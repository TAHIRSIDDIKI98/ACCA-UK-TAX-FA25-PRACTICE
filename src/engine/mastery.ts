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
