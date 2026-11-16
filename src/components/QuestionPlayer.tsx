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
  coachCbePresentation,
  gradeQuestion,
  type GradedResult,
  type UserQuestionAnswer,
} from '../engine/scoring';
import {
  generateTrapVariant,
  getProformaTemplateForTopic,
} from '../engine/taxCalculators';
import type {
  AppState,
  CaseSubQuestion,
  KitQuestion,
  MatrixOptions,
  McqOption,
  PairDropdownGroup,
} from '../types/tx';
import { ScenarioText } from './ScenarioText';
import { TaxCalculatorPad } from './TaxCalculatorPad';
import { TaxTablesDrawer } from './TaxTablesView';

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

  // Slide-out Bank Queue Drawer state (keeps player viewport clean & focused)
  const [queueOpen, setQueueOpen] = useState(false);
  const [secFilter, setSecFilter] = useState<'ALL' | 'A' | 'B' | 'C'>('ALL');
  const [areaFilter, setAreaFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'unattempted' | 'missed'>('ALL');
  const [searchQ, setSearchQ] = useState('');

  // Reset state whenever question changes
  useEffect(() => {
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
  }, [question.id, question.marks, question.type, question.interaction]);

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
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
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
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [locked, question]);

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

  const handleSubmit = (skipReveal = false) => {
    const elapsed = Math.max(1, budgetSeconds - secondsLeft);
    const result = gradeQuestion(question, skipReveal ? null : answer);
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
      userAnswerSummary: skipReveal ? 'Skipped / Revealed' : result.userDisplay,
      correctAnswerSummary: result.correctDisplay,
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
    prefixKey: string
  ) => {
    if (interaction === 'numeric_input') {
      return (
        <div className="max-w-xs">
          <label className="mb-1.5 block text-xs font-semibold text-neutral-600 dark:text-neutral-300">
            Enter whole £ figure (no commas needed):
          </label>
          <div className="flex items-center rounded-xl border border-[#D8D4C8] bg-white focus-within:border-[#0F5132] dark:border-[#303846] dark:bg-[#12161D] dark:focus-within:border-emerald-500">
            <span className="border-r border-[#E6E4DD] bg-[#FAF9F6] px-3.5 py-2.5 font-mono text-sm font-bold text-neutral-700 dark:border-[#262C36] dark:bg-[#1C222B] dark:text-neutral-200">
              £
            </span>
            <input
              type="text"
              inputMode="numeric"
              disabled={locked}
              value={typeof val === 'string' ? val : ''}
              onChange={(e) => onChange(e.target.value)}
              placeholder="e.g. 7420"
              className="w-full bg-transparent px-3.5 py-2.5 font-mono text-sm font-semibold text-[#14171A] focus:outline-none disabled:opacity-70 dark:text-[#F0F3F6]"
            />
          </div>
        </div>
      );
    }

    if (interaction === 'matrix') {
      const mat = options as MatrixOptions;
      const curObj = (val && typeof val === 'object' && !Array.isArray(val)
        ? val
        : {}) as Record<string, string[]>;
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
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EFECE4] bg-white dark:divide-[#262C36] dark:bg-[#161B22]">
              {mat.rows.map((rowText, rIdx) => {
                const rowKey = String(rIdx);
                const selectedCols = curObj[rowKey] ?? [];
                return (
                  <tr key={rIdx}>
                    <td className="px-3.5 py-3 font-medium text-[#14171A] dark:text-[#F0F3F6]">
                      {rowText}
                    </td>
                    {mat.columns.map((col, cIdx) => {
                      const checked = selectedCols.includes(col);
                      return (
                        <td key={cIdx} className="px-3.5 py-3 text-center">
                          <input
                            type="checkbox"
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
      return (
        <div className="space-y-3">
          {groups.map((grp, idx) => (
            <div
              key={idx}
              className="flex flex-col gap-2 rounded-xl border border-[#E6E4DD] bg-[#FAF9F6] p-3.5 sm:flex-row sm:items-center sm:justify-between dark:border-[#262C36] dark:bg-[#12161D]"
            >
              <span className="text-xs font-semibold text-[#14171A] dark:text-[#F0F3F6]">
                {grp.group}
              </span>
              <select
                disabled={locked}
                value={curArr[idx] ?? ''}
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
          ))}
        </div>
      );
    }

    if (interaction === 'multi_select') {
      const opts = options as McqOption[];
      const curArr = Array.isArray(val) ? (val as string[]) : [];
      return (
        <div className="space-y-2.5">
          <p className="text-xs font-semibold text-neutral-500 dark:text-neutral-400">
            Select all matching options:
          </p>
          {opts.map((opt) => {
            const checked = curArr.includes(opt.key);
            return (
              <label
                key={`${prefixKey}-${opt.key}`}
                className={`flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 text-sm transition-colors ${
                  checked
                    ? 'border-[#0F5132] bg-emerald-50/70 dark:border-emerald-500 dark:bg-emerald-950/30'
                    : 'border-[#E6E4DD] bg-white hover:bg-[#FAF9F6] dark:border-[#262C36] dark:bg-[#161B22] dark:hover:bg-[#1C222B]'
                }`}
              >
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
                  <span className="font-mono text-xs font-bold text-neutral-500 dark:text-neutral-400 mr-2">
                    {opt.key}.
                  </span>
                  <span className="text-[#14171A] dark:text-[#F0F3F6]">{opt.text}</span>
                </span>
              </label>
            );
          })}
        </div>
      );
    }

    const opts = Array.isArray(options) ? (options as McqOption[]) : [];
    const curVal = typeof val === 'string' ? val : '';
    return (
      <div className="space-y-2.5">
        {opts.map((opt) => {
          const selected = curVal === opt.key;
          return (
            <label
              key={`${prefixKey}-${opt.key}`}
              className={`flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 text-sm transition-colors ${
                selected
                  ? 'border-[#0F5132] bg-emerald-50/70 dark:border-emerald-500 dark:bg-emerald-950/30'
                  : 'border-[#E6E4DD] bg-white hover:bg-[#FAF9F6] dark:border-[#262C36] dark:bg-[#161B22] dark:hover:bg-[#1C222B]'
              }`}
            >
              <input
                type="radio"
                name={`radio-${prefixKey}`}
                disabled={locked}
                checked={selected}
                onChange={() => onChange(opt.key)}
                className="mt-1 h-4 w-4 border-neutral-300 text-[#0F5132]"
              />
              <span>
                <span className="font-mono text-xs font-bold text-neutral-500 dark:text-neutral-400 mr-2">
                  {opt.key}.
                </span>
                <span className="text-[#14171A] dark:text-[#F0F3F6]">{opt.text}</span>
              </span>
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
      <TaxTablesDrawer open={tablesOpen} onClose={() => setTablesOpen(false)} />

      {/* Slide-out Question Queue Drawer */}
      {queueOpen && (
        <div className="fixed inset-0 z-50 flex justify-start bg-black/40 backdrop-blur-[1px]">
          <div className="flex h-full w-full max-w-md flex-col border-r border-[#E6E4DD] bg-white shadow-2xl dark:border-[#262C36] dark:bg-[#161B22]">
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
                  value={searchQ}
                  onChange={(e) => setSearchQ(e.target.value)}
                  placeholder="Jump to Q#, title, or topic..."
                  className="w-full rounded-lg border border-[#D8D4C8] bg-[#FAF9F6] py-2 pl-8 pr-3 text-xs text-[#14171A] focus:border-[#0F5132] focus:outline-none dark:border-[#303846] dark:bg-[#0D1117] dark:text-[#F0F3F6]"
                />
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
            onClick={() =>
              onSelectQuestion(generateTrapVariant(question.topic_id, Math.floor(Math.random() * 3)))
            }
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
                <p className="text-xs font-semibold text-neutral-500 dark:text-neutral-400">
                  Section B Case: Complete all 5 Objective Tests below, then submit together.
                </p>
                {(question.options as CaseSubQuestion[]).map((sq, idx) => {
                  const arr = Array.isArray(answer) ? answer : [];
                  return (
                    <div
                      key={sq.sub_num}
                      className="rounded-xl border border-[#E6E4DD] bg-[#FAF9F6] p-4 space-y-3 dark:border-[#262C36] dark:bg-[#12161D]"
                    >
                      <span className="font-mono text-xs font-bold text-[#0F5132] dark:text-emerald-400">
                        OT {sq.sub_num} ({sq.marks} marks)
                      </span>
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
                        `case-${question.id}-${idx}`
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
                `single-${question.id}`
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
                    <span className="hidden font-mono text-[11px] text-neutral-400 sm:inline">
                      Keys: A–D select · C calc · T tables
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* PHASE 3: Locked Solution + Mark Scheme + Examiner Debrief (A–F) */}
      {locked && graded && (
        <section className="space-y-5">
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

          {/* Verdict & Mark Scheme */}
          <div className="rounded-2xl border border-[#E6E4DD] bg-white p-6 space-y-5 dark:border-[#262C36] dark:bg-[#161B22]">
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
                        ? 'Partial Marks Earned'
                        : 'Incorrect — Review Worked Solution & Trap Debrief'
                      : 'Self-Mark Against Official ACCA Mark Scheme'}
                  </h2>
                  <p className="text-xs text-neutral-600 dark:text-neutral-400">
                    Your response: <span className="font-mono font-semibold">{graded.userDisplay}</span> · Correct:{' '}
                    <span className="font-mono font-semibold text-[#0F5132] dark:text-emerald-400">
                      {graded.correctDisplay}
                    </span>
                  </p>
                </div>
              </div>

              <div className="rounded-xl border border-[#E6E4DD] bg-[#FAF9F6] px-4 py-2 font-mono text-sm font-bold text-[#14171A] tabular-nums dark:border-[#262C36] dark:bg-[#12161D] dark:text-[#F0F3F6]">
                {graded.isAutoGraded ? graded.marksScored : selfMarkedScore} / {question.marks} marks
              </div>
            </div>

            {graded.subResults && (
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-5">
                {graded.subResults.map((sr) => (
                  <div
                    key={sr.subNum}
                    className={`rounded-xl border p-3 text-xs ${
                      sr.correct
                        ? 'border-emerald-200 bg-emerald-50/70 text-emerald-950 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-100'
                        : 'border-red-200 bg-red-50/70 text-red-950 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-100'
                    }`}
                  >
                    <p className="font-mono font-bold">
                      OT {sr.subNum} · {sr.correct ? '2/2' : '0/2'}
                    </p>
                    <p className="mt-1">Yours: {sr.user}</p>
                    <p>Ans: {sr.expected}</p>
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-neutral-600 dark:text-neutral-300">
                  Step-by-Step ACCA Mark Scheme
                </h3>
                {question.type === 'cr' && (
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
                      disabled={aiLoading}
                      onClick={handleRequestAiFeedback}
                      className="rounded-lg border border-[#D8D4C8] bg-white px-3 py-1.5 text-xs font-semibold text-[#14171A] hover:bg-neutral-50 disabled:opacity-50 dark:border-[#303846] dark:bg-[#1C222B] dark:text-[#F0F3F6]"
                    >
                      {aiLoading ? 'Reviewing...' : 'AI Examiner Critique'}
                    </button>
                  </div>
                )}
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
                        {step.label}
                      </span>
                      <span className="font-mono font-bold text-[#0F5132] dark:text-emerald-400 tabular-nums">
                        {step.marks}m
                      </span>
                    </label>
                  );
                })}
              </div>

              {aiCritique && (
                <div className="rounded-xl border border-[#D4DFD7] bg-emerald-50/50 p-4 text-xs text-[#14171A] whitespace-pre-line dark:border-emerald-900/50 dark:bg-emerald-950/20 dark:text-neutral-200">
                  <strong className="text-[#0F5132] dark:text-emerald-400">Examiner Critique:</strong>
                  {'\n'}
                  {aiCritique}
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

            <div className="rounded-xl border border-[#E6E4DD] bg-[#FAF9F6] p-4 space-y-2 dark:border-[#262C36] dark:bg-[#12161D]">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-[#14171A] dark:text-[#F0F3F6]">
                  Full Worked Solution (Kit {question.answer_page})
                </h3>
                <span className="font-mono text-xs text-neutral-500 dark:text-neutral-400">
                  {question.kit_page} · {question.st_chapter}
                </span>
              </div>
              <div className="whitespace-pre-line font-mono text-xs leading-relaxed text-[#14171A] dark:text-neutral-200">
                {question.full_worked_solution}
              </div>
            </div>
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
      )}
    </div>
  );
};
