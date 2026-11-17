import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  BookOpen,
  Calculator,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Clock,
  HelpCircle,
  ListFilter,
  Pause,
  Play,
  RotateCcw,
  Search,
  ShieldCheck,
  Sparkles,
  X,
  XCircle,
} from 'lucide-react';
import { TOPICS } from '../data/taxReference';
import {
  auditEasyMarks,
  buildWrongAnswerFeedback,
  coachCbePresentation,
  formatRichAnswer,
  gradeQuestion,
  gradeSubItem,
  type GradedResult,
  type UserQuestionAnswer,
} from '../engine/scoring';
import {
  generateTrapVariant,
  getProformaTemplateForTopic,
} from '../engine/taxCalculators';
import { formatMarkSchemeLabel } from '../engine/workedSolutionParser';
import type {
  AppState,
  CaseSubQuestion,
  KitQuestion,
  MatrixOptions,
  McqOption,
  PairDropdownGroup,
} from '../types/tx';
import { FormattedCoachText } from './FormattedCoachText';
import { ScenarioText } from './ScenarioText';
import { TaxCalculatorPad } from './TaxCalculatorPad';
import { TaxTablesDrawer } from './TaxTablesView';
import { WorkedSolutionBlock } from './WorkedSolutionBlock';

function isSubAnswered(val: unknown): boolean {
  if (val === undefined || val === null) return false;
  if (typeof val === 'string') return val.trim().length > 0;
  if (Array.isArray(val)) return val.some((x) => typeof x === 'string' && x.trim().length > 0);
  if (typeof val === 'object') {
    return Object.values(val as Record<string, unknown>).some(
      (arr) => Array.isArray(arr) && arr.length > 0
    );
  }
  return false;
}

interface QuestionPlayerProps {
  question: KitQuestion;
  allQuestions: KitQuestion[];
  tier: 1 | 2 | 3 | 4;
  appState: AppState;
  onSelectQuestion: (q: KitQuestion) => void;
  onRecordAttempt: (params: {
    question: KitQuestion;
    tier: 1 | 2 | 3 | 4;
    marksScored: number;
    marksAvailable: number;
    freeMarksCaptured: number;
    freeMarksTotal: number;
    userAnswerSummary: string;
    correctAnswerSummary: string;
    elapsedSeconds: number;
  }) => { microDrillTriggeredCategory: string | null };
  onLaunchMicroDrill: (trapCategory: string) => void;
}

function formatClock(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${String(m).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
}

const TOPIC_AREA_BY_ID: Record<number, string> = Object.fromEntries(
  TOPICS.map((t) => [t.id, t.syllabusArea])
);

export const QuestionPlayer: React.FC<QuestionPlayerProps> = ({
  question,
  allQuestions,
  tier,
  appState,
  onSelectQuestion,
  onRecordAttempt,
  onLaunchMicroDrill,
}) => {
  const budgetSeconds = Math.round(question.marks * 1.8 * 60);

  const [answer, setAnswer] = useState<UserQuestionAnswer>('');
  const [scratchPad, setScratchPad] = useState('');
  const [showScratchPad, setShowScratchPad] = useState(false);
  const [locked, setLocked] = useState(false);
  const [graded, setGraded] = useState<GradedResult | null>(null);
  const [checkedSteps, setCheckedSteps] = useState<Record<string, boolean>>({});
  const [showHint, setShowHint] = useState(false);
  const [tablesOpen, setTablesOpen] = useState(false);
  const [calcOpen, setCalcOpen] = useState(false);
  const [calcExpr, setCalcExpr] = useState('');
  const [secondsLeft, setSecondsLeft] = useState(budgetSeconds);
  const [timerRunning, setTimerRunning] = useState(true);
  const [microDrillAlert, setMicroDrillAlert] = useState<string | null>(null);
  const [aiCritique, setAiCritique] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [cbeCheckerOpen, setCbeCheckerOpen] = useState(true);
  const [crScoreConfirmed, setCrScoreConfirmed] = useState(false);
  const feedbackRef = React.useRef<HTMLElement | null>(null);

  // Slide-out Bank Queue Drawer state (keeps player viewport clean & focused)
  const [queueOpen, setQueueOpen] = useState(false);
  const [secFilter, setSecFilter] = useState<'ALL' | 'A' | 'B' | 'C'>('ALL');
  const [areaFilter, setAreaFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'unattempted' | 'missed'>('ALL');
  const [searchQ, setSearchQ] = useState('');

  const resetWorkspaceInputs = React.useCallback(() => {
    if (question.type === 'case') {
      const subs = question.options as CaseSubQuestion[];
      setAnswer(
        subs.map((sq) => {
          if (sq.interaction === 'multi_select') return [];
          if (sq.interaction === 'matrix') return {};
          if (sq.interaction === 'pair_dropdown') return [];
          return '';
        })
      );
    } else if (question.interaction === 'multi_select' || question.interaction === 'pair_dropdown') {
      setAnswer([]);
    } else if (question.interaction === 'matrix') {
      setAnswer({});
    } else {
      setAnswer('');
    }

    setScratchPad('');
    setLocked(false);
    setGraded(null);
    setCheckedSteps({});
    setCrScoreConfirmed(false);
    setShowHint(false);
    setSecondsLeft(Math.round(question.marks * 1.8 * 60));
    setTimerRunning(true);
    setMicroDrillAlert(null);
    setAiCritique(null);
  }, [question.type, question.interaction, question.options, question.marks]);

  // Reset state and scroll cleanly to top whenever question changes
  useEffect(() => {
    resetWorkspaceInputs();
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [question.id, resetWorkspaceInputs]);

  useEffect(() => {
    if (!timerRunning || locked) return;
    const id = window.setInterval(() => {
      setSecondsLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => window.clearInterval(id);
  }, [timerRunning, locked]);

  // Keyboard shortcuts for fast practice flow
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && queueOpen) {
        e.preventDefault();
        setQueueOpen(false);
        return;
      }
      const targetEl = e.target as HTMLElement | null;
      const tag = targetEl?.tagName;
      const inputType = tag === 'INPUT' ? (targetEl as HTMLInputElement).type.toLowerCase() : '';
      if (tag === 'TEXTAREA' || tag === 'SELECT' || (tag === 'INPUT' && inputType !== 'radio' && inputType !== 'checkbox')) {
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const k = e.key.toLowerCase();
      if (k === 'c') {
        e.preventDefault();
        setCalcOpen((v) => !v);
        return;
      }
      if (k === 't') {
        e.preventDefault();
        setTablesOpen((v) => !v);
        return;
      }
      if (k === 'h' && !locked) {
        e.preventDefault();
        setShowHint((v) => !v);
        return;
      }
      if (!locked && question.type === 'mcq' && (question.interaction === 'single_mcq' || question.interaction === 'grid_2x2')) {
        const opts = Array.isArray(question.options) ? (question.options as McqOption[]) : [];
        const mapIdx = ['a', 'b', 'c', 'd'].indexOf(k);
        const numIdx = ['1', '2', '3', '4'].indexOf(k);
        const picked = opts[mapIdx >= 0 ? mapIdx : numIdx];
        if (picked) {
          e.preventDefault();
          setAnswer(picked.key);
          return;
        }
        if (e.key === 'Enter' && typeof answer === 'string' && answer.trim().length > 0) {
          e.preventDefault();
          handleSubmit(false);
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [locked, question, queueOpen, answer]);

  const watchlistTraps = useMemo(() => {
    return Object.values(appState.trapLedger)
      .filter((t) => t.hitCount > 0)
      .sort((a, b) => b.hitCount - a.hitCount)
      .slice(0, 2);
  }, [appState.trapLedger]);

  const attemptedIds = useMemo(
    () => new Set(appState.attempts.map((a) => a.questionId)),
    [appState.attempts]
  );
  const missedIds = useMemo(
    () => new Set(appState.mistakes.map((m) => m.questionId)),
    [appState.mistakes]
  );

  const filteredList = useMemo(() => {
    const q = searchQ.trim().toLowerCase();
    return allQuestions.filter((item) => {
      if (secFilter !== 'ALL' && item.section !== secFilter) return false;
      if (areaFilter === 'Specimen') {
        if (!item.id.startsWith('SPEC-')) return false;
      } else if (areaFilter !== 'ALL') {
        if (TOPIC_AREA_BY_ID[item.topic_id] !== areaFilter) return false;
      }
      if (statusFilter === 'unattempted' && attemptedIds.has(item.id)) return false;
      if (statusFilter === 'missed' && !missedIds.has(item.id)) return false;
      if (!q) return true;
      return (
        item.id.toLowerCase().includes(q) ||
        item.title.toLowerCase().includes(q) ||
        item.topic.toLowerCase().includes(q)
      );
    });
  }, [allQuestions, secFilter, areaFilter, statusFilter, searchQ, attemptedIds, missedIds]);

  const currentIdx = filteredList.findIndex((item) => item.id === question.id);

  useEffect(() => {
    const onNavKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === '[' && currentIdx > 0) {
        e.preventDefault();
        onSelectQuestion(filteredList[currentIdx - 1]);
      } else if (e.key === ']' && currentIdx >= 0 && currentIdx < filteredList.length - 1) {
        e.preventDefault();
        onSelectQuestion(filteredList[currentIdx + 1]);
      }
    };
    window.addEventListener('keydown', onNavKey);
    return () => window.removeEventListener('keydown', onNavKey);
  }, [currentIdx, filteredList, onSelectQuestion]);

  const handleSubmit = (skipReveal = false) => {
    const elapsed = Math.max(1, budgetSeconds - secondsLeft);
    const activeAns = skipReveal ? null : answer;
    const result = gradeQuestion(question, activeAns);
    const richUserSummary =
      question.type === 'cr' || question.type === 'case'
        ? result.userDisplay
        : formatRichAnswer(question.interaction, question.options, activeAns);
    const richCorrectSummary =
      question.type === 'cr' || question.type === 'case'
        ? result.correctDisplay
        : formatRichAnswer(question.interaction, question.options, question.correct_answer);
    const easyAudit =
      question.type === 'cr' && typeof answer === 'string'
        ? auditEasyMarks(answer, question)
        : { capturedCount: 0, totalChecks: 0, checks: [] };

    const initialChecks: Record<string, boolean> = {};
    if (result.isAutoGraded && result.isFullyCorrect) {
      question.mark_scheme_steps.forEach((s) => {
        initialChecks[s.id] = true;
      });
    }
    setCheckedSteps(initialChecks);
    setGraded(result);
    setLocked(true);
    setTimerRunning(false);
    setCrScoreConfirmed(false);

    if (typeof window !== 'undefined') {
      window.requestAnimationFrame(() => {
        feedbackRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      });
    }

    if (question.type === 'cr' && !skipReveal) {
      return;
    }

    const { microDrillTriggeredCategory } = onRecordAttempt({
      question,
      tier,
      marksScored: skipReveal ? 0 : result.marksScored,
      marksAvailable: question.marks,
      freeMarksCaptured: easyAudit.capturedCount,
      freeMarksTotal: easyAudit.totalChecks,
      userAnswerSummary: skipReveal ? 'Skipped / Revealed' : richUserSummary,
      correctAnswerSummary: richCorrectSummary,
      elapsedSeconds: elapsed,
    });

    if (microDrillTriggeredCategory) {
      setMicroDrillAlert(microDrillTriggeredCategory);
    }
  };

  const selfMarkedScore = useMemo(() => {
    if (!locked) return 0;
    if (question.type !== 'cr' && graded?.isAutoGraded) {
      return graded.marksScored;
    }
    let total = 0;
    for (const step of question.mark_scheme_steps) {
      if (checkedSteps[step.id]) total += step.marks;
    }
    return Math.min(question.marks, Math.round(total * 2) / 2);
  }, [locked, question, graded, checkedSteps]);

  const handleApplySelfMarkToProgress = () => {
    if (crScoreConfirmed) return;
    const easyAudit =
      typeof answer === 'string'
        ? auditEasyMarks(answer, question)
        : { capturedCount: 0, totalChecks: 0, checks: [] };

    const { microDrillTriggeredCategory } = onRecordAttempt({
      question,
      tier,
      marksScored: selfMarkedScore,
      marksAvailable: question.marks,
      freeMarksCaptured: easyAudit.capturedCount,
      freeMarksTotal: easyAudit.totalChecks,
      userAnswerSummary: `CR Self-Marked ${selfMarkedScore}/${question.marks}`,
      correctAnswerSummary: question.mark_scheme_steps.map((s) => s.label).join(' · '),
      elapsedSeconds: Math.max(1, budgetSeconds - secondsLeft),
    });
    setCrScoreConfirmed(true);
    if (microDrillTriggeredCategory) {
      setMicroDrillAlert(microDrillTriggeredCategory);
    }
  };

  const handleRequestAiFeedback = async () => {
    if (typeof answer !== 'string' || !answer.trim()) return;
    setAiLoading(true);
    try {
      const res = await fetch('/api/coach/grade-cr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionTitle: question.title,
          requirement: question.requirement,
          modelSolution: question.full_worked_solution,
          userResponse: answer,
          marks: question.marks,
        }),
      });
      const json = await res.json();
      setAiCritique(json.feedback || 'Feedback unavailable.');
    } catch {
      setAiCritique('Could not connect to marking service; use the step checkboxes below.');
    } finally {
      setAiLoading(false);
    }
  };

  const renderSingleOrSubInput = (
    interaction: string,
    options: McqOption[] | MatrixOptions | PairDropdownGroup[],
    val: unknown,
    onChange: (nextVal: UserQuestionAnswer) => void,
    prefixKey: string,
    onEnterSubmit?: () => void,
    revealExpected?: unknown
  ) => {
    const hasReveal = locked && revealExpected !== undefined;

    if (interaction === 'numeric_input') {
      const subGrade = hasReveal ? gradeSubItem('numeric_input', revealExpected, val) : null;
      return (
        <div className="max-w-sm space-y-2">
          <label className="mb-1.5 block text-xs font-semibold text-neutral-600 dark:text-neutral-300">
            Enter whole £ figure (no commas needed):
          </label>
          <div
            className={`flex items-center rounded-xl border bg-white dark:bg-[#12161D] ${
              subGrade
                ? subGrade.correct
                  ? 'border-[#0F5132] ring-1 ring-emerald-500/30 dark:border-emerald-500'
                  : 'border-red-400 ring-1 ring-red-500/20 dark:border-red-700'
                : 'border-[#D8D4C8] focus-within:border-[#0F5132] dark:border-[#303846] dark:focus-within:border-emerald-500'
            }`}
          >
            <span className="border-r border-[#E6E4DD] bg-[#FAF9F6] px-3.5 py-2.5 font-mono text-sm font-bold text-neutral-700 dark:border-[#262C36] dark:bg-[#1C222B] dark:text-neutral-200">
              £
            </span>
            <input
              type="text"
              inputMode="numeric"
              disabled={locked}
              value={typeof val === 'string' ? val : ''}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !locked && onEnterSubmit) {
                  e.preventDefault();
                  onEnterSubmit();
                }
              }}
              placeholder="e.g. 7420"
              className="w-full bg-transparent px-3.5 py-2.5 font-mono text-sm font-semibold text-[#14171A] focus:outline-none disabled:opacity-80 dark:text-[#F0F3F6]"
            />
          </div>
          {subGrade && !subGrade.correct && (
            <p className="font-mono text-xs font-semibold text-[#0F5132] dark:text-emerald-400">
              ✓ Correct Answer: {subGrade.expectedDisplay}
            </p>
          )}
        </div>
      );
    }

    if (interaction === 'matrix') {
      const mat = options as MatrixOptions;
      const curObj = (val && typeof val === 'object' && !Array.isArray(val)
        ? val
        : {}) as Record<string, string[]>;
      const expObj = (hasReveal && revealExpected && typeof revealExpected === 'object' && !Array.isArray(revealExpected)
        ? revealExpected
        : null) as Record<string, string[]> | null;

      return (
        <div className="overflow-x-auto rounded-xl border border-[#E6E4DD] dark:border-[#262C36]">
          <table className="min-w-full divide-y divide-[#EFECE4] text-xs dark:divide-[#262C36]">
            <thead>
              <tr className="bg-[#FAF9F6] font-semibold text-neutral-700 dark:bg-[#12161D] dark:text-neutral-300">
                <th className="px-3.5 py-2.5 text-left">Item / Statement</th>
                {mat.columns.map((col, cIdx) => (
                  <th key={cIdx} className="px-3.5 py-2.5 text-center">
                    {col}
                  </th>
                ))}
                {expObj && <th className="px-3.5 py-2.5 text-left">Result</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EFECE4] bg-white dark:divide-[#262C36] dark:bg-[#161B22]">
              {mat.rows.map((rowText, rIdx) => {
                const rowKey = String(rIdx);
                const selectedCols = curObj[rowKey] ?? [];
                const expectedCols = expObj ? expObj[rowKey] ?? [] : null;
                const rowOk =
                  expectedCols !== null &&
                  expectedCols.length === selectedCols.length &&
                  expectedCols.every((c) => selectedCols.includes(c));
                return (
                  <tr
                    key={rIdx}
                    className={
                      expectedCols
                        ? rowOk
                          ? 'bg-emerald-50/40 dark:bg-emerald-950/15'
                          : 'bg-red-50/40 dark:bg-red-950/15'
                        : undefined
                    }
                  >
                    <td className="px-3.5 py-3 font-medium text-[#14171A] dark:text-[#F0F3F6]">
                      {rowText}
                    </td>
                    {mat.columns.map((col, cIdx) => {
                      const checked = selectedCols.includes(col);
                      const isExpCell = expectedCols?.includes(col) ?? false;
                      return (
                        <td
                          key={cIdx}
                          className={`px-3.5 py-3 text-center ${
                            expectedCols && isExpCell
                              ? 'bg-emerald-50/70 dark:bg-emerald-950/30'
                              : ''
                          }`}
                        >
                          <input
                            type="checkbox"
                            aria-label={`${rowText} — ${col}`}
                            disabled={locked}
                            checked={checked}
                            onChange={() => {
                              const nextCols = checked
                                ? selectedCols.filter((c) => c !== col)
                                : [...selectedCols, col];
                              onChange({ ...curObj, [rowKey]: nextCols });
                            }}
                            className="h-4 w-4 rounded border-neutral-300 text-[#0F5132]"
                          />
                        </td>
                      );
                    })}
                    {expectedCols && (
                      <td className="px-3.5 py-3 font-mono text-[11px] font-semibold">
                        {rowOk ? (
                          <span className="text-[#0F5132] dark:text-emerald-400">✓ Correct</span>
                        ) : (
                          <span className="text-red-700 dark:text-red-400">
                            ✗ Ans: {expectedCols.join(', ') || 'None'}
                          </span>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      );
    }

    if (interaction === 'pair_dropdown') {
      const groups = options as PairDropdownGroup[];
      const curArr = Array.isArray(val) ? (val as string[]) : [];
      const expArr = hasReveal && Array.isArray(revealExpected) ? (revealExpected as string[]) : null;
      return (
        <div className="space-y-3">
          {groups.map((grp, idx) => {
            const chosen = curArr[idx] ?? '';
            const expectedChoice = expArr?.[idx];
            const isRowOk =
              expectedChoice !== undefined &&
              chosen.trim().toLowerCase() === expectedChoice.trim().toLowerCase();
            return (
              <div
                key={idx}
                className={`space-y-1.5 rounded-xl border p-3.5 ${
                  expArr
                    ? isRowOk
                      ? 'border-emerald-300 bg-emerald-50/50 dark:border-emerald-800 dark:bg-emerald-950/20'
                      : 'border-red-300 bg-red-50/50 dark:border-red-900/60 dark:bg-red-950/20'
                    : 'border-[#E6E4DD] bg-[#FAF9F6] dark:border-[#262C36] dark:bg-[#12161D]'
                }`}
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-xs font-semibold text-[#14171A] dark:text-[#F0F3F6]">
                    {grp.group}
                  </span>
                  <select
                    disabled={locked}
                    value={chosen}
                    onChange={(e) => {
                      const next = [...curArr];
                      next[idx] = e.target.value;
                      onChange(next);
                    }}
                    className="rounded-lg border border-[#D8D4C8] bg-white px-3 py-2 text-xs font-medium text-[#14171A] dark:border-[#303846] dark:bg-[#1C222B] dark:text-[#F0F3F6]"
                  >
                    <option value="">Select option...</option>
                    {grp.choices.map((ch, cIdx) => (
                      <option key={cIdx} value={ch}>
                        {ch}
                      </option>
                    ))}
                  </select>
                </div>
                {expArr && !isRowOk && (
                  <p className="font-mono text-[11px] font-semibold text-[#0F5132] dark:text-emerald-400">
                    ✓ Correct choice: {expectedChoice}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      );
    }

    if (interaction === 'multi_select') {
      const opts = options as McqOption[];
      const curArr = Array.isArray(val) ? (val as string[]) : [];
      const expArr = hasReveal && Array.isArray(revealExpected) ? (revealExpected as string[]) : null;
      return (
        <div className="space-y-2.5">
          <p className="text-xs font-semibold text-neutral-500 dark:text-neutral-400">
            Select all matching options:
          </p>
          {opts.map((opt) => {
            const checked = curArr.includes(opt.key);
            const isExpected = expArr ? expArr.includes(opt.key) : false;
            const isWrongPick = Boolean(expArr && checked && !isExpected);
            const isCorrectReveal = Boolean(expArr && isExpected);
            return (
              <label
                key={`${prefixKey}-${opt.key}`}
                className={`flex cursor-pointer items-start justify-between gap-3 rounded-xl border px-4 py-3 text-sm transition-colors ${
                  isWrongPick
                    ? 'border-red-400 bg-red-50/70 dark:border-red-700 dark:bg-red-950/30'
                    : isCorrectReveal
                    ? 'border-[#0F5132] bg-emerald-50/80 dark:border-emerald-500 dark:bg-emerald-950/35'
                    : checked
                    ? 'border-[#0F5132] bg-emerald-50/70 dark:border-emerald-500 dark:bg-emerald-950/30'
                    : 'border-[#E6E4DD] bg-white hover:bg-[#FAF9F6] dark:border-[#262C36] dark:bg-[#161B22] dark:hover:bg-[#1C222B]'
                }`}
              >
                <span className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    disabled={locked}
                    checked={checked}
                    onChange={() => {
                      const next = checked
                        ? curArr.filter((k) => k !== opt.key)
                        : [...curArr, opt.key];
                      onChange(next);
                    }}
                    className="mt-1 h-4 w-4 rounded border-neutral-300 text-[#0F5132]"
                  />
                  <span>
                    <span className="mr-2 font-mono text-xs font-bold text-neutral-500 dark:text-neutral-400">
                      {opt.key}.
                    </span>
                    <span className="text-[#14171A] dark:text-[#F0F3F6]">{opt.text}</span>
                  </span>
                </span>
                {isCorrectReveal && (
                  <span className="shrink-0 font-mono text-[11px] font-bold text-[#0F5132] dark:text-emerald-400">
                    ✓ Correct
                  </span>
                )}
                {isWrongPick && (
                  <span className="shrink-0 font-mono text-[11px] font-bold text-red-700 dark:text-red-400">
                    ✗ Your pick
                  </span>
                )}
              </label>
            );
          })}
        </div>
      );
    }

    const opts = Array.isArray(options) ? (options as McqOption[]) : [];
    const curVal = typeof val === 'string' ? val : '';
    const expKey = hasReveal ? String(revealExpected ?? '').trim().toUpperCase() : null;
    return (
      <div className="space-y-2.5">
        {opts.map((opt) => {
          const selected = curVal === opt.key;
          const isCorrectReveal = Boolean(expKey && opt.key.toUpperCase() === expKey);
          const isWrongPick = Boolean(expKey && selected && !isCorrectReveal);
          return (
            <label
              key={`${prefixKey}-${opt.key}`}
              className={`flex cursor-pointer items-start justify-between gap-3 rounded-xl border px-4 py-3 text-sm transition-colors ${
                isWrongPick
                  ? 'border-red-400 bg-red-50/75 dark:border-red-700 dark:bg-red-950/30'
                  : isCorrectReveal
                  ? 'border-[#0F5132] bg-emerald-50/80 dark:border-emerald-500 dark:bg-emerald-950/35'
                  : selected
                  ? 'border-[#0F5132] bg-emerald-50/70 dark:border-emerald-500 dark:bg-emerald-950/30'
                  : 'border-[#E6E4DD] bg-white hover:bg-[#FAF9F6] dark:border-[#262C36] dark:bg-[#161B22] dark:hover:bg-[#1C222B]'
              }`}
            >
              <span className="flex items-start gap-3">
                <input
                  type="radio"
                  name={`radio-${prefixKey}`}
                  disabled={locked}
                  checked={selected}
                  onChange={() => onChange(opt.key)}
                  className="mt-1 h-4 w-4 border-neutral-300 text-[#0F5132]"
                />
                <span>
                  <span className="mr-2 font-mono text-xs font-bold text-neutral-500 dark:text-neutral-400">
                    {opt.key}.
                  </span>
                  <span className="text-[#14171A] dark:text-[#F0F3F6]">{opt.text}</span>
                </span>
              </span>
              {isCorrectReveal && (
                <span className="shrink-0 font-mono text-[11px] font-bold text-[#0F5132] dark:text-emerald-400">
                  ✓ Correct Answer
                </span>
              )}
              {isWrongPick && (
                <span className="shrink-0 font-mono text-[11px] font-bold text-red-700 dark:text-red-400">
                  ✗ Your Choice
                </span>
              )}
            </label>
          );
        })}
      </div>
    );
  };

  const liveCbeCheck = useMemo(
    () =>
      question.type === 'cr'
        ? coachCbePresentation(typeof answer === 'string' ? answer : '', question)
        : null,
    [question, answer]
  );

  const crAudit =
    locked && question.type === 'cr' && typeof answer === 'string'
      ? auditEasyMarks(answer, question)
      : null;
  const crPresentation =
    locked && question.type === 'cr' ? liveCbeCheck : null;

  return (
    <div className="space-y-5">
      <TaxTablesDrawer
        open={tablesOpen}
        onClose={() => setTablesOpen(false)}
        onOpenQuestionById={(qId) => {
          setTablesOpen(false);
          const found = allQuestions.find((q) => q.id === qId);
          if (found) onSelectQuestion(found);
        }}
      />

      {/* Slide-out Question Queue Drawer */}
      {queueOpen && (
        <div
          onClick={() => setQueueOpen(false)}
          className="fixed inset-0 z-50 flex justify-start bg-black/40 backdrop-blur-[1px]"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex h-full w-full max-w-md flex-col border-r border-[#E6E4DD] bg-white shadow-2xl dark:border-[#262C36] dark:bg-[#161B22]"
          >
            <div className="flex items-center justify-between border-b border-[#E6E4DD] px-5 py-4 dark:border-[#262C36]">
              <div>
                <h2 className="font-display text-base font-semibold text-[#14171A] dark:text-[#F0F3F6]">
                  Question Bank Queue ({filteredList.length}/{allQuestions.length})
                </h2>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  Kaplan TX-UK FA25 Kit + Specimen
                </p>
              </div>
              <button
                type="button"
                aria-label="Close question queue"
                onClick={() => setQueueOpen(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[#E6E4DD] text-neutral-600 hover:bg-neutral-100 dark:border-[#262C36] dark:text-neutral-300"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3 border-b border-[#EFECE4] p-4 dark:border-[#262C36]">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-2.5 h-3.5 w-3.5 text-neutral-400" />
                <input
                  type="text"
                  aria-label="Search question bank"
                  value={searchQ}
                  onChange={(e) => setSearchQ(e.target.value)}
                  placeholder="Jump to Q#, title, or topic..."
                  className="w-full rounded-lg border border-[#D8D4C8] bg-[#FAF9F6] py-2 pl-8 pr-8 text-xs text-[#14171A] focus:border-[#0F5132] focus:outline-none dark:border-[#303846] dark:bg-[#0D1117] dark:text-[#F0F3F6]"
                />
                {searchQ && (
                  <button
                    type="button"
                    aria-label="Clear question search"
                    onClick={() => setSearchQ('')}
                    className="absolute right-2.5 top-2 rounded p-0.5 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              <div className="flex flex-wrap gap-1.5">
                {(['ALL', 'A', 'B', 'C'] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSecFilter(s)}
                    className={`rounded-md px-2.5 py-1 text-xs font-semibold ${
                      secFilter === s
                        ? 'bg-[#0F5132] text-white dark:bg-emerald-600'
                        : 'bg-[#FAF9F6] text-neutral-600 hover:bg-[#EFECE4] dark:bg-[#1C222B] dark:text-neutral-300'
                    }`}
                  >
                    {s === 'ALL' ? 'All Sec' : `Sec ${s}`}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <select
                  aria-label="Filter by syllabus area"
                  value={areaFilter}
                  onChange={(e) => setAreaFilter(e.target.value)}
                  className="rounded-lg border border-[#D8D4C8] bg-[#FAF9F6] px-2.5 py-1.5 text-xs font-medium text-[#14171A] dark:border-[#303846] dark:bg-[#0D1117] dark:text-[#F0F3F6]"
                >
                  <option value="ALL">All Areas ({allQuestions.length})</option>
                  <option value="Income Tax & NIC">Income Tax &amp; NIC</option>
                  <option value="Chargeable Gains">Chargeable Gains</option>
                  <option value="Inheritance Tax">Inheritance Tax</option>
                  <option value="Corporation Tax">Corporation Tax</option>
                  <option value="VAT">VAT</option>
                  <option value="UK Tax System">UK Tax System</option>
                  <option value="Specimen">Specimen CBE</option>
                </select>

                <select
                  aria-label="Filter by status"
                  value={statusFilter}
                  onChange={(e) =>
                    setStatusFilter(e.target.value as 'ALL' | 'unattempted' | 'missed')
                  }
                  className="rounded-lg border border-[#D8D4C8] bg-[#FAF9F6] px-2.5 py-1.5 text-xs font-medium text-[#14171A] dark:border-[#303846] dark:bg-[#0D1117] dark:text-[#F0F3F6]"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="unattempted">Unattempted</option>
                  <option value="missed">Missed ({missedIds.size})</option>
                </select>
              </div>
            </div>

            <div className="flex-1 divide-y divide-[#EFECE4] overflow-y-auto dark:divide-[#262C36]">
              {filteredList.length === 0 ? (
                <div className="p-6 text-center text-xs text-neutral-500">
                  No questions match those filters.{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setSecFilter('ALL');
                      setAreaFilter('ALL');
                      setStatusFilter('ALL');
                      setSearchQ('');
                    }}
                    className="font-semibold text-[#0F5132] hover:underline"
                  >
                    Reset
                  </button>
                </div>
              ) : (
                filteredList.map((item) => {
                  const isActive = item.id === question.id;
                  const isAttempted = attemptedIds.has(item.id);
                  const isMissed = missedIds.has(item.id);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        onSelectQuestion(item);
                        setQueueOpen(false);
                      }}
                      className={`flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors ${
                        isActive
                          ? 'bg-emerald-50/70 dark:bg-emerald-950/30'
                          : 'hover:bg-[#FAF9F6] dark:hover:bg-[#1C222B]'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 font-mono text-[11px]">
                          <span className="font-bold text-[#0F5132] dark:text-emerald-400">
                            {item.id}
                          </span>
                          <span className="text-neutral-400">·</span>
                          <span className="text-neutral-500 dark:text-neutral-400">
                            Sec {item.section} ({item.marks}m)
                          </span>
                        </div>
                        <p className="truncate text-xs font-semibold text-[#14171A] dark:text-[#F0F3F6]">
                          {item.title.replace(/^KIT\s+\w+\s*/, '')}
                        </p>
                      </div>
                      <span className="shrink-0 font-mono text-[11px] font-semibold">
                        {isMissed ? (
                          <span className="text-red-700 dark:text-red-400">Review</span>
                        ) : isAttempted ? (
                          <span className="text-[#0F5132] dark:text-emerald-400">Done</span>
                        ) : (
                          <span className="text-neutral-400">New</span>
                        )}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Clean Distraction-Free Studio Control Strip */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#E6E4DD] bg-white px-4 py-3 dark:border-[#262C36] dark:bg-[#161B22]">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setQueueOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#D8D4C8] bg-[#FAF9F6] px-3 py-1.5 text-xs font-semibold text-[#14171A] hover:bg-[#EFECE4] dark:border-[#303846] dark:bg-[#1C222B] dark:text-[#F0F3F6]"
          >
            <ListFilter className="h-3.5 w-3.5 text-[#0F5132] dark:text-emerald-400" />
            Browse Bank ({filteredList.length})
          </button>

          <select
            aria-label="Select question from bank"
            value={question.id}
            onChange={(e) => {
              const found = allQuestions.find((x) => x.id === e.target.value);
              if (found) onSelectQuestion(found);
            }}
            className="max-w-[230px] sm:max-w-[285px] rounded-lg border border-[#D8D4C8] bg-[#FAF9F6] px-2.5 py-1.5 text-xs font-semibold text-[#14171A] dark:border-[#303846] dark:bg-[#0D1117] dark:text-[#F0F3F6]"
          >
            {!filteredList.some((x) => x.id === question.id) && (
              <option value={question.id}>
                {question.id} · {question.title}
              </option>
            )}
            {filteredList.map((item) => (
              <option key={item.id} value={item.id}>
                {item.id} ({item.marks}m Sec {item.section}) · {item.title.slice(0, 38)}
              </option>
            ))}
          </select>

          <button
            type="button"
            disabled={currentIdx <= 0}
            onClick={() => currentIdx > 0 && onSelectQuestion(filteredList[currentIdx - 1])}
            className="inline-flex items-center gap-1 rounded-lg border border-[#D8D4C8] bg-white px-2.5 py-1.5 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 disabled:opacity-40 dark:border-[#303846] dark:bg-[#1C222B] dark:text-neutral-200"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            Prev
          </button>
          <button
            type="button"
            disabled={currentIdx < 0 || currentIdx >= filteredList.length - 1}
            onClick={() =>
              currentIdx >= 0 &&
              currentIdx < filteredList.length - 1 &&
              onSelectQuestion(filteredList[currentIdx + 1])
            }
            className="inline-flex items-center gap-1 rounded-lg border border-[#D8D4C8] bg-white px-2.5 py-1.5 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 disabled:opacity-40 dark:border-[#303846] dark:bg-[#1C222B] dark:text-neutral-200"
          >
            Next
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div
            className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 font-mono text-xs font-bold tabular-nums ${
              secondsLeft < budgetSeconds * 0.2
                ? 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-700 dark:bg-amber-950/50 dark:text-amber-200'
                : 'border-[#E6E4DD] bg-[#FAF9F6] text-[#14171A] dark:border-[#262C36] dark:bg-[#12161D] dark:text-[#F0F3F6]'
            }`}
          >
            <Clock className="h-3.5 w-3.5 text-neutral-500" />
            {formatClock(secondsLeft)}
            <button
              type="button"
              aria-label="Pause or resume timer"
              onClick={() => setTimerRunning((r) => !r)}
              className="text-neutral-500 hover:text-[#14171A] dark:hover:text-white"
            >
              {timerRunning ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
            </button>
            <button
              type="button"
              aria-label="Reset timer"
              onClick={() => {
                setSecondsLeft(budgetSeconds);
                setTimerRunning(true);
              }}
              className="text-neutral-500 hover:text-[#14171A] dark:hover:text-white"
            >
              <RotateCcw className="h-3 w-3" />
            </button>
          </div>

          <button
            type="button"
            onClick={() => setCalcOpen((c) => !c)}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold ${
              calcOpen
                ? 'border-[#0F5132] bg-emerald-50 text-[#0F5132] dark:border-emerald-500 dark:bg-emerald-950/40 dark:text-emerald-300'
                : 'border-[#D8D4C8] bg-white text-neutral-700 hover:bg-neutral-50 dark:border-[#303846] dark:bg-[#1C222B] dark:text-neutral-200'
            }`}
          >
            <Calculator className="h-3.5 w-3.5" />
            Calculator
          </button>

          <button
            type="button"
            onClick={() => setTablesOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#D8D4C8] bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 dark:border-[#303846] dark:bg-[#1C222B] dark:text-neutral-200"
          >
            <BookOpen className="h-3.5 w-3.5" />
            Tables
          </button>

          <button
            type="button"
            onClick={() => {
              const varMatch = question.id.match(/^VAR-T\d+-(\d+)$/);
              const currentSeed = varMatch ? Number(varMatch[1]) - 1 : -1;
              const nextSeed = (currentSeed + 1) % 3;
              onSelectQuestion(generateTrapVariant(question.topic_id, nextSeed));
            }}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#14171A] px-3 py-1.5 text-xs font-semibold text-white hover:bg-neutral-800 dark:bg-emerald-600 dark:hover:bg-emerald-500"
          >
            <Sparkles className="h-3.5 w-3.5 text-amber-300" />
            Trap Variant
          </button>
        </div>
      </div>

      {/* Watchlist Banner */}
      {watchlistTraps.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-2.5 text-xs text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/25 dark:text-amber-200">
          <span>
            <strong>Personal Watchlist:</strong>{' '}
            {watchlistTraps.map((w) => `${w.trapCategory} (${w.hitCount} hits)`).join(' · ')}
          </span>
          <span className="font-mono">Read dates &amp; qualifiers twice before answering</span>
        </div>
      )}

      {/* Interactive CBE Calculator Drawer */}
      {calcOpen && (
        <TaxCalculatorPad
          expr={calcExpr}
          onChangeExpr={setCalcExpr}
          canApplyRounded={!locked && question.interaction === 'numeric_input'}
          onApplyRounded={(rounded) => setAnswer(String(rounded))}
          onClose={() => setCalcOpen(false)}
        />
      )}

      {/* Active Question Stage */}
      <div className="rounded-2xl border border-[#E6E4DD] bg-white p-5 sm:p-7 dark:border-[#262C36] dark:bg-[#161B22]">
        <div className="border-b border-[#EFECE4] pb-4 dark:border-[#262C36]">
          <div className="flex flex-wrap items-center gap-2 font-mono text-xs text-neutral-500 dark:text-neutral-400">
            <span className="font-bold text-[#0F5132] dark:text-emerald-400">{question.id}</span>
            <span aria-hidden="true">·</span>
            <span>Section {question.section}</span>
            <span aria-hidden="true">·</span>
            <span>{question.marks} marks</span>
            <span aria-hidden="true">·</span>
            <span>{question.kit_page}</span>
            {question.past_exam && (
              <>
                <span aria-hidden="true">·</span>
                <span>{question.past_exam}</span>
              </>
            )}
          </div>
          <h1 className="mt-1.5 font-display text-xl sm:text-2xl font-semibold text-[#14171A] dark:text-[#F0F3F6]">
            {question.title.replace(/\s*\|\s*$/, '')}
          </h1>
          <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
            Topic {question.topic_id}: {question.topic} ({question.st_chapter}) ·{' '}
            {question.exam_frequency_tag}
          </p>
        </div>

        {/* Split-Screen for Case/CR, Focused Column for Section A */}
        <div
          className={`mt-6 ${
            question.type === 'case' || question.type === 'cr'
              ? 'grid grid-cols-1 gap-6 lg:grid-cols-12'
              : 'space-y-5'
          }`}
        >
          <div
            className={
              question.type === 'case' || question.type === 'cr'
                ? 'lg:col-span-6 lg:sticky lg:top-20 lg:self-start space-y-4'
                : 'space-y-4'
            }
          >
            {question.scenario && <ScenarioText text={question.scenario} />}

            <div className="rounded-xl border border-[#D4DFD7] bg-emerald-50/40 p-4 dark:border-emerald-900/50 dark:bg-emerald-950/20">
              <p className="mb-1 font-mono text-[11px] font-bold uppercase tracking-wider text-[#0F5132] dark:text-emerald-400">
                Requirement
              </p>
              <div className="whitespace-pre-line text-sm font-semibold text-[#14171A] dark:text-[#F0F3F6]">
                {question.requirement}
              </div>
            </div>
          </div>

          <div
            className={
              question.type === 'case' || question.type === 'cr'
                ? 'lg:col-span-6 space-y-4'
                : 'space-y-4'
            }
          >
            {question.type === 'case' ? (
              <div className="space-y-4">
                {(() => {
                  const subs = question.options as CaseSubQuestion[];
                  const arr = Array.isArray(answer) ? answer : [];
                  const answeredCount = subs.filter((_, i) => isSubAnswered(arr[i])).length;
                  return (
                    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#E6E4DD] bg-[#FAF9F6] px-3.5 py-2.5 dark:border-[#262C36] dark:bg-[#12161D]">
                      <span className="font-mono text-xs font-semibold text-neutral-700 dark:text-neutral-300 tabular-nums">
                        Section B Case · {answeredCount}/5 OTs answered
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {subs.map((sq, i) => {
                          const done = isSubAnswered(arr[i]);
                          return (
                            <button
                              key={sq.sub_num}
                              type="button"
                              onClick={() =>
                                document
                                  .getElementById(`player-ot-${sq.sub_num}`)
                                  ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                              }
                              className={`rounded-md border px-2 py-0.5 font-mono text-[11px] font-semibold transition-colors ${
                                done
                                  ? 'border-emerald-300 bg-emerald-50 text-[#0F5132] dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                                  : 'border-[#D8D4C8] bg-white text-neutral-600 hover:bg-neutral-50 dark:border-[#303846] dark:bg-[#1C222B] dark:text-neutral-300'
                              }`}
                            >
                              OT{sq.sub_num}
                              {done ? ' ✓' : ''}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}
                {(question.options as CaseSubQuestion[]).map((sq, idx) => {
                  const arr = Array.isArray(answer) ? answer : [];
                  const subRes = locked && graded?.subResults ? graded.subResults[idx] : null;
                  const subCorrectFull = locked
                    ? formatRichAnswer(sq.interaction, sq.options, sq.correct_answer)
                    : '';
                  const subUserFull = locked
                    ? formatRichAnswer(sq.interaction, sq.options, arr[idx])
                    : '';
                  return (
                    <div
                      id={`player-ot-${sq.sub_num}`}
                      key={sq.sub_num}
                      className={`rounded-xl border p-4 space-y-3 ${
                        subRes
                          ? subRes.correct
                            ? 'border-emerald-200 bg-[#FAF9F6] dark:border-emerald-900/60 dark:bg-[#12161D]'
                            : 'border-red-300 bg-red-50/30 dark:border-red-900/60 dark:bg-red-950/15'
                          : 'border-[#E6E4DD] bg-[#FAF9F6] dark:border-[#262C36] dark:bg-[#12161D]'
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-mono text-xs font-bold text-[#0F5132] dark:text-emerald-400">
                          OT {sq.sub_num} ({sq.marks} marks)
                        </span>
                        {subRes && (
                          <span
                            className={`font-mono text-xs font-bold ${
                              subRes.correct
                                ? 'text-[#0F5132] dark:text-emerald-400'
                                : 'text-red-700 dark:text-red-400'
                            }`}
                          >
                            {subRes.correct ? `✓ ${sq.marks}/${sq.marks} Correct` : `✗ 0/${sq.marks} Incorrect`}
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-medium text-[#14171A] whitespace-pre-line dark:text-[#F0F3F6]">
                        {sq.prompt}
                      </p>
                      {renderSingleOrSubInput(
                        sq.interaction,
                        sq.options,
                        arr[idx],
                        (subVal) => {
                          const next = [...arr];
                          next[idx] = subVal as string | string[] | Record<string, string[]>;
                          setAnswer(next);
                        },
                        `case-${question.id}-${idx}`,
                        undefined,
                        locked ? sq.correct_answer : undefined
                      )}
                      {subRes && !subRes.correct && (
                        <div className="mt-2 space-y-2.5 rounded-xl border border-red-200 bg-white p-3.5 dark:border-red-900/50 dark:bg-[#161B22]">
                          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 text-xs">
                            <div className="rounded-lg border border-red-200 bg-red-50/70 px-3 py-2 dark:border-red-900/50 dark:bg-red-950/25">
                              <span className="block font-mono text-[10px] font-bold uppercase tracking-wider text-red-700 dark:text-red-400">
                                Your Answer
                              </span>
                              <span className="mt-0.5 block font-semibold text-red-950 dark:text-red-100">
                                {subUserFull}
                              </span>
                            </div>
                            <div className="rounded-lg border border-emerald-200 bg-emerald-50/70 px-3 py-2 dark:border-emerald-900/50 dark:bg-emerald-950/25">
                              <span className="block font-mono text-[10px] font-bold uppercase tracking-wider text-[#0F5132] dark:text-emerald-400">
                                Correct Answer
                              </span>
                              <span className="mt-0.5 block font-semibold text-emerald-950 dark:text-emerald-100">
                                {subCorrectFull}
                              </span>
                            </div>
                          </div>
                          <div>
                            <p className="mb-1.5 font-mono text-[10px] font-bold uppercase tracking-wider text-[#14171A] dark:text-neutral-300">
                              OT {sq.sub_num} Worked Explanation
                            </p>
                            <WorkedSolutionBlock text={sq.worked_solution} compact />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : question.type === 'cr' ? (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-bold text-[#14171A] dark:text-[#F0F3F6]">
                    CBE Constructed Response Workspace (Marked)
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      disabled={locked}
                      onClick={() => {
                        const tpl = getProformaTemplateForTopic(question.topic_id);
                        setAnswer(
                          typeof answer === 'string' && answer.trim()
                            ? `${answer}\n\n${tpl}`
                            : tpl
                        );
                      }}
                      className="rounded-lg border border-[#D8D4C8] bg-[#FAF9F6] px-2.5 py-1 text-[11px] font-semibold text-[#14171A] hover:bg-[#EFECE4] dark:border-[#303846] dark:bg-[#1C222B] dark:text-neutral-200"
                    >
                      + Insert Proforma Template
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowScratchPad((v) => !v)}
                      className="rounded-lg border border-[#D8D4C8] bg-white px-2.5 py-1 text-[11px] font-semibold text-neutral-700 hover:bg-neutral-50 dark:border-[#303846] dark:bg-[#1C222B] dark:text-neutral-200"
                    >
                      {showScratchPad ? 'Hide Scratch Pad' : 'Scratch Pad (Unmarked)'}
                    </button>
                  </div>
                </div>

                <textarea
                  rows={12}
                  disabled={locked}
                  value={typeof answer === 'string' ? answer : ''}
                  onChange={(e) => setAnswer(e.target.value)}
                  placeholder="Structure clearly with headings, separate lines, negatives in brackets (X), explicit 0 for exempt items, and labelled workings (W1), (W2)..."
                  className="w-full rounded-xl border border-[#D8D4C8] bg-[#FAF9F6] p-3.5 font-mono text-xs leading-relaxed text-[#14171A] focus:border-[#0F5132] focus:outline-none disabled:opacity-75 dark:border-[#303846] dark:bg-[#0D1117] dark:text-[#F0F3F6]"
                />

                {liveCbeCheck && (
                  <div
                    data-testid="cbe-presentation-checker"
                    className="rounded-xl border border-[#E6E4DD] bg-[#FAF9F6] dark:border-[#262C36] dark:bg-[#12161D]"
                  >
                    <button
                      type="button"
                      onClick={() => setCbeCheckerOpen((o) => !o)}
                      className="flex w-full items-center justify-between gap-2 px-4 py-2.5 text-left"
                    >
                      <div className="flex items-center gap-2">
                        {liveCbeCheck.markerRisks.length === 0 ? (
                          <ShieldCheck className="h-4 w-4 text-[#0F5132] dark:text-emerald-400" />
                        ) : (
                          <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                        )}
                        <span className="text-xs font-bold text-[#14171A] dark:text-[#F0F3F6]">
                          CBE Presentation Checker
                        </span>
                        <span
                          className={`font-mono text-xs font-bold tabular-nums ${
                            liveCbeCheck.scoreOutOf100 >= 80
                              ? 'text-[#0F5132] dark:text-emerald-400'
                              : liveCbeCheck.scoreOutOf100 >= 50
                              ? 'text-amber-700 dark:text-amber-400'
                              : 'text-red-700 dark:text-red-400'
                          }`}
                        >
                          {liveCbeCheck.scoreOutOf100}/100
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] font-semibold text-neutral-600 dark:text-neutral-300">
                        <span>
                          {liveCbeCheck.markerRisks.length === 0
                            ? 'All CBE layout checks passed'
                            : `${liveCbeCheck.markerRisks.length} marker ${
                                liveCbeCheck.markerRisks.length === 1 ? 'risk' : 'risks'
                              } flagged`}
                        </span>
                        {cbeCheckerOpen ? (
                          <ChevronUp className="h-3.5 w-3.5" />
                        ) : (
                          <ChevronDown className="h-3.5 w-3.5" />
                        )}
                      </div>
                    </button>

                    {cbeCheckerOpen && (
                      <div className="divide-y divide-[#EFECE4] border-t border-[#E6E4DD] bg-white px-4 py-2 text-xs dark:divide-[#262C36] dark:border-[#262C36] dark:bg-[#161B22]">
                        {liveCbeCheck.findings.map((finding) => (
                          <div key={finding.id} className="flex items-start gap-2.5 py-2.5">
                            {finding.status === 'pass' ? (
                              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#0F5132] dark:text-emerald-400" />
                            ) : (
                              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
                            )}
                            <div className="min-w-0">
                              <p
                                className={`font-semibold ${
                                  finding.status === 'pass'
                                    ? 'text-[#0F5132] dark:text-emerald-300'
                                    : 'text-amber-900 dark:text-amber-200'
                                }`}
                              >
                                {finding.label}
                              </p>
                              <p className="text-neutral-600 leading-relaxed dark:text-neutral-400">
                                {finding.detail}
                              </p>
                              {finding.fixExample && (
                                <p className="mt-0.5 font-mono text-[11px] text-[#1E3A5F] dark:text-sky-300">
                                  Fix: {finding.fixExample}
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {showScratchPad && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3.5 space-y-1.5 dark:border-amber-900/60 dark:bg-amber-950/20">
                    <p className="text-[11px] font-bold text-amber-900 dark:text-amber-200">
                      Unmarked CBE Scratch Pad (ACCA markers CANNOT see this box!)
                    </p>
                    <textarea
                      rows={4}
                      value={scratchPad}
                      onChange={(e) => setScratchPad(e.target.value)}
                      placeholder="Rough jottings only — copy workings into the main response box above for marks."
                      className="w-full rounded-lg border border-amber-200 bg-white p-2.5 font-mono text-xs text-[#14171A] dark:border-amber-800 dark:bg-[#0D1117] dark:text-[#F0F3F6]"
                    />
                  </div>
                )}
              </div>
            ) : (
              renderSingleOrSubInput(
                question.interaction,
                question.options as McqOption[] | MatrixOptions | PairDropdownGroup[],
                answer,
                (v) => setAnswer(v),
                `single-${question.id}`,
                () => handleSubmit(false),
                locked ? question.correct_answer : undefined
              )
            )}

            {!locked && (
              <div className="space-y-3 pt-2">
                {showHint && (
                  <div className="rounded-xl border border-[#D4DFD7] bg-emerald-50/60 px-4 py-3 text-xs text-[#14171A] dark:border-emerald-900/50 dark:bg-emerald-950/25 dark:text-emerald-100">
                    <strong>Hint (no spoilers):</strong>{' '}
                    {question.examiner_debrief.examiner_playbook}
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => handleSubmit(false)}
                      className="rounded-lg bg-[#0F5132] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#0B3D26] dark:bg-emerald-600 dark:hover:bg-emerald-500"
                    >
                      Submit Answer
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowHint((h) => !h)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-[#D8D4C8] bg-white px-3.5 py-2.5 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 dark:border-[#303846] dark:bg-[#1C222B] dark:text-neutral-200"
                    >
                      <HelpCircle className="h-3.5 w-3.5" />
                      {showHint ? 'Hide Hint' : 'Hint (H)'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSubmit(true)}
                      className="rounded-lg border border-[#D8D4C8] bg-white px-3.5 py-2.5 text-xs font-semibold text-neutral-600 hover:bg-neutral-50 dark:border-[#303846] dark:bg-[#1C222B] dark:text-neutral-300"
                    >
                      Skip &amp; Reveal
                    </button>
                  </div>

                  {question.type === 'mcq' && (
                    <span className="hidden font-mono text-[11px] text-neutral-500 dark:text-neutral-400 sm:inline">
                      {question.interaction === 'single_mcq' || question.interaction === 'grid_2x2'
                        ? 'Keys: A–D select · Enter submit · C calc · T tables'
                        : 'Keys: A–D select · C calc · T tables'}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* PHASE 3: Locked Solution + Mark Scheme + Examiner Debrief (A–F) */}
      {locked && graded && (() => {
        const wrongFeedback = buildWrongAnswerFeedback(question, graded, answer);
        const isWrongOrPartialAuto = wrongFeedback.isWrongOrPartial;
        return (
        <section ref={feedbackRef} className="space-y-5">
          {microDrillAlert && (
            <div className="flex flex-col gap-3 rounded-2xl border border-red-300 bg-red-50/90 p-4 sm:flex-row sm:items-center sm:justify-between dark:border-red-900 dark:bg-red-950/30">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-700 dark:text-red-400" />
                <div>
                  <p className="text-sm font-bold text-red-950 dark:text-red-200">
                    2nd Repeat Trap Detected: {microDrillAlert}
                  </p>
                  <p className="text-xs text-red-900 dark:text-red-300">
                    You hit &ldquo;{microDrillAlert}&rdquo; twice. Launch a focused 2-question micro-drill now.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onLaunchMicroDrill(microDrillAlert)}
                className="shrink-0 rounded-lg bg-red-700 px-4 py-2 text-xs font-semibold text-white hover:bg-red-800"
              >
                Start 2-Q Micro-Drill →
              </button>
            </div>
          )}

          {/* Verdict, Answer & Explanation, and Mark Scheme */}
          <div
            className={`rounded-2xl border bg-white p-6 space-y-5 dark:bg-[#161B22] ${
              isWrongOrPartialAuto
                ? 'border-red-300 dark:border-red-900/70'
                : 'border-[#E6E4DD] dark:border-[#262C36]'
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#EFECE4] pb-4 dark:border-[#262C36]">
              <div className="flex items-center gap-3">
                {graded.isAutoGraded ? (
                  graded.isFullyCorrect ? (
                    <CheckCircle2 className="h-5 w-5 text-[#0F5132] dark:text-emerald-400" />
                  ) : (
                    <XCircle className="h-5 w-5 text-red-700 dark:text-red-400" />
                  )
                ) : (
                  <CheckCircle2 className="h-5 w-5 text-[#0F5132] dark:text-emerald-400" />
                )}
                <div>
                  <h2 className="font-display text-lg font-semibold text-[#14171A] dark:text-[#F0F3F6]">
                    {graded.isAutoGraded
                      ? graded.isFullyCorrect
                        ? 'Full Marks Earned'
                        : graded.marksScored > 0
                        ? 'Partial Marks Earned — Answer & Explanation Below'
                        : 'Incorrect — Correct Answer & Explanation'
                      : 'Self-Mark Against Official ACCA Mark Scheme'}
                  </h2>
                  <p className="text-xs text-neutral-600 dark:text-neutral-400">
                    {question.type === 'cr' ? (
                      <>
                        Your response: <span className="font-mono font-semibold">{graded.userDisplay}</span>
                      </>
                    ) : question.type === 'case' ? (
                      <>
                        {graded.subResults?.filter((s) => s.correct).length ?? 0} of 5 Objective Test questions correct — see per-OT answers &amp; explanations below
                      </>
                    ) : (
                      <>
                        Your answer: <span className="font-semibold">{wrongFeedback.userSummary}</span> · Correct:{' '}
                        <span className="font-semibold text-[#0F5132] dark:text-emerald-400">
                          {wrongFeedback.correctSummary}
                        </span>
                      </>
                    )}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="rounded-xl border border-[#E6E4DD] bg-[#FAF9F6] px-4 py-2 font-mono text-sm font-bold text-[#14171A] tabular-nums dark:border-[#262C36] dark:bg-[#12161D] dark:text-[#F0F3F6]">
                  {graded.isAutoGraded ? graded.marksScored : selfMarkedScore} / {question.marks} marks
                </div>
                <button
                  type="button"
                  onClick={resetWorkspaceInputs}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-[#D8D4C8] bg-white px-3.5 py-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 dark:border-[#303846] dark:bg-[#1C222B] dark:text-neutral-200 dark:hover:bg-[#242C38]"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Retry Question
                </button>
              </div>
            </div>

            {graded.subResults && (
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-5">
                {graded.subResults.map((sr, sIdx) => {
                  const subFb = wrongFeedback.subFeedbacks[sIdx];
                  return (
                    <button
                      type="button"
                      key={sr.subNum}
                      onClick={() =>
                        document
                          .getElementById(`player-ot-${sr.subNum}`)
                          ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                      }
                      className={`rounded-xl border p-3 text-left text-xs transition-colors hover:brightness-95 ${
                        sr.correct
                          ? 'border-emerald-200 bg-emerald-50/70 text-emerald-950 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-100'
                          : 'border-red-200 bg-red-50/70 text-red-950 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-100'
                      }`}
                    >
                      <p className="font-mono font-bold">
                        OT {sr.subNum} · {sr.correct ? '2/2 ✓' : '0/2 ✗'}
                      </p>
                      <p className="mt-1 line-clamp-2" title={subFb ? subFb.userSummary : sr.user}>
                        Yours: {subFb ? subFb.userSummary : sr.user}
                      </p>
                      <p className="mt-0.5 line-clamp-2 font-semibold" title={subFb ? subFb.correctSummary : sr.expected}>
                        Ans: {subFb ? subFb.correctSummary : sr.expected}
                      </p>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Immediate Answer & Explanation Block on Wrong/Partial Auto-Graded Questions */}
            {isWrongOrPartialAuto && (
              <div
                data-testid="wrong-answer-explanation"
                className="space-y-4 rounded-xl border border-red-200 bg-red-50/40 p-4 sm:p-5 dark:border-red-900/50 dark:bg-red-950/15"
              >
                {wrongFeedback.subFeedbacks.length > 0 ? (
                  <div className="space-y-3">
                    <p className="font-mono text-[11px] font-bold uppercase tracking-wider text-red-800 dark:text-red-300">
                      Missed Objective Test Answers &amp; Explanations
                    </p>
                    {wrongFeedback.subFeedbacks
                      .filter((s) => !s.correct)
                      .map((subFb) => (
                        <div
                          key={subFb.subNum}
                          className="space-y-2.5 rounded-xl border border-red-200 bg-white p-3.5 dark:border-red-900/50 dark:bg-[#161B22]"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="font-mono text-xs font-bold text-red-700 dark:text-red-400">
                              OT {subFb.subNum} · Incorrect (0/{subFb.marks})
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                document
                                  .getElementById(`player-ot-${subFb.subNum}`)
                                  ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                              }
                              className="font-mono text-[11px] font-semibold text-[#0F5132] hover:underline dark:text-emerald-400"
                            >
                              View OT {subFb.subNum} Question ↑
                            </button>
                          </div>
                          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 text-xs">
                            <div className="rounded-lg border border-red-200 bg-red-50/70 px-3 py-2 dark:border-red-900/50 dark:bg-red-950/25">
                              <span className="block font-mono text-[10px] font-bold uppercase tracking-wider text-red-700 dark:text-red-400">
                                Your Answer
                              </span>
                              <span className="mt-0.5 block font-semibold text-red-950 dark:text-red-100">
                                {subFb.userSummary}
                              </span>
                            </div>
                            <div className="rounded-lg border border-emerald-200 bg-emerald-50/70 px-3 py-2 dark:border-emerald-900/50 dark:bg-emerald-950/25">
                              <span className="block font-mono text-[10px] font-bold uppercase tracking-wider text-[#0F5132] dark:text-emerald-400">
                                Correct Answer
                              </span>
                              <span className="mt-0.5 block font-semibold text-emerald-950 dark:text-emerald-100">
                                {subFb.correctSummary}
                              </span>
                            </div>
                          </div>
                          <div>
                            <p className="mb-1 font-mono text-[10px] font-bold uppercase tracking-wider text-[#14171A] dark:text-neutral-300">
                              OT {subFb.subNum} Worked Explanation
                            </p>
                            <WorkedSolutionBlock text={subFb.explanation} compact />
                          </div>
                        </div>
                      ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 text-xs">
                    <div className="rounded-xl border border-red-200 bg-white px-4 py-3 dark:border-red-900/50 dark:bg-[#161B22]">
                      <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-red-700 dark:text-red-400">
                        Your Answer
                      </p>
                      <p className="mt-1 font-semibold text-red-950 dark:text-red-200">
                        {wrongFeedback.userSummary}
                      </p>
                    </div>
                    <div className="rounded-xl border border-emerald-300 bg-white px-4 py-3 dark:border-emerald-800 dark:bg-[#161B22]">
                      <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-[#0F5132] dark:text-emerald-400">
                        Correct Answer
                      </p>
                      <p className="mt-1 font-semibold text-[#0F5132] dark:text-emerald-200">
                        {wrongFeedback.correctSummary}
                      </p>
                    </div>
                  </div>
                )}

                <div className="rounded-xl border border-[#E6E4DD] bg-white p-4 space-y-2.5 dark:border-[#262C36] dark:bg-[#161B22]">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-[#0F5132] dark:text-emerald-400">
                      {wrongFeedback.subFeedbacks.length > 0
                        ? `Full Case Worked Solution (Kit ${question.answer_page})`
                        : `Explanation & Worked Solution (Kit ${question.answer_page})`}
                    </h3>
                    <span className="font-mono text-[11px] text-neutral-500 dark:text-neutral-400">
                      {question.kit_page} · {question.st_chapter}
                    </span>
                  </div>
                  <WorkedSolutionBlock text={wrongFeedback.explanation} />
                </div>

                <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3.5 text-xs leading-relaxed dark:border-amber-900/50 dark:bg-amber-950/20">
                  <p className="font-bold text-amber-950 dark:text-amber-200">
                    Why This Happens — {question.examiner_debrief.trap_category}
                  </p>
                  <p className="mt-1 text-neutral-800 dark:text-neutral-200">
                    {wrongFeedback.trapNote}
                  </p>
                  {wrongFeedback.distractorNote && (
                    <p className="mt-1 text-neutral-700 dark:text-neutral-300">
                      <strong>Distractor Check:</strong> {wrongFeedback.distractorNote}
                    </p>
                  )}
                </div>
              </div>
            )}

            <div className="space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-neutral-600 dark:text-neutral-300">
                  Step-by-Step ACCA Mark Scheme
                </h3>
                {question.type === 'cr' && (() => {
                  const hasCrWorking = typeof answer === 'string' && answer.trim().length > 0;
                  return (
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        disabled={crScoreConfirmed}
                        onClick={handleApplySelfMarkToProgress}
                        className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold text-white ${
                          crScoreConfirmed
                            ? 'bg-emerald-700'
                            : 'bg-[#0F5132] hover:bg-[#0B3D26] dark:bg-emerald-600'
                        }`}
                      >
                        {crScoreConfirmed
                          ? `Score Confirmed (${selfMarkedScore}/${question.marks})`
                          : `Confirm Self-Marked Score (${selfMarkedScore}/${question.marks})`}
                      </button>
                      <button
                        type="button"
                        disabled={aiLoading || !hasCrWorking}
                        title={
                          hasCrWorking
                            ? 'Request Gemini AI Examiner Critique of your response'
                            : 'Click Retry Question and enter a written response to enable AI Critique'
                        }
                        onClick={handleRequestAiFeedback}
                        className="rounded-lg border border-[#D8D4C8] bg-white px-3 py-1.5 text-xs font-semibold text-[#14171A] hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-[#303846] dark:bg-[#1C222B] dark:text-[#F0F3F6]"
                      >
                        {aiLoading
                          ? 'Reviewing...'
                          : hasCrWorking
                          ? 'AI Examiner Critique'
                          : 'AI Critique (Enter Working First)'}
                      </button>
                    </div>
                  );
                })()}
              </div>

              <div className="divide-y divide-[#EFECE4] rounded-xl border border-[#E6E4DD] dark:divide-[#262C36] dark:border-[#262C36]">
                {question.mark_scheme_steps.map((step) => {
                  const isChecked = Boolean(checkedSteps[step.id]);
                  return (
                    <label
                      key={step.id}
                      className="flex cursor-pointer items-center justify-between gap-3 px-4 py-2.5 text-xs hover:bg-[#FAF9F6] dark:hover:bg-[#1C222B]"
                    >
                      <span className="flex items-center gap-2.5 text-[#14171A] dark:text-[#F0F3F6]">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() =>
                            setCheckedSteps((prev) => ({
                              ...prev,
                              [step.id]: !prev[step.id],
                            }))
                          }
                          className="h-4 w-4 rounded border-neutral-300 text-[#0F5132]"
                        />
                        {formatMarkSchemeLabel(step.label)}
                      </span>
                      <span className="font-mono font-bold text-[#0F5132] dark:text-emerald-400 tabular-nums">
                        {step.marks}m
                      </span>
                    </label>
                  );
                })}
              </div>

              {aiCritique && (
                <div className="rounded-xl border border-[#D4DFD7] bg-emerald-50/50 p-4 text-xs leading-relaxed text-[#14171A] space-y-2 dark:border-emerald-900/50 dark:bg-emerald-950/20 dark:text-neutral-200">
                  <p className="font-semibold text-[#0F5132] dark:text-emerald-400">
                    Examiner Critique
                  </p>
                  <FormattedCoachText text={aiCritique} />
                </div>
              )}
            </div>

            {crAudit && crPresentation && (
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <div className="rounded-xl border border-[#E6E4DD] bg-[#FAF9F6] p-4 dark:border-[#262C36] dark:bg-[#12161D]">
                  <h4 className="text-xs font-bold text-[#14171A] dark:text-[#F0F3F6]">
                    Easy-Marks Audit ({crAudit.capturedCount}/{crAudit.totalChecks} captured)
                  </h4>
                  <ul className="mt-2 space-y-1.5 text-xs">
                    {crAudit.checks.map((c, idx) => (
                      <li
                        key={idx}
                        className={
                          c.captured
                            ? 'text-[#0F5132] dark:text-emerald-400'
                            : 'text-red-700 dark:text-red-400'
                        }
                      >
                        {c.captured ? '✓' : '✗'} {c.label}
                        {!c.captured && (
                          <span className="ml-3.5 block text-neutral-500 dark:text-neutral-400">
                            {c.tip}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="rounded-xl border border-[#E6E4DD] bg-[#FAF9F6] p-4 dark:border-[#262C36] dark:bg-[#12161D]">
                  <h4 className="text-xs font-bold text-[#14171A] dark:text-[#F0F3F6]">
                    CBE Presentation Audit ({crPresentation.scoreOutOf100}/100)
                  </h4>
                  <ul className="mt-2 space-y-1.5 text-xs">
                    {crPresentation.findings.map((f) => (
                      <li
                        key={f.id}
                        className={
                          f.status === 'pass'
                            ? 'text-[#0F5132] dark:text-emerald-400'
                            : 'text-amber-800 dark:text-amber-300'
                        }
                      >
                        {f.status === 'pass' ? '✓' : '!'} <strong>{f.label}:</strong> {f.detail}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {!isWrongOrPartialAuto && (
              <div className="rounded-xl border border-[#E6E4DD] bg-[#FAF9F6] p-4 space-y-3 dark:border-[#262C36] dark:bg-[#12161D]">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-[#14171A] dark:text-[#F0F3F6]">
                    Full Worked Solution (Kit {question.answer_page})
                  </h3>
                  <span className="font-mono text-xs text-neutral-500 dark:text-neutral-400">
                    {question.kit_page} · {question.st_chapter}
                  </span>
                </div>
                <WorkedSolutionBlock text={question.full_worked_solution} />
              </div>
            )}
          </div>

          {/* A–F Examiner Forensic Debrief */}
          <div className="rounded-2xl border border-[#E6E4DD] bg-white p-6 space-y-4 dark:border-[#262C36] dark:bg-[#161B22]">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#EFECE4] pb-3 dark:border-[#262C36]">
              <h2 className="font-display text-lg font-semibold text-[#14171A] dark:text-[#F0F3F6]">
                Examiner Debrief — {question.examiner_debrief.trap_category}
              </h2>
              <span className="font-mono text-xs text-neutral-500 dark:text-neutral-400">
                {question.exam_frequency_tag}
              </span>
            </div>

            <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2 text-xs leading-relaxed">
              <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4 dark:border-amber-900/50 dark:bg-amber-950/20">
                <p className="font-bold text-amber-950 dark:text-amber-200">A. Trap of the Question</p>
                <p className="mt-1 text-neutral-800 dark:text-neutral-200">
                  {question.examiner_debrief.trap_of_question}
                </p>
              </div>

              <div className="rounded-xl border border-[#E6E4DD] bg-[#FAF9F6] p-4 dark:border-[#262C36] dark:bg-[#12161D]">
                <p className="font-bold text-[#14171A] dark:text-[#F0F3F6]">B. Distractor Forensics</p>
                <p className="mt-1 text-neutral-700 dark:text-neutral-300">
                  {question.examiner_debrief.distractor_forensics}
                </p>
              </div>

              <div className="rounded-xl border border-[#E6E4DD] bg-[#FAF9F6] p-4 dark:border-[#262C36] dark:bg-[#12161D]">
                <p className="font-bold text-[#14171A] dark:text-[#F0F3F6]">C. Examiner’s Playbook</p>
                <p className="mt-1 text-neutral-700 dark:text-neutral-300">
                  {question.examiner_debrief.examiner_playbook}
                </p>
              </div>

              <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 dark:border-emerald-900/50 dark:bg-emerald-950/20">
                <p className="font-bold text-[#0F5132] dark:text-emerald-300">D. Speed Trick</p>
                <p className="mt-1 text-neutral-800 dark:text-neutral-200">
                  {question.examiner_debrief.speed_trick}
                </p>
              </div>

              <div className="rounded-xl border border-[#E6E4DD] bg-[#FAF9F6] p-4 dark:border-[#262C36] dark:bg-[#12161D]">
                <p className="font-bold text-[#1E3A5F] dark:text-sky-300">E. Twist Prediction</p>
                <p className="mt-1 text-neutral-700 dark:text-neutral-300">
                  {question.examiner_debrief.twist_prediction}
                </p>
              </div>

              <div className="rounded-xl border border-[#E6E4DD] bg-[#FAF9F6] p-4 dark:border-[#262C36] dark:bg-[#12161D]">
                <p className="font-bold text-[#14171A] dark:text-[#F0F3F6]">F. Personal Trap Ledger Update</p>
                {(() => {
                  const entry = appState.trapLedger[question.examiner_debrief.trap_category];
                  return (
                    <p className="mt-1 text-neutral-700 dark:text-neutral-300">
                      Hits: <strong className="font-mono">{entry?.hitCount ?? 0}</strong> · Avoided:{' '}
                      <strong className="font-mono">{entry?.avoidedCount ?? 0}</strong> · Status:{' '}
                      {entry?.microDrillRequired ? 'Micro-drill flagged (≥2 hits)' : 'Monitored'}
                    </p>
                  );
                })()}
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={() => {
                  if (currentIdx >= 0 && currentIdx < filteredList.length - 1) {
                    onSelectQuestion(filteredList[currentIdx + 1]);
                  } else if (filteredList.length > 0) {
                    onSelectQuestion(filteredList[0]);
                  }
                }}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#0F5132] px-4 py-2 text-xs font-semibold text-white hover:bg-[#0B3D26] dark:bg-emerald-600 dark:hover:bg-emerald-500"
              >
                Next Question
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </section>
        );
      })()}
    </div>
  );
};
