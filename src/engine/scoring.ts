import type { CaseSubQuestion, KitQuestion } from '../types/tx';

export type UserQuestionAnswer =
  | string
  | string[]
  | Record<string, string[]>
  | Array<string | string[] | Record<string, string[]>>;

export interface GradedResult {
  isAutoGraded: boolean;
  marksScored: number;
  marksAvailable: number;
  isFullyCorrect: boolean;
  subResults?: { subNum: number; correct: boolean; expected: string; user: string }[];
  correctDisplay: string;
  userDisplay: string;
}

function normalizeStr(v: unknown): string {
  return String(v ?? '')
    .replace(/[£,\s]+/g, ' ')
    .trim()
    .toLowerCase();
}

function normalizeNum(v: unknown): number | null {
  const cleaned = String(v ?? '').replace(/[£,\s]/g, '').trim();
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

export function gradeSubItem(
  interaction: string,
  correct: unknown,
  user: unknown
): { correct: boolean; expectedDisplay: string; userDisplay: string } {
  if (interaction === 'numeric_input') {
    const expN = normalizeNum(correct);
    const usrN = normalizeNum(user);
    const ok = expN !== null && usrN !== null && Math.abs(expN - usrN) <= 1; // ±£1 rounding tolerance per ACCA Kit convention
    return {
      correct: ok,
      expectedDisplay: expN !== null ? `£${expN.toLocaleString()}` : String(correct),
      userDisplay: usrN !== null ? `£${usrN.toLocaleString()}` : String(user || '—'),
    };
  }

  if (interaction === 'multi_select') {
    const expArr = (Array.isArray(correct) ? correct : []).map((x) => normalizeStr(x)).sort();
    const usrArr = (Array.isArray(user) ? user : []).map((x) => normalizeStr(x)).sort();
    const ok = expArr.length > 0 && expArr.length === usrArr.length && expArr.every((v, i) => v === usrArr[i]);
    return {
      correct: ok,
      expectedDisplay: (Array.isArray(correct) ? correct : []).join(', '),
      userDisplay: (Array.isArray(user) && user.length ? user : ['—']).join(', '),
    };
  }

  if (interaction === 'pair_dropdown') {
    const expArr = (Array.isArray(correct) ? correct : []).map((x) => normalizeStr(x));
    const usrArr = (Array.isArray(user) ? user : []).map((x) => normalizeStr(x));
    const ok = expArr.length > 0 && expArr.length === usrArr.length && expArr.every((v, i) => v === usrArr[i]);
    return {
      correct: ok,
      expectedDisplay: (Array.isArray(correct) ? correct : []).join(' | '),
      userDisplay: (Array.isArray(user) && user.length ? user : ['—']).join(' | '),
    };
  }

  if (interaction === 'matrix') {
    const expObj = (correct && typeof correct === 'object' ? correct : {}) as Record<string, string[]>;
    const usrObj = (user && typeof user === 'object' ? user : {}) as Record<string, string[]>;
    const keys = Object.keys(expObj);
    const ok =
      keys.length > 0 &&
      keys.every((k) => {
        const e = (expObj[k] ?? []).map((s) => normalizeStr(s)).sort();
        const u = (usrObj[k] ?? []).map((s) => normalizeStr(s)).sort();
        return e.length === u.length && e.every((val, i) => val === u[i]);
      });
    return {
      correct: ok,
      expectedDisplay: keys.map((k) => `Row ${Number(k) + 1}: ${(expObj[k] || []).join(', ') || 'None'}`).join(' · '),
      userDisplay: keys.map((k) => `Row ${Number(k) + 1}: ${(usrObj[k] || []).join(', ') || 'None'}`).join(' · '),
    };
  }

  // single_mcq / grid_2x2
  const ok = normalizeStr(correct) === normalizeStr(user) && normalizeStr(user) !== '';
  return {
    correct: ok,
    expectedDisplay: String(correct ?? ''),
    userDisplay: String(user || '—'),
  };
}

export function gradeQuestion(question: KitQuestion, userAnswer: UserQuestionAnswer | null | undefined): GradedResult {
  if (question.type === 'cr') {
    return {
      isAutoGraded: false,
      marksScored: 0, // updated by user self-marking checkboxes in Phase 3
      marksAvailable: question.marks,
      isFullyCorrect: false,
      correctDisplay: 'Self-mark against ACCA Marking Scheme below',
      userDisplay: typeof userAnswer === 'string' && userAnswer.trim() ? 'Submitted working' : 'No response entered',
    };
  }

  if (question.type === 'case') {
    const subs = question.options as CaseSubQuestion[];
    const userArr = Array.isArray(userAnswer) ? userAnswer : [];
    const subResults = subs.map((sq, idx) => {
      const res = gradeSubItem(sq.interaction, sq.correct_answer, userArr[idx]);
      return {
        subNum: sq.sub_num,
        correct: res.correct,
        expected: res.expectedDisplay,
        user: res.userDisplay,
      };
    });
    const correctCount = subResults.filter((r) => r.correct).length;
    const marksScored = correctCount * 2;
    return {
      isAutoGraded: true,
      marksScored,
      marksAvailable: question.marks,
      isFullyCorrect: marksScored === question.marks,
      subResults,
      correctDisplay: subResults.map((r) => `OT${r.subNum}: ${r.expected}`).join(' · '),
      userDisplay: subResults.map((r) => `OT${r.subNum}: ${r.user}`).join(' · '),
    };
  }

  const single = gradeSubItem(question.interaction, question.correct_answer, userAnswer);
  return {
    isAutoGraded: true,
    marksScored: single.correct ? question.marks : 0,
    marksAvailable: question.marks,
    isFullyCorrect: single.correct,
    correctDisplay: single.expectedDisplay,
    userDisplay: single.userDisplay,
  };
}

export interface KeywordMatchResult {
  matched: string[];
  missing: string[];
  suggestedMarks: number;
  maxMarks: number;
}

export function scoreKeywords(userText: string, keywords: string[], maxMarks: number): KeywordMatchResult {
  const lower = userText.toLowerCase();
  const matched: string[] = [];
  const missing: string[] = [];
  for (const kw of keywords) {
    if (lower.includes(kw.toLowerCase())) matched.push(kw);
    else missing.push(kw);
  }
  const ratio = keywords.length > 0 ? matched.length / keywords.length : 0;
  const suggestedMarks = Math.min(maxMarks, Math.round(ratio * maxMarks * 2) / 2);
  return { matched, missing, suggestedMarks, maxMarks };
}

export interface EasyMarksAuditResult {
  capturedCount: number;
  totalChecks: number;
  checks: { label: string; captured: boolean; tip: string }[];
}

export function auditEasyMarks(userText: string, question: KitQuestion): EasyMarksAuditResult {
  const txt = userText.trim();
  const checks: { label: string; captured: boolean; tip: string }[] = [];

  // 1. Headings / Proforma structure
  checks.push({
    label: 'Clear heading / requirement label',
    captured: /(computation|working|w1|2025\/26|part\s*\(?[a-d]\)?|income tax|corporation tax)/i.test(txt),
    tip: 'Always open with taxpayer name, tax type, and tax year (2025/26).',
  });

  // 2. Explicit zeros for exempt/non-adjustable items
  if (/zero|\(0\)|exempt|not taxable|not deductible/i.test(question.requirement + ' ' + question.full_worked_solution)) {
    checks.push({
      label: 'Explicit zeros (0) shown for exempt / non-adjustable items',
      captured: /(?:^|\s|:|=|\b)0(?:\s|$|\))|nil/im.test(txt),
      tip: 'Markers award 0.5 free marks for showing "0" on exempt/allowable lines.',
    });
  }

  // 3. Labelled workings W1/W2
  checks.push({
    label: 'Labelled workings (W1 / W2 / Notes)',
    captured: /(w1|w2|working\s*1|note\s*1)/i.test(txt),
    tip: 'Cross-reference (W1), (W2) so method marks are awarded even if a subtotal is wrong.',
  });

  // 4. PAYE / tax deducted at foot
  if (/paye/i.test(question.scenario + ' ' + question.full_worked_solution)) {
    checks.push({
      label: 'PAYE deducted from Income Tax liability',
      captured: /paye/i.test(txt),
      tip: 'Deduct PAYE at the very bottom after calculating tax liability (never from income).',
    });
  }

  // 5. Full dates with calendar year
  if (/date|deadline|notify|filing|pay/i.test(question.requirement)) {
    checks.push({
      label: 'Full dates stated with calendar year (e.g. 31 January 2027)',
      captured: /\b202[5-9]|203[0-2]\b/.test(txt),
      tip: 'Always include the full 4-digit year (e.g. 31 January 2027, not just "31 Jan").',
    });
  }

  return {
    capturedCount: checks.filter((c) => c.captured).length,
    totalChecks: checks.length,
    checks,
  };
}

export interface CbePresentationFinding {
  id: string;
  category: 'labels' | 'negatives' | 'dates' | 'zeros' | 'workings' | 'bodmas' | 'paye';
  label: string;
  status: 'pass' | 'risk';
  detail: string;
  fixExample?: string;
}

export interface CbePresentationReport {
  scoreOutOf100: number;
  passedChecks: string[];
  markerRisks: string[];
  findings: CbePresentationFinding[];
}

export function coachCbePresentation(
  userText: string,
  question?: KitQuestion
): CbePresentationReport {
  const txt = userText.trim();
  const passedChecks: string[] = [];
  const markerRisks: string[] = [];
  const findings: CbePresentationFinding[] = [];

  if (!txt) {
    const emptyMsg =
      'Response area is empty — remember Scratch Pad work is NOT marked by ACCA.';
    return {
      scoreOutOf100: 0,
      passedChecks: [],
      markerRisks: [emptyMsg],
      findings: [
        {
          id: 'empty',
          category: 'labels',
          label: 'Constructed response content',
          status: 'risk',
          detail: emptyMsg,
          fixExample: 'Click "+ Insert Proforma Template" to scaffold headings and workings.',
        },
      ],
    };
  }

  // 1. Computation Heading / Tax Year / Period Label
  const hasHeading =
    /(2025\/26|fy\s*202[45]|income tax|corporation tax|capital gains|inheritance tax|vat|computation|year ended|period ended|tax payable)/i.test(
      txt
    );
  if (hasHeading) {
    const msg = 'Clear computation heading & tax period label present';
    passedChecks.push(msg);
    findings.push({
      id: 'heading',
      category: 'labels',
      label: 'Computation heading & tax year',
      status: 'pass',
      detail: msg,
    });
  } else {
    const msg =
      'Missing computation heading / tax period label (markers need taxpayer name, tax type & 2025/26 or accounting period).';
    markerRisks.push(msg);
    findings.push({
      id: 'heading',
      category: 'labels',
      label: 'Missing computation heading / label',
      status: 'risk',
      detail: msg,
      fixExample: 'e.g. "2025/26 Income Tax Computation" or "Year ended 31 March 2026"',
    });
  }

  // 2. Bracketed negatives vs unbracketed minus signs / raw deductions
  const hasMinusPrefix = /(?:^|\s)-\s*£?\d[\d,]*/m.test(txt);
  const hasBracketedNegative = /\(\s*£?\d[\d,]*\s*\)/.test(txt);
  const hasDeductionWords = /(less|deduct|relief|allowance|paye|loss|costs)/i.test(txt);
  if (hasMinusPrefix && !hasBracketedNegative) {
    const msg =
      'Unbracketed negative ("-5000") detected — ACCA CBE spreadsheets expect bracketed negatives e.g. (5,000) for clean SUM columns.';
    markerRisks.push(msg);
    findings.push({
      id: 'negatives',
      category: 'negatives',
      label: 'Bracketed negative formatting',
      status: 'risk',
      detail: msg,
      fixExample: 'Replace "-5000" with "(5,000)" in a single computation column.',
    });
  } else if (hasBracketedNegative || !hasDeductionWords) {
    const msg = 'Deductions formatted cleanly with bracketed negatives (X)';
    passedChecks.push(msg);
    findings.push({
      id: 'negatives',
      category: 'negatives',
      label: 'Bracketed negative formatting',
      status: 'pass',
      detail: msg,
    });
  } else {
    const msg =
      'Deduction words detected without bracketed negatives — show subtracted amounts in brackets e.g. (12,570) so markers trace additions vs deductions.';
    markerRisks.push(msg);
    findings.push({
      id: 'negatives',
      category: 'negatives',
      label: 'Deductions need brackets (X)',
      status: 'risk',
      detail: msg,
      fixExample: 'Less: Personal Allowance: (12,570)',
    });
  }

  // 3. Date Formatting (flag day+month dates missing 4-digit calendar year)
  const monthNamesRe =
    /\b\d{1,2}\s+(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b(?!\s+20\d{2})/i;
  const slashShortDateRe = /\b\d{1,2}\/\d{1,2}\b(?!\/\d{2,4})/;
  const hasFullYearDate = /\b\d{1,2}\s+(?:january|february|march|april|may|june|july|august|september|october|november|december)\s+20\d{2}\b/i.test(
    txt
  );
  if (monthNamesRe.test(txt) || slashShortDateRe.test(txt)) {
    const msg =
      'Incomplete date format detected — ACCA TX markers dock 0.5m for dates missing the full month & 4-digit calendar year (e.g. write "31 January 2027", not "31 Jan" or "31/01").';
    markerRisks.push(msg);
    findings.push({
      id: 'dates',
      category: 'dates',
      label: 'Full calendar year on dates',
      status: 'risk',
      detail: msg,
      fixExample: 'State full date: e.g. "31 January 2027" or "1 January 2028".',
    });
  } else if (hasFullYearDate || !/(date|due|deadline|notify|file|pay|submit)/i.test(question?.requirement ?? txt)) {
    const msg = 'Dates include full month & 4-digit calendar year';
    passedChecks.push(msg);
    findings.push({
      id: 'dates',
      category: 'dates',
      label: 'Date formatting',
      status: 'pass',
      detail: msg,
    });
  } else {
    const msg =
      'Requirement asks for dates/deadlines — include full calendar dates (day + full month + 4-digit year, e.g. 31 January 2027).';
    markerRisks.push(msg);
    findings.push({
      id: 'dates',
      category: 'dates',
      label: 'Missing full calendar dates',
      status: 'risk',
      detail: msg,
      fixExample: 'e.g. Balancing payment due 31 January 2027',
    });
  }

  // 4. Labelled Workings (W1 / W2)
  if (/(w1|w2|working\s*1|working\s*2|note\s*1)/i.test(txt)) {
    const msg = 'Workings clearly labelled (W1/W2) for own-figure method credit';
    passedChecks.push(msg);
    findings.push({
      id: 'workings',
      category: 'workings',
      label: 'Cross-referenced workings (W1)',
      status: 'pass',
      detail: msg,
    });
  } else {
    const msg =
      'Missing labelled workings (W1), (W2) — burying calculations inside one line risks losing own-figure method marks.';
    markerRisks.push(msg);
    findings.push({
      id: 'workings',
      category: 'workings',
      label: 'Missing (W1) workings labels',
      status: 'risk',
      detail: msg,
      fixExample: 'Add "(W1) Company car benefit:" below main proforma.',
    });
  }

  // 5. Explicit zeros for exempt / disallowable items
  const hasExplicitZero = /(?:^|\s|:|=|\()0(?:\s|$|\))|\bnil\b/im.test(txt);
  if (hasExplicitZero) {
    const msg = 'Explicit zero (0) shown for exempt / non-adjustable lines';
    passedChecks.push(msg);
    findings.push({
      id: 'zeros',
      category: 'zeros',
      label: 'Explicit zeros for exempt items',
      status: 'pass',
      detail: msg,
    });
  } else {
    const msg =
      'No explicit "0" / "Nil" shown — ACCA markers award 0.5–1 easy mark for explicitly listing exempt/disallowable items as 0 rather than skipping them.';
    markerRisks.push(msg);
    findings.push({
      id: 'zeros',
      category: 'zeros',
      label: 'Show explicit 0 for exempt items',
      status: 'risk',
      detail: msg,
      fixExample: 'e.g. "Exempt benefit / Client entertaining: 0"',
    });
  }

  // 6. Unbracketed BODMAS division check + Line separation
  if (/\d[\d,]*\s*[+-]\s*\d[\d,]*\s*\/\s*\d/.test(txt)) {
    const msg =
      'Unbracketed "+ ... / ..." cell formula risk (BODMAS trap! Wrap numerator in brackets: ((a + b) / 2)).';
    markerRisks.push(msg);
    findings.push({
      id: 'bodmas',
      category: 'bodmas',
      label: 'Spreadsheet formula brackets',
      status: 'risk',
      detail: msg,
      fixExample: 'Use ((80,000 + 72,000) / 2) instead of 80,000 + 72,000 / 2.',
    });
  } else if (txt.split('\n').filter((l) => l.trim()).length >= 4) {
    const msg = 'Clean multi-line CBE layout without unbracketed BODMAS risks';
    passedChecks.push(msg);
    findings.push({
      id: 'bodmas',
      category: 'bodmas',
      label: 'Line structure & formula safety',
      status: 'pass',
      detail: msg,
    });
  } else {
    const msg =
      'Single-block text — separate each income/tax line onto its own row so markers can award half-marks line by line.';
    markerRisks.push(msg);
    findings.push({
      id: 'bodmas',
      category: 'bodmas',
      label: 'Separate items onto own rows',
      status: 'risk',
      detail: msg,
      fixExample: 'Use one labelled line per figure.',
    });
  }

  // 7. Optional PAYE check when question mentions PAYE
  if (question && /paye/i.test(question.scenario + ' ' + question.full_worked_solution)) {
    if (/paye/i.test(txt)) {
      const msg = 'PAYE deducted at bottom of Income Tax computation';
      passedChecks.push(msg);
      findings.push({
        id: 'paye',
        category: 'paye',
        label: 'PAYE tax credit at foot',
        status: 'pass',
        detail: msg,
      });
    } else {
      const msg =
        'Scenario involves PAYE — remember to deduct PAYE from Income Tax liability at the foot (never from salary).';
      markerRisks.push(msg);
      findings.push({
        id: 'paye',
        category: 'paye',
        label: 'PAYE missing at foot',
        status: 'risk',
        detail: msg,
        fixExample: 'Less: PAYE deducted at source: (X)',
      });
    }
  }

  const total = findings.length;
  const passCount = findings.filter((f) => f.status === 'pass').length;
  const scoreOutOf100 = total > 0 ? Math.round((passCount / total) * 100) : 0;
  return { scoreOutOf100, passedChecks, markerRisks, findings };
}

