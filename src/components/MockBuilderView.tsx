import React, { useEffect, useMemo, useState } from 'react';
import {
  Award,
  CheckCircle2,
  Clock,
  FileCheck2,
  Flag,
  Layers,
  PenTool,
  Play,
  Zap,
} from 'lucide-react';
import { HIGHER_SKILLS_ROSTER, TOPICS, WRITTEN_ANSWER_ROSTER } from '../data/taxReference';
import { auditEasyMarks, gradeQuestion, scoreKeywords, type UserQuestionAnswer } from '../engine/scoring';
import type {
  AppState,
  CaseSubQuestion,
  KitQuestion,
  MatrixOptions,
  McqOption,
  MockResultRecord,
  PairDropdownGroup,
  SectionType,
} from '../types/tx';

interface MockAttemptEntry {
  question: KitQuestion;
  marksScored: number;
  marksAvailable: number;
  freeMarksCaptured: number;
  freeMarksTotal: number;
  userAnswerSummary: string;
  correctAnswerSummary: string;
  elapsedSeconds: number;
}

interface MockBuilderViewProps {
  allQuestions: KitQuestion[];
  specimenQuestions: KitQuestion[];
  appState: AppState;
  autoLaunchSpecimen?: boolean;
  onSaveMockResult: (record: MockResultRecord) => void;
  onRecordMockAttempts: (entries: MockAttemptEntry[]) => void;
  onSyncMockCrMarks: (
    mockId: string,
    crEntries: MockAttemptEntry[],
    updatedSectionBreakdown: { section: SectionType; scored: number; available: number }[],
    updatedTotalScored: number
  ) => void;
  onOpenQuestionById: (qId: string) => void;
}

type MockSubView = 'menu' | 'running' | 'report' | 'higher' | 'easy' | 'theory';

interface ActiveMockPaper {
  mode: 'full_specimen' | 'quick_mock' | 'it_abc_mock' | 'custom_mock';
  title: string;
  items: KitQuestion[];
  totalMarks: number;
  budgetSeconds: number;
}

const AREA_BY_TOPIC_ID: Record<number, string> = Object.fromEntries(
  TOPICS.map((t) => [t.id, t.syllabusArea])
);

function hasAnswerEntered(val: UserQuestionAnswer | undefined): boolean {
  if (val === undefined || val === null) return false;
  if (typeof val === 'string') return val.trim().length > 0;
  if (Array.isArray(val)) {
    return val.some((entry) => {
      if (typeof entry === 'string') return entry.trim().length > 0;
      if (Array.isArray(entry)) return entry.length > 0;
      if (entry && typeof entry === 'object') {
        return Object.values(entry).some((arr) => Array.isArray(arr) && arr.length > 0);
      }
      return false;
    });
  }
  if (typeof val === 'object') {
    return Object.values(val).some((arr) => Array.isArray(arr) && arr.length > 0);
  }
  return false;
}

function formatTimer(sec: number): string {
  const s = Math.max(0, sec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
}

export const MockBuilderView: React.FC<MockBuilderViewProps> = ({
  allQuestions,
  specimenQuestions,
  appState,
  autoLaunchSpecimen = false,
  onSaveMockResult,
  onRecordMockAttempts,
  onSyncMockCrMarks,
  onOpenQuestionById,
}) => {
  const [subView, setSubView] = useState<MockSubView>('menu');
  const [paper, setPaper] = useState<ActiveMockPaper | null>(null);
  const [activeMockId, setActiveMockId] = useState<string | null>(null);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, UserQuestionAnswer>>({});
  const [flagged, setFlagged] = useState<Record<string, boolean>>({});
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [crSelfMarks, setCrSelfMarks] = useState<Record<string, number>>({});
  const [crSyncedToMastery, setCrSyncedToMastery] = useState(false);
  const [autoSyncedCount, setAutoSyncedCount] = useState(0);

  // Custom Syllabus Mock Builder state
  const [customArea, setCustomArea] = useState<string>('ALL');
  const [customSecACount, setCustomSecACount] = useState<number>(5);
  const [customIncludeB, setCustomIncludeB] = useState<boolean>(true);
  const [customIncludeC, setCustomIncludeC] = useState<boolean>(true);
  const [customPrioritizeUnseen, setCustomPrioritizeUnseen] = useState<boolean>(true);
  const [reportFilter, setReportFilter] = useState<'all' | 'missed' | 'cr'>('all');

  // Written-Answer Clinic state (/theory)
  const [theoryIdx, setTheoryIdx] = useState(0);
  const [theoryText, setTheoryText] = useState('');
  const [theoryChecked, setTheoryChecked] = useState(false);

  // Easy-Marks Rapid 10-Rep state (/easy)
  const [rapidItems, setRapidItems] = useState<KitQuestion[]>([]);
  const [rapidAnswers, setRapidAnswers] = useState<Record<string, string>>({});
  const [rapidSubmitted, setRapidSubmitted] = useState(false);

  const sortByPreferredSections = (items: KitQuestion[]) => {
    const order = appState.profile.preferredSectionOrder;
    const rank: Record<SectionType, number> =
      order === 'C-B-A'
        ? { C: 0, B: 1, A: 2 }
        : order === 'B-C-A'
        ? { B: 0, C: 1, A: 2 }
        : { A: 0, B: 1, C: 2 };
    return [...items].sort((a, b) => rank[a.section] - rank[b.section]);
  };

  const launchMock = (mode: 'full_specimen' | 'quick_mock' | 'it_abc_mock') => {
    let items: KitQuestion[] = [];
    let title = '';
    if (mode === 'full_specimen') {
      items = [...specimenQuestions];
      title = 'Full ACCA TX-UK Specimen CBE Exam (100 Marks · 3h 00m)';
    } else if (mode === 'quick_mock') {
      items = allQuestions.filter((q) => q.section === 'A').slice(0, 15);
      title = '54-Minute Quick Section A Mock (30 Marks · 15 OTs)';
    } else {
      const secA = allQuestions.filter((q) => q.section === 'A').slice(0, 5);
      const secB = allQuestions.filter((q) => q.section === 'B').slice(0, 1);
      const secC = allQuestions.filter((q) => q.section === 'C').slice(0, 1);
      items = [...secA, ...secB, ...secC];
      title = 'Income Tax & NIC Mini A/B/C Mock (35 Marks)';
    }

    const ordered = sortByPreferredSections(items);
    const totalMarks = ordered.reduce((s, q) => s + q.marks, 0);
    const budgetSeconds = Math.round(totalMarks * 1.8 * 60);

    setPaper({ mode, title, items: ordered, totalMarks, budgetSeconds });
    setActiveMockId(null);
    setCurrentIdx(0);
    setAnswers({});
    setFlagged({});
    setCrSelfMarks({});
    setCrSyncedToMastery(false);
    setAutoSyncedCount(0);
    setReportFilter('all');
    setSecondsLeft(budgetSeconds);
    setSubView('running');
  };

  const launchCustomMock = () => {
    const attemptedIds = new Set(appState.attempts.map((a) => a.questionId));
    const missedIds = new Set(appState.mistakes.map((m) => m.questionId));

    const pool = allQuestions.filter((q) =>
      customArea === 'ALL' ? true : AREA_BY_TOPIC_ID[q.topic_id] === customArea
    );

    const pickFromSection = (sec: SectionType, limit: number) => {
      const candidates = pool.filter((q) => q.section === sec);
      if (!customPrioritizeUnseen) return candidates.slice(0, limit);
      const prioritized = [...candidates].sort((a, b) => {
        const score = (item: KitQuestion) =>
          missedIds.has(item.id) ? 0 : !attemptedIds.has(item.id) ? 1 : 2;
        return score(a) - score(b);
      });
      return prioritized.slice(0, limit);
    };

    const secA = pickFromSection('A', customSecACount);
    const secB = customIncludeB ? pickFromSection('B', 1) : [];
    const secC = customIncludeC ? pickFromSection('C', 1) : [];
    const ordered = sortByPreferredSections([...secA, ...secB, ...secC]);
    if (ordered.length === 0) return;

    const totalMarks = ordered.reduce((s, q) => s + q.marks, 0);
    const budgetSeconds = Math.round(totalMarks * 1.8 * 60);
    const areaLabel = customArea === 'ALL' ? 'Full Syllabus' : customArea;

    setPaper({
      mode: 'custom_mock',
      title: `Custom ${areaLabel} Mock (${totalMarks} Marks)`,
      items: ordered,
      totalMarks,
      budgetSeconds,
    });
    setActiveMockId(null);
    setCurrentIdx(0);
    setAnswers({});
    setFlagged({});
    setCrSelfMarks({});
    setCrSyncedToMastery(false);
    setAutoSyncedCount(0);
    setReportFilter('all');
    setSecondsLeft(budgetSeconds);
    setSubView('running');
  };

  useEffect(() => {
    if (autoLaunchSpecimen && subView === 'menu' && specimenQuestions.length > 0) {
      launchMock('full_specimen');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoLaunchSpecimen]);

  useEffect(() => {
    if (subView !== 'running') return;
    const id = window.setInterval(() => {
      setSecondsLeft((s) => (s > 0 ? s - 1 : 0));
    }, 1000);
    return () => window.clearInterval(id);
  }, [subView]);

  const gradedReport = useMemo(() => {
    if (!paper || subView !== 'report') return null;
    const itemResults = paper.items.map((q) => {
      const res = gradeQuestion(q, answers[q.id]);
      const finalScored =
        q.type === 'cr' ? crSelfMarks[q.id] ?? 0 : res.marksScored;
      return {
        q,
        res,
        finalScored,
      };
    });

    const sectionMap: Record<SectionType, { scored: number; available: number }> = {
      A: { scored: 0, available: 0 },
      B: { scored: 0, available: 0 },
      C: { scored: 0, available: 0 },
    };
    for (const row of itemResults) {
      sectionMap[row.q.section].scored += row.finalScored;
      sectionMap[row.q.section].available += row.q.marks;
    }

    const totalScored = itemResults.reduce((s, r) => s + r.finalScored, 0);
    return {
      itemResults,
      totalScored,
      totalAvailable: paper.totalMarks,
      percent: paper.totalMarks > 0 ? Math.round((totalScored / paper.totalMarks) * 100) : 0,
      sectionBreakdown: (['A', 'B', 'C'] as SectionType[])
        .filter((sec) => sectionMap[sec].available > 0)
        .map((sec) => ({
          section: sec,
          scored: sectionMap[sec].scored,
          available: sectionMap[sec].available,
        })),
    };
  }, [paper, subView, answers, crSelfMarks]);

  const handleSubmitFullMock = () => {
    if (!paper) return;
    const mockId = `mock-${Date.now()}`;
    const sectionMap: Record<SectionType, { scored: number; available: number }> = {
      A: { scored: 0, available: 0 },
      B: { scored: 0, available: 0 },
      C: { scored: 0, available: 0 },
    };
    const autoAttemptEntries: MockAttemptEntry[] = [];
    const totalElapsed = Math.max(1, paper.budgetSeconds - secondsLeft);
    const perItemSeconds = Math.max(10, Math.round(totalElapsed / Math.max(1, paper.items.length)));

    let totalScored = 0;
    for (const q of paper.items) {
      const res = gradeQuestion(q, answers[q.id]);
      const sc = q.type === 'cr' ? crSelfMarks[q.id] ?? 0 : res.marksScored;
      totalScored += sc;
      sectionMap[q.section].scored += sc;
      sectionMap[q.section].available += q.marks;

      if (q.type !== 'cr') {
        autoAttemptEntries.push({
          question: q,
          marksScored: res.marksScored,
          marksAvailable: q.marks,
          freeMarksCaptured: 0,
          freeMarksTotal: 0,
          userAnswerSummary: res.userDisplay,
          correctAnswerSummary: res.correctDisplay,
          elapsedSeconds: perItemSeconds,
        });
      }
    }

    onSaveMockResult({
      id: mockId,
      mode: paper.mode,
      title: paper.title,
      completedIso: new Date().toISOString(),
      marksScored: totalScored,
      marksAvailable: paper.totalMarks,
      sectionBreakdown: (['A', 'B', 'C'] as SectionType[])
        .filter((s) => sectionMap[s].available > 0)
        .map((s) => ({ section: s, ...sectionMap[s] })),
      elapsedSeconds: totalElapsed,
    });
    onRecordMockAttempts(autoAttemptEntries);
    setActiveMockId(mockId);
    setAutoSyncedCount(autoAttemptEntries.length);
    setCrSyncedToMastery(false);
    setSubView('report');
  };

  const handleConfirmCrMarks = () => {
    if (!paper || !activeMockId || !gradedReport || crSyncedToMastery) return;
    const crEntries: MockAttemptEntry[] = [];
    const totalElapsed = Math.max(1, paper.budgetSeconds - secondsLeft);
    const perItemSeconds = Math.max(60, Math.round(totalElapsed / Math.max(1, paper.items.length)));

    for (const { q, finalScored } of gradedReport.itemResults) {
      if (q.type !== 'cr') continue;
      const rawText = typeof answers[q.id] === 'string' ? (answers[q.id] as string) : '';
      const easy = auditEasyMarks(rawText, q);
      crEntries.push({
        question: q,
        marksScored: finalScored,
        marksAvailable: q.marks,
        freeMarksCaptured: easy.capturedCount,
        freeMarksTotal: easy.totalChecks,
        userAnswerSummary: `Mock CR Self-Marked ${finalScored}/${q.marks}`,
        correctAnswerSummary: q.mark_scheme_steps.map((s) => s.label).join(' · '),
        elapsedSeconds: perItemSeconds,
      });
    }

    onSyncMockCrMarks(
      activeMockId,
      crEntries,
      gradedReport.sectionBreakdown,
      gradedReport.totalScored
    );
    setCrSyncedToMastery(true);
  };

  const renderMockInteractiveInput = (
    interaction: string,
    options: McqOption[] | MatrixOptions | PairDropdownGroup[],
    curVal: unknown,
    onChangeVal: (nextVal: UserQuestionAnswer) => void,
    prefixKey: string
  ) => {
    if (interaction === 'numeric_input') {
      return (
        <div className="flex max-w-xs items-center rounded border border-slate-300 bg-white">
          <span className="border-r border-slate-200 bg-slate-50 px-3 py-1.5 font-mono text-sm font-bold text-slate-700">
            £
          </span>
          <input
            type="text"
            inputMode="numeric"
            value={typeof curVal === 'string' ? curVal : ''}
            onChange={(e) => onChangeVal(e.target.value)}
            placeholder="whole £ amount"
            className="w-full px-3 py-1.5 font-mono text-sm focus:outline-none"
          />
        </div>
      );
    }

    if (interaction === 'matrix') {
      const mat = options as MatrixOptions;
      const obj = (curVal && typeof curVal === 'object' && !Array.isArray(curVal)
        ? curVal
        : {}) as Record<string, string[]>;
      return (
        <div className="overflow-x-auto rounded border border-slate-200">
          <table className="min-w-full text-xs">
            <thead>
              <tr className="bg-slate-50 font-semibold text-slate-700">
                <th className="px-3 py-2 text-left">Item</th>
                {mat.columns.map((c, ci) => (
                  <th key={ci} className="px-3 py-2 text-center">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {mat.rows.map((r, ri) => {
                const chosen = obj[String(ri)] ?? [];
                return (
                  <tr key={ri} className="border-t border-slate-100">
                    <td className="px-3 py-2 text-slate-800">{r}</td>
                    {mat.columns.map((col, ci) => (
                      <td key={ci} className="px-3 py-2 text-center">
                        <input
                          type="checkbox"
                          checked={chosen.includes(col)}
                          onChange={() => {
                            const nextRow = chosen.includes(col)
                              ? chosen.filter((x) => x !== col)
                              : [...chosen, col];
                            onChangeVal({ ...obj, [String(ri)]: nextRow });
                          }}
                        />
                      </td>
                    ))}
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
      const arr = Array.isArray(curVal) ? (curVal as string[]) : [];
      return (
        <div className="space-y-2">
          {groups.map((g, gi) => (
            <div
              key={gi}
              className="flex flex-col gap-1.5 rounded border border-slate-200 p-2.5 text-xs sm:flex-row sm:items-center sm:justify-between"
            >
              <span className="font-medium text-slate-800">{g.group}</span>
              <select
                value={arr[gi] ?? ''}
                onChange={(e) => {
                  const next = [...arr];
                  next[gi] = e.target.value;
                  onChangeVal(next);
                }}
                className="rounded border border-slate-300 bg-white px-2.5 py-1 text-xs"
              >
                <option value="">Select...</option>
                {g.choices.map((c, ci) => (
                  <option key={ci} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      );
    }

    const opts = Array.isArray(options) ? (options as McqOption[]) : [];
    const isMulti = interaction === 'multi_select';
    return (
      <div className="space-y-1.5">
        {isMulti && (
          <p className="text-[11px] font-semibold text-slate-500">Select all matching options:</p>
        )}
        {opts.map((opt) => {
          const checked = isMulti
            ? Array.isArray(curVal) && curVal.includes(opt.key)
            : curVal === opt.key;
          return (
            <label
              key={`${prefixKey}-${opt.key}`}
              className={`flex cursor-pointer items-start gap-2.5 rounded border p-2.5 text-sm ${
                checked ? 'border-blue-600 bg-blue-50/60' : 'border-slate-200 hover:bg-slate-50'
              }`}
            >
              <input
                type={isMulti ? 'checkbox' : 'radio'}
                name={prefixKey}
                checked={checked}
                onChange={() => {
                  if (isMulti) {
                    const prev = Array.isArray(curVal) ? (curVal as string[]) : [];
                    const next = checked ? prev.filter((x) => x !== opt.key) : [...prev, opt.key];
                    onChangeVal(next);
                  } else {
                    onChangeVal(opt.key);
                  }
                }}
                className="mt-1"
              />
              <span>
                <strong className="font-mono text-xs mr-1.5">{opt.key}.</strong>
                {opt.text}
              </span>
            </label>
          );
        })}
      </div>
    );
  };

  const startEasyRapid10 = () => {
    const mcqs = allQuestions.filter((q) => q.section === 'A' && q.type === 'mcq').slice(0, 10);
    setRapidItems(mcqs);
    setRapidAnswers({});
    setRapidSubmitted(false);
    setSubView('easy');
  };

  if (subView === 'running' && paper) {
    const curQ = paper.items[currentIdx];
    const curAns = answers[curQ.id];
    return (
      <div className="space-y-5">
        {/* Strict Exam Header Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-900 px-5 py-3.5 text-white">
          <div>
            <p className="font-mono text-xs text-blue-300">
              STRICT EXAM MODE · Feedback locked until paper submitted
            </p>
            <h1 className="font-display text-sm font-bold">{paper.title}</h1>
          </div>
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 rounded bg-slate-800 px-3 py-1.5 font-mono text-sm font-bold tabular-nums">
              <Clock className="h-4 w-4 text-amber-400" />
              {formatTimer(secondsLeft)}
            </span>
            <button
              type="button"
              onClick={handleSubmitFullMock}
              className="rounded-md bg-blue-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-blue-500"
            >
              Submit Entire Exam
            </button>
          </div>
        </div>

        {/* Question Palette */}
        <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-slate-200 bg-white p-3">
          {paper.items.map((item, idx) => {
            const hasAns = hasAnswerEntered(answers[item.id]);
            const isFlag = Boolean(flagged[item.id]);
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setCurrentIdx(idx)}
                className={`rounded border px-2.5 py-1 font-mono text-xs font-semibold ${
                  idx === currentIdx
                    ? 'border-blue-700 bg-blue-700 text-white'
                    : isFlag
                    ? 'border-amber-400 bg-amber-50 text-amber-900'
                    : hasAns
                    ? 'border-teal-300 bg-teal-50 text-teal-900'
                    : 'border-slate-200 bg-slate-50 text-slate-700'
                }`}
              >
                {idx + 1} ({item.section})
              </button>
            );
          })}
        </div>

        {/* Active Exam Question */}
        <div className="rounded-lg border border-slate-200 bg-white p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <div>
              <span className="font-mono text-xs font-bold text-blue-700">
                Item {currentIdx + 1} of {paper.items.length} · {curQ.id} · Section {curQ.section} ({curQ.marks} marks)
              </span>
              <h2 className="font-display text-base font-bold text-slate-900">{curQ.title}</h2>
            </div>
            <button
              type="button"
              onClick={() => setFlagged((f) => ({ ...f, [curQ.id]: !f[curQ.id] }))}
              className={`inline-flex items-center gap-1 rounded border px-3 py-1 text-xs font-semibold ${
                flagged[curQ.id]
                  ? 'border-amber-400 bg-amber-50 text-amber-900'
                  : 'border-slate-300 bg-white text-slate-700'
              }`}
            >
              <Flag className="h-3.5 w-3.5" />
              {flagged[curQ.id] ? 'Flagged' : 'Flag'}
            </button>
          </div>

          {curQ.scenario && (
            <div className="whitespace-pre-line rounded border border-slate-200 bg-slate-50 p-4 text-sm text-slate-800">
              {curQ.scenario}
            </div>
          )}

          <div className="rounded border border-blue-200 bg-blue-50/40 p-3.5 text-sm font-medium text-slate-900">
            {curQ.requirement}
          </div>

          {/* Input according to question type */}
          {curQ.type === 'cr' ? (
            <textarea
              rows={10}
              value={typeof curAns === 'string' ? curAns : ''}
              onChange={(e) => setAnswers((a) => ({ ...a, [curQ.id]: e.target.value }))}
              placeholder="Enter CBE working & headings here (self-marked against ACCA scheme upon submission)..."
              className="w-full rounded border border-slate-300 p-3 font-mono text-xs text-slate-900"
            />
          ) : curQ.type === 'case' ? (
            <div className="space-y-4">
              {(curQ.options as CaseSubQuestion[]).map((sq, sIdx) => {
                const arr = Array.isArray(curAns) ? curAns : [];
                return (
                  <div key={sq.sub_num} className="rounded border border-slate-200 p-3.5 space-y-2.5">
                    <p className="text-xs font-bold text-blue-700">OT {sq.sub_num} ({sq.marks} marks)</p>
                    <p className="text-sm text-slate-900 whitespace-pre-line">{sq.prompt}</p>
                    {renderMockInteractiveInput(
                      sq.interaction,
                      sq.options,
                      arr[sIdx],
                      (subVal) => {
                        const next = [...arr];
                        next[sIdx] = subVal as string | string[] | Record<string, string[]>;
                        setAnswers((a) => ({ ...a, [curQ.id]: next }));
                      },
                      `mock-case-${curQ.id}-${sIdx}`
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            renderMockInteractiveInput(
              curQ.interaction,
              curQ.options as McqOption[] | MatrixOptions | PairDropdownGroup[],
              curAns,
              (nextVal) => setAnswers((a) => ({ ...a, [curQ.id]: nextVal })),
              `mock-q-${curQ.id}`
            )
          )}

          <div className="flex justify-between pt-3 border-t border-slate-200">
            <button
              type="button"
              disabled={currentIdx === 0}
              onClick={() => setCurrentIdx((i) => Math.max(0, i - 1))}
              className="rounded border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 disabled:opacity-40"
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() => {
                if (currentIdx < paper.items.length - 1) setCurrentIdx((i) => i + 1);
                else handleSubmitFullMock();
              }}
              className="rounded bg-blue-700 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-800"
            >
              {currentIdx < paper.items.length - 1 ? 'Next Item →' : 'Finish & Submit Paper'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (subView === 'report' && gradedReport && paper) {
    return (
      <div className="space-y-5">
        <div className="rounded-lg border border-slate-200 bg-white p-6">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
            <div>
              <p className="font-mono text-xs font-semibold text-blue-700">MOCK SCORE REPORT</p>
              <h1 className="font-display text-xl font-bold text-slate-900">{paper.title}</h1>
            </div>
            <div className="text-right">
              <p className="font-mono text-3xl font-bold text-slate-900 tabular-nums">
                {gradedReport.totalScored} / {gradedReport.totalAvailable} ({gradedReport.percent}%)
              </p>
              <p className={`text-xs font-bold ${gradedReport.percent >= 50 ? 'text-teal-700' : 'text-red-700'}`}>
                {gradedReport.percent >= 60
                  ? 'Target Bank Achieved (≥60%)'
                  : gradedReport.percent >= 50
                  ? 'ACCA Pass Mark Achieved (≥50%)'
                  : 'Below Pass Mark (<50%) — Review Debriefs Below'}
              </p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {gradedReport.sectionBreakdown.map((sec) => (
              <div key={sec.section} className="rounded border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-bold text-slate-700">Section {sec.section}</p>
                <p className="mt-1 font-mono text-lg font-bold text-slate-900 tabular-nums">
                  {sec.scored} / {sec.available}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-md border border-teal-200 bg-teal-50/70 px-4 py-2.5 text-xs">
            <span className="flex items-center gap-1.5 font-medium text-teal-950">
              <CheckCircle2 className="h-4 w-4 text-teal-700" />
              {autoSyncedCount} Section A/B mock items synced to Topic Mastery, Trap Ledger & 1/3/7d Mistake Bank.
            </span>
            {paper.items.some((q) => q.type === 'cr') && (
              <button
                type="button"
                disabled={crSyncedToMastery}
                onClick={handleConfirmCrMarks}
                className={`rounded-md px-3.5 py-1.5 text-xs font-semibold ${
                  crSyncedToMastery
                    ? 'bg-teal-700 text-white'
                    : 'bg-blue-700 text-white hover:bg-blue-800'
                }`}
              >
                {crSyncedToMastery
                  ? 'CR Self-Marks Synced to Mastery ✓'
                  : 'Confirm CR Marks & Sync Mastery'}
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="inline-flex rounded-md border border-slate-200 bg-slate-100 p-0.5">
            {(
              [
                { id: 'all', label: `All Items (${gradedReport.itemResults.length})` },
                {
                  id: 'missed',
                  label: `Missed Only (${
                    gradedReport.itemResults.filter((r) => r.finalScored < r.q.marks).length
                  })`,
                },
                {
                  id: 'cr',
                  label: `Section C CRs (${
                    gradedReport.itemResults.filter((r) => r.q.type === 'cr').length
                  })`,
                },
              ] as const
            ).map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setReportFilter(f.id)}
                className={`whitespace-nowrap rounded px-3 py-1 text-xs font-semibold ${
                  reportFilter === f.id
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <span className="font-mono text-xs text-slate-500">
            Click any item below to expand full solution & trap debrief
          </span>
        </div>

        <div className="space-y-3">
          {gradedReport.itemResults
            .filter(({ q, finalScored }) => {
              if (reportFilter === 'missed') return finalScored < q.marks;
              if (reportFilter === 'cr') return q.type === 'cr';
              return true;
            })
            .map(({ q, res, finalScored }) => (
            <details key={q.id} className="rounded-lg border border-slate-200 bg-white p-4">
              <summary className="flex cursor-pointer items-center justify-between gap-2 text-sm font-bold text-slate-900">
                <span>
                  <span className="font-mono text-xs text-blue-700 mr-2">{q.id}</span>
                  {q.title}
                </span>
                <span className="font-mono text-xs font-bold text-slate-800">
                  {finalScored}/{q.marks}m · Expand Solution
                </span>
              </summary>
              <div className="mt-3 space-y-3 border-t border-slate-100 pt-3 text-xs">
                {q.type === 'cr' && (
                  <div className="flex flex-wrap items-center gap-3 rounded border border-blue-200 bg-blue-50 p-2.5">
                    <span className="font-semibold text-blue-900">Self-mark CR score (out of {q.marks}):</span>
                    <input
                      type="number"
                      min={0}
                      max={q.marks}
                      step={0.5}
                      disabled={crSyncedToMastery}
                      value={crSelfMarks[q.id] ?? 0}
                      onChange={(e) =>
                        setCrSelfMarks((m) => ({
                          ...m,
                          [q.id]: Math.min(q.marks, Math.max(0, Number(e.target.value) || 0)),
                        }))
                      }
                      className="w-20 rounded border border-blue-300 bg-white px-2 py-1 font-mono font-bold"
                    />
                    <span className="text-[11px] text-blue-800">
                      Compare with mark scheme below, then click “Confirm CR Marks & Sync Mastery” above.
                    </span>
                  </div>
                )}
                <p><strong>Your Answer:</strong> {res.userDisplay} · <strong>Expected:</strong> {res.correctDisplay}</p>
                <div className="whitespace-pre-line rounded bg-slate-50 p-3 font-mono text-slate-800">
                  {q.full_worked_solution}
                </div>
                <p className="text-red-900">
                  <strong>Examiner Trap:</strong> {q.examiner_debrief.trap_of_question}
                </p>
              </div>
            </details>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setSubView('menu')}
          className="rounded-md border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50"
        >
          ← Back to Mock & Labs Menu
        </button>
      </div>
    );
  }

  if (subView === 'higher') {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-5">
          <div>
            <h1 className="font-display text-lg font-bold text-slate-900">
              Higher-Skills 10-Mark Cross-Tax Lab
            </h1>
            <p className="text-xs text-slate-600">
              Master Section C 10-mark & 15-mark planning scenarios (incorporation, employment vs self-employment, dividends vs salary).
            </p>
          </div>
          <button
            type="button"
            onClick={() => setSubView('menu')}
            className="rounded border border-slate-300 px-3 py-1.5 text-xs font-semibold"
          >
            ← Back
          </button>
        </div>
        <div className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
          {HIGHER_SKILLS_ROSTER.map((item) => (
            <div key={item.kitQ} className="flex items-center justify-between gap-3 p-4">
              <div>
                <p className="text-sm font-bold text-slate-900">
                  <span className="font-mono text-xs text-blue-700 mr-2">{item.kitQ}</span>
                  {item.name}
                </p>
                <p className="text-xs text-slate-600">{item.focus} · {item.ref}</p>
              </div>
              <button
                type="button"
                onClick={() => onOpenQuestionById(item.kitQ)}
                className="rounded-md bg-blue-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-800"
              >
                Launch in Player →
              </button>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (subView === 'easy') {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-5">
          <div>
            <h1 className="font-display text-lg font-bold text-slate-900">
              Easy-Marks Rapid 10-Rep Drill
            </h1>
            <p className="text-xs text-slate-600">
              10 rapid computational OTs to lock in effortless Section A marks.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setSubView('menu')}
            className="rounded border border-slate-300 px-3 py-1.5 text-xs font-semibold"
          >
            ← Back
          </button>
        </div>

        <div className="space-y-3">
          {rapidItems.map((q, idx) => {
            const opts = Array.isArray(q.options) ? (q.options as McqOption[]) : [];
            const picked = rapidAnswers[q.id];
            const isCorrect = picked === String(q.correct_answer);
            return (
              <div key={q.id} className="rounded-lg border border-slate-200 bg-white p-4 space-y-2">
                <p className="font-mono text-xs font-bold text-blue-700">
                  Rep {idx + 1}/10 · {q.id} ({q.topic})
                </p>
                <p className="text-sm text-slate-800">{q.scenario} {q.requirement}</p>
                <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                  {opts.map((o) => (
                    <label key={o.key} className="flex items-center gap-2 rounded border border-slate-200 px-3 py-2 text-xs">
                      <input
                        type="radio"
                        disabled={rapidSubmitted}
                        name={`rapid-${q.id}`}
                        checked={picked === o.key}
                        onChange={() => setRapidAnswers((r) => ({ ...r, [q.id]: o.key }))}
                      />
                      <strong>{o.key}.</strong> {o.text}
                    </label>
                  ))}
                </div>
                {rapidSubmitted && (
                  <p className={`text-xs font-semibold ${isCorrect ? 'text-teal-700' : 'text-red-700'}`}>
                    {isCorrect ? '✓ Correct' : `✗ Answer is ${String(q.correct_answer)}`} · {q.examiner_debrief.speed_trick}
                  </p>
                )}
              </div>
            );
          })}
        </div>

        {!rapidSubmitted && (
          <button
            type="button"
            onClick={() => setRapidSubmitted(true)}
            className="rounded-md bg-blue-700 px-5 py-2.5 text-xs font-semibold text-white hover:bg-blue-800"
          >
            Submit Rapid 10 Reps
          </button>
        )}
      </div>
    );
  }

  if (subView === 'theory') {
    const cur = WRITTEN_ANSWER_ROSTER[theoryIdx];
    const kwResult = theoryChecked ? scoreKeywords(theoryText, cur.keywords, cur.marks) : null;
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-5">
          <div>
            <h1 className="font-display text-lg font-bold text-slate-900">
              Written-Answer Clinic
            </h1>
            <p className="text-xs text-slate-600">
              Train concise bullet-point phrasing scored against official ACCA marking keywords.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setSubView('menu')}
            className="rounded border border-slate-300 px-3 py-1.5 text-xs font-semibold"
          >
            ← Back
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          {WRITTEN_ANSWER_ROSTER.map((w, i) => (
            <button
              key={w.id}
              type="button"
              onClick={() => {
                setTheoryIdx(i);
                setTheoryText('');
                setTheoryChecked(false);
              }}
              className={`rounded border px-3 py-1.5 text-xs font-semibold ${
                theoryIdx === i
                  ? 'border-blue-600 bg-blue-50 text-blue-900'
                  : 'border-slate-200 bg-white text-slate-700'
              }`}
            >
              {w.title}
            </button>
          ))}
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-5 space-y-4">
          <div className="flex justify-between text-xs text-slate-500">
            <span className="font-bold text-slate-900">{cur.title}</span>
            <span className="font-mono">{cur.kitCitation}</span>
          </div>
          <p className="text-sm font-medium text-slate-900">{cur.prompt}</p>
          <textarea
            rows={5}
            value={theoryText}
            onChange={(e) => setTheoryText(e.target.value)}
            placeholder="Write crisp 1-sentence bullet points matching ACCA mark points (0.5–1 mark per distinct point)..."
            className="w-full rounded border border-slate-300 p-3 text-sm text-slate-900"
          />
          <button
            type="button"
            onClick={() => setTheoryChecked(true)}
            className="rounded-md bg-blue-700 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-800"
          >
            Score Keywords Against Model Phrase Bank
          </button>

          {kwResult && (
            <div className="rounded-md border border-slate-200 bg-slate-50 p-4 space-y-2 text-xs">
              <p className="font-bold text-slate-900">
                Suggested Keyword Score: {kwResult.suggestedMarks} / {kwResult.maxMarks} marks
              </p>
              <p className="text-teal-800">
                <strong>Matched keywords:</strong> {kwResult.matched.join(', ') || 'None yet'}
              </p>
              <p className="text-red-800">
                <strong>Missing keywords:</strong> {kwResult.missing.join(', ') || 'All captured!'}
              </p>
              <div className="border-t border-slate-200 pt-2">
                <p className="font-bold text-slate-800">Official Model Phrasing:</p>
                <ul className="mt-1 list-disc pl-4 space-y-1 text-slate-700">
                  {cur.modelPhraseBank.map((p, idx) => <li key={idx}>{p}</li>)}
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Default Menu View
  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-slate-200 bg-white p-5">
        <h1 className="font-display text-xl font-bold text-slate-900">
          Mock Exam Builder & Targeted Skill Clinics
        </h1>
        <p className="mt-1 text-xs text-slate-600">
          Strict CBE exam timing (1.8 min/mark). In mock mode, solutions stay locked until you submit the entire paper.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="flex flex-col justify-between rounded-lg border border-slate-200 bg-white p-5 space-y-4">
          <div>
            <div className="flex items-center justify-between">
              <FileCheck2 className="h-5 w-5 text-blue-700" />
              <span className="font-mono text-xs font-bold text-blue-700">100 MARKS · 3h 00m</span>
            </div>
            <h2 className="mt-3 font-display text-base font-bold text-slate-900">
              Full Specimen CBE Mock
            </h2>
            <p className="mt-1 text-xs text-slate-600">
              Official ACCA Specimen Paper (Kit p.609–637): 15 Sec A OTs (30m), 3 Sec B 5-OT Cases (30m), and Sarah + Simon + Naive Ltd Sec C CRs (40m).
            </p>
          </div>
          <button
            type="button"
            onClick={() => launchMock('full_specimen')}
            className="inline-flex items-center justify-center gap-1.5 rounded-md bg-blue-700 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-800"
          >
            <Play className="h-3.5 w-3.5" />
            Launch Specimen Mock
          </button>
        </div>

        <div className="flex flex-col justify-between rounded-lg border border-slate-200 bg-white p-5 space-y-4">
          <div>
            <div className="flex items-center justify-between">
              <Layers className="h-5 w-5 text-teal-700" />
              <span className="font-mono text-xs font-bold text-teal-700">35 MARKS · 63m</span>
            </div>
            <h2 className="mt-3 font-display text-base font-bold text-slate-900">
              Income Tax A/B/C Mini Mock
            </h2>
            <p className="mt-1 text-xs text-slate-600">
              Built from Q1–127: 5 Sec A OTs (10m) + 1 Sec B 5-OT Case (10m) + 1 Sec C 15-mark Constructed Response.
            </p>
          </div>
          <button
            type="button"
            onClick={() => launchMock('it_abc_mock')}
            className="inline-flex items-center justify-center gap-1.5 rounded-md border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-900 hover:bg-slate-50"
          >
            Start Mini A/B/C Mock
          </button>
        </div>

        <div className="flex flex-col justify-between rounded-lg border border-slate-200 bg-white p-5 space-y-4">
          <div>
            <div className="flex items-center justify-between">
              <Clock className="h-5 w-5 text-amber-600" />
              <span className="font-mono text-xs font-bold text-amber-700">30 MARKS · 54m</span>
            </div>
            <h2 className="mt-3 font-display text-base font-bold text-slate-900">
              54-Min Quick Section A Mock
            </h2>
            <p className="mt-1 text-xs text-slate-600">
              15 mixed Section A Objective Tests timed strictly to the 54-minute Section A exam allowance.
            </p>
          </div>
          <button
            type="button"
            onClick={() => launchMock('quick_mock')}
            className="inline-flex items-center justify-center gap-1.5 rounded-md border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-900 hover:bg-slate-50"
          >
            Start Quick 54-Min Mock
          </button>
        </div>
      </div>

      {/* Custom Syllabus Mock Builder */}
      <div className="rounded-lg border border-slate-200 bg-white p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-display text-base font-bold text-slate-900">
              Custom Syllabus Mock Builder (Q1–Q306)
            </h2>
            <p className="text-xs text-slate-600">
              Target any single tax head (e.g. Corporation Tax, CGT, IHT, VAT) with strict 1.8 min/mark pacing and automatic Mistake Bank syncing.
            </p>
          </div>
          <button
            type="button"
            onClick={launchCustomMock}
            className="inline-flex items-center gap-1.5 rounded-md bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
          >
            <Play className="h-3.5 w-3.5 text-amber-400" />
            Launch Custom Mock
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Syllabus Area</label>
            <select
              aria-label="Custom mock syllabus area"
              value={customArea}
              onChange={(e) => setCustomArea(e.target.value)}
              className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-2 font-medium text-slate-900"
            >
              <option value="ALL">All Syllabus Areas (Q1–Q306)</option>
              <option value="Income Tax & NIC">Income Tax & NIC (Q1–127)</option>
              <option value="Chargeable Gains">Chargeable Gains (Q128–179)</option>
              <option value="Inheritance Tax">Inheritance Tax (Q180–212)</option>
              <option value="Corporation Tax">Corporation Tax (Q213–270)</option>
              <option value="VAT">VAT (Q271–306)</option>
            </select>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Section A OTs (2m each)</label>
            <select
              aria-label="Custom mock Section A count"
              value={customSecACount}
              onChange={(e) => setCustomSecACount(Number(e.target.value))}
              className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-2 font-medium text-slate-900"
            >
              <option value={5}>5 OTs (10 marks)</option>
              <option value={10}>10 OTs (20 marks)</option>
              <option value={15}>15 OTs (30 marks)</option>
            </select>
          </div>

          <div className="space-y-2 pt-1">
            <label className="flex items-center gap-2 font-medium text-slate-800">
              <input
                type="checkbox"
                checked={customIncludeB}
                onChange={(e) => setCustomIncludeB(e.target.checked)}
              />
              Include 1 Section B Case (10m)
            </label>
            <label className="flex items-center gap-2 font-medium text-slate-800">
              <input
                type="checkbox"
                checked={customIncludeC}
                onChange={(e) => setCustomIncludeC(e.target.checked)}
              />
              Include 1 Section C CR (10–15m)
            </label>
          </div>

          <div className="space-y-2 pt-1">
            <label className="flex items-center gap-2 font-medium text-slate-800">
              <input
                type="checkbox"
                checked={customPrioritizeUnseen}
                onChange={(e) => setCustomPrioritizeUnseen(e.target.checked)}
              />
              Prioritise Missed & Unseen Qs
            </label>
            <p className="font-mono text-[11px] text-slate-500 tabular-nums">
              Est. {customSecACount * 2 + (customIncludeB ? 10 : 0) + (customIncludeC ? 15 : 0)}m ·{' '}
              {Math.round((customSecACount * 2 + (customIncludeB ? 10 : 0) + (customIncludeC ? 15 : 0)) * 1.8)} min · Order: {appState.profile.preferredSectionOrder}
            </p>
          </div>
        </div>
      </div>

      {/* Specialized Skill Clinics */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <button
          type="button"
          onClick={() => setSubView('higher')}
          className="rounded-lg border border-slate-200 bg-white p-5 text-left transition-colors hover:border-blue-400"
        >
          <Award className="h-5 w-5 text-blue-700" />
          <h3 className="mt-2.5 font-display text-sm font-bold text-slate-900">
            Higher-Skills 10-Mark Lab
          </h3>
          <p className="mt-1 text-xs text-slate-600">
            10 curated cross-tax planning & comparison CRs (Q100, Q102, Q111, Specimen Q31 & Q33).
          </p>
        </button>

        <button
          type="button"
          onClick={startEasyRapid10}
          className="rounded-lg border border-slate-200 bg-white p-5 text-left transition-colors hover:border-blue-400"
        >
          <Zap className="h-5 w-5 text-amber-600" />
          <h3 className="mt-2.5 font-display text-sm font-bold text-slate-900">
            Easy-Marks Rapid 10 Reps
          </h3>
          <p className="mt-1 text-xs text-slate-600">
            Rapid 10-question computational sprint with speed tricks & zero-slip discipline.
          </p>
        </button>

        <button
          type="button"
          onClick={() => setSubView('theory')}
          className="rounded-lg border border-slate-200 bg-white p-5 text-left transition-colors hover:border-blue-400"
        >
          <PenTool className="h-5 w-5 text-teal-700" />
          <h3 className="mt-2.5 font-display text-sm font-bold text-slate-900">
            Written-Answer Clinic
          </h3>
          <p className="mt-1 text-xs text-slate-600">
            Drill 2–4 mark narrative points (iXBRL, MLRO ethics, loss choice, record retention).
          </p>
        </button>
      </div>

      {/* Past Mock History */}
      {appState.mockHistory.length > 0 && (
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="font-display text-sm font-bold text-slate-900">Completed Mock Attempts</h2>
          <div className="mt-3 divide-y divide-slate-100 text-xs">
            {appState.mockHistory.map((m) => (
              <div key={m.id} className="flex items-center justify-between py-2.5">
                <div>
                  <span className="font-semibold text-slate-900">{m.title}</span>
                  <span className="ml-2 font-mono text-slate-500">{m.completedIso.slice(0, 10)}</span>
                </div>
                <span className="font-mono font-bold text-slate-900">
                  {m.marksScored}/{m.marksAvailable} ({Math.round((m.marksScored / m.marksAvailable) * 100)}%)
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
