import type { MistakeEntry, TrapLedgerEntry } from '../types/tx';

export interface MistakeDiagnosisRootCause {
  title: string;
  ruleFix: string;
  questionIds: string[];
}

export interface MistakeDiagnosisReport {
  source: 'gemini' | 'deterministic';
  headline: string;
  rootCauses: MistakeDiagnosisRootCause[];
  priorityOrder: string[];
  examDayRule: string;
}

export interface MistakeDrillOption {
  key: 'A' | 'B' | 'C' | 'D';
  text: string;
}

export interface MistakePracticeDrill {
  source: 'gemini' | 'deterministic';
  stem: string;
  requirement: string;
  options: MistakeDrillOption[];
  correctKey: 'A' | 'B' | 'C' | 'D';
  explanation: string;
}

export interface TutorChatMessage {
  role: 'user' | 'assistant';
  text: string;
}

export function buildMistakeDiagnosisPayload(
  mistakes: MistakeEntry[],
  trapLedger: Record<string, TrapLedgerEntry>
) {
  const recentMistakes = mistakes.slice(0, 15).map((m) => ({
    questionId: m.questionId,
    topicName: m.topicName,
    ruleMissed: m.ruleMissed,
    userAnswerSummary: m.userAnswerSummary,
    correctAnswerSummary: m.correctAnswerSummary,
    kitCitation: m.kitCitation,
    srsStage: m.srsStage,
  }));

  const topTraps = Object.values(trapLedger)
    .filter((t) => t.hitCount > 0)
    .sort((a, b) => b.hitCount - a.hitCount)
    .slice(0, 8)
    .map((t) => ({
      trapCategory: t.trapCategory,
      hitCount: t.hitCount,
      avoidedCount: t.avoidedCount,
      ruleSummary: t.ruleSummary,
      questionIds: t.questionIds,
    }));

  return { recentMistakes, topTraps };
}

export function buildDeterministicMistakeDiagnosis(
  mistakes: MistakeEntry[],
  trapLedger: Record<string, TrapLedgerEntry>
): MistakeDiagnosisReport {
  if (mistakes.length === 0) {
    return {
      source: 'deterministic',
      headline: 'Zero active mistakes logged — Mistake Bank is currently clear.',
      rootCauses: [],
      priorityOrder: [],
      examDayRule:
        'Keep circling dates, gross/net qualifiers, and 2025/26 thresholds before running any proforma.',
    };
  }

  const byTopic = new Map<string, MistakeEntry[]>();
  for (const m of mistakes) {
    const arr = byTopic.get(m.topicName) ?? [];
    arr.push(m);
    byTopic.set(m.topicName, arr);
  }

  const sortedTopics = [...byTopic.entries()].sort((a, b) => b[1].length - a[1].length);
  const topTraps = Object.values(trapLedger)
    .filter((t) => t.hitCount > 0)
    .sort((a, b) => b.hitCount - a.hitCount);

  const rootCauses: MistakeDiagnosisRootCause[] = sortedTopics.slice(0, 3).map(([topic, list]) => ({
    title: `${topic} (${list.length} logged ${list.length === 1 ? 'mistake' : 'mistakes'})`,
    ruleFix: list[0].ruleMissed,
    questionIds: list.map((x) => x.questionId).slice(0, 5),
  }));

  const priorityOrder = [...mistakes]
    .sort((a, b) => a.srsStage - b.srsStage)
    .slice(0, 5)
    .map((m) => `${m.questionId} (${m.topicName})`);

  const leadTrap = topTraps[0];

  return {
    source: 'deterministic',
    headline: leadTrap
      ? `Primary bottleneck: ${leadTrap.trapCategory} (${leadTrap.hitCount} ${
          leadTrap.hitCount === 1 ? 'hit' : 'hits'
        }) across ${sortedTopics[0]?.[0] ?? 'core syllabus topics'}.`
      : `Primary focus: ${sortedTopics[0]?.[0] ?? 'Core FA25 Rules'} (${mistakes.length} active SRS items).`,
    rootCauses,
    priorityOrder,
    examDayRule:
      leadTrap?.ruleSummary ??
      'Verify dates, tax-year apportionments (n/12), and gross vs net wording before selecting or entering an answer.',
  };
}

export function parseAndValidateDrillResponse(rawText: string): MistakePracticeDrill {
  const cleaned = rawText
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();

  const parsed = JSON.parse(cleaned) as Partial<MistakePracticeDrill>;

  if (
    !parsed ||
    typeof parsed.stem !== 'string' ||
    !parsed.stem.trim() ||
    typeof parsed.requirement !== 'string' ||
    !parsed.requirement.trim() ||
    !Array.isArray(parsed.options) ||
    parsed.options.length !== 4
  ) {
    throw new Error('Invalid drill structure returned by model.');
  }

  const expectedKeys = ['A', 'B', 'C', 'D'] as const;
  const normalizedOptions: MistakeDrillOption[] = parsed.options.map((opt, idx) => {
    const key = expectedKeys[idx];
    const text = typeof opt?.text === 'string' ? opt.text.trim() : '';
    if (!text) {
      throw new Error(`Missing option text for choice ${key}.`);
    }
    return { key, text };
  });

  const correctKey = String(parsed.correctKey ?? '').toUpperCase().trim() as
    | 'A'
    | 'B'
    | 'C'
    | 'D';
  if (!expectedKeys.includes(correctKey)) {
    throw new Error('Invalid correctKey returned by model.');
  }

  const explanation =
    typeof parsed.explanation === 'string' && parsed.explanation.trim()
      ? parsed.explanation.trim()
      : 'Review the Finance Act 2025 proforma rule for this trap.';

  return {
    source: 'gemini',
    stem: parsed.stem.trim(),
    requirement: parsed.requirement.trim(),
    options: normalizedOptions,
    correctKey,
    explanation,
  };
}
