import { TOPICS } from '../data/taxReference';
import type {
  AppState,
  AttemptRecord,
  KitQuestion,
  MistakeEntry,
  RagStatus,
  TopicProgress,
  TrapLedgerEntry,
  UserProfile,
} from '../types/tx';

export const STORAGE_KEY = 'tx_mastercoach_state_v1';

export function addDaysIso(isoDate: string, days: number): string {
  const d = new Date(isoDate);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString();
}

export function createInitialTopicProgress(): Record<number, TopicProgress> {
  const map: Record<number, TopicProgress> = {};
  for (const t of TOPICS) {
    map[t.id] = {
      topicId: t.id,
      attempts: 0,
      marksScored: 0,
      marksAvailable: 0,
      mastery: 0,
      rag: 'unstarted',
      tierUnlocked: 1,
      consecutiveCleanPasses: 0,
      tier3Passed: false,
      lastPracticedIso: null,
    };
  }
  return map;
}

export function createInitialAppState(defaultExamDate = '2026-12-08'): AppState {
  return {
    version: 1,
    profile: {
      examDate: defaultExamDate,
      attemptType: 'first',
      hoursPerWeek: 8,
      preferredSectionOrder: 'A-B-C',
      onboarded: false,
    },
    streakDays: 0,
    lastStudyDate: null,
    topicProgress: createInitialTopicProgress(),
    attempts: [],
    mistakes: [],
    trapLedger: {},
    memoryStates: {},
    mockHistory: [],
    studyTextLoaded: false,
    studyTextName: null,
  };
}

export function computeRagStatus(mastery: number, attempts: number, tier3Passed: boolean): RagStatus {
  if (attempts === 0) return 'unstarted';
  if (mastery >= 80 && tier3Passed) return 'green';
  if (mastery >= 50) return 'amber';
  return 'red';
}

export function computeTopicMasteryFromAttempts(attempts: AttemptRecord[]): {
  mastery: number;
  tier3Passed: boolean;
} {
  if (attempts.length === 0) return { mastery: 0, tier3Passed: false };
  // Weight Tier 3 and Tier 4 higher (1.5x / 1.75x) per TX Mastercoach Mastery spec
  let weightedScored = 0;
  let weightedAvailable = 0;
  let tier3Passed = false;
  for (const a of attempts) {
    const w = a.tier === 4 ? 1.75 : a.tier === 3 ? 1.5 : a.tier === 2 ? 1.15 : 1.0;
    weightedScored += a.marksScored * w;
    weightedAvailable += a.marksAvailable * w;
    if ((a.tier === 3 || a.tier === 4) && a.marksAvailable > 0 && a.marksScored / a.marksAvailable >= 0.5) {
      tier3Passed = true;
    }
  }
  const mastery = weightedAvailable > 0 ? Math.min(100, Math.round((weightedScored / weightedAvailable) * 100)) : 0;
  return { mastery, tier3Passed };
}

export function recordAttemptAndUpdateState(
  prev: AppState,
  params: {
    question: KitQuestion;
    tier: 1 | 2 | 3 | 4;
    marksScored: number;
    marksAvailable: number;
    freeMarksCaptured: number;
    freeMarksTotal: number;
    userAnswerSummary: string;
    correctAnswerSummary: string;
    elapsedSeconds: number;
    nowIso?: string;
  }
): { nextState: AppState; microDrillTriggeredCategory: string | null } {
  const nowIso = params.nowIso ?? new Date().toISOString();
  const todayStr = nowIso.slice(0, 10);
  const ratio = params.marksAvailable > 0 ? params.marksScored / params.marksAvailable : 0;
  const isCleanPass = ratio >= 0.99; // clean pass on OT/case or >=75% on CR
  const isPass = params.question.type === 'cr' ? ratio >= 0.7 : isCleanPass;
  const trapCategory = params.question.examiner_debrief.trap_category || params.question.topic;

  const newAttempt: AttemptRecord = {
    id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    questionId: params.question.id,
    topicId: params.question.topic_id,
    section: params.question.section,
    tier: params.tier,
    marksScored: params.marksScored,
    marksAvailable: params.marksAvailable,
    freeMarksCaptured: params.freeMarksCaptured,
    freeMarksTotal: params.freeMarksTotal,
    trapAvoided: isPass,
    trapCategory,
    timestampIso: nowIso,
    elapsedSeconds: params.elapsedSeconds,
    isVariant: params.question.is_variant,
  };

  // Update streak
  let streakDays = prev.streakDays;
  if (!prev.lastStudyDate) {
    streakDays = 1;
  } else if (prev.lastStudyDate !== todayStr) {
    const prevD = new Date(prev.lastStudyDate + 'T00:00:00Z');
    const curD = new Date(todayStr + 'T00:00:00Z');
    const diffDays = Math.round((curD.getTime() - prevD.getTime()) / (1000 * 60 * 60 * 24));
    streakDays = diffDays === 1 ? prev.streakDays + 1 : 1;
  }

  const nextAttempts = [newAttempt, ...prev.attempts];
  const topicAttempts = nextAttempts.filter((a) => a.topicId === params.question.topic_id);
  const existingTp = prev.topicProgress[params.question.topic_id] ?? {
    topicId: params.question.topic_id,
    attempts: 0,
    marksScored: 0,
    marksAvailable: 0,
    mastery: 0,
    rag: 'unstarted' as RagStatus,
    tierUnlocked: 1 as const,
    consecutiveCleanPasses: 0,
    tier3Passed: false,
    lastPracticedIso: null,
  };

  const { mastery, tier3Passed } = computeTopicMasteryFromAttempts(topicAttempts);
  const consecutiveCleanPasses = isPass ? existingTp.consecutiveCleanPasses + 1 : 0;
  let tierUnlocked = existingTp.tierUnlocked;
  if (consecutiveCleanPasses >= 2 && tierUnlocked < 4) {
    tierUnlocked = (tierUnlocked + 1) as 1 | 2 | 3 | 4;
  }

  const updatedTp: TopicProgress = {
    topicId: params.question.topic_id,
    attempts: existingTp.attempts + 1,
    marksScored: existingTp.marksScored + params.marksScored,
    marksAvailable: existingTp.marksAvailable + params.marksAvailable,
    mastery,
    rag: computeRagStatus(mastery, existingTp.attempts + 1, tier3Passed),
    tierUnlocked,
    consecutiveCleanPasses: consecutiveCleanPasses >= 2 ? 0 : consecutiveCleanPasses,
    tier3Passed,
    lastPracticedIso: nowIso,
  };

  // Update Mistake Bank + SRS (1/3/7 day queue)
  const nextMistakes = [...prev.mistakes];
  const existingIdx = nextMistakes.findIndex((m) => m.questionId === params.question.id);
  if (!isPass) {
    const entry: MistakeEntry = {
      id: existingIdx >= 0 ? nextMistakes[existingIdx].id : `mis-${params.question.id}-${Date.now()}`,
      questionId: params.question.id,
      topicId: params.question.topic_id,
      topicName: params.question.topic,
      ruleMissed: params.question.examiner_debrief.trap_of_question,
      userAnswerSummary: params.userAnswerSummary,
      correctAnswerSummary: params.correctAnswerSummary,
      kitCitation: `Kit ${params.question.id} (${params.question.kit_page}, ans ${params.question.answer_page})`,
      createdIso: nowIso,
      srsStage: 0,
      nextReviewIso: addDaysIso(nowIso, 1), // +1 day initial interval
      resolvedCount: 0,
    };
    if (existingIdx >= 0) nextMistakes[existingIdx] = entry;
    else nextMistakes.unshift(entry);
  } else if (existingIdx >= 0) {
    // Advance SRS stage: 0(+1d) -> 1(+3d) -> 2(+7d) -> 3(+14d)
    const cur = nextMistakes[existingIdx];
    const nextStage = Math.min(3, cur.srsStage + 1) as 0 | 1 | 2 | 3;
    const daysMap: Record<number, number> = { 0: 1, 1: 3, 2: 7, 3: 14 };
    nextMistakes[existingIdx] = {
      ...cur,
      srsStage: nextStage,
      nextReviewIso: addDaysIso(nowIso, daysMap[nextStage]),
      resolvedCount: cur.resolvedCount + 1,
    };
  }

  // Update Trap Ledger
  const nextTrapLedger = { ...prev.trapLedger };
  const existingTrap: TrapLedgerEntry = nextTrapLedger[trapCategory] ?? {
    trapCategory,
    ruleSummary: params.question.examiner_debrief.examiner_playbook,
    hitCount: 0,
    avoidedCount: 0,
    questionIds: [],
    lastHitIso: nowIso,
    microDrillRequired: false,
  };

  let microDrillTriggeredCategory: string | null = null;
  if (!isPass) {
    const newHits = existingTrap.hitCount + 1;
    const triggerMicro = newHits >= 2;
    if (triggerMicro) microDrillTriggeredCategory = trapCategory;
    nextTrapLedger[trapCategory] = {
      ...existingTrap,
      hitCount: newHits,
      questionIds: existingTrap.questionIds.includes(params.question.id)
        ? existingTrap.questionIds
        : [...existingTrap.questionIds, params.question.id],
      lastHitIso: nowIso,
      microDrillRequired: triggerMicro,
    };
  } else {
    nextTrapLedger[trapCategory] = {
      ...existingTrap,
      avoidedCount: existingTrap.avoidedCount + 1,
      microDrillRequired: existingTrap.avoidedCount + 1 >= existingTrap.hitCount ? false : existingTrap.microDrillRequired,
    };
  }

  return {
    nextState: {
      ...prev,
      streakDays,
      lastStudyDate: todayStr,
      topicProgress: {
        ...prev.topicProgress,
        [params.question.topic_id]: updatedTp,
      },
      attempts: nextAttempts,
      mistakes: nextMistakes,
      trapLedger: nextTrapLedger,
    },
    microDrillTriggeredCategory,
  };
}

export function getDueMistakes(mistakes: MistakeEntry[], nowIso = new Date().toISOString()): MistakeEntry[] {
  const nowMs = new Date(nowIso).getTime();
  return mistakes.filter((m) => new Date(m.nextReviewIso).getTime() <= nowMs);
}

export type TrapFrequencyTier = 'critical' | 'repeat' | 'single' | 'immune';

export interface TrapFrequencyBucket {
  tier: TrapFrequencyTier;
  title: string;
  subtitle: string;
  entries: TrapLedgerEntry[];
}

export function categorizeTrapLedger(trapLedger: Record<string, TrapLedgerEntry>): {
  buckets: TrapFrequencyBucket[];
  totalHits: number;
  totalAvoided: number;
  repeatOffenceCategories: number;
} {
  const all = Object.values(trapLedger);
  const sortEntries = (list: TrapLedgerEntry[]) =>
    [...list].sort((a, b) => b.hitCount - a.hitCount || a.avoidedCount - b.avoidedCount);

  const critical = sortEntries(all.filter((e) => e.hitCount >= 3));
  const repeat = sortEntries(all.filter((e) => e.hitCount === 2));
  const single = sortEntries(all.filter((e) => e.hitCount === 1));
  const immune = sortEntries(all.filter((e) => e.hitCount === 0 && e.avoidedCount > 0));

  const buckets: TrapFrequencyBucket[] = [
    {
      tier: 'critical',
      title: 'Critical Repeat Offences (3+ hits)',
      subtitle: 'Chronic examiner traps costing recurring marks — micro-drill mandatory',
      entries: critical,
    },
    {
      tier: 'repeat',
      title: 'Micro-Drill Triggered (2 hits)',
      subtitle: 'Second repeat hit detected — clear with a 2-question trap drill',
      entries: repeat,
    },
    {
      tier: 'single',
      title: 'First-Offence Watch (1 hit)',
      subtitle: 'Flagged once — read dates and qualifying adjectives twice next time',
      entries: single,
    },
    {
      tier: 'immune',
      title: 'Zero-Hit Immunity (0 hits, avoided)',
      subtitle: 'Rules passed cleanly without falling into planted distractors',
      entries: immune,
    },
  ];

  const totalHits = all.reduce((s, e) => s + e.hitCount, 0);
  const totalAvoided = all.reduce((s, e) => s + e.avoidedCount, 0);
  return {
    buckets,
    totalHits,
    totalAvoided,
    repeatOffenceCategories: critical.length + repeat.length,
  };
}

export function computeTrapImmunityPercent(state: AppState): number {
  const entries = Object.values(state.trapLedger);
  if (entries.length === 0) return 100;
  const totalAvoided = entries.reduce((s, e) => s + e.avoidedCount, 0);
  const totalHits = entries.reduce((s, e) => s + e.hitCount, 0);
  const total = totalAvoided + totalHits;
  return total === 0 ? 100 : Math.round((totalAvoided / total) * 100);
}

export function computeFreeMarksHarvestPercent(state: AppState): number {
  const crAttempts = state.attempts.filter((a) => a.freeMarksTotal > 0);
  if (crAttempts.length === 0) return 0;
  const cap = crAttempts.reduce((s, a) => s + a.freeMarksCaptured, 0);
  const tot = crAttempts.reduce((s, a) => s + a.freeMarksTotal, 0);
  return tot > 0 ? Math.round((cap / tot) * 100) : 0;
}

export function computeOverallReadiness(state: AppState): number {
  const activeTopics = Object.values(state.topicProgress).filter((t) => t.attempts > 0);
  if (activeTopics.length === 0) return 0;
  const avgMastery = activeTopics.reduce((s, t) => s + t.mastery, 0) / activeTopics.length;
  const coverageBonus = Math.min(20, (activeTopics.length / 12) * 20);
  return Math.min(100, Math.round(avgMastery * 0.8 + coverageBonus));
}

export interface PredictedPriorityItem {
  topicId: number;
  title: string;
  frequencyOutOf8: number;
  mastery: number;
  rag: RagStatus;
  priorityScore: number;
  reason: string;
}

export function computeExamPredictions(state: AppState): PredictedPriorityItem[] {
  return TOPICS.map((t) => {
    const tp = state.topicProgress[t.id];
    const mastery = tp?.mastery ?? 0;
    const gap = 100 - mastery;
    const priorityScore = Math.round(t.phase1.frequencyCount * (gap / 10));
    return {
      topicId: t.id,
      title: t.title,
      frequencyOutOf8: t.phase1.frequencyCount,
      mastery,
      rag: tp?.rag ?? 'unstarted',
      priorityScore,
      reason: `${t.phase1.frequencyCount}/8 past sittings · ${tp?.attempts ? `${mastery}% mastery` : 'Not yet tested'}`,
    };
  }).sort((a, b) => b.priorityScore - a.priorityScore);
}

export function computeStudyPlanDays(profile: UserProfile, state: AppState, nowDate = new Date()) {
  const target = new Date(profile.examDate + 'T00:00:00Z');
  const diffDays = Math.max(1, Math.ceil((target.getTime() - nowDate.getTime()) / (1000 * 60 * 60 * 24)));
  const isCountdown = diffDays <= 28;
  const predictions = computeExamPredictions(state);
  const dueCount = getDueMistakes(state.mistakes, nowDate.toISOString()).length;

  const topGaps = predictions.slice(0, 3).map((p) => p.title).join(', ');
  const blocks = diffDays <= 14
    ? [
        {
          phase: `Days ${diffDays}–8 · Weak-Topic Surgery`,
          detail: `Drill top gaps (${topGaps}) + sit 2 timed mocks (target ≥60%).`,
        },
        {
          phase: 'Days 7–3 · Trapbook & Memory Vault',
          detail: `Clear ${dueCount} SRS due items + review Must-Memorise rates & 1 unseen mock.`,
        },
        {
          phase: 'Days 2–1 · Taper & Light OTs',
          detail: 'Rates & Dates cards only + 10 rapid OTs. Zero new heavy CRs.',
        },
      ]
    : isCountdown
    ? [
        {
          phase: `Days ${diffDays}–15 · Full Syllabus Sweep (${profile.hoursPerWeek} hrs/wk)`,
          detail: `Lock in core high-frequency areas (${topGaps}) across IT, CT, CGT, IHT & VAT using Kit Q1–306.`,
        },
        {
          phase: 'Days 14–6 · Timed CBE Mocks & Section C CRs',
          detail: 'Sit Full Specimen 100m + custom CT/IT 15-mark CR drills at strict 1.8 min/mark pace (target ≥60%).',
        },
        {
          phase: 'Days 5–1 · SRS Clearance & Memory Vault Taper',
          detail: `Clear ${dueCount} SRS due mistakes, drill Confusion Clinics, and lock Must-Memorise deadlines & car/VAT thresholds.`,
        },
      ]
    : [
        {
          phase: 'Block 1 · Core Income Tax & NIC (Q1–127)',
          detail: `${profile.hoursPerWeek} hrs/wk: Topics 2, 5, 7, 8, 11 (highest frequency 6–8/8 sittings).`,
        },
        {
          phase: 'Block 2 · Corporation Tax & Chargeable Gains (Q128–179, Q213–270)',
          detail: 'Topics 13–21 + Section B 5-OT cases and Section C 15-mark CT proformas.',
        },
        {
          phase: 'Block 3 · IHT, VAT & Full Timed Mocks (Q180–212, Q271–306)',
          detail: `Clear ${dueCount} SRS reviews daily + sit Specimen 3-hour CBE Mock (target ≥60%).`,
        },
      ];

  return { daysUntilExam: diffDays, isCountdown, blocks, dueCount };
}

export function serializeStateForExport(state: AppState): string {
  return JSON.stringify(state, null, 2);
}

export function parseImportedState(rawJson: string): { ok: true; state: AppState } | { ok: false; error: string } {
  try {
    const parsed = JSON.parse(rawJson);
    if (!parsed || typeof parsed !== 'object' || typeof parsed.version !== 'number' || !parsed.topicProgress) {
      return { ok: false, error: 'Invalid TX Mastercoach state JSON structure.' };
    }
    const base = createInitialAppState();
    return {
      ok: true,
      state: {
        ...base,
        ...parsed,
        profile: { ...base.profile, ...(parsed.profile ?? {}) },
        topicProgress: { ...base.topicProgress, ...(parsed.topicProgress ?? {}) },
      },
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Malformed JSON' };
  }
}

export interface TaxHeadSummary {
  area: string;
  shortLabel: string;
  topicsCount: number;
  attemptedTopics: number;
  masteredTopics: number;
  averageMastery: number;
  questionCount: number;
  weakestTopicId: number;
  weakestTopicTitle: string;
}

const TAX_HEAD_ORDER: { area: string; shortLabel: string }[] = [
  { area: 'Income Tax & NIC', shortLabel: 'Income Tax & NIC' },
  { area: 'Corporation Tax', shortLabel: 'Corporation Tax' },
  { area: 'Chargeable Gains', shortLabel: 'Capital Gains (CGT)' },
  { area: 'Inheritance Tax', shortLabel: 'Inheritance Tax' },
  { area: 'VAT', shortLabel: 'Value Added Tax' },
  { area: 'UK Tax System', shortLabel: 'Tax System & Ethics' },
];

export function computeTaxHeadSummaries(state: AppState): TaxHeadSummary[] {
  return TAX_HEAD_ORDER.map(({ area, shortLabel }) => {
    const areaTopics = TOPICS.filter((t) => t.syllabusArea === area);
    const questionCount = areaTopics.reduce((s, t) => s + t.extractedCount, 0);
    const attempted = areaTopics.filter((t) => (state.topicProgress[t.id]?.attempts ?? 0) > 0);
    const mastered = areaTopics.filter((t) => state.topicProgress[t.id]?.rag === 'green');
    const averageMastery =
      areaTopics.length > 0
        ? Math.round(
            areaTopics.reduce((s, t) => s + (state.topicProgress[t.id]?.mastery ?? 0), 0) /
              areaTopics.length
          )
        : 0;

    const weakest = [...areaTopics].sort((a, b) => {
      const ma = state.topicProgress[a.id]?.mastery ?? 0;
      const mb = state.topicProgress[b.id]?.mastery ?? 0;
      if (ma !== mb) return ma - mb;
      return b.phase1.frequencyCount - a.phase1.frequencyCount;
    })[0];

    return {
      area,
      shortLabel,
      topicsCount: areaTopics.length,
      attemptedTopics: attempted.length,
      masteredTopics: mastered.length,
      averageMastery,
      questionCount,
      weakestTopicId: weakest?.id ?? 1,
      weakestTopicTitle: weakest?.title ?? area,
    };
  });
}

export interface RecommendedStudyAction {
  kind: 'micro_drill' | 'srs' | 'weak_topic' | 'specimen_mock';
  kicker: string;
  title: string;
  detail: string;
  ctaLabel: string;
  topicId?: number;
  trapCategory?: string;
  questionId?: string;
}

export function getRecommendedNextAction(
  state: AppState,
  nowIso = new Date().toISOString()
): RecommendedStudyAction {
  const flaggedTrap = Object.values(state.trapLedger)
    .filter((t) => t.microDrillRequired || t.hitCount >= 2)
    .sort((a, b) => b.hitCount - a.hitCount)[0];

  if (flaggedTrap) {
    return {
      kind: 'micro_drill',
      kicker: 'Priority Trap Intervention',
      title: `Clear repeat trap: ${flaggedTrap.trapCategory}`,
      detail: `${flaggedTrap.hitCount} hits logged. Complete a focused 2-question trap drill to restore immunity before timed mocks.`,
      ctaLabel: 'Launch 2-Q Trap Drill',
      trapCategory: flaggedTrap.trapCategory,
    };
  }

  const due = getDueMistakes(state.mistakes, nowIso);
  if (due.length > 0) {
    const first = due[0];
    return {
      kind: 'srs',
      kicker: `${due.length} Spaced-Repetition ${due.length === 1 ? 'Review' : 'Reviews'} Due`,
      title: `Re-drill ${first.questionId} (${first.topicName})`,
      detail: `Clearing due 1/3/7-day reviews locks rules into long-term memory ahead of exam day.`,
      ctaLabel: 'Clear Due Mistake',
      questionId: first.questionId,
    };
  }

  const predictions = computeExamPredictions(state);
  const top = predictions[0];
  if (state.attempts.length >= 15 && state.mockHistory.length === 0) {
    return {
      kind: 'specimen_mock',
      kicker: 'Benchmark Check',
      title: 'Sit the Full 100-Mark Specimen CBE Mock',
      detail: 'Test pacing at 1.8 min/mark across Sections A, B, and C to establish a true baseline score.',
      ctaLabel: 'Start Specimen Mock',
    };
  }

  return {
    kind: 'weak_topic',
    kicker: `Highest Yield · ${top.frequencyOutOf8}/8 Past Sittings`,
    title: `Topic ${top.topicId}: ${top.title}`,
    detail:
      top.mastery === 0
        ? 'Unstarted high-frequency core syllabus area. Review the Phase-1 snapshot and drill Section A OTs.'
        : `Current mastery ${top.mastery}%. Push past 80% and pass Tier-3 Sec B/C cases.`,
    ctaLabel: `Open Topic ${top.topicId}`,
    topicId: top.topicId,
  };
}

const INTERACTION_LABELS: Record<string, string> = {
  single_mcq: 'Single MCQ',
  grid_2x2: '2×2 Grid',
  numeric_input: 'Numeric (£)',
  pair_dropdown: 'Dropdown Match',
  multi_select: 'Multi-Select',
  matrix: 'Matrix',
  constructed_response: 'Constructed Response',
};

export function formatInteractionLabel(interaction: string): string {
  if (INTERACTION_LABELS[interaction]) return INTERACTION_LABELS[interaction];
  return interaction
    .split('_')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export interface QuestionJumpResolution {
  id: string;
  label: string;
  matchedByKeyword: boolean;
}

export function resolveQuestionJump(
  allQuestions: Array<Pick<KitQuestion, 'id' | 'title' | 'topic'>>,
  query: string
): QuestionJumpResolution {
  const trimmed = query.trim();
  if (!trimmed) {
    return { id: 'Q1', label: 'Q1', matchedByKeyword: false };
  }
  const upper = trimmed.toUpperCase();

  // Exact ID match (e.g. Q128, SPEC-Q3, SPEC-CASE-2)
  const exact = allQuestions.find((q) => q.id.toUpperCase() === upper);
  if (exact) {
    return { id: exact.id, label: exact.id, matchedByKeyword: false };
  }

  // Specimen shorthand (SPEC-CASE-2, SC2, S3, SPEC15, etc.)
  if (/^SPEC-?CASE-?[123]$/.test(upper) || /^SC[123]$/.test(upper)) {
    const caseNum = upper.replace(/[^\d]/g, '') || '1';
    const id = `SPEC-CASE-${caseNum}`;
    return { id, label: id, matchedByKeyword: false };
  }
  if (/^(?:SPEC(?:-?Q)?|S)\d+$/.test(upper)) {
    const specNum = Math.min(33, Math.max(1, Number(upper.replace(/[^\d]/g, '')) || 1));
    const id =
      specNum >= 16 && specNum <= 20
        ? 'SPEC-CASE-1'
        : specNum >= 21 && specNum <= 25
        ? 'SPEC-CASE-2'
        : specNum >= 26 && specNum <= 30
        ? 'SPEC-CASE-3'
        : `SPEC-Q${specNum}`;
    return { id, label: id, matchedByKeyword: false };
  }

  // Pure numeric or Q-prefixed numeric shorthand (128, Q128)
  if (/^Q?\d+$/.test(upper)) {
    const qNum = Math.min(306, Math.max(1, Number(upper.replace(/[^\d]/g, '')) || 1));
    const id = `Q${qNum}`;
    return { id, label: id, matchedByKeyword: false };
  }

  // Keyword lookup across question title & topic (e.g. "Sheldon", "Opal", "chattels")
  const lower = trimmed.toLowerCase();
  const titleMatch =
    allQuestions.find((q) => q.title.toLowerCase().includes(lower)) ??
    allQuestions.find((q) => q.topic.toLowerCase().includes(lower));
  if (titleMatch) {
    return {
      id: titleMatch.id,
      label: `${titleMatch.id} · ${titleMatch.title.replace(/^KIT\s+\w+\s*/, '')}`,
      matchedByKeyword: true,
    };
  }

  return { id: 'Q1', label: 'Q1 (default)', matchedByKeyword: false };
}

export interface QuickJumpTarget {
  kind: 'question' | 'topic' | 'nav';
  id: string;
  title: string;
  subtitle: string;
  topicId?: number;
  navTab?: 'overview' | 'topics' | 'player' | 'mock' | 'mistakes' | 'tables';
}

const WORKSPACE_JUMP_ITEMS: QuickJumpTarget[] = [
  {
    kind: 'nav',
    id: 'nav-tables',
    title: 'FA25 Complete Revision Hub & Tax Tables',
    subtitle: 'Rates, allowances, live checkers, worked examples & deadlines',
    navTab: 'tables',
  },
  {
    kind: 'nav',
    id: 'nav-mock',
    title: 'Timed CBE Mock Exam Builder',
    subtitle: '100-mark Specimen CBE, 5-Q Rapid & custom area mocks',
    navTab: 'mock',
  },
  {
    kind: 'nav',
    id: 'nav-mistakes',
    title: 'Revision Clinic, SRS & Memory Vault',
    subtitle: '1/3/7d Mistake Bank, 14-Trap Ledger, Confusion Clinic & Deck',
    navTab: 'mistakes',
  },
  {
    kind: 'nav',
    id: 'nav-topics',
    title: '24-Topic Syllabus Handbook',
    subtitle: 'Phase-1 law & proformas + 4-tier adaptive practice ladder',
    navTab: 'topics',
  },
];

export function searchQuickJumpTargets(
  allQuestions: Array<Pick<KitQuestion, 'id' | 'title' | 'topic' | 'section' | 'marks'>>,
  query: string
): QuickJumpTarget[] {
  const trimmed = query.trim();
  if (!trimmed) {
    const curatedQIds = ['Q27', 'Q101', 'Q256', 'SPEC-Q31', 'SPEC-CASE-2'];
    const curatedQuestions: QuickJumpTarget[] = [];
    for (const qId of curatedQIds) {
      const q = allQuestions.find((item) => item.id === qId);
      if (q) {
        curatedQuestions.push({
          kind: 'question',
          id: q.id,
          title: `${q.id} · ${q.title.replace(/^KIT\s+\w+\s*/, '')}`,
          subtitle: `Sec ${q.section} · ${q.marks}m · ${q.topic}`,
        });
      }
    }
    const curatedTopics: QuickJumpTarget[] = [2, 5, 13]
      .map((tid) => TOPICS.find((t) => t.id === tid))
      .filter((t): t is NonNullable<typeof t> => Boolean(t))
      .map((t) => ({
        kind: 'topic',
        id: `T${t.id}`,
        title: `Topic ${t.id}: ${t.title}`,
        subtitle: `${t.syllabusArea} · ${t.extractedCount} questions · ${t.kitRange}`,
        topicId: t.id,
      }));
    return [...curatedQuestions.slice(0, 4), ...curatedTopics.slice(0, 2), WORKSPACE_JUMP_ITEMS[0]];
  }

  const lower = trimmed.toLowerCase();
  const results: QuickJumpTarget[] = [];
  const seenQuestionIds = new Set<string>();

  const resolved = resolveQuestionJump(allQuestions, trimmed);
  const looksLikeIdQuery =
    /^(?:Q?\d+|SPEC(?:-?CASE)?-?\d+|SC\d+|S\d+)$/i.test(trimmed);
  if (looksLikeIdQuery || resolved.matchedByKeyword) {
    const q = allQuestions.find((item) => item.id === resolved.id);
    if (q) {
      seenQuestionIds.add(q.id);
      results.push({
        kind: 'question',
        id: q.id,
        title: `${q.id} · ${q.title.replace(/^KIT\s+\w+\s*/, '')}`,
        subtitle: `Sec ${q.section} · ${q.marks}m · ${q.topic}`,
      });
    }
  }

  for (const q of allQuestions) {
    if (results.length >= 6) break;
    if (seenQuestionIds.has(q.id)) continue;
    if (
      q.id.toLowerCase().includes(lower) ||
      q.title.toLowerCase().includes(lower) ||
      q.topic.toLowerCase().includes(lower)
    ) {
      seenQuestionIds.add(q.id);
      results.push({
        kind: 'question',
        id: q.id,
        title: `${q.id} · ${q.title.replace(/^KIT\s+\w+\s*/, '')}`,
        subtitle: `Sec ${q.section} · ${q.marks}m · ${q.topic}`,
      });
    }
  }

  let topicHits = 0;
  for (const t of TOPICS) {
    if (topicHits >= 4) break;
    const topicCode = `topic ${t.id}`;
    if (
      topicCode.includes(lower) ||
      `t${t.id}` === lower ||
      t.title.toLowerCase().includes(lower) ||
      t.syllabusArea.toLowerCase().includes(lower)
    ) {
      topicHits++;
      results.push({
        kind: 'topic',
        id: `T${t.id}`,
        title: `Topic ${t.id}: ${t.title}`,
        subtitle: `${t.syllabusArea} · ${t.extractedCount} questions · ${t.kitRange}`,
        topicId: t.id,
      });
    }
  }

  for (const nav of WORKSPACE_JUMP_ITEMS) {
    if (
      nav.title.toLowerCase().includes(lower) ||
      nav.subtitle.toLowerCase().includes(lower)
    ) {
      results.push(nav);
    }
  }

  return results.slice(0, 10);
}
