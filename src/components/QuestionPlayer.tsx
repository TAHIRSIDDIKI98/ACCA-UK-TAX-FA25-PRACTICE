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
  Pause,
  Play,
  RotateCcw,
  Search,
  ShieldCheck,
  Sparkles,
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
import { evaluateArithmeticExpression, generateTrapVariant } from '../engine/taxCalculators';
import type {
  AppState,
  CaseSubQuestion,
  KitQuestion,
  MatrixOptions,
  McqOption,
  PairDropdownGroup,
} from '../types/tx';
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

function getProformaTemplateForTopic(topicId: number): string {
  if (topicId >= 13 && topicId <= 16) {
    return [
      'Corporation Tax Computation (TTP & Marginal Relief)',
      'Adjusted trading profit (W1): ',
      'Non-trading loan relationship / Property income: ',
      'Chargeable gains: ',
      'Exempt item / Disallowable item: 0',
      'Less: Qualifying charitable donations (QCDs): (0)',
      '= Taxable Total Profits (TTP): ',
      'Plus: Exempt ABGH dividends: ',
      '= Augmented Profits: ',
      'Less: Marginal relief [(U - A) * (N / A) * 3/200]: (0)',
    ].join('\n');
  }
  if (topicId >= 17 && topicId <= 21) {
    return [
      '2025/26 Capital Gains Tax Computation',
      'Disposal proceeds: ',
      'Less: Incidental disposal costs: (0)',
      'Less: Original cost / Enhancement expenditure: (0)',
      '= Chargeable Gain / (Allowable Loss): ',
      'Exempt asset / Chattel <= 6,000: 0',
      'Less: Current year / b/f capital losses: (0)',
      'Less: Annual Exempt Amount: (3,000)',
      '= Taxable Gain (@ 14% BADR / 18% / 24%): ',
    ].join('\n');
  }
  if (topicId === 22) {
    return [
      'Inheritance Tax Computation (FA25)',
      'Transfer of value (diminution in estate): ',
      'Less: Spouse / Small gift / Normal expenditure exemption: (0)',
      'Less: Annual Exemption (3,000 CY + 3,000 b/f): (6,000)',
      '= Chargeable Transfer (PET / CLT): ',
      'Less: Nil Rate Band (325,000 less prior 7-yr transfers): ',
      '+ Residence Nil Rate Band (175,000 max for death estate): ',
      '= Taxable Chargeable Amount (@ 20% / 25% gross / 40%): ',
    ].join('\n');
  }
  if (topicId === 23 || topicId === 24) {
    return [
      'VAT Return & Compliance Summary (FA25)',
      'Output VAT (20% standard-rated / 0% zero-rated): ',
      'Less: Recoverable Input VAT: (0)',
      'Non-deductible client entertaining / private motor car: 0',
      'Bad debt relief (>6 months overdue from payment date): (0)',
      '= Net VAT Payable / (Repayable): ',
      'Online Return & Payment Due: 1 month + 7 days after quarter end',
    ].join('\n');
  }
  return [
    '2025/26 Income Tax Computation (NS | Savings | Dividends)',
    'Employment / Trading / Property income (W1): ',
    'Exempt / Non-taxable item: 0',
    'Less: Personal Allowance (12,570 — check ANI > 100,000): (12,570)',
    '= Taxable Income (NS -> Savings -> Dividends): ',
    'Less: 20% Reducers / PAYE deducted: (0)',
    'Balancing payment & POA due: 31 January 2027',
  ].join('\n');
}

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

  // Quick Question Switcher Filters
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

  // Top 2 recurring traps watchlist
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
  const calcResult = useMemo(() => evaluateArithmeticExpression(calcExpr), [calcExpr]);

  const [crScoreConfirmed, setCrScoreConfirmed] = useState(false);

  const handleSubmit = (skipReveal = false) => {
    const elapsed = Math.max(1, budgetSeconds - secondsLeft);
    const result = gradeQuestion(question, skipReveal ? null : answer);
    const easyAudit =
      question.type === 'cr' && typeof answer === 'string'
        ? auditEasyMarks(answer, question)
        : { capturedCount: 0, totalChecks: 0, checks: [] };

    // Initialize self-marking step checkboxes
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

    // For CR questions (unless skipped), wait until student ticks their step mark scheme checkboxes
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

  // Recalculate CR / step self-mark score dynamically when checkboxes toggle
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
          <label className="block text-xs font-semibold text-slate-600 mb-1.5">
            Enter whole £ figure (no commas needed):
          </label>
          <div className="flex items-center rounded-md border border-slate-300 bg-white focus-within:border-blue-600">
            <span className="border-r border-slate-200 bg-slate-50 px-3 py-2 font-mono text-sm font-bold text-slate-700">
              £
            </span>
            <input
              type="text"
              inputMode="numeric"
              disabled={locked}
              value={typeof val === 'string' ? val : ''}
              onChange={(e) => onChange(e.target.value)}
              placeholder="e.g. 7420"
              className="w-full px-3 py-2 font-mono text-sm font-semibold text-slate-900 focus:outline-none disabled:bg-slate-50"
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
        <div className="overflow-x-auto rounded-md border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-xs">
            <thead>
              <tr className="bg-slate-50 font-semibold text-slate-700">
                <th className="px-3 py-2 text-left">Item / Statement</th>
                {mat.columns.map((col, cIdx) => (
                  <th key={cIdx} className="px-3 py-2 text-center">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {mat.rows.map((rowText, rIdx) => {
                const rowKey = String(rIdx);
                const selectedCols = curObj[rowKey] ?? [];
                return (
                  <tr key={rIdx}>
                    <td className="px-3 py-2.5 font-medium text-slate-800">{rowText}</td>
                    {mat.columns.map((col, cIdx) => {
                      const checked = selectedCols.includes(col);
                      return (
                        <td key={cIdx} className="px-3 py-2.5 text-center">
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
                            className="h-4 w-4 rounded border-slate-300 text-blue-700"
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
              className="flex flex-col gap-1.5 rounded-md border border-slate-200 bg-slate-50 p-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <span className="text-xs font-semibold text-slate-800">{grp.group}</span>
              <select
                disabled={locked}
                value={curArr[idx] ?? ''}
                onChange={(e) => {
                  const next = [...curArr];
                  next[idx] = e.target.value;
                  onChange(next);
                }}
                className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-900"
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
        <div className="space-y-2">
          <p className="text-xs font-semibold text-slate-500">
            Select all matching options (check boxes):
          </p>
          {opts.map((opt) => {
            const checked = curArr.includes(opt.key);
            return (
              <label
                key={`${prefixKey}-${opt.key}`}
                className={`flex cursor-pointer items-start gap-3 rounded-md border px-3.5 py-2.5 text-sm transition-colors ${
                  checked
                    ? 'border-blue-600 bg-blue-50/70'
                    : 'border-slate-200 bg-white hover:bg-slate-50'
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
                  className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-700"
                />
                <span>
                  <span className="font-mono text-xs font-bold text-slate-700 mr-2">
                    {opt.key}.
                  </span>
                  <span className="text-slate-900">{opt.text}</span>
                </span>
              </label>
            );
          })}
        </div>
      );
    }

    // Default single_mcq / grid_2x2
    const opts = Array.isArray(options) ? (options as McqOption[]) : [];
    const curVal = typeof val === 'string' ? val : '';
    return (
      <div className="space-y-2">
        {opts.map((opt) => {
          const selected = curVal === opt.key;
          return (
            <label
              key={`${prefixKey}-${opt.key}`}
              className={`flex cursor-pointer items-start gap-3 rounded-md border px-3.5 py-2.5 text-sm transition-colors ${
                selected
                  ? 'border-blue-600 bg-blue-50/70'
                  : 'border-slate-200 bg-white hover:bg-slate-50'
              }`}
            >
              <input
                type="radio"
                name={`radio-${prefixKey}`}
                disabled={locked}
                checked={selected}
                onChange={() => onChange(opt.key)}
                className="mt-1 h-4 w-4 border-slate-300 text-blue-700"
              />
              <span>
                <span className="font-mono text-xs font-bold text-slate-700 mr-2">
                  {opt.key}.
                </span>
                <span className="text-slate-900">{opt.text}</span>
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

      {/* Quick Question Browser Bar */}
      <div className="flex flex-col gap-2.5 rounded-lg border border-slate-200 bg-white p-3.5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              placeholder="Jump to Q# or topic..."
              className="w-48 rounded-md border border-slate-300 bg-white py-1.5 pl-8 pr-2.5 text-xs text-slate-900"
            />
          </div>

          <div className="inline-flex rounded-md border border-slate-200 bg-slate-100 p-0.5">
            {(['ALL', 'A', 'B', 'C'] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSecFilter(s)}
                className={`rounded px-2.5 py-1 text-xs font-semibold ${
                  secFilter === s
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {s === 'ALL' ? 'All Sec' : `Sec ${s}`}
              </button>
            ))}
          </div>

          <select
            aria-label="Filter by syllabus area"
            value={areaFilter}
            onChange={(e) => setAreaFilter(e.target.value)}
            className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-800"
          >
            <option value="ALL">All Syllabus Areas ({allQuestions.length})</option>
            <option value="Income Tax & NIC">Income Tax & NIC</option>
            <option value="Chargeable Gains">Chargeable Gains</option>
            <option value="Inheritance Tax">Inheritance Tax</option>
            <option value="Corporation Tax">Corporation Tax</option>
            <option value="VAT">VAT</option>
            <option value="UK Tax System">UK Tax System & Ethics</option>
            <option value="Specimen">Specimen CBE Exam</option>
          </select>

          <select
            aria-label="Filter by status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'ALL' | 'unattempted' | 'missed')}
            className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-800"
          >
            <option value="ALL">All Statuses</option>
            <option value="unattempted">Unattempted</option>
            <option value="missed">Missed / SRS ({missedIds.size})</option>
          </select>

          <select
            aria-label="Select question from bank"
            value={question.id}
            onChange={(e) => {
              const found = allQuestions.find((x) => x.id === e.target.value);
              if (found) onSelectQuestion(found);
            }}
            className="max-w-xs rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-800"
          >
            {!filteredList.some((x) => x.id === question.id) && (
              <option value={question.id}>
                {question.id} · {question.title}
              </option>
            )}
            {filteredList.map((item) => (
              <option key={item.id} value={item.id}>
                {item.id} ({item.marks}m Sec {item.section}) · {item.title.slice(0, 42)}
              </option>
            ))}
          </select>

          <span className="font-mono text-[11px] font-semibold text-slate-500 tabular-nums">
            {currentIdx >= 0 ? `${currentIdx + 1}/${filteredList.length}` : `${filteredList.length} shown`}
          </span>

          {filteredList.length === 0 && (
            <button
              type="button"
              onClick={() => {
                setSecFilter('ALL');
                setAreaFilter('ALL');
                setStatusFilter('ALL');
                setSearchQ('');
              }}
              className="text-xs font-semibold text-blue-700 hover:underline"
            >
              Reset Filters
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            disabled={currentIdx <= 0}
            onClick={() => currentIdx > 0 && onSelectQuestion(filteredList[currentIdx - 1])}
            className="inline-flex whitespace-nowrap shrink-0 items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
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
            className="inline-flex whitespace-nowrap shrink-0 items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
          >
            Next
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onSelectQuestion(generateTrapVariant(question.topic_id, Math.floor(Math.random() * 3)))}
            className="inline-flex whitespace-nowrap shrink-0 items-center gap-1 rounded-md border border-slate-300 bg-slate-900 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
          >
            <Sparkles className="h-3.5 w-3.5 text-amber-400" />
            Trap Variant
          </button>
        </div>
      </div>

      {/* Watchlist Banner */}
      {watchlistTraps.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-950">
          <span>
            <strong>Personal Watchlist:</strong>{' '}
            {watchlistTraps
              .map((w) => `${w.trapCategory} (${w.hitCount} hits)`)
              .join(' · ')}
          </span>
          <span className="font-mono text-amber-800">Read dates & adjectives twice before clicking!</span>
        </div>
      )}

      {/* Active Question Header */}
      <div className="rounded-lg border border-slate-200 bg-white p-5">
        <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2 font-mono text-xs text-slate-600">
              <span className="font-bold text-blue-700">{question.id}</span>
              <span>·</span>
              <span>Section {question.section}</span>
              <span>·</span>
              <span>{question.marks} marks</span>
              <span>·</span>
              <span>{question.kit_page}</span>
              {question.past_exam && (
                <>
                  <span>·</span>
                  <span>{question.past_exam}</span>
                </>
              )}
            </div>
            <h1 className="mt-1 font-display text-lg font-bold text-slate-900">
              {question.title.replace(/\s*\|\s*$/, '')}
            </h1>
            <p className="text-xs text-slate-500">
              Topic {question.topic_id}: {question.topic} ({question.st_chapter}) · {question.exam_frequency_tag}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* 1.8 min/mark Countdown Timer */}
            <div
              className={`inline-flex items-center gap-2 rounded-md border px-3 py-1.5 font-mono text-sm font-bold tabular-nums ${
                secondsLeft < budgetSeconds * 0.2
                  ? 'border-amber-300 bg-amber-50 text-amber-900'
                  : 'border-slate-200 bg-slate-50 text-slate-900'
              }`}
            >
              <Clock className="h-4 w-4 text-slate-500" />
              {formatClock(secondsLeft)}
              <button
                type="button"
                aria-label="Pause or resume timer"
                onClick={() => setTimerRunning((r) => !r)}
                className="ml-1 text-slate-500 hover:text-slate-900"
              >
                {timerRunning ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
              </button>
              <button
                type="button"
                aria-label="Reset timer"
                onClick={() => {
                  setSecondsLeft(budgetSeconds);
                  setTimerRunning(true);
                }}
                className="text-slate-500 hover:text-slate-900"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </button>
            </div>

            <button
              type="button"
              onClick={() => setCalcOpen((c) => !c)}
              className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-semibold ${
                calcOpen
                  ? 'border-blue-600 bg-blue-50 text-blue-900'
                  : 'border-slate-300 bg-white text-slate-800 hover:bg-slate-50'
              }`}
            >
              <Calculator className="h-3.5 w-3.5 text-blue-700" />
              Calculator
            </button>

            <button
              type="button"
              onClick={() => setTablesOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50"
            >
              <BookOpen className="h-3.5 w-3.5 text-blue-700" />
              Exam Tables
            </button>
          </div>
        </div>

        {calcOpen && (
          <div className="mt-3 flex flex-col gap-2 rounded-md border border-slate-200 bg-slate-50 p-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-1 items-center gap-2">
              <Calculator className="h-4 w-4 shrink-0 text-slate-500" />
              <input
                type="text"
                aria-label="CBE arithmetic calculator expression"
                value={calcExpr}
                onChange={(e) => setCalcExpr(e.target.value)}
                placeholder="e.g. 36000 * 36% * 11 / 12 or (240000 - 190000) * 19%"
                className="w-full rounded border border-slate-300 bg-white px-2.5 py-1.5 font-mono text-xs text-slate-900"
              />
            </div>
            <div className="flex items-center gap-2.5 text-xs">
              {calcExpr.trim() ? (
                calcResult.ok ? (
                  <>
                    <span className="font-mono font-bold text-slate-900 tabular-nums">
                      = {calcResult.value.toLocaleString()} (round £{calcResult.rounded.toLocaleString()})
                    </span>
                    {!locked && question.interaction === 'numeric_input' && (
                      <button
                        type="button"
                        onClick={() => setAnswer(String(calcResult.rounded))}
                        className="rounded border border-blue-600 bg-blue-600 px-2 py-1 text-[11px] font-semibold text-white hover:bg-blue-700"
                      >
                        Use £{calcResult.rounded.toLocaleString()}
                      </button>
                    )}
                  </>
                ) : (
                  <span className="font-mono text-red-700">{calcResult.error}</span>
                )
              ) : (
                <span className="text-slate-500">Supports +, −, *, /, %, ( )</span>
              )}
            </div>
          </div>
        )}

        {/* Question Body: Split screen for Case / CR, Single clean flow for Sec A */}
        <div
          className={`mt-5 ${
            question.type === 'case' || question.type === 'cr'
              ? 'grid grid-cols-1 gap-6 lg:grid-cols-12'
              : 'space-y-5'
          }`}
        >
          {/* Scenario & Requirement */}
          <div
            className={
              question.type === 'case' || question.type === 'cr'
                ? 'lg:col-span-6 space-y-4'
                : 'space-y-4'
            }
          >
            {question.scenario && (
              <div className="rounded-md border border-slate-200 bg-slate-50/70 p-4">
                <p className="mb-1.5 font-mono text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Scenario
                </p>
                <div className="whitespace-pre-line text-sm leading-relaxed text-slate-800">
                  {question.scenario}
                </div>
              </div>
            )}

            <div className="rounded-md border border-blue-200 bg-blue-50/40 p-4">
              <p className="mb-1 font-mono text-[11px] font-bold uppercase tracking-wider text-blue-800">
                Requirement
              </p>
              <div className="whitespace-pre-line text-sm font-medium text-slate-900">
                {question.requirement}
              </div>
            </div>
          </div>

          {/* Interactive Response Zone */}
          <div
            className={
              question.type === 'case' || question.type === 'cr'
                ? 'lg:col-span-6 space-y-4'
                : 'space-y-4'
            }
          >
            {question.type === 'case' ? (
              <div className="space-y-4">
                <p className="text-xs font-semibold text-slate-600">
                  Section B Case: Complete all 5 Objective Tests below, then submit together.
                </p>
                {(question.options as CaseSubQuestion[]).map((sq, idx) => {
                  const arr = Array.isArray(answer) ? answer : [];
                  return (
                    <div
                      key={sq.sub_num}
                      className="rounded-md border border-slate-200 bg-white p-4 space-y-2.5"
                    >
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="font-mono text-xs font-bold text-blue-700">
                          OT {sq.sub_num} ({sq.marks} marks)
                        </span>
                      </div>
                      <p className="text-sm font-medium text-slate-900 whitespace-pre-line">
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
                  <span className="text-xs font-bold text-slate-800">
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
                      className="rounded border border-slate-300 bg-slate-50 px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100"
                    >
                      + Insert Proforma Template
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowScratchPad((v) => !v)}
                      className="rounded border border-slate-300 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
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
                  className="w-full rounded-md border border-slate-300 bg-white p-3 font-mono text-xs leading-relaxed text-slate-900 focus:border-blue-600 focus:outline-none disabled:bg-slate-50"
                />

                {/* Live CBE Presentation Checker */}
                {liveCbeCheck && (
                  <div
                    data-testid="cbe-presentation-checker"
                    className="rounded-md border border-slate-200 bg-slate-50/80"
                  >
                    <button
                      type="button"
                      onClick={() => setCbeCheckerOpen((o) => !o)}
                      className="flex w-full items-center justify-between gap-2 px-3.5 py-2.5 text-left"
                    >
                      <div className="flex items-center gap-2">
                        {liveCbeCheck.markerRisks.length === 0 ? (
                          <ShieldCheck className="h-4 w-4 text-teal-700" />
                        ) : (
                          <AlertTriangle className="h-4 w-4 text-amber-700" />
                        )}
                        <span className="text-xs font-bold text-slate-900">
                          CBE Presentation Checker
                        </span>
                        <span
                          className={`font-mono text-xs font-bold tabular-nums ${
                            liveCbeCheck.scoreOutOf100 >= 80
                              ? 'text-teal-700'
                              : liveCbeCheck.scoreOutOf100 >= 50
                              ? 'text-amber-700'
                              : 'text-red-700'
                          }`}
                        >
                          {liveCbeCheck.scoreOutOf100}/100
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-600">
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
                      <div className="divide-y divide-slate-200/80 border-t border-slate-200 bg-white px-3.5 py-2 text-xs">
                        {liveCbeCheck.findings.map((finding) => (
                          <div key={finding.id} className="flex items-start gap-2.5 py-2">
                            {finding.status === 'pass' ? (
                              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-teal-700" />
                            ) : (
                              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-700" />
                            )}
                            <div className="min-w-0">
                              <p
                                className={`font-semibold ${
                                  finding.status === 'pass' ? 'text-teal-900' : 'text-amber-950'
                                }`}
                              >
                                {finding.label}
                              </p>
                              <p className="text-slate-600 leading-relaxed">{finding.detail}</p>
                              {finding.fixExample && (
                                <p className="mt-0.5 font-mono text-[11px] text-blue-800">
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
                  <div className="rounded-md border border-amber-200 bg-amber-50 p-3 space-y-1.5">
                    <p className="text-[11px] font-bold text-amber-900">
                      Unmarked CBE Scratch Pad (ACCA markers CANNOT see this box!)
                    </p>
                    <textarea
                      rows={4}
                      value={scratchPad}
                      onChange={(e) => setScratchPad(e.target.value)}
                      placeholder="Rough jottings only — copy workings into the main response box above for marks."
                      className="w-full rounded border border-amber-200 bg-white p-2 font-mono text-xs text-slate-800"
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

            {/* Pre-Submit Hint & Submit Actions */}
            {!locked && (
              <div className="space-y-3 pt-2">
                {showHint && (
                  <div className="rounded-md border border-blue-200 bg-blue-50 px-3.5 py-2.5 text-xs text-blue-950">
                    <strong>Hint (no spoilers):</strong>{' '}
                    {question.examiner_debrief.examiner_playbook}
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => handleSubmit(false)}
                    className="rounded-md bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-800"
                  >
                    Submit Answer
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowHint((h) => !h)}
                    className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-3.5 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    <HelpCircle className="h-3.5 w-3.5" />
                    {showHint ? 'Hide Hint' : 'Show Hint'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSubmit(true)}
                    className="rounded-md border border-slate-300 bg-white px-3.5 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                  >
                    Skip & Reveal
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* PHASE 3: Locked Solution + Mark Scheme + Examiner Debrief (A–F) */}
      {locked && graded && (
        <section className="space-y-5">
          {/* 2nd-offence Trap Micro-Drill Trigger */}
          {microDrillAlert && (
            <div className="flex flex-col gap-3 rounded-lg border border-red-300 bg-red-50 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-700" />
                <div>
                  <p className="text-sm font-bold text-red-950">
                    2nd Repeat Trap Detected: {microDrillAlert}
                  </p>
                  <p className="text-xs text-red-900">
                    You have hit the "{microDrillAlert}" trap twice. Launch a focused 2-question micro-drill now to lock out this error.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onLaunchMicroDrill(microDrillAlert)}
                className="shrink-0 rounded-md bg-red-700 px-4 py-2 text-xs font-semibold text-white hover:bg-red-800"
              >
                Start 2-Q Micro-Drill →
              </button>
            </div>
          )}

          {/* Verdict + Answer Comparison */}
          <div className="rounded-lg border border-slate-200 bg-white p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2.5">
                {graded.isAutoGraded ? (
                  graded.isFullyCorrect ? (
                    <CheckCircle2 className="h-5 w-5 text-teal-700" />
                  ) : (
                    <XCircle className="h-5 w-5 text-red-700" />
                  )
                ) : (
                  <CheckCircle2 className="h-5 w-5 text-blue-700" />
                )}
                <div>
                  <h2 className="font-display text-base font-bold text-slate-900">
                    {graded.isAutoGraded
                      ? graded.isFullyCorrect
                        ? 'Full Marks Earned'
                        : graded.marksScored > 0
                        ? 'Partial Marks Earned'
                        : 'Incorrect — Review Full Solution & Trap Debrief'
                      : 'Self-Mark Against Official ACCA Mark Scheme'}
                  </h2>
                  <p className="text-xs text-slate-600">
                    Your response: <span className="font-mono font-semibold">{graded.userDisplay}</span> · Correct:{' '}
                    <span className="font-mono font-semibold text-teal-800">{graded.correctDisplay}</span>
                  </p>
                </div>
              </div>

              <div className="rounded-md border border-slate-200 bg-slate-50 px-3.5 py-2 font-mono text-sm font-bold text-slate-900 tabular-nums">
                {graded.isAutoGraded ? graded.marksScored : selfMarkedScore} / {question.marks} marks
              </div>
            </div>

            {/* Section B Sub-Question Breakdown */}
            {graded.subResults && (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-5">
                {graded.subResults.map((sr) => (
                  <div
                    key={sr.subNum}
                    className={`rounded border p-2.5 text-xs ${
                      sr.correct
                        ? 'border-teal-200 bg-teal-50 text-teal-950'
                        : 'border-red-200 bg-red-50 text-red-950'
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

            {/* Interactive Self-Marking Step Checklist */}
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Step-by-Step ACCA Mark Scheme Checkboxes
                </h3>
                {question.type === 'cr' && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={crScoreConfirmed}
                      onClick={handleApplySelfMarkToProgress}
                      className={`rounded border px-3 py-1 text-xs font-semibold ${
                        crScoreConfirmed
                          ? 'border-teal-600 bg-teal-600 text-white'
                          : 'border-blue-700 bg-blue-700 text-white hover:bg-blue-800'
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
                      className="rounded border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50"
                    >
                      {aiLoading ? 'Reviewing...' : 'AI Examiner Critique'}
                    </button>
                  </div>
                )}
              </div>

              <div className="divide-y divide-slate-100 rounded-md border border-slate-200">
                {question.mark_scheme_steps.map((step) => {
                  const isChecked = Boolean(checkedSteps[step.id]);
                  return (
                    <label
                      key={step.id}
                      className="flex cursor-pointer items-center justify-between gap-3 px-3.5 py-2.5 text-xs hover:bg-slate-50"
                    >
                      <span className="flex items-center gap-2.5 text-slate-800">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() =>
                            setCheckedSteps((prev) => ({
                              ...prev,
                              [step.id]: !prev[step.id],
                            }))
                          }
                          className="h-4 w-4 rounded border-slate-300 text-blue-700"
                        />
                        {step.label}
                      </span>
                      <span className="font-mono font-bold text-slate-700 tabular-nums">
                        {step.marks}m
                      </span>
                    </label>
                  );
                })}
              </div>

              {aiCritique && (
                <div className="rounded-md border border-blue-200 bg-blue-50 p-3.5 text-xs text-slate-800 whitespace-pre-line">
                  <strong className="text-blue-900">Examiner Critique:</strong>
                  {'\n'}
                  {aiCritique}
                </div>
              )}
            </div>

            {/* Easy-Marks Audit & CBE Presentation Coach (for CRs) */}
            {crAudit && crPresentation && (
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <div className="rounded-md border border-slate-200 bg-slate-50 p-3.5">
                  <h4 className="text-xs font-bold text-slate-900">
                    Easy-Marks Audit ({crAudit.capturedCount}/{crAudit.totalChecks} captured)
                  </h4>
                  <ul className="mt-2 space-y-1.5 text-xs">
                    {crAudit.checks.map((c, idx) => (
                      <li key={idx} className={c.captured ? 'text-teal-800' : 'text-red-800'}>
                        {c.captured ? '✓' : '✗'} {c.label}
                        {!c.captured && <span className="block text-slate-500 ml-3.5">{c.tip}</span>}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="rounded-md border border-slate-200 bg-slate-50 p-3.5">
                  <h4 className="text-xs font-bold text-slate-900">
                    CBE Presentation Audit ({crPresentation.scoreOutOf100}/100)
                  </h4>
                  <ul className="mt-2 space-y-1.5 text-xs">
                    {crPresentation.findings.map((f) => (
                      <li key={f.id} className={f.status === 'pass' ? 'text-teal-800' : 'text-amber-900'}>
                        {f.status === 'pass' ? '✓' : '!'} <strong>{f.label}:</strong> {f.detail}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {/* Complete Kaplan Model Solution */}
            <div className="rounded-md border border-slate-200 bg-slate-50 p-4 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                  Full Worked Solution (Kit {question.answer_page})
                </h3>
                <span className="font-mono text-xs text-slate-500">
                  {question.kit_page} · {question.st_chapter}
                </span>
              </div>
              <div className="whitespace-pre-line font-mono text-xs leading-relaxed text-slate-800">
                {question.full_worked_solution}
              </div>
            </div>
          </div>

          {/* EXAMINER INTELLIGENCE LAYER: A–F Examiner Debrief */}
          <div className="rounded-lg border border-slate-300 bg-white p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
              <h2 className="font-display text-base font-bold text-slate-900">
                Examiner Debrief — Trap Category: {question.examiner_debrief.trap_category}
              </h2>
              <span className="font-mono text-xs text-slate-500">
                {question.exam_frequency_tag}
              </span>
            </div>

            <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2 text-xs leading-relaxed">
              <div className="rounded-md border border-red-200 bg-red-50/40 p-3.5">
                <p className="font-bold text-red-900">A. Trap of the Question</p>
                <p className="mt-1 text-slate-800">{question.examiner_debrief.trap_of_question}</p>
              </div>

              <div className="rounded-md border border-slate-200 bg-slate-50 p-3.5">
                <p className="font-bold text-slate-900">B. Distractor Forensics</p>
                <p className="mt-1 text-slate-800">{question.examiner_debrief.distractor_forensics}</p>
              </div>

              <div className="rounded-md border border-slate-200 bg-slate-50 p-3.5">
                <p className="font-bold text-slate-900">C. Examiner’s Playbook</p>
                <p className="mt-1 text-slate-800">{question.examiner_debrief.examiner_playbook}</p>
              </div>

              <div className="rounded-md border border-teal-200 bg-teal-50/40 p-3.5">
                <p className="font-bold text-teal-900">D. Speed Trick</p>
                <p className="mt-1 text-slate-800">{question.examiner_debrief.speed_trick}</p>
              </div>

              <div className="rounded-md border border-blue-200 bg-blue-50/40 p-3.5">
                <p className="font-bold text-blue-900">E. Twist Prediction</p>
                <p className="mt-1 text-slate-800">{question.examiner_debrief.twist_prediction}</p>
              </div>

              <div className="rounded-md border border-slate-200 bg-slate-50 p-3.5">
                <p className="font-bold text-slate-900">F. Personal Trap Ledger Update</p>
                {(() => {
                  const entry = appState.trapLedger[question.examiner_debrief.trap_category];
                  return (
                    <p className="mt-1 text-slate-800">
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
                className="inline-flex items-center gap-1.5 rounded-md bg-blue-700 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-800"
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
