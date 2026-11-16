import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Bot,
  CheckCircle2,
  Loader2,
  Send,
  Sparkles,
  X,
} from 'lucide-react';
import {
  buildDeterministicMistakeDiagnosis,
  buildMistakeDiagnosisPayload,
  parseAndValidateDrillResponse,
  type MistakeDiagnosisReport,
  type MistakePracticeDrill,
  type TutorChatMessage,
} from '../engine/mistakeCoach';
import { generateTrapVariant } from '../engine/taxCalculators';
import type { KitQuestion, MistakeEntry, TrapLedgerEntry } from '../types/tx';
import { FormattedCoachText } from './FormattedCoachText';
import { WorkedSolutionBlock } from './WorkedSolutionBlock';

interface MistakeBatchDiagnosisPanelProps {
  mistakes: MistakeEntry[];
  trapLedger: Record<string, TrapLedgerEntry>;
  onOpenQuestionById: (qId: string) => void;
}

export const MistakeBatchDiagnosisPanel: React.FC<MistakeBatchDiagnosisPanelProps> = ({
  mistakes,
  trapLedger,
  onOpenQuestionById,
}) => {
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [diagnosis, setDiagnosis] = useState<MistakeDiagnosisReport | null>(null);

  const runDiagnosis = async () => {
    if (mistakes.length === 0) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const payload = buildMistakeDiagnosisPayload(mistakes, trapLedger);
      const res = await fetch('/api/coach/mistake-diagnosis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        diagnosis?: MistakeDiagnosisReport;
      };
      if (!res.ok || !data.ok || !data.diagnosis) {
        setErrorMsg(data.error || `Diagnosis failed (HTTP ${res.status}).`);
        return;
      }
      setDiagnosis(data.diagnosis);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Network error contacting AI coach.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-2xl border border-[#E6E4DD] bg-white p-5 space-y-4 dark:border-[#262C36] dark:bg-[#161B22]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-2.5">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-[#0F5132] dark:text-emerald-400" />
          <div>
            <h2 className="font-display text-base font-semibold text-[#14171A] dark:text-[#F0F3F6]">
              AI Mistake Pattern Diagnosis
            </h2>
            <p className="text-xs text-neutral-600 dark:text-neutral-400">
              Analyze your {mistakes.length} logged{' '}
              {mistakes.length === 1 ? 'mistake' : 'mistakes'} and repeat traps with Gemini to surface root FA25 gaps.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {diagnosis && (
            <button
              type="button"
              onClick={() => setDiagnosis(null)}
              className="rounded-lg border border-[#D8D4C8] px-3 py-1.5 text-xs font-semibold text-neutral-600 hover:bg-neutral-50 dark:border-[#303846] dark:text-neutral-300 dark:hover:bg-[#1C222B]"
            >
              Clear
            </button>
          )}
          <button
            type="button"
            disabled={loading || mistakes.length === 0}
            onClick={runDiagnosis}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#0F5132] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#0B3D26] disabled:opacity-50 dark:bg-emerald-600 dark:hover:bg-emerald-500"
          >
            {loading ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Diagnosing Patterns...
              </>
            ) : (
              <>
                <Sparkles className="h-3.5 w-3.5" />
                Analyze Mistakes with Gemini
              </>
            )}
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="flex flex-col gap-2.5 rounded-xl border border-amber-300 bg-amber-50/70 p-3.5 text-xs text-amber-950 sm:flex-row sm:items-center sm:justify-between dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700 dark:text-amber-400" />
            <span>{errorMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => {
              setErrorMsg(null);
              setDiagnosis(buildDeterministicMistakeDiagnosis(mistakes, trapLedger));
            }}
            className="shrink-0 rounded-md border border-amber-400 bg-white px-2.5 py-1 font-semibold text-amber-900 hover:bg-amber-100 dark:border-amber-700 dark:bg-[#161B22] dark:text-amber-200"
          >
            Load Offline FA25 Summary
          </button>
        </div>
      )}

      {diagnosis && (
        <div className="space-y-4 border-t border-[#EFECE4] pt-4 dark:border-[#262C36]">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-bold text-[#14171A] dark:text-[#F0F3F6]">
              {diagnosis.headline}
            </p>
            <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-[#0F5132] dark:text-emerald-400">
              {diagnosis.source === 'gemini' ? 'Gemini FA25 Diagnosis' : 'Offline Rule Summary'}
            </span>
          </div>

          {diagnosis.rootCauses.length > 0 && (
            <div
              className={`grid grid-cols-1 gap-3 ${
                diagnosis.rootCauses.length === 1
                  ? ''
                  : diagnosis.rootCauses.length === 2
                  ? 'md:grid-cols-2'
                  : 'md:grid-cols-2 lg:grid-cols-3'
              }`}
            >
              {diagnosis.rootCauses.map((rc, idx) => (
                <div
                  key={`${rc.title}-${idx}`}
                  className="rounded-xl border border-[#E6E4DD] bg-[#FAF9F6] p-3.5 space-y-2 dark:border-[#262C36] dark:bg-[#12161D]"
                >
                  <p className="text-xs font-bold text-[#14171A] dark:text-[#F0F3F6]">
                    {idx + 1}. {rc.title}
                  </p>
                  <div className="text-xs leading-relaxed text-neutral-700 dark:text-neutral-300">
                    <FormattedCoachText text={rc.ruleFix} />
                  </div>
                  {rc.questionIds && rc.questionIds.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {rc.questionIds.map((qId) => (
                        <button
                          key={qId}
                          type="button"
                          onClick={() => onOpenQuestionById(qId)}
                          className="font-mono text-[11px] font-semibold text-[#0F5132] hover:underline dark:text-emerald-400"
                        >
                          {qId} →
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <div
            className={`grid grid-cols-1 gap-3 text-xs ${
              diagnosis.priorityOrder.length > 0 ? 'sm:grid-cols-2' : ''
            }`}
          >
            {diagnosis.priorityOrder.length > 0 && (
              <div className="rounded-xl border border-[#E6E4DD] bg-[#FAF9F6] p-3.5 dark:border-[#262C36] dark:bg-[#12161D]">
                <p className="font-mono text-[11px] font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                  Recommended Re-Drill Sequence
                </p>
                <ol className="mt-1.5 space-y-1 text-[#14171A] dark:text-neutral-200">
                  {diagnosis.priorityOrder.map((item, idx) => (
                    <li key={idx} className="font-medium">
                      {idx + 1}. {item}
                    </li>
                  ))}
                </ol>
              </div>
            )}

            <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3.5 dark:border-emerald-900/50 dark:bg-emerald-950/20">
              <p className="font-mono text-[11px] font-bold uppercase tracking-wider text-[#0F5132] dark:text-emerald-400">
                Exam-Day Guardrail
              </p>
              <div className="mt-1.5 font-medium leading-relaxed text-[#14171A] dark:text-emerald-100">
                <FormattedCoachText text={diagnosis.examDayRule} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

interface MistakeTutorInlinePanelProps {
  mistake: MistakeEntry;
  question: KitQuestion | undefined;
  onClose: () => void;
  onRedrillQuestion: (qId: string) => void;
}

const QUICK_PROMPTS = [
  'Show me the fastest exam shortcut',
  'What if the date or status changed?',
  'What distractor trap catches students here?',
];

export const MistakeTutorInlinePanel: React.FC<MistakeTutorInlinePanelProps> = ({
  mistake,
  question,
  onClose,
  onRedrillQuestion,
}) => {
  const [mode, setMode] = useState<'tutor' | 'drill'>('tutor');
  const [messages, setMessages] = useState<TutorChatMessage[]>([]);
  const [tutorLoading, setTutorLoading] = useState(false);
  const [tutorError, setTutorError] = useState<string | null>(null);
  const [followUpInput, setFollowUpInput] = useState('');

  // Adaptive Practice Drill state
  const [drill, setDrill] = useState<MistakePracticeDrill | null>(null);
  const [drillLoading, setDrillLoading] = useState(false);
  const [drillError, setDrillError] = useState<string | null>(null);
  const [pickedOption, setPickedOption] = useState<string>('');
  const [drillChecked, setDrillChecked] = useState(false);

  const requestTutorReply = async (nextMessages: TutorChatMessage[]) => {
    setTutorLoading(true);
    setTutorError(null);
    try {
      const res = await fetch('/api/coach/mistake-tutor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mistake,
          questionContext: question
            ? {
                scenario: question.scenario,
                requirement: question.requirement,
                fullWorkedSolution: question.full_worked_solution,
                trapOfQuestion: question.examiner_debrief.trap_of_question,
                speedTrick: question.examiner_debrief.speed_trick,
              }
            : undefined,
          messages: nextMessages,
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        reply?: string;
        error?: string;
      };
      if (!res.ok || !data.ok || !data.reply) {
        setTutorError(data.error || `Tutor request failed (HTTP ${res.status}).`);
        return;
      }
      setMessages([...nextMessages, { role: 'assistant', text: data.reply }]);
    } catch (err) {
      setTutorError(err instanceof Error ? err.message : 'Network error contacting tutor.');
    } finally {
      setTutorLoading(false);
    }
  };

  useEffect(() => {
    // Request initial breakdown automatically on open
    requestTutorReply([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mistake.id]);

  const handleSendFollowUp = (textToSend: string) => {
    const trimmed = textToSend.trim();
    if (!trimmed || tutorLoading) return;
    const nextMessages: TutorChatMessage[] = [
      ...messages,
      { role: 'user', text: trimmed },
    ];
    setMessages(nextMessages);
    setFollowUpInput('');
    requestTutorReply(nextMessages);
  };

  const handleGenerateDrill = async () => {
    setMode('drill');
    setDrillLoading(true);
    setDrillError(null);
    setPickedOption('');
    setDrillChecked(false);
    try {
      const res = await fetch('/api/coach/mistake-drill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mistake,
          questionContext: question
            ? {
                scenario: question.scenario,
                requirement: question.requirement,
                fullWorkedSolution: question.full_worked_solution,
              }
            : undefined,
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        drill?: unknown;
        error?: string;
      };
      if (!res.ok || !data.ok || !data.drill) {
        setDrillError(data.error || `Practice drill generation failed (HTTP ${res.status}).`);
        return;
      }
      setDrill(parseAndValidateDrillResponse(JSON.stringify(data.drill)));
    } catch (err) {
      setDrillError(err instanceof Error ? err.message : 'Could not generate practice check.');
    } finally {
      setDrillLoading(false);
    }
  };

  const loadOfflineVariant = () => {
    const v = generateTrapVariant(mistake.topicId, Math.floor(Math.random() * 3));
    const opts = (v.options as Array<{ key: string; text: string }>).slice(0, 4).map((o, i) => ({
      key: (['A', 'B', 'C', 'D'] as const)[i],
      text: o.text,
    }));
    const correctKey = String(v.correct_answer || 'A').slice(0, 1).toUpperCase() as
      | 'A'
      | 'B'
      | 'C'
      | 'D';
    setDrillError(null);
    setDrill({
      source: 'deterministic',
      stem: v.scenario,
      requirement: v.requirement,
      options: opts,
      correctKey,
      explanation: v.full_worked_solution,
    });
    setPickedOption('');
    setDrillChecked(false);
  };

  return (
    <div className="border-t border-[#E6E4DD] bg-[#FAF9F6] p-4 sm:p-5 space-y-4 dark:border-[#262C36] dark:bg-[#12161D]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Bot className="h-4 w-4 text-[#0F5132] dark:text-emerald-400" />
          <span className="font-display text-sm font-semibold text-[#14171A] dark:text-[#F0F3F6]">
            Gemini Mistake Tutor · {mistake.questionId}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg border border-[#E6E4DD] bg-white p-0.5 dark:border-[#262C36] dark:bg-[#161B22]">
            <button
              type="button"
              onClick={() => setMode('tutor')}
              className={`rounded-md px-2.5 py-1 text-xs font-semibold ${
                mode === 'tutor'
                  ? 'bg-[#0F5132] text-white dark:bg-emerald-600'
                  : 'text-neutral-600 dark:text-neutral-300'
              }`}
            >
              Explain &amp; Ask
            </button>
            <button
              type="button"
              onClick={() => (drill ? setMode('drill') : handleGenerateDrill())}
              className={`rounded-md px-2.5 py-1 text-xs font-semibold ${
                mode === 'drill'
                  ? 'bg-[#0F5132] text-white dark:bg-emerald-600'
                  : 'text-neutral-600 dark:text-neutral-300'
              }`}
            >
              Verify with New Check Q
            </button>
          </div>

          <button
            type="button"
            onClick={() => onRedrillQuestion(mistake.questionId)}
            className="inline-flex items-center gap-1 rounded-lg border border-[#D8D4C8] bg-white px-2.5 py-1 text-xs font-semibold text-[#0F5132] hover:bg-neutral-50 dark:border-[#303846] dark:bg-[#161B22] dark:text-emerald-400"
          >
            Open {mistake.questionId}
            <ArrowRight className="h-3 w-3" />
          </button>

          <button
            type="button"
            aria-label={`Close tutor for ${mistake.questionId}`}
            onClick={onClose}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-[#E6E4DD] bg-white text-neutral-500 hover:text-neutral-800 dark:border-[#262C36] dark:bg-[#161B22] dark:text-neutral-300"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {mode === 'tutor' ? (
        <div className="space-y-3">
          {tutorError && (
            <div className="rounded-xl border border-amber-300 bg-amber-50/70 p-3.5 text-xs space-y-2 text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
              <p className="font-semibold">{tutorError}</p>
              {question && (
                <div className="rounded-lg border border-amber-200 bg-[#FAF9F6] p-3 text-neutral-800 space-y-2 dark:border-amber-900/50 dark:bg-[#161B22] dark:text-neutral-200">
                  <p className="font-mono text-[11px] font-bold uppercase text-[#0F5132] dark:text-emerald-400">
                    Official Kaplan Worked Solution ({question.answer_page})
                  </p>
                  <WorkedSolutionBlock text={question.full_worked_solution} compact />
                </div>
              )}
            </div>
          )}

          {messages.length > 0 && (
            <div className="space-y-2.5">
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={`rounded-xl border p-3.5 text-xs leading-relaxed ${
                    msg.role === 'user'
                      ? 'ml-auto max-w-2xl border-[#0F5132]/30 bg-emerald-50/60 text-[#14171A] dark:border-emerald-800/50 dark:bg-emerald-950/25 dark:text-emerald-100'
                      : 'border-[#E6E4DD] bg-white text-[#14171A] dark:border-[#262C36] dark:bg-[#161B22] dark:text-neutral-200'
                  }`}
                >
                  <p className="mb-1 font-mono text-[10px] font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                    {msg.role === 'user' ? 'You' : 'Gemini TX-UK Tutor'}
                  </p>
                  <FormattedCoachText text={msg.text} />
                </div>
              ))}
            </div>
          )}

          {tutorLoading && (
            <div className="flex items-center gap-2 rounded-xl border border-[#E6E4DD] bg-white px-4 py-3 text-xs text-neutral-600 dark:border-[#262C36] dark:bg-[#161B22] dark:text-neutral-300">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-[#0F5132] dark:text-emerald-400" />
              Working through {mistake.questionId} under Finance Act 2025...
            </div>
          )}

          <div className="flex flex-wrap gap-1.5">
            {QUICK_PROMPTS.map((qText) => (
              <button
                key={qText}
                type="button"
                disabled={tutorLoading}
                onClick={() => handleSendFollowUp(qText)}
                className="rounded-lg border border-[#D8D4C8] bg-white px-2.5 py-1 text-[11px] font-semibold text-neutral-700 hover:bg-[#EFECE4] disabled:opacity-50 dark:border-[#303846] dark:bg-[#161B22] dark:text-neutral-200"
              >
                {qText}
              </button>
            ))}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendFollowUp(followUpInput);
            }}
            className="flex gap-2"
          >
            <input
              type="text"
              aria-label={`Ask Gemini tutor a question about ${mistake.questionId}`}
              value={followUpInput}
              onChange={(e) => setFollowUpInput(e.target.value)}
              placeholder={`Ask about ${mistake.questionId} (e.g. "Why didn't RDE2 add 4%?" or "What if she paid £500?")`}
              className="min-w-0 flex-1 rounded-lg border border-[#D8D4C8] bg-white px-3 py-2 text-xs text-[#14171A] focus:border-[#0F5132] focus:outline-none dark:border-[#303846] dark:bg-[#0D1117] dark:text-[#F0F3F6]"
            />
            <button
              type="submit"
              disabled={tutorLoading || !followUpInput.trim()}
              className="inline-flex items-center gap-1 rounded-lg bg-[#0F5132] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#0B3D26] disabled:opacity-50 dark:bg-emerald-600"
            >
              <Send className="h-3.5 w-3.5" />
              Ask
            </button>
          </form>
        </div>
      ) : (
        <div className="space-y-3">
          {drillLoading ? (
            <div className="flex items-center gap-2 rounded-xl border border-[#E6E4DD] bg-white px-4 py-4 text-xs text-neutral-600 dark:border-[#262C36] dark:bg-[#161B22] dark:text-neutral-300">
              <Loader2 className="h-4 w-4 animate-spin text-[#0F5132] dark:text-emerald-400" />
              Generating a fresh FA25 verification question on {mistake.topicName}...
            </div>
          ) : drillError ? (
            <div className="flex flex-col gap-2.5 rounded-xl border border-amber-300 bg-amber-50/70 p-3.5 text-xs text-amber-950 sm:flex-row sm:items-center sm:justify-between dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
              <span>{drillError}</span>
              <button
                type="button"
                onClick={loadOfflineVariant}
                className="shrink-0 rounded-md border border-amber-400 bg-white px-2.5 py-1 font-semibold text-amber-900 hover:bg-amber-100 dark:border-amber-700 dark:bg-[#161B22] dark:text-amber-200"
              >
                Use Deterministic FA25 Variant
              </button>
            </div>
          ) : drill ? (
            <div className="rounded-xl border border-[#E6E4DD] bg-white p-4 space-y-3 dark:border-[#262C36] dark:bg-[#161B22]">
              <div className="flex items-center justify-between text-[11px] font-mono">
                <span className="font-bold uppercase text-[#0F5132] dark:text-emerald-400">
                  {drill.source === 'gemini' ? 'Gemini Fresh Verification Q' : 'FA25 Trap Variant Check'}
                </span>
                <button
                  type="button"
                  onClick={handleGenerateDrill}
                  className="font-semibold text-neutral-600 hover:underline dark:text-neutral-300"
                >
                  New Numbers →
                </button>
              </div>
              <p className="text-xs leading-relaxed text-[#14171A] dark:text-neutral-200">
                {drill.stem}
              </p>
              <p className="text-xs font-bold text-[#14171A] dark:text-white">
                {drill.requirement}
              </p>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {drill.options.map((opt) => {
                  const chosen = pickedOption === opt.key;
                  const isCorrect = drillChecked && opt.key === drill.correctKey;
                  const isWrong = drillChecked && chosen && opt.key !== drill.correctKey;
                  return (
                    <button
                      key={opt.key}
                      type="button"
                      disabled={drillChecked}
                      onClick={() => setPickedOption(opt.key)}
                      className={`rounded-lg border px-3 py-2 text-left text-xs transition-colors ${
                        isCorrect
                          ? 'border-[#0F5132] bg-emerald-50 font-semibold text-[#0F5132] dark:border-emerald-500 dark:bg-emerald-950/40 dark:text-emerald-300'
                          : isWrong
                          ? 'border-red-400 bg-red-50 font-semibold text-red-800 dark:border-red-700 dark:bg-red-950/40 dark:text-red-300'
                          : chosen
                          ? 'border-[#0F5132] bg-[#FAF9F6] font-semibold text-[#14171A] dark:border-emerald-500 dark:bg-[#1C222B] dark:text-white'
                          : 'border-[#E6E4DD] bg-[#FAF9F6] text-neutral-800 hover:bg-[#EFECE4] dark:border-[#262C36] dark:bg-[#12161D] dark:text-neutral-200'
                      }`}
                    >
                      <span className="font-mono font-bold mr-1.5">{opt.key}.</span>
                      {opt.text}
                    </button>
                  );
                })}
              </div>

              {!drillChecked ? (
                <button
                  type="button"
                  disabled={!pickedOption}
                  onClick={() => setDrillChecked(true)}
                  className="rounded-lg bg-[#0F5132] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#0B3D26] disabled:opacity-40 dark:bg-emerald-600"
                >
                  Check Verification Answer
                </button>
              ) : (
                <div className="rounded-lg border border-[#E6E4DD] bg-[#FAF9F6] p-3 text-xs space-y-1 dark:border-[#262C36] dark:bg-[#12161D]">
                  <p className="flex items-center gap-1.5 font-bold">
                    {pickedOption === drill.correctKey ? (
                      <span className="inline-flex items-center gap-1 text-[#0F5132] dark:text-emerald-400">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Correct ({drill.correctKey}) — Rule locked in!
                      </span>
                    ) : (
                      <span className="text-red-700 dark:text-red-400">
                        Picked {pickedOption}, Correct is {drill.correctKey}
                      </span>
                    )}
                  </p>
                  <div className="text-neutral-700 dark:text-neutral-300">
                    <FormattedCoachText text={drill.explanation} />
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
};
