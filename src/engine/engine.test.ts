import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  calculateAdjustedPersonalAllowance,
  calculateCapitalAllowances2526,
  calculateCarAndFuelBenefit,
  calculateChattelGain,
  calculateCorporationTax,
  calculateIncomeTax2526,
  calculateNic2526,
  evaluateArithmeticExpression,
  generateTrapVariant,
} from './taxCalculators';
import { auditEasyMarks, coachCbePresentation, gradeQuestion, scoreKeywords } from './scoring';
import {
  categorizeTrapLedger,
  computeExamPredictions,
  computeStudyPlanDays,
  computeTaxHeadSummaries,
  createInitialAppState,
  getDueMistakes,
  getRecommendedNextAction,
  parseImportedState,
  recordAttemptAndUpdateState,
  serializeStateForExport,
} from './mastery';
import {
  buildDeterministicMistakeDiagnosis,
  buildMistakeDiagnosisPayload,
  parseAndValidateDrillResponse,
} from './mistakeCoach';
import { formatMarkSchemeLabel, parseScenarioSegments, parseWorkedSolutionBlocks } from './workedSolutionParser';
import { TOPICS, CONFUSION_CLINIC_PAIRS } from '../data/taxReference';
import { FA25_REVISION_MODULES, FA25_TIME_LIMIT_GROUPS } from '../data/fa25RevisionHub';
import type { CaseSubQuestion, KitQuestion, MatrixOptions, McqOption, PairDropdownGroup } from '../types/tx';

const questions: KitQuestion[] = JSON.parse(
  fs.readFileSync(path.resolve('src/data/questions.json'), 'utf8')
);
const specimen: KitQuestion[] = JSON.parse(
  fs.readFileSync(path.resolve('src/data/specimen.json'), 'utf8')
);

test('Specimen Q3 Martin Personal Allowance with gross Gift Aid matches £7,420', () => {
  const res = calculateAdjustedPersonalAllowance(111_100, 800, 0);
  assert.equal(res.ani, 110_300);
  assert.equal(res.personalAllowance, 7_420);
});

test('Specimen Q31 Sarah Incorporation Income Tax & NIC matches £4,317 + £1,394 + £3,750 + £3,088 CT', () => {
  const it = calculateIncomeTax2526({ nonSavings: 30_000, dividends: 10_000 });
  assert.equal(it.liability, 4_317);
  const nic = calculateNic2526({ employeeCashEarnings: 30_000 });
  assert.equal(nic.class1Employee, 1_394);
  assert.equal(nic.class1Employer, 3_750);
  const ct = calculateCorporationTax({ ttp: 50_000 - 30_000 - 3_750 });
  assert.equal(ct.corporationTax, 3_088);
});

test('Specimen Q1 William Class 4 NIC on £82,700 (ignoring pension) matches £2,911', () => {
  const nic = calculateNic2526({ selfEmployedTradingProfit: 82_700 });
  assert.equal(nic.class4, 2_911);
});

test('Specimen Q7 Antique table chattels 5/3 cap matches £4,500', () => {
  const cgt = calculateChattelGain(8_700, 3_800);
  assert.equal(cgt.chargeableGain, 4_500);
});

test('Company Car & Fuel benefit ignores partial fuel contribution & caps RDE2', () => {
  const res = calculateCarAndFuelBenefit({
    listPrice: 36_000,
    co2: 152, // rounds down to 150 -> 17 + 19 = 36%
    fuelType: 'diesel_rde2',
    monthsAvailable: 11,
    privateFuelProvided: true,
    privateFuelEmployeeReimbursedPartial: 500,
  });
  assert.equal(res.percentage, 36);
  assert.equal(res.carBenefit, Math.round(36_000 * 0.36 * (11 / 12)));
  assert.equal(res.fuelBenefit, Math.round(28_200 * 0.36 * (11 / 12)));
});

test('Deterministic Tier-4 Trap Variants rotate correct option across A/B/C/D and grade accurately for IT, Prop, Cars, Pensions, CAs, Losses, NIC, CT, CGT, IHT & VAT', () => {
  const seenCorrectLetters = new Set<string>();
  for (const tid of [2, 4, 5, 6, 8, 10, 11, 13, 17, 22, 23]) {
    for (const seed of [0, 1, 2]) {
      const v = generateTrapVariant(tid, seed);
      assert.equal(v.is_variant, true, `Topic ${tid} should flag is_variant`);
      const opts = v.options as McqOption[];
      assert.equal(opts.length, 4, `Topic ${tid} should have 4 options`);
      assert.equal(new Set(opts.map((o) => o.text)).size, 4, `Topic ${tid} seed ${seed} should have 4 distinct options`);
      seenCorrectLetters.add(String(v.correct_answer));

      const gradedRight = gradeQuestion(v, String(v.correct_answer));
      assert.equal(gradedRight.isFullyCorrect, true, `Topic ${tid} seed ${seed} should grade ${v.correct_answer} as 100%`);
      assert.equal(gradedRight.marksScored, 2);

      const wrongOpt = opts.find((o) => o.key !== String(v.correct_answer))!;
      assert.equal(gradeQuestion(v, wrongOpt.key).marksScored, 0);
    }
  }
  assert.ok(seenCorrectLetters.size >= 3, `Expected rotated answers across A/B/C/D, got ${[...seenCorrectLetters].join(',')}`);
});

test('Default profile targets 8 December 2026 exam and questions.json has all 306 Kit + 100m Specimen', () => {
  const initState = createInitialAppState();
  assert.equal(initState.profile.examDate, '2026-12-08');
  assert.equal(questions.length, 306);
  const specTotal = specimen.reduce((s, q) => s + q.marks, 0);
  assert.equal(specTotal, 100);
});

test('Auto-grading handles MCQ, Matrix, Number, and 5-OT Section B Case (Q93)', () => {
  const q3 = questions.find((q) => q.id === 'Q3')!;
  assert.equal(gradeQuestion(q3, 'C').marksScored, 2);
  assert.equal(gradeQuestion(q3, 'A').marksScored, 0);

  const q1 = questions.find((q) => q.id === 'Q1')!;
  const q1Good = gradeQuestion(q1, q1.correct_answer);
  assert.equal(q1Good.isFullyCorrect, true);

  const q93 = questions.find((q) => q.id === 'Q93')!;
  const q93Partial = gradeQuestion(q93, ['A', 'B', '3505', 'D', {}]);
  assert.equal(q93Partial.marksScored, 6);
  assert.equal(q93Partial.marksAvailable, 10);
});

test('Mastery, SRS 1/3/7d scheduling, and 2nd-offence Trap Micro-Drill trigger work', () => {
  let state = createInitialAppState('2026-09-07');
  const q27 = questions.find((q) => q.id === 'Q27')!;
  const q28 = questions.find((q) => q.id === 'Q28')!;

  // First wrong answer in Employment Income
  const r1 = recordAttemptAndUpdateState(state, {
    question: q27,
    tier: 2,
    marksScored: 0,
    marksAvailable: 2,
    freeMarksCaptured: 0,
    freeMarksTotal: 0,
    userAnswerSummary: 'A',
    correctAnswerSummary: String(q27.correct_answer),
    elapsedSeconds: 90,
    nowIso: '2026-05-01T10:00:00.000Z',
  });
  state = r1.nextState;
  assert.equal(r1.microDrillTriggeredCategory, null);
  assert.equal(state.mistakes.length, 1);
  // Check +1 day SRS due date
  assert.equal(state.mistakes[0].nextReviewIso.slice(0, 10), '2026-05-02');
  assert.equal(getDueMistakes(state.mistakes, '2026-05-02T12:00:00.000Z').length, 1);

  // Second wrong answer in same trap category triggers rapid 2-question micro-drill
  const r2 = recordAttemptAndUpdateState(state, {
    question: q28,
    tier: 2,
    marksScored: 0,
    marksAvailable: 2,
    freeMarksCaptured: 0,
    freeMarksTotal: 0,
    userAnswerSummary: 'B',
    correctAnswerSummary: String(q28.correct_answer),
    elapsedSeconds: 100,
    nowIso: '2026-05-01T10:05:00.000Z',
  });
  state = r2.nextState;
  assert.ok(r2.microDrillTriggeredCategory);
  assert.equal(state.trapLedger[q27.examiner_debrief.trap_category].microDrillRequired, true);

  // Answering Q27 right advances SRS stage from 0 (+1d) to 1 (+3d)
  const r3 = recordAttemptAndUpdateState(state, {
    question: q27,
    tier: 2,
    marksScored: 2,
    marksAvailable: 2,
    freeMarksCaptured: 0,
    freeMarksTotal: 0,
    userAnswerSummary: String(q27.correct_answer),
    correctAnswerSummary: String(q27.correct_answer),
    elapsedSeconds: 70,
    nowIso: '2026-05-02T10:00:00.000Z',
  });
  const m27 = r3.nextState.mistakes.find((m) => m.questionId === 'Q27')!;
  assert.equal(m27.srsStage, 1);
  assert.equal(m27.nextReviewIso.slice(0, 10), '2026-05-05');
});

test('CBE Presentation Coach & Keyword Matcher & Countdown Plan work accurately', () => {
  const sampleCr = `Sheldon - Income Tax 2025/26\nEmployment income (W1)   162,078\nGym benefit              0\nLess: PAYE               (60,560)\nPayable by 31 January 2027`;
  const q101 = questions.find((q) => q.id === 'Q101')!;
  const easy = auditEasyMarks(sampleCr, q101);
  assert.ok(easy.capturedCount >= 3);

  const cbe = coachCbePresentation(sampleCr);
  assert.ok(cbe.scoreOutOf100 >= 75);

  const kw = scoreKeywords('Use integrated software and HMRC software for small affairs', ['integrated software', 'HMRC software', 'tagging service'], 3);
  assert.equal(kw.matched.length, 2);
  assert.equal(kw.suggestedMarks, 2);

  const state = createInitialAppState('2026-11-25');
  const plan = computeStudyPlanDays(state.profile, state, new Date('2026-11-16T00:00:00Z'));
  assert.equal(plan.isCountdown, true);
  assert.ok(computeExamPredictions(state).length === 24);

  const exported = serializeStateForExport(state);
  const reimported = parseImportedState(exported);
  assert.equal(reimported.ok, true);
});

test('Every non-CR Kit & Specimen item grades to 100% with its extracted correct_answer', () => {
  for (const q of [...questions, ...specimen]) {
    if (q.type === 'cr') continue;
    const res = gradeQuestion(q, q.correct_answer);
    assert.equal(res.isFullyCorrect, true, `Expected ${q.id} to self-grade 100%`);
    assert.equal(res.marksScored, q.marks, `Expected ${q.id} to earn full ${q.marks} marks`);
  }
});

test('Safe CBE arithmetic expression evaluator handles %, brackets, commas, and division by zero', () => {
  const car = evaluateArithmeticExpression('36,000 * 36% * 11 / 12');
  assert.equal(car.ok, true);
  if (car.ok) assert.equal(car.rounded, 11_880);

  const mr = evaluateArithmeticExpression('(250000 - 190000) * (160000 / 190000) * 3 / 200');
  assert.equal(mr.ok, true);
  if (mr.ok) assert.equal(mr.rounded, 758);

  const divZero = evaluateArithmeticExpression('100 / (5 - 5)');
  assert.equal(divZero.ok, false);
});

test('CBE Presentation Checker flags missing labels, unbracketed negatives, short dates, and BODMAS', () => {
  const q101 = questions.find((q) => q.id === 'Q101')!;
  const sloppyCr = [
    'Salary 80000 + 72000 / 2',
    'Allowance -12570',
    'Balance due 31 Jan',
  ].join('\n');

  const sloppyReport = coachCbePresentation(sloppyCr, q101);
  const riskIds = sloppyReport.findings.filter((f) => f.status === 'risk').map((f) => f.id);
  assert.ok(riskIds.includes('heading'), 'Should flag missing computation heading');
  assert.ok(riskIds.includes('negatives'), 'Should flag unbracketed -12570');
  assert.ok(riskIds.includes('dates'), 'Should flag 31 Jan without 4-digit calendar year');
  assert.ok(riskIds.includes('workings'), 'Should flag missing (W1)');
  assert.ok(riskIds.includes('zeros'), 'Should flag missing explicit 0');
  assert.ok(riskIds.includes('bodmas'), 'Should flag unbracketed + / BODMAS math');

  const cleanCr = [
    'Sheldon — 2025/26 Income Tax Computation',
    'Employment income (W1): 162,078',
    'Exempt gym benefit: 0',
    'Less: Personal Allowance: (12,570)',
    'Less: PAYE deducted: (60,560)',
    'Balancing payment due: 31 January 2027',
  ].join('\n');
  const cleanReport = coachCbePresentation(cleanCr, q101);
  assert.equal(cleanReport.scoreOutOf100, 100);
  assert.equal(cleanReport.markerRisks.length, 0);
});

test('categorizeTrapLedger groups traps into critical (3+), repeat (2), single (1), and immune buckets', () => {
  const result = categorizeTrapLedger({
    'Employment & Cars': {
      trapCategory: 'Employment & Cars',
      ruleSummary: 'RDE2 diesel 4% exemption',
      hitCount: 3,
      avoidedCount: 1,
      questionIds: ['Q27', 'Q28', 'Q29'],
      lastHitIso: '2026-05-01T10:00:00.000Z',
      microDrillRequired: true,
    },
    'PA Taper & ANI': {
      trapCategory: 'PA Taper & ANI',
      ruleSummary: 'Gross up Gift Aid by 100/80',
      hitCount: 2,
      avoidedCount: 0,
      questionIds: ['Q3', 'Q4'],
      lastHitIso: '2026-05-02T10:00:00.000Z',
      microDrillRequired: true,
    },
    'VAT Flat Rate & Cash': {
      trapCategory: 'VAT Flat Rate & Cash',
      ruleSummary: 'Apply FRS % to VAT-inclusive turnover',
      hitCount: 1,
      avoidedCount: 2,
      questionIds: ['Q275'],
      lastHitIso: '2026-05-03T10:00:00.000Z',
      microDrillRequired: false,
    },
    'IHT 7-Year Cumulation': {
      trapCategory: 'IHT 7-Year Cumulation',
      ruleSummary: 'Apply AE CY then prior year b/f',
      hitCount: 0,
      avoidedCount: 4,
      questionIds: [],
      lastHitIso: '2026-05-04T10:00:00.000Z',
      microDrillRequired: false,
    },
  });

  assert.equal(result.totalHits, 6);
  assert.equal(result.totalAvoided, 7);
  assert.equal(result.repeatOffenceCategories, 2);
  assert.equal(result.buckets[0].entries.length, 1);
  assert.equal(result.buckets[0].entries[0].trapCategory, 'Employment & Cars');
  assert.equal(result.buckets[1].entries[0].trapCategory, 'PA Taper & ANI');
  assert.equal(result.buckets[2].entries[0].trapCategory, 'VAT Flat Rate & Cash');
  assert.equal(result.buckets[3].entries[0].trapCategory, 'IHT 7-Year Cumulation');
});

test('All 306 Kit + 21 Specimen items pass structural integrity, matrix/dropdown validity, CR mark sums & canonical debrief hygiene', () => {
  const bank = [...questions, ...specimen];
  const checkMatrix = (id: string, mat: MatrixOptions, ans: Record<string, string[]>) => {
    assert.equal(new Set(mat.columns).size, mat.columns.length, `${id}: duplicate matrix columns`);
    for (const col of mat.columns) {
      assert.ok(col !== 'Not' && col !== 'True False' && !(col.includes('Neither type') && col !== 'Neither type'), `${id}: truncated/merged matrix header "${col}"`);
    }
    assert.equal(Object.keys(ans).length, mat.rows.length, `${id}: matrix answer row count mismatch`);
    let totalSelected = 0;
    for (let r = 0; r < mat.rows.length; r++) {
      const vals = ans[String(r)] ?? [];
      totalSelected += vals.length;
      for (const v of vals) {
        assert.ok(mat.columns.includes(v), `${id}: matrix answer "${v}" missing from columns`);
      }
    }
    assert.ok(totalSelected >= 1, `${id}: matrix has zero selected cells across all rows`);
  };

  const checkPairDropdown = (id: string, groups: PairDropdownGroup[], ans: string[]) => {
    assert.equal(ans.length, groups.length, `${id}: pair_dropdown answer length mismatch`);
    groups.forEach((g, idx) => {
      assert.ok(g.choices.includes(ans[idx]), `${id}: dropdown answer "${ans[idx]}" missing from choices`);
      for (const c of g.choices) {
        assert.ok(!/\bAND\s+£|\bWITH GROUP ASPECTS\b/.test(c), `${id}: artifact leaked into choice "${c}"`);
      }
    });
  };

  const countsByTopic: Record<number, number> = {};
  for (const q of bank) {
    countsByTopic[q.topic_id] = (countsByTopic[q.topic_id] ?? 0) + 1;
    assert.equal(q.title, q.title.trim(), `${q.id}: untrimmed whitespace in title`);
    assert.ok(!/\|\s*$/.test(q.title), `${q.id}: trailing pipe artifact in title "${q.title}"`);
    assert.ok(q.full_worked_solution.trim().length >= 15, `${q.id}: worked solution too short`);
    assert.ok(!/Walk in the footsteps|W alk in the footsteps/i.test(q.examiner_debrief.trap_of_question), `${q.id}: noisy tutor boilerplate in trap_of_question`);
    assert.ok(!/[\uF000-\uF0FF]/.test(q.examiner_debrief.trap_of_question + q.examiner_debrief.examiner_playbook + q.examiner_debrief.distractor_forensics), `${q.id}: Wingdings/PUA glyph leaked into examiner_debrief`);
    assert.ok(!/[\uE000-\uF8FF]/.test(JSON.stringify(q)), `${q.id}: PUA/Wingdings glyph leaked into question payload`);
    assert.ok(!/\b(?:which is|as follows)\s*$/i.test(q.examiner_debrief.trap_of_question) && !/:\s*$/.test(q.examiner_debrief.trap_of_question), `${q.id}: dangling incomplete ending in trap_of_question`);
    assert.ok(!/Walk in the footsteps/i.test(q.title), `${q.id}: tutor banner leaked into title`);
    assert.ok(!q.scenario.trim() || !/^[a-z]/.test(q.scenario.trim()), `${q.id}: scenario begins mid-sentence with lowercase`);
    const reqTrim = q.requirement.trim();
    assert.ok(reqTrim.length >= 10 && reqTrim !== '00' && !/^(?:ended 31|forward\?|202\d\/\d{2}\?)/i.test(reqTrim), `${q.id}: broken or split requirement "${reqTrim}"`);
    assert.ok(!/^[A-Z0-9\s,&–-]{12,}$/.test(reqTrim), `${q.id}: requirement is an all-caps heading "${reqTrim}"`);
    if (q.type !== 'cr') {
      assert.ok(!reqTrim.includes('|'), `${q.id}: non-CR requirement still contains raw pipe table "${reqTrim}"`);
    }

    if (q.examiner_debrief.trap_category === 'UK Residence') {
      assert.ok(q.topic_id === 3 || q.id === 'SPEC-Q15', `${q.id}: spurious UK Residence trap_category on topic ${q.topic_id}`);
    }
    if (q.topic_id >= 23) assert.equal(q.examiner_debrief.trap_category, 'VAT Compliance & FRS', `${q.id}: VAT must map to VAT Compliance & FRS`);
    if (q.topic_id === 22) assert.equal(q.examiner_debrief.trap_category, 'Inheritance Tax', `${q.id}: IHT must map to Inheritance Tax`);
    if (q.topic_id >= 17 && q.topic_id <= 21) assert.equal(q.examiner_debrief.trap_category, 'CGT Losses & Matching', `${q.id}: CGT must map to CGT Losses & Matching`);
    if (q.topic_id === 12) assert.equal(q.examiner_debrief.trap_category, 'SA Tax Admin & Records', `${q.id}: T12 must map to SA Tax Admin & Records`);
    if (q.topic_id >= 13 && q.topic_id <= 16) {
      assert.ok(
        ['Corporation Tax', 'Company Losses', 'Groups of Companies', 'Company Tax Admin', 'Capital Allowances'].includes(q.examiner_debrief.trap_category),
        `${q.id}: CT topic ${q.topic_id} mistagged as ${q.examiner_debrief.trap_category}`
      );
    }

    if (q.type === 'cr') {
      const sumSteps = q.mark_scheme_steps.reduce((s, st) => s + st.marks, 0);
      assert.ok(Math.abs(sumSteps - q.marks) <= 0.5, `${q.id}: CR mark_scheme_steps sum ${sumSteps} != ${q.marks}`);
    } else if (q.type === 'case') {
      const subs = q.options as CaseSubQuestion[];
      assert.equal(subs.length, 5, `${q.id}: case must have 5 sub-questions`);
      subs.forEach((sq) => {
        if (sq.interaction === 'matrix') {
          checkMatrix(`${q.id}#${sq.sub_num}`, sq.options as MatrixOptions, sq.correct_answer as Record<string, string[]>);
        } else if (sq.interaction === 'pair_dropdown') {
          checkPairDropdown(`${q.id}#${sq.sub_num}`, sq.options as PairDropdownGroup[], sq.correct_answer as string[]);
        } else if (sq.interaction === 'grid_2x2') {
          for (const opt of sq.options as McqOption[]) {
            assert.ok(!/Col\s*1|Chargeable gain\s*\/|Allowable cost\s*\//.test(opt.text), `${q.id}#${sq.sub_num}: grid header leak "${opt.text}"`);
          }
        }
      });
    } else if (q.interaction === 'matrix') {
      checkMatrix(q.id, q.options as MatrixOptions, q.correct_answer as Record<string, string[]>);
    } else if (q.interaction === 'pair_dropdown') {
      checkPairDropdown(q.id, q.options as PairDropdownGroup[], q.correct_answer as string[]);
    } else if (q.interaction === 'grid_2x2') {
      for (const opt of q.options as McqOption[]) {
        assert.ok(!/Col\s*1|Chargeable gain\s*\/|Allowable cost\s*\//.test(opt.text), `${q.id}: grid header leak "${opt.text}"`);
      }
    }
  }

  for (const t of TOPICS) {
    assert.equal(t.extractedCount, countsByTopic[t.id] ?? 0, `Topic ${t.id} extractedCount out of sync`);
    for (const rule of [...t.phase1.coreRules, ...t.phase1.proformaLines]) {
      assert.ok(!/\bWait:|verify per ST|\?\s*Note/i.test(rule), `Topic ${t.id} contains draft note: ${rule}`);
    }
  }
  for (const pair of CONFUSION_CLINIC_PAIRS) {
    for (const sc of pair.scenarios) {
      assert.ok(!/\bWait\b/i.test(sc.explanation), `Confusion pair ${pair.id} contains draft Wait wording`);
    }
  }
});

test('computeTaxHeadSummaries covers all 24 topics and getRecommendedNextAction prioritises traps then SRS', () => {
  const initState = createInitialAppState();
  const heads = computeTaxHeadSummaries(initState);
  assert.equal(heads.length, 6);
  assert.equal(heads.reduce((s, h) => s + h.topicsCount, 0), 24);
  assert.equal(heads.reduce((s, h) => s + h.questionCount, 0), 327);

  const initialRec = getRecommendedNextAction(initState);
  assert.equal(initialRec.kind, 'weak_topic');

  const q27 = questions.find((q) => q.id === 'Q27')!;
  const s1 = recordAttemptAndUpdateState(initState, {
    question: q27,
    tier: 2,
    marksScored: 0,
    marksAvailable: 2,
    freeMarksCaptured: 0,
    freeMarksTotal: 0,
    userAnswerSummary: 'A',
    correctAnswerSummary: 'B',
    elapsedSeconds: 45,
  }).nextState;

  const afterOneMiss = getRecommendedNextAction(s1, new Date(Date.now() + 2 * 86400_000).toISOString());
  assert.equal(afterOneMiss.kind, 'srs');

  const s2 = recordAttemptAndUpdateState(s1, {
    question: q27,
    tier: 2,
    marksScored: 0,
    marksAvailable: 2,
    freeMarksCaptured: 0,
    freeMarksTotal: 0,
    userAnswerSummary: 'A',
    correctAnswerSummary: 'B',
    elapsedSeconds: 45,
  }).nextState;
  const afterTwoHits = getRecommendedNextAction(s2);
  assert.equal(afterTwoHits.kind, 'micro_drill');
});

test('Mistake Bank AI Coach helpers build payloads, offline FA25 diagnoses, and validate drill JSON', () => {
  const emptyReport = buildDeterministicMistakeDiagnosis([], {});
  assert.equal(emptyReport.source, 'deterministic');
  assert.equal(emptyReport.rootCauses.length, 0);

  let state = createInitialAppState('2026-12-08');
  const q27 = questions.find((q) => q.id === 'Q27')!;
  const q28 = questions.find((q) => q.id === 'Q28')!;
  state = recordAttemptAndUpdateState(state, {
    question: q27,
    tier: 2,
    marksScored: 0,
    marksAvailable: 2,
    freeMarksCaptured: 0,
    freeMarksTotal: 0,
    userAnswerSummary: 'A',
    correctAnswerSummary: String(q27.correct_answer),
    elapsedSeconds: 80,
    nowIso: '2026-05-10T10:00:00.000Z',
  }).nextState;
  state = recordAttemptAndUpdateState(state, {
    question: q28,
    tier: 2,
    marksScored: 0,
    marksAvailable: 2,
    freeMarksCaptured: 0,
    freeMarksTotal: 0,
    userAnswerSummary: 'B',
    correctAnswerSummary: String(q28.correct_answer),
    elapsedSeconds: 85,
    nowIso: '2026-05-10T10:05:00.000Z',
  }).nextState;

  const payload = buildMistakeDiagnosisPayload(state.mistakes, state.trapLedger);
  assert.equal(payload.recentMistakes.length, 2);
  assert.ok(payload.topTraps.length >= 1);

  const report = buildDeterministicMistakeDiagnosis(state.mistakes, state.trapLedger);
  assert.equal(report.source, 'deterministic');
  assert.ok(report.rootCauses.length >= 1);
  assert.ok(report.priorityOrder.length >= 1);
  assert.ok(report.examDayRule.length > 10);

  const fencedJson = [
    '```json',
    JSON.stringify({
      stem: 'A taxpayer has a petrol company car with list price £25,000 and CO2 emissions of 112 g/km for 2025/26.',
      requirement: 'Calculate the taxable car benefit.',
      options: [
        { key: 'A', text: '£6,500' },
        { key: 'B', text: '£6,750' },
        { key: 'C', text: '£7,000' },
        { key: 'D', text: '£7,250' },
      ],
      correctKey: 'b',
      explanation: '112 rounds down to 110 -> 17% + ((110-55)/5) = 27%; 27% x £25,000 = £6,750.',
    }),
    '```',
  ].join('\n');

  const parsedDrill = parseAndValidateDrillResponse(fencedJson);
  assert.equal(parsedDrill.source, 'gemini');
  assert.equal(parsedDrill.correctKey, 'B');
  assert.equal(parsedDrill.options.length, 4);

  assert.throws(
    () =>
      parseAndValidateDrillResponse(
        JSON.stringify({
          stem: 'Missing option test',
          requirement: 'Pick one',
          options: [{ key: 'A', text: '£100' }],
          correctKey: 'Z',
        })
      ),
    /Invalid drill structure|Invalid correctKey/
  );
});

test('parseWorkedSolutionBlocks separates headings, aligned proforma tables with subtotal rules, and prose', () => {
  const sample = [
    'Requirement (a)',
    '£',
    'Salary | 30,000',
    'Less: Personal allowance | (12,570)',
    '––––––',
    'Taxable income | 17,430',
    '––––––',
    'Tutorial note',
    'Personal allowance is reduced when adjusted net income exceeds £100,000.',
    'Working 1 – Car benefit',
    'CO2 emissions round down to the nearest 5 g/km.',
    'Examiner’s report',
    'Candidates often forgot to apply the Diesel supplement.',
  ].join('\n');

  const blocks = parseWorkedSolutionBlocks(sample);
  assert.equal(blocks[0].type, 'heading');
  assert.equal(blocks[1].type, 'table');
  if (blocks[1].type === 'table') {
    assert.equal(blocks[1].rows.length, 4);
    assert.deepEqual(blocks[1].rows[1].cells, ['Salary', '30,000']);
    assert.equal(blocks[1].rows[2].ruleBelow, true);
    assert.equal(blocks[1].rows[3].ruleBelow, true);
  }
  assert.deepEqual(blocks[2], { type: 'heading', text: 'Tutorial note' });
  assert.equal(blocks[3].type, 'paragraph');
  assert.deepEqual(blocks[4], { type: 'heading', text: 'Working 1 – Car benefit' });
  assert.equal(blocks[5].type, 'paragraph');
  assert.deepEqual(blocks[6], { type: 'heading', text: 'Examiner’s report' });
  assert.equal(blocks[7].type, 'paragraph');

  // Pipe-delimited dash rules across columns become borders rather than literal dash text rows
  const pipeDashBlocks = parseWorkedSolutionBlocks(
    'Pension income | 15,000 | 15,000\n------ | ------ | ------\nTotal income | 15,000 | 15,000'
  );
  assert.equal(pipeDashBlocks.length, 1);
  if (pipeDashBlocks[0].type === 'table') {
    assert.equal(pipeDashBlocks[0].rows.length, 2);
    assert.equal(pipeDashBlocks[0].rows[0].ruleBelow, true);
    assert.equal(pipeDashBlocks[0].rows[1].cells[0], 'Total income');
  }

  assert.equal(
    formatMarkSchemeLabel('OT 5: Correct answer ({"0":["True"],"1":["False"],"2":["False"],"3":["True"]})'),
    'OT 5: Correct answer (Row 1: True · Row 2: False · Row 3: False · Row 4: True)'
  );
  assert.equal(
    formatMarkSchemeLabel('OT 2: Correct answer (["£0","£0","£990"])'),
    'OT 2: Correct answer (£0 · £0 · £990)'
  );
  assert.equal(formatMarkSchemeLabel('OT 1: Correct answer (A)'), 'OT 1: Correct answer (A)');

  // Tutor footer banners are stripped cleanly and % units + footnote digits behave properly
  const q27Like = parseWorkedSolutionBlocks(
    'PHILIP AND CHARLES (ADAPTED)  |  Walk in the footsteps of a top tutor\n%\nDiesel (RDE2) | 17\n1\nPlus: (150 - 55) / 5 | 19\n---\nAppropriate percentage | 36'
  );
  assert.equal(q27Like.length, 1);
  if (q27Like[0].type === 'table') {
    assert.deepEqual(q27Like[0].rows[0].cells, ['', '%']);
    assert.ok(!q27Like[0].rows.some((r) => r.cells[0] === 'Total' && r.cells[1] === '1'));
  }
});

test('Regression: repaired bank prompts & parseScenarioSegments unify £/dash exhibits and numbered notes', () => {
  const bank = [...questions, ...specimen];
  const q251 = bank.find((q) => q.id === 'Q251')!;
  assert.ok(q251.requirement.includes('corporation tax'), 'Q251 requirement should contain question prompt');

  const q297 = bank.find((q) => q.id === 'Q297')!;
  const q297Ot5 = (q297.options as CaseSubQuestion[]).find((sq) => sq.sub_num === 5)!;
  assert.ok(q297Ot5.prompt.startsWith('What is the amount of input VAT'), 'Q297 OT5 should have full restored opening');

  const q162 = bank.find((q) => q.id === 'Q162')!;
  const q162Ot2 = (q162.options as CaseSubQuestion[]).find((sq) => sq.sub_num === 2)!;
  assert.ok(!q162Ot2.prompt.includes('|'), 'Q162 OT2 should not contain stray pipe artifact');

  const exhibitSegs = parseScenarioSegments([
    'Year ended 31 March 2026',
    '£',
    'Trading profit | 100,000',
    'Less: Loss b/f | (20,000)',
    '–––––––',
    'Taxable total profits | 80,000',
    '–––––––',
  ].join('\n'));
  assert.equal(exhibitSegs.length, 2);
  assert.equal(exhibitSegs[0].type, 'prose');
  assert.equal(exhibitSegs[1].type, 'table');
  if (exhibitSegs[1].type === 'table') {
    assert.deepEqual(exhibitSegs[1].rows[0].cells, ['£']);
    assert.equal(exhibitSegs[1].rows[2].ruleBelow, true);
    assert.equal(exhibitSegs[1].rows[3].ruleBelow, true);
  }

  const noteSegs = parseScenarioSegments(
    '1 | During the tax year 2025/26, Simon was paid a gross annual salary of £24,700.\n2 | He received a car.'
  );
  assert.equal(noteSegs.length, 1);
  assert.equal(noteSegs[0].type, 'table');
  if (noteSegs[0].type === 'table') {
    assert.equal(noteSegs[0].rows.length, 2);
    assert.equal(noteSegs[0].rows[0].cells[0], '1');
  }
});

test('FA25 Revision Hub modules & statutory time limits include complete rates, matrices, examples & clean copy', () => {
  assert.equal(FA25_REVISION_MODULES.length, 9);
  const validTopicIds = new Set(TOPICS.map((t) => t.id));
  for (const mod of FA25_REVISION_MODULES) {
    assert.ok(validTopicIds.has(mod.relatedTopicId), `${mod.id}: invalid relatedTopicId ${mod.relatedTopicId}`);
    assert.ok(mod.rates.length >= 4, `${mod.id}: needs detailed rates/thresholds`);
    assert.ok(mod.workedExamples.length >= 1, `${mod.id}: must include worked numerical example`);
    assert.ok(mod.examTraps.length >= 2, `${mod.id}: must include examiner traps`);
    for (const ex of mod.workedExamples) {
      assert.ok(ex.steps.length >= 3, `${ex.title}: needs step-by-step workings`);
      assert.ok(ex.answer.trim().length > 4, `${ex.title}: missing numerical answer`);
      assert.ok(!/\bWait:|verify per ST/i.test(JSON.stringify(ex)), `${ex.title}: draft text found`);
    }
  }

  const resMod = FA25_REVISION_MODULES.find((m) => m.id === 'residence-benefits')!;
  assert.equal(resMod.matrices?.[0].rows.length, 6, 'Residence Status table must have all 6 day brackets');

  const vatMod = FA25_REVISION_MODULES.find((m) => m.id === 'vat-penalties')!;
  assert.equal(vatMod.matrices?.[0].rows.length, 3, 'Error Penalties table must have all 3 behaviour tiers');

  assert.equal(FA25_TIME_LIMIT_GROUPS.length, 3);
  const allDeadlines = FA25_TIME_LIMIT_GROUPS.flatMap((g) => g.items);
  assert.ok(allDeadlines.length >= 18);
  assert.ok(allDeadlines.some((d) => d.example2526.includes('4y Normal')));
});

test('calculateCapitalAllowances2526 handles 9m short AP, 50% SRP FYA (no same-year WDA), Full Expensing & Sole Trader small pools', () => {
  // Company 9m short AP: £750k prorated AIA on £800k SRP -> £50k excess gets £25k unprorated 50% FYA; deferred £25k earns 0 same-year WDA.
  // Main pool b/f £40,000 -> £40k * 18% * 9/12 = £5,400. Petrol car >50g (£18,000) -> £18k * 6% * 9/12 = £810.
  const co9m = calculateCapitalAllowances2526({
    isCompany: true,
    months: 9,
    mainPoolBf: 40_000,
    specialRateAddition: 800_000,
    mainPoolAddition: 0,
    carCost: 18_000,
    carTier: 'over_50g',
  });
  assert.equal(co9m.aiaLimit, 750_000);
  assert.equal(co9m.aiaClaimed, 750_000);
  assert.equal(co9m.srpFya50, 25_000);
  assert.equal(co9m.mainWda, 5_400);
  assert.equal(co9m.srpWda, 810);
  assert.equal(co9m.totalAllowances, 781_210);
  assert.equal(co9m.srpCf, 42_190);

  // Company 12m: AIA covers first £1,000,000, Full Expensing 100% covers remaining £100,000 new main P&M + 100% FYA on new 0g car
  const coFe = calculateCapitalAllowances2526({
    isCompany: true,
    months: 12,
    mainPoolBf: 0,
    specialRateAddition: 0,
    mainPoolAddition: 1_100_000,
    carCost: 30_000,
    carTier: 'new_0g',
  });
  assert.equal(coFe.aiaClaimed, 1_000_000);
  assert.equal(coFe.mainFullExpensing, 100_000);
  assert.equal(coFe.carFya100, 30_000);
  assert.equal(coFe.totalAllowances, 1_130_000);

  // Sole Trader 12m: No FE / no 50% FYA; Main pool £900 qualifies for £1,000 Small Pools full write-off
  const sole = calculateCapitalAllowances2526({
    isCompany: false,
    months: 12,
    mainPoolBf: 900,
    specialRateAddition: 1_050_000,
    mainPoolAddition: 0,
    carCost: 0,
    carTier: 'new_0g',
  });
  assert.equal(sole.srpFya50, 0);
  assert.equal(sole.aiaClaimed, 1_000_000);
  assert.equal(sole.mainSmallWriteOff, true);
  assert.equal(sole.mainWda, 900);
  assert.equal(sole.mainCf, 0);
  assert.equal(sole.srpWda, 3_000); // 6% * £50,000 excess
});


