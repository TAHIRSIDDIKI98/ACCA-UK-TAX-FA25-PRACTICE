import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Award,
  BookOpen,
  Calculator,
  CheckCircle2,
  Clock,
  FileCheck2,
  Flag,
  Layers,
  PenTool,
  Play,
  RotateCcw,
  ShieldCheck,
  Trash2,
  Zap,
} from 'lucide-react';
import { HIGHER_SKILLS_ROSTER, TOPICS, WRITTEN_ANSWER_ROSTER } from '../data/taxReference';
import {
  auditEasyMarks,
  coachCbePresentation,
  gradeQuestion,
  scoreKeywords,
  type UserQuestionAnswer,
} from '../engine/scoring';
import { getProformaTemplateForTopic } from '../engine/taxCalculators';
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
import { ScenarioText } from './ScenarioText';
import { TaxCalculatorPad } from './TaxCalculatorPad';
import { TaxTablesDrawer } from './TaxTablesView';

const ACTIVE_MOCK_STORAGE_KEY = 'tx_mastercoach_active_mock_v1';

interface SavedActiveMock {
  paper: ActiveMockPaper;
  currentIdx: number;
  answers: Record<string, UserQuestionAnswer>;
  flagged: Record<string, boolean>;
  secondsLeft: number;
  savedIso: string;
}

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
  const [crStepChecks, setCrStepChecks] = useState<Record<string, Record<string, boolean>>>({});
  const [crSyncedToMastery, setCrSyncedToMastery] = useState(false);
  const [autoSyncedCount, setAutoSyncedCount] = useState(0);
  const [tablesOpen, setTablesOpen] = useState(false);
  const [calcOpen, setCalcOpen] = useState(false);
  const [calcExpr, setCalcExpr] = useState('');
  const [crScratchPads, setCrScratchPads] = useState<Record<string, string>>({});
  const [showScratchPad, setShowScratchPad] = useState(false);
  const [savedMock, setSavedMock] = useState<SavedActiveMock | null>(() => {
    try {
      const raw = window.localStorage.getItem(ACTIVE_MOCK_STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as SavedActiveMock;
      if (parsed && parsed.paper && Array.isArray(parsed.paper.items) && parsed.paper.items.length > 0) {
        return parsed;
      }
      return null;
    } catch {
      return null;
    }
  });

  // Custom Syllabus Mock Builder state
  const [customArea, setCustomArea] = useState<string>('ALL');
  const [customSecACount, setCustomSecACount] = useState<number>(5);
  const [customIncludeB, setCustomIncludeB] = useState<boolean>(true);
  const [customIncludeC, setCustomIncludeC] = useState<boolean>(true);
  const [customPrioritizeUnseen, setCustomPrioritizeUnseen] = useState<boolean>(true);
  const [reportFilter, setReportFilter] = useState<'all' | 'missed' | 'cr'>('all');

  // Written-Answer Clinic state
  const [theoryIdx, setTheoryIdx] = useState(0);
  const [theoryText, setTheoryText] = useState('');
  const [theoryChecked, setTheoryChecked] = useState(false);

  // Easy-Marks Rapid 10-Rep state
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

  const prioritizeUnseenAndMissed = (candidates: KitQuestion[]) => {
    const attemptedIds = new Set(appState.attempts.map((a) => a.questionId));
    const missedIds = new Set(appState.mistakes.map((m) => m.questionId));
    return [...candidates].sort((a, b) => {
      const score = (item: KitQuestion) =>
        missedIds.has(item.id) ? 0 : !attemptedIds.has(item.id) ? 1 : 2;
      return score(a) - score(b);
    });
  };

  const resetMockSessionState = (nextPaper: ActiveMockPaper) => {
    setPaper(nextPaper);
    setActiveMockId(null);
    setCurrentIdx(0);
    setAnswers({});
    setFlagged({});
    setCrSelfMarks({});
    setCrStepChecks({});
    setCrScratchPads({});
    setShowScratchPad(false);
    setCalcOpen(false);
    setCrSyncedToMastery(false);
    setAutoSyncedCount(0);
    setReportFilter('all');
    setSecondsLeft(nextPaper.budgetSeconds);
    setSubView('running');
  };

  const launchMock = (mode: 'full_specimen' | 'quick_mock' | 'it_abc_mock') => {
    let items: KitQuestion[] = [];
    let title = '';
    if (mode === 'full_specimen') {
      items = [...specimenQuestions];
      title = 'Full ACCA TX-UK Specimen CBE Exam (100 Marks · 3h 00m)';
    } else if (mode === 'quick_mock') {
      const prioritizedSecA = prioritizeUnseenAndMissed(
        allQuestions.filter((q) => q.section === 'A')
      );
      const areas = ['Income Tax & NIC', 'Chargeable Gains', 'Inheritance Tax', 'Corporation Tax', 'VAT'];
      const pickedIds = new Set<string>();
      const balanced: KitQuestion[] = [];
      for (let round = 0; round < 3 && balanced.length < 15; round++) {
        for (const area of areas) {
          const match = prioritizedSecA.find(
            (q) => !pickedIds.has(q.id) && AREA_BY_TOPIC_ID[q.topic_id] === area
          );
          if (match) {
            pickedIds.add(match.id);
            balanced.push(match);
            if (balanced.length >= 15) break;
          }
        }
      }
      for (const q of prioritizedSecA) {
        if (balanced.length >= 15) break;
        if (!pickedIds.has(q.id)) {
          pickedIds.add(q.id);
          balanced.push(q);
        }
      }
      items = balanced;
      title = '54-Minute Quick Section A Mock (30 Marks · 15 OTs)';
    } else {
      const itPool = allQuestions.filter((q) => AREA_BY_TOPIC_ID[q.topic_id] === 'Income Tax & NIC');
      const secA = prioritizeUnseenAndMissed(itPool.filter((q) => q.section === 'A')).slice(0, 5);
      const secB = prioritizeUnseenAndMissed(itPool.filter((q) => q.section === 'B')).slice(0, 1);
      const secC = prioritizeUnseenAndMissed(itPool.filter((q) => q.section === 'C')).slice(0, 1);
      items = [...secA, ...secB, ...secC];
      title = 'Income Tax & NIC Mini A/B/C Mock (35 Marks)';
    }

    const ordered = sortByPreferredSections(items);
    const totalMarks = ordered.reduce((s, q) => s + q.marks, 0);
    const budgetSeconds = Math.round(totalMarks * 1.8 * 60);
    resetMockSessionState({ mode, title, items: ordered, totalMarks, budgetSeconds });
  };

  const launchCustomMock = () => {
    const pool = allQuestions.filter((q) =>
      customArea === 'ALL' ? true : AREA_BY_TOPIC_ID[q.topic_id] === customArea
    );

    const pickFromSection = (sec: SectionType, limit: number) => {
      const candidates = pool.filter((q) => q.section === sec);
      if (!customPrioritizeUnseen) return candidates.slice(0, limit);
      return prioritizeUnseenAndMissed(candidates).slice(0, limit);
    };

    const secA = pickFromSection('A', customSecACount);
    const secB = customIncludeB ? pickFromSection('B', 1) : [];
    const secC = customIncludeC ? pickFromSection('C', 1) : [];
    const ordered = sortByPreferredSections([...secA, ...secB, ...secC]);
    if (ordered.length === 0) return;

    const totalMarks = ordered.reduce((s, q) => s + q.marks, 0);
    const budgetSeconds = Math.round(totalMarks * 1.8 * 60);
    const areaLabel = customArea === 'ALL' ? 'Full Syllabus' : customArea;

    resetMockSessionState({
      mode: 'custom_mock',
      title: `Custom ${areaLabel} Mock (${totalMarks} Marks)`,
      items: ordered,
      totalMarks,
      budgetSeconds,
    });
  };

  const resumeSavedMock = () => {
    if (!savedMock) return;
    setPaper(savedMock.paper);
    setActiveMockId(null);
    setCurrentIdx(Math.min(savedMock.currentIdx, Math.max(0, savedMock.paper.items.length - 1)));
    setAnswers(savedMock.answers ?? {});
    setFlagged(savedMock.flagged ?? {});
    setSecondsLeft(savedMock.secondsLeft ?? savedMock.paper.budgetSeconds);
    setCrSelfMarks({});
    setCrStepChecks({});
    setCrSyncedToMastery(false);
    setAutoSyncedCount(0);
    setReportFilter('all');
    setSubView('running');
  };

  const discardSavedMock = () => {
    setSavedMock(null);
    try {
      window.localStorage.removeItem(ACTIVE_MOCK_STORAGE_KEY);
    } catch {
      // Ignore storage error
    }
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

  useEffect(() => {
    if (subView !== 'running' || !paper) return;
    const payload: SavedActiveMock = {
      paper,
      currentIdx,
      answers,
      flagged,
      secondsLeft,
      savedIso: new Date().toISOString(),
    };
    setSavedMock(payload);
    try {
      window.localStorage.setItem(ACTIVE_MOCK_STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // Ignore storage quota errors
    }
  }, [subView, paper, currentIdx, answers, flagged, secondsLeft]);

  const customPreviewTotals = useMemo(() => {
    const pool = allQuestions.filter((q) =>
      customArea === 'ALL' ? true : AREA_BY_TOPIC_ID[q.topic_id] === customArea
    );
    const pickPreview = (sec: SectionType, limit: number) => {
      const candidates = pool.filter((q) => q.section === sec);
      return (customPrioritizeUnseen ? prioritizeUnseenAndMissed(candidates) : candidates).slice(0, limit);
    };
    const secA = pickPreview('A', customSecACount);
    const secB = customIncludeB ? pickPreview('B', 1) : [];
    const secC = customIncludeC ? pickPreview('C', 1) : [];
    const totalMarks = [...secA, ...secB, ...secC].reduce((s, q) => s + q.marks, 0);
    return {
      totalMarks,
      minutes: Math.round(totalMarks * 1.8),
      hasB: secB.length > 0,
      hasC: secC.length > 0,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allQuestions, customArea, customSecACount, customIncludeB, customIncludeC, customPrioritizeUnseen, appState.attempts.length, appState.mistakes.length]);

  const gradedReport = useMemo(() => {
    if (!paper || subView !== 'report') return null;
    const itemResults = paper.items.map((q) => {
      const res = gradeQuestion(q, answers[q.id]);
      const finalScored = q.type === 'cr' ? crSelfMarks[q.id] ?? 0 : res.marksScored;
      return { q, res, finalScored };
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
    discardSavedMock();
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
        <div className="flex max-w-xs items-center rounded-xl border border-[#D8D4C8] bg-white dark:border-[#303846] dark:bg-[#12161D]">
          <span className="border-r border-[#E6E4DD] bg-[#FAF9F6] px-3 py-2 font-mono text-sm font-bold text-neutral-700 dark:border-[#262C36] dark:bg-[#1C222B] dark:text-neutral-200">
            £
          </span>
          <input
            type="text"
            inputMode="numeric"
            value={typeof curVal === 'string' ? curVal : ''}
            onChange={(e) => onChangeVal(e.target.value)}
            placeholder="whole £ amount"
            className="w-full bg-transparent px-3 py-2 font-mono text-sm focus:outline-none dark:text-[#F0F3F6]"
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
        <div className="overflow-x-auto rounded-xl border border-[#E6E4DD] dark:border-[#262C36]">
          <table className="min-w-full text-xs">
            <thead>
              <tr className="bg-[#FAF9F6] font-semibold text-neutral-700 dark:bg-[#12161D] dark:text-neutral-300">
                <th className="px-3.5 py-2.5 text-left">Item</th>
                {mat.columns.map((c, ci) => (
                  <th key={ci} className="px-3.5 py-2.5 text-center">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {mat.rows.map((r, ri) => {
                const chosen = obj[String(ri)] ?? [];
                return (
                  <tr key={ri} className="border-t border-[#EFECE4] dark:border-[#262C36]">
                    <td className="px-3.5 py-2.5 text-[#14171A] dark:text-[#F0F3F6]">{r}</td>
                    {mat.columns.map((col, ci) => (
                      <td key={ci} className="px-3.5 py-2.5 text-center">
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
        <div className="space-y-2.5">
          {groups.map((g, gi) => (
            <div
              key={gi}
              className="flex flex-col gap-1.5 rounded-xl border border-[#E6E4DD] bg-[#FAF9F6] p-3 text-xs sm:flex-row sm:items-center sm:justify-between dark:border-[#262C36] dark:bg-[#12161D]"
            >
              <span className="font-medium text-[#14171A] dark:text-[#F0F3F6]">{g.group}</span>
              <select
                value={arr[gi] ?? ''}
                onChange={(e) => {
                  const next = [...arr];
                  next[gi] = e.target.value;
                  onChangeVal(next);
                }}
                className="rounded-lg border border-[#D8D4C8] bg-white px-2.5 py-1.5 text-xs dark:border-[#303846] dark:bg-[#1C222B] dark:text-[#F0F3F6]"
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
      <div className="space-y-2">
        {isMulti && (
          <p className="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400">
            Select all matching options:
          </p>
        )}
        {opts.map((opt) => {
          const checked = isMulti
            ? Array.isArray(curVal) && curVal.includes(opt.key)
            : curVal === opt.key;
          return (
            <label
              key={`${prefixKey}-${opt.key}`}
              className={`flex cursor-pointer items-start gap-2.5 rounded-xl border p-3 text-sm transition-colors ${
                checked
                  ? 'border-[#0F5132] bg-emerald-50/60 dark:border-emerald-500 dark:bg-emerald-950/30'
                  : 'border-[#E6E4DD] bg-white hover:bg-[#FAF9F6] dark:border-[#262C36] dark:bg-[#161B22] dark:hover:bg-[#1C222B]'
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
                <strong className="font-mono text-xs mr-1.5 text-neutral-500 dark:text-neutral-400">
                  {opt.key}.
                </strong>
                <span className="text-[#14171A] dark:text-[#F0F3F6]">{opt.text}</span>
              </span>
            </label>
          );
        })}
      </div>
    );
  };

  const startEasyRapid10 = () => {
    const mcqs = prioritizeUnseenAndMissed(
      allQuestions.filter((q) => q.section === 'A' && q.type === 'mcq')
    ).slice(0, 10);
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
        <TaxTablesDrawer open={tablesOpen} onClose={() => setTablesOpen(false)} />

        {/* Strict CBE Exam Top Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#262C36] bg-[#14171A] px-5 py-4 text-white">
          <div>
            <p className="font-mono text-[11px] font-semibold text-emerald-300">
              STRICT CBE EXAM MODE · Feedback locked until submission
            </p>
            <h1 className="font-display text-base font-semibold">{paper.title}</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setCalcOpen((c) => !c)}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold ${
                calcOpen
                  ? 'border-emerald-400 bg-emerald-900/60 text-white'
                  : 'border-neutral-700 bg-neutral-800 text-neutral-100 hover:bg-neutral-700'
              }`}
            >
              <Calculator className="h-3.5 w-3.5 text-emerald-300" />
              Calculator
            </button>
            <button
              type="button"
              onClick={() => setTablesOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-1.5 text-xs font-semibold text-neutral-100 hover:bg-neutral-700"
            >
              <BookOpen className="h-3.5 w-3.5 text-emerald-300" />
              Exam Tables
            </button>
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-neutral-800 px-3 py-1.5 font-mono text-sm font-bold tabular-nums">
              <Clock className="h-4 w-4 text-amber-400" />
              {formatTimer(secondsLeft)}
            </span>
            <button
              type="button"
              onClick={() => setSubView('menu')}
              className="rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-1.5 text-xs font-semibold text-neutral-200 hover:bg-neutral-700"
            >
              Save &amp; Exit
            </button>
            <button
              type="button"
              onClick={handleSubmitFullMock}
              className="rounded-lg bg-[#0F5132] px-4 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
            >
              Submit Entire Exam
            </button>
          </div>
        </div>

        {calcOpen && (
          <TaxCalculatorPad
            expr={calcExpr}
            onChangeExpr={setCalcExpr}
            canApplyRounded={curQ.interaction === 'numeric_input'}
            onApplyRounded={(rounded) =>
              setAnswers((a) => ({ ...a, [curQ.id]: String(rounded) }))
            }
            onClose={() => setCalcOpen(false)}
          />
        )}

        {/* Question Navigator Palette */}
        <div className="flex flex-wrap items-center gap-1.5 rounded-2xl border border-[#E6E4DD] bg-white p-3.5 dark:border-[#262C36] dark:bg-[#161B22]">
          {paper.items.map((item, idx) => {
            const hasAns = hasAnswerEntered(answers[item.id]);
            const isFlag = Boolean(flagged[item.id]);
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setCurrentIdx(idx)}
                className={`rounded-lg border px-2.5 py-1 font-mono text-xs font-semibold ${
                  idx === currentIdx
                    ? 'border-[#0F5132] bg-[#0F5132] text-white dark:bg-emerald-600'
                    : isFlag
                    ? 'border-amber-400 bg-amber-50 text-amber-950 dark:border-amber-700 dark:bg-amber-950/50 dark:text-amber-200'
                    : hasAns
                    ? 'border-emerald-300 bg-emerald-50 text-[#0F5132] dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300'
                    : 'border-[#E6E4DD] bg-[#FAF9F6] text-neutral-700 dark:border-[#262C36] dark:bg-[#12161D] dark:text-neutral-300'
                }`}
              >
                {idx + 1} ({item.section})
              </button>
            );
          })}
        </div>

        {/* Active Exam Question */}
        <div className="rounded-2xl border border-[#E6E4DD] bg-white p-5 sm:p-6 space-y-5 dark:border-[#262C36] dark:bg-[#161B22]">
          <div className="flex items-center justify-between border-b border-[#EFECE4] pb-3.5 dark:border-[#262C36]">
            <div>
              <span className="font-mono text-xs font-bold text-[#0F5132] dark:text-emerald-400">
                Item {currentIdx + 1} of {paper.items.length} · {curQ.id} · Section {curQ.section} ({curQ.marks} marks)
              </span>
              <h2 className="font-display text-lg font-semibold text-[#14171A] dark:text-[#F0F3F6]">
                {curQ.title}
              </h2>
            </div>
            <button
              type="button"
              onClick={() => setFlagged((f) => ({ ...f, [curQ.id]: !f[curQ.id] }))}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold ${
                flagged[curQ.id]
                  ? 'border-amber-400 bg-amber-50 text-amber-950 dark:border-amber-700 dark:bg-amber-950/50 dark:text-amber-200'
                  : 'border-[#D8D4C8] bg-white text-neutral-700 dark:border-[#303846] dark:bg-[#1C222B] dark:text-neutral-200'
              }`}
            >
              <Flag className="h-3.5 w-3.5" />
              {flagged[curQ.id] ? 'Flagged' : 'Flag'}
            </button>
          </div>

          {curQ.scenario && <ScenarioText text={curQ.scenario} />}

          <div className="rounded-xl border border-[#D4DFD7] bg-emerald-50/40 p-4 text-sm font-semibold text-[#14171A] dark:border-emerald-900/50 dark:bg-emerald-950/20 dark:text-[#F0F3F6]">
            {curQ.requirement}
          </div>

          {curQ.type === 'cr' ? (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-bold text-[#14171A] dark:text-[#F0F3F6]">
                  CBE Constructed Response Workspace (Marked)
                </span>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      const tpl = getProformaTemplateForTopic(curQ.topic_id);
                      const prev = typeof curAns === 'string' ? curAns : '';
                      setAnswers((a) => ({
                        ...a,
                        [curQ.id]: prev.trim() ? `${prev}\n\n${tpl}` : tpl,
                      }));
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
                rows={11}
                value={typeof curAns === 'string' ? curAns : ''}
                onChange={(e) => setAnswers((a) => ({ ...a, [curQ.id]: e.target.value }))}
                placeholder="Enter CBE working & headings here (bracketed negatives (X), explicit 0 for exempt items, labelled (W1)/(W2) workings)..."
                className="w-full rounded-xl border border-[#D8D4C8] bg-[#FAF9F6] p-3.5 font-mono text-xs text-[#14171A] focus:border-[#0F5132] focus:outline-none dark:border-[#303846] dark:bg-[#0D1117] dark:text-[#F0F3F6]"
              />
              {showScratchPad && (
                <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3.5 space-y-1.5 dark:border-amber-900/60 dark:bg-amber-950/20">
                  <p className="text-[11px] font-bold text-amber-900 dark:text-amber-200">
                    Unmarked CBE Scratch Pad (ACCA markers CANNOT see this box!)
                  </p>
                  <textarea
                    rows={4}
                    value={crScratchPads[curQ.id] ?? ''}
                    onChange={(e) =>
                      setCrScratchPads((s) => ({ ...s, [curQ.id]: e.target.value }))
                    }
                    placeholder="Rough jottings only — copy workings into the main response box above for marks."
                    className="w-full rounded-lg border border-amber-200 bg-white p-2.5 font-mono text-xs text-[#14171A] dark:border-amber-800 dark:bg-[#0D1117] dark:text-[#F0F3F6]"
                  />
                </div>
              )}
            </div>
          ) : curQ.type === 'case' ? (
            <div className="space-y-4">
              {(curQ.options as CaseSubQuestion[]).map((sq, sIdx) => {
                const arr = Array.isArray(curAns) ? curAns : [];
                return (
                  <div
                    key={sq.sub_num}
                    className="rounded-xl border border-[#E6E4DD] bg-[#FAF9F6] p-4 space-y-3 dark:border-[#262C36] dark:bg-[#12161D]"
                  >
                    <p className="font-mono text-xs font-bold text-[#0F5132] dark:text-emerald-400">
                      OT {sq.sub_num} ({sq.marks} marks)
                    </p>
                    <p className="text-sm text-[#14171A] whitespace-pre-line dark:text-[#F0F3F6]">
                      {sq.prompt}
                    </p>
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

          <div className="flex justify-between border-t border-[#EFECE4] pt-4 dark:border-[#262C36]">
            <button
              type="button"
              disabled={currentIdx === 0}
              onClick={() => setCurrentIdx((i) => Math.max(0, i - 1))}
              className="rounded-lg border border-[#D8D4C8] bg-white px-4 py-2 text-xs font-semibold text-neutral-700 disabled:opacity-40 dark:border-[#303846] dark:bg-[#1C222B] dark:text-neutral-200"
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() => {
                if (currentIdx < paper.items.length - 1) setCurrentIdx((i) => i + 1);
                else handleSubmitFullMock();
              }}
              className="rounded-lg bg-[#0F5132] px-4 py-2 text-xs font-semibold text-white hover:bg-[#0B3D26] dark:bg-emerald-600"
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
        <div className="rounded-2xl border border-[#E6E4DD] bg-white p-6 dark:border-[#262C36] dark:bg-[#161B22]">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#EFECE4] pb-4 dark:border-[#262C36]">
            <div>
              <p className="font-mono text-xs font-semibold text-[#0F5132] dark:text-emerald-400">
                MOCK SCORE REPORT
              </p>
              <h1 className="font-display text-2xl font-semibold text-[#14171A] dark:text-[#F0F3F6]">
                {paper.title}
              </h1>
            </div>
            <div className="text-right">
              <p className="font-mono text-3xl font-bold text-[#14171A] dark:text-[#F0F3F6] tabular-nums">
                {gradedReport.totalScored} / {gradedReport.totalAvailable} ({gradedReport.percent}%)
              </p>
              <p
                className={`text-xs font-bold ${
                  gradedReport.percent >= 50
                    ? 'text-[#0F5132] dark:text-emerald-400'
                    : 'text-red-700 dark:text-red-400'
                }`}
              >
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
              <div
                key={sec.section}
                className="rounded-xl border border-[#E6E4DD] bg-[#FAF9F6] p-3.5 dark:border-[#262C36] dark:bg-[#12161D]"
              >
                <p className="text-xs font-bold text-neutral-600 dark:text-neutral-300">
                  Section {sec.section}
                </p>
                <p className="mt-1 font-mono text-lg font-bold text-[#14171A] dark:text-[#F0F3F6] tabular-nums">
                  {sec.scored} / {sec.available}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50/70 px-4 py-3 text-xs dark:border-emerald-900/50 dark:bg-emerald-950/25">
            <span className="flex items-center gap-1.5 font-medium text-[#0F5132] dark:text-emerald-300">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              {autoSyncedCount} Section A/B mock items synced to Topic Mastery, Trap Ledger &amp; 1/3/7d Mistake Bank.
            </span>
            {paper.items.some((q) => q.type === 'cr') && (
              <button
                type="button"
                disabled={crSyncedToMastery}
                onClick={handleConfirmCrMarks}
                className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold text-white ${
                  crSyncedToMastery
                    ? 'bg-emerald-700'
                    : 'bg-[#0F5132] hover:bg-[#0B3D26] dark:bg-emerald-600'
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
          <div className="inline-flex rounded-xl border border-[#E6E4DD] bg-white p-1 dark:border-[#262C36] dark:bg-[#161B22]">
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
                className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold ${
                  reportFilter === f.id
                    ? 'bg-[#0F5132] text-white dark:bg-emerald-600'
                    : 'text-neutral-600 hover:text-[#14171A] dark:text-neutral-300'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <span className="font-mono text-xs text-neutral-500 dark:text-neutral-400">
            Expand any item for worked solution &amp; trap debrief
          </span>
        </div>

        <div className="space-y-3">
          {gradedReport.itemResults
            .filter(({ q, finalScored }) => {
              if (reportFilter === 'missed') return finalScored < q.marks;
              if (reportFilter === 'cr') return q.type === 'cr';
              return true;
            })
            .map(({ q, res, finalScored }) => {
              const rawCrText =
                q.type === 'cr' && typeof answers[q.id] === 'string' ? (answers[q.id] as string) : '';
              const cbeAudit = q.type === 'cr' ? coachCbePresentation(rawCrText, q) : null;
              const easyAudit = q.type === 'cr' ? auditEasyMarks(rawCrText, q) : null;
              const qStepChecks = crStepChecks[q.id] ?? {};
              return (
                <details
                  key={q.id}
                  className="rounded-2xl border border-[#E6E4DD] bg-white p-4 dark:border-[#262C36] dark:bg-[#161B22]"
                >
                  <summary className="flex cursor-pointer items-center justify-between gap-2 text-sm font-bold text-[#14171A] dark:text-[#F0F3F6]">
                    <span>
                      <span className="font-mono text-xs text-[#0F5132] dark:text-emerald-400 mr-2">
                        {q.id}
                      </span>
                      {q.title}
                    </span>
                    <span className="font-mono text-xs font-bold tabular-nums">
                      {finalScored}/{q.marks}m · Expand
                    </span>
                  </summary>
                  <div className="mt-3 space-y-3 border-t border-[#EFECE4] pt-3 text-xs dark:border-[#262C36]">
                    {q.type === 'cr' && (
                      <div className="space-y-3 rounded-xl border border-[#D4DFD7] bg-emerald-50/40 p-3.5 dark:border-emerald-900/50 dark:bg-emerald-950/20">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold text-[#0F5132] dark:text-emerald-300">
                              Self-mark CR score (out of {q.marks}):
                            </span>
                            <input
                              type="number"
                              aria-label={`Self-mark score for ${q.id}`}
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
                              className="w-20 rounded-lg border border-[#D8D4C8] bg-white px-2.5 py-1 font-mono font-bold text-[#14171A] dark:border-[#303846] dark:bg-[#0D1117] dark:text-[#F0F3F6]"
                            />
                          </div>
                          <span className="text-[11px] text-neutral-600 dark:text-neutral-300">
                            Tick steps below to auto-sum, then click &ldquo;Confirm CR Marks &amp; Sync Mastery&rdquo;.
                          </span>
                        </div>

                        {q.mark_scheme_steps.length > 0 && (
                          <div className="space-y-1.5 rounded-xl border border-[#E6E4DD] bg-white p-3 dark:border-[#262C36] dark:bg-[#161B22]">
                            <p className="font-mono text-[11px] font-bold text-neutral-700 dark:text-neutral-300">
                              ACCA Mark Scheme Step Checklist
                            </p>
                            {q.mark_scheme_steps.map((step) => {
                              const checked = Boolean(qStepChecks[step.id]);
                              return (
                                <label
                                  key={step.id}
                                  className="flex cursor-pointer items-start justify-between gap-2 rounded px-1.5 py-1 hover:bg-[#FAF9F6] dark:hover:bg-[#1C222B]"
                                >
                                  <span className="flex items-start gap-2">
                                    <input
                                      type="checkbox"
                                      disabled={crSyncedToMastery}
                                      checked={checked}
                                      onChange={() => {
                                        const nextSteps = { ...qStepChecks, [step.id]: !checked };
                                        const summed = q.mark_scheme_steps.reduce(
                                          (sum, st) => sum + (nextSteps[st.id] ? st.marks : 0),
                                          0
                                        );
                                        setCrStepChecks((prev) => ({ ...prev, [q.id]: nextSteps }));
                                        setCrSelfMarks((m) => ({
                                          ...m,
                                          [q.id]: Math.min(q.marks, Math.round(summed * 2) / 2),
                                        }));
                                      }}
                                      className="mt-0.5"
                                    />
                                    <span className="text-[#14171A] dark:text-[#F0F3F6]">
                                      {step.label}
                                    </span>
                                  </span>
                                  <span className="shrink-0 font-mono font-bold text-[#0F5132] dark:text-emerald-400">
                                    {step.marks}m
                                  </span>
                                </label>
                              );
                            })}
                          </div>
                        )}

                        {cbeAudit && easyAudit && (
                          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#E6E4DD] bg-white px-3.5 py-2 dark:border-[#262C36] dark:bg-[#161B22]">
                            <span className="inline-flex items-center gap-1.5 font-semibold text-[#14171A] dark:text-[#F0F3F6]">
                              {cbeAudit.markerRisks.length === 0 ? (
                                <ShieldCheck className="h-4 w-4 text-[#0F5132] dark:text-emerald-400" />
                              ) : (
                                <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                              )}
                              CBE Presentation: {cbeAudit.scoreOutOf100}/100 · Free Marks:{' '}
                              {easyAudit.capturedCount}/{easyAudit.totalChecks}
                            </span>
                            {cbeAudit.markerRisks.length > 0 && (
                              <span className="text-[11px] text-amber-800 dark:text-amber-300">
                                Top risk: {cbeAudit.markerRisks[0]}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                    <p className="text-[#14171A] dark:text-neutral-200">
                      <strong>Your Answer:</strong> {res.userDisplay} · <strong>Expected:</strong>{' '}
                      {res.correctDisplay}
                    </p>
                    <div className="whitespace-pre-line rounded-xl bg-[#FAF9F6] p-3.5 font-mono text-[#14171A] dark:bg-[#12161D] dark:text-neutral-200">
                      {q.full_worked_solution}
                    </div>
                    <p className="text-amber-900 dark:text-amber-300">
                      <strong>Examiner Trap:</strong> {q.examiner_debrief.trap_of_question}
                    </p>
                  </div>
                </details>
              );
            })}
        </div>

        <button
          type="button"
          onClick={() => setSubView('menu')}
          className="rounded-lg border border-[#D8D4C8] bg-white px-4 py-2 text-xs font-semibold text-[#14171A] hover:bg-neutral-50 dark:border-[#303846] dark:bg-[#161B22] dark:text-neutral-200"
        >
          ← Back to Mock Exam Launchpad
        </button>
      </div>
    );
  }

  if (subView === 'higher') {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between rounded-2xl border border-[#E6E4DD] bg-white p-5 dark:border-[#262C36] dark:bg-[#161B22]">
          <div>
            <h1 className="font-display text-xl font-semibold text-[#14171A] dark:text-[#F0F3F6]">
              Higher-Skills 10-Mark Cross-Tax Lab
            </h1>
            <p className="text-xs text-neutral-600 dark:text-neutral-400">
              Section C 10-mark &amp; 15-mark planning scenarios (incorporation, employment vs self-employment, dividends vs salary).
            </p>
          </div>
          <button
            type="button"
            onClick={() => setSubView('menu')}
            className="rounded-lg border border-[#D8D4C8] px-3 py-1.5 text-xs font-semibold text-[#14171A] dark:border-[#303846] dark:text-neutral-200"
          >
            ← Back
          </button>
        </div>
        <div className="divide-y divide-[#EFECE4] rounded-2xl border border-[#E6E4DD] bg-white dark:divide-[#262C36] dark:border-[#262C36] dark:bg-[#161B22]">
          {HIGHER_SKILLS_ROSTER.map((item) => (
            <div key={item.kitQ} className="flex items-center justify-between gap-3 p-4">
              <div>
                <p className="text-sm font-bold text-[#14171A] dark:text-[#F0F3F6]">
                  <span className="font-mono text-xs text-[#0F5132] dark:text-emerald-400 mr-2">
                    {item.kitQ}
                  </span>
                  {item.name}
                </p>
                <p className="text-xs text-neutral-600 dark:text-neutral-400">
                  {item.focus} · {item.ref}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onOpenQuestionById(item.kitQ)}
                className="rounded-lg bg-[#0F5132] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#0B3D26] dark:bg-emerald-600"
              >
                Launch in Studio →
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
        <div className="flex items-center justify-between rounded-2xl border border-[#E6E4DD] bg-white p-5 dark:border-[#262C36] dark:bg-[#161B22]">
          <div>
            <h1 className="font-display text-xl font-semibold text-[#14171A] dark:text-[#F0F3F6]">
              Easy-Marks Rapid 10-Rep Drill
            </h1>
            <p className="text-xs text-neutral-600 dark:text-neutral-400">
              10 rapid computational OTs to lock in effortless Section A marks.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setSubView('menu')}
            className="rounded-lg border border-[#D8D4C8] px-3 py-1.5 text-xs font-semibold text-[#14171A] dark:border-[#303846] dark:text-neutral-200"
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
              <div
                key={q.id}
                className="rounded-2xl border border-[#E6E4DD] bg-white p-5 space-y-2.5 dark:border-[#262C36] dark:bg-[#161B22]"
              >
                <p className="font-mono text-xs font-bold text-[#0F5132] dark:text-emerald-400">
                  Rep {idx + 1}/10 · {q.id} ({q.topic})
                </p>
                <p className="text-sm text-[#14171A] dark:text-[#F0F3F6]">
                  {q.scenario} {q.requirement}
                </p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {opts.map((o) => (
                    <label
                      key={o.key}
                      className="flex cursor-pointer items-center gap-2 rounded-xl border border-[#E6E4DD] bg-[#FAF9F6] px-3 py-2 text-xs dark:border-[#262C36] dark:bg-[#12161D]"
                    >
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
                  <p
                    className={`text-xs font-semibold ${
                      isCorrect
                        ? 'text-[#0F5132] dark:text-emerald-400'
                        : 'text-red-700 dark:text-red-400'
                    }`}
                  >
                    {isCorrect ? '✓ Correct' : `✗ Answer is ${String(q.correct_answer)}`} ·{' '}
                    {q.examiner_debrief.speed_trick}
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
            className="rounded-lg bg-[#0F5132] px-5 py-2.5 text-xs font-semibold text-white hover:bg-[#0B3D26] dark:bg-emerald-600"
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
        <div className="flex items-center justify-between rounded-2xl border border-[#E6E4DD] bg-white p-5 dark:border-[#262C36] dark:bg-[#161B22]">
          <div>
            <h1 className="font-display text-xl font-semibold text-[#14171A] dark:text-[#F0F3F6]">
              Written-Answer Clinic
            </h1>
            <p className="text-xs text-neutral-600 dark:text-neutral-400">
              Train concise bullet-point phrasing scored against official ACCA marking keywords.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setSubView('menu')}
            className="rounded-lg border border-[#D8D4C8] px-3 py-1.5 text-xs font-semibold text-[#14171A] dark:border-[#303846] dark:text-neutral-200"
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
              className={`rounded-xl border px-3 py-1.5 text-xs font-semibold ${
                theoryIdx === i
                  ? 'border-[#0F5132] bg-[#0F5132] text-white dark:bg-emerald-600'
                  : 'border-[#E6E4DD] bg-white text-neutral-700 dark:border-[#262C36] dark:bg-[#161B22] dark:text-neutral-200'
              }`}
            >
              {w.title}
            </button>
          ))}
        </div>

        <div className="rounded-2xl border border-[#E6E4DD] bg-white p-5 space-y-4 dark:border-[#262C36] dark:bg-[#161B22]">
          <div className="flex justify-between text-xs text-neutral-500 dark:text-neutral-400">
            <span className="font-bold text-[#14171A] dark:text-[#F0F3F6]">{cur.title}</span>
            <span className="font-mono">{cur.kitCitation}</span>
          </div>
          <p className="text-sm font-medium text-[#14171A] dark:text-[#F0F3F6]">{cur.prompt}</p>
          <textarea
            rows={5}
            value={theoryText}
            onChange={(e) => setTheoryText(e.target.value)}
            placeholder="Write crisp 1-sentence bullet points matching ACCA mark points (0.5–1 mark per distinct point)..."
            className="w-full rounded-xl border border-[#D8D4C8] bg-[#FAF9F6] p-3 text-sm text-[#14171A] dark:border-[#303846] dark:bg-[#0D1117] dark:text-[#F0F3F6]"
          />
          <button
            type="button"
            onClick={() => setTheoryChecked(true)}
            className="rounded-lg bg-[#0F5132] px-4 py-2 text-xs font-semibold text-white hover:bg-[#0B3D26] dark:bg-emerald-600"
          >
            Score Keywords Against Model Phrase Bank
          </button>

          {kwResult && (
            <div className="rounded-xl border border-[#E6E4DD] bg-[#FAF9F6] p-4 space-y-2 text-xs dark:border-[#262C36] dark:bg-[#12161D]">
              <p className="font-bold text-[#14171A] dark:text-[#F0F3F6]">
                Suggested Keyword Score: {kwResult.suggestedMarks} / {kwResult.maxMarks} marks
              </p>
              <p className="text-[#0F5132] dark:text-emerald-400">
                <strong>Matched keywords:</strong> {kwResult.matched.join(', ') || 'None yet'}
              </p>
              <p className="text-red-700 dark:text-red-400">
                <strong>Missing keywords:</strong> {kwResult.missing.join(', ') || 'All captured!'}
              </p>
              <div className="border-t border-[#EFECE4] pt-2 dark:border-[#262C36]">
                <p className="font-bold text-[#14171A] dark:text-[#F0F3F6]">Official Model Phrasing:</p>
                <ul className="mt-1 list-disc pl-4 space-y-1 text-neutral-700 dark:text-neutral-300">
                  {cur.modelPhraseBank.map((p, idx) => (
                    <li key={idx}>{p}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-[#E6E4DD] bg-white p-6 dark:border-[#262C36] dark:bg-[#161B22]">
        <h1 className="font-display text-2xl font-semibold text-[#14171A] dark:text-[#F0F3F6]">
          CBE Mock Exam Launchpad &amp; Clinics
        </h1>
        <p className="mt-1 text-xs sm:text-sm text-neutral-600 dark:text-neutral-400">
          Strict CBE exam timing (1.8 min/mark). Solutions remain locked until you submit the entire paper.
        </p>
      </div>

      {savedMock && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-300 bg-emerald-50/70 px-5 py-4 dark:border-emerald-800 dark:bg-emerald-950/30">
          <div>
            <p className="font-mono text-[11px] font-bold uppercase tracking-wider text-[#0F5132] dark:text-emerald-400">
              In-Progress Mock Saved
            </p>
            <p className="text-sm font-bold text-[#14171A] dark:text-[#F0F3F6]">
              {savedMock.paper.title} · Item {savedMock.currentIdx + 1}/{savedMock.paper.items.length} ·{' '}
              {formatTimer(savedMock.secondsLeft)} left
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={resumeSavedMock}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#0F5132] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#0B3D26] dark:bg-emerald-600"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Resume Saved Mock
            </button>
            <button
              type="button"
              aria-label="Discard saved mock"
              onClick={discardSavedMock}
              className="inline-flex items-center gap-1 rounded-lg border border-[#D8D4C8] bg-white px-3 py-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 dark:border-[#303846] dark:bg-[#1C222B] dark:text-neutral-200"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Discard
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="flex flex-col justify-between rounded-2xl border border-[#E6E4DD] bg-white p-5 space-y-4 dark:border-[#262C36] dark:bg-[#161B22]">
          <div>
            <div className="flex items-center justify-between">
              <FileCheck2 className="h-5 w-5 text-[#0F5132] dark:text-emerald-400" />
              <span className="font-mono text-xs font-bold text-[#0F5132] dark:text-emerald-400">
                100 MARKS · 3h 00m
              </span>
            </div>
            <h2 className="mt-3 font-display text-lg font-semibold text-[#14171A] dark:text-[#F0F3F6]">
              Full Specimen CBE Mock
            </h2>
            <p className="mt-1 text-xs text-neutral-600 dark:text-neutral-400">
              Official ACCA Specimen Paper (Kit p.609–637): 15 Sec A OTs (30m), 3 Sec B 5-OT Cases (30m), and Sarah + Simon + Naive Ltd Sec C CRs (40m).
            </p>
          </div>
          <button
            type="button"
            onClick={() => launchMock('full_specimen')}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#0F5132] px-4 py-2.5 text-xs font-semibold text-white hover:bg-[#0B3D26] dark:bg-emerald-600"
          >
            <Play className="h-3.5 w-3.5" />
            Launch Specimen Mock
          </button>
        </div>

        <div className="flex flex-col justify-between rounded-2xl border border-[#E6E4DD] bg-white p-5 space-y-4 dark:border-[#262C36] dark:bg-[#161B22]">
          <div>
            <div className="flex items-center justify-between">
              <Layers className="h-5 w-5 text-[#1E3A5F] dark:text-sky-400" />
              <span className="font-mono text-xs font-bold text-[#1E3A5F] dark:text-sky-400">
                35 MARKS · 63m
              </span>
            </div>
            <h2 className="mt-3 font-display text-lg font-semibold text-[#14171A] dark:text-[#F0F3F6]">
              Income Tax A/B/C Mini Mock
            </h2>
            <p className="mt-1 text-xs text-neutral-600 dark:text-neutral-400">
              Built from Q1–127: 5 Sec A OTs (10m) + 1 Sec B 5-OT Case (10m) + 1 Sec C 15-mark Constructed Response.
            </p>
          </div>
          <button
            type="button"
            onClick={() => launchMock('it_abc_mock')}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-[#D8D4C8] bg-[#FAF9F6] px-4 py-2.5 text-xs font-semibold text-[#14171A] hover:bg-[#EFECE4] dark:border-[#303846] dark:bg-[#1C222B] dark:text-[#F0F3F6]"
          >
            Start Mini A/B/C Mock
          </button>
        </div>

        <div className="flex flex-col justify-between rounded-2xl border border-[#E6E4DD] bg-white p-5 space-y-4 dark:border-[#262C36] dark:bg-[#161B22]">
          <div>
            <div className="flex items-center justify-between">
              <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              <span className="font-mono text-xs font-bold text-amber-700 dark:text-amber-400">
                30 MARKS · 54m
              </span>
            </div>
            <h2 className="mt-3 font-display text-lg font-semibold text-[#14171A] dark:text-[#F0F3F6]">
              54-Min Quick Section A Mock
            </h2>
            <p className="mt-1 text-xs text-neutral-600 dark:text-neutral-400">
              15 mixed Section A Objective Tests timed strictly to the 54-minute Section A exam allowance.
            </p>
          </div>
          <button
            type="button"
            onClick={() => launchMock('quick_mock')}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-[#D8D4C8] bg-[#FAF9F6] px-4 py-2.5 text-xs font-semibold text-[#14171A] hover:bg-[#EFECE4] dark:border-[#303846] dark:bg-[#1C222B] dark:text-[#F0F3F6]"
          >
            Start Quick 54-Min Mock
          </button>
        </div>
      </div>

      {/* Custom Syllabus Mock Builder */}
      <div className="rounded-2xl border border-[#E6E4DD] bg-white p-6 space-y-4 dark:border-[#262C36] dark:bg-[#161B22]">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-display text-lg font-semibold text-[#14171A] dark:text-[#F0F3F6]">
              Custom Syllabus Mock Builder (Q1–Q306)
            </h2>
            <p className="text-xs text-neutral-600 dark:text-neutral-400">
              Target any single tax head with strict 1.8 min/mark pacing and automatic Mistake Bank syncing.
            </p>
          </div>
          <button
            type="button"
            onClick={launchCustomMock}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#14171A] px-4 py-2.5 text-xs font-semibold text-white hover:bg-neutral-800 dark:bg-emerald-600 dark:hover:bg-emerald-500"
          >
            <Play className="h-3.5 w-3.5 text-amber-300" />
            Launch Custom Mock
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 text-xs">
          <div>
            <label className="mb-1 block font-semibold text-neutral-700 dark:text-neutral-300">
              Syllabus Area
            </label>
            <select
              aria-label="Custom mock syllabus area"
              value={customArea}
              onChange={(e) => setCustomArea(e.target.value)}
              className="w-full rounded-lg border border-[#D8D4C8] bg-[#FAF9F6] px-2.5 py-2 font-medium text-[#14171A] dark:border-[#303846] dark:bg-[#0D1117] dark:text-[#F0F3F6]"
            >
              <option value="ALL">All Syllabus Areas (Q1–Q306)</option>
              <option value="Income Tax & NIC">Income Tax &amp; NIC (Q1–127)</option>
              <option value="Chargeable Gains">Chargeable Gains (Q128–179)</option>
              <option value="Inheritance Tax">Inheritance Tax (Q180–212)</option>
              <option value="Corporation Tax">Corporation Tax (Q213–270)</option>
              <option value="VAT">VAT (Q271–306)</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block font-semibold text-neutral-700 dark:text-neutral-300">
              Section A OTs (2m each)
            </label>
            <select
              aria-label="Custom mock Section A count"
              value={customSecACount}
              onChange={(e) => setCustomSecACount(Number(e.target.value))}
              className="w-full rounded-lg border border-[#D8D4C8] bg-[#FAF9F6] px-2.5 py-2 font-medium text-[#14171A] dark:border-[#303846] dark:bg-[#0D1117] dark:text-[#F0F3F6]"
            >
              <option value={5}>5 OTs (10 marks)</option>
              <option value={10}>10 OTs (20 marks)</option>
              <option value={15}>15 OTs (30 marks)</option>
            </select>
          </div>

          <div className="space-y-2 pt-1">
            <label className="flex items-center gap-2 font-medium text-[#14171A] dark:text-neutral-200">
              <input
                type="checkbox"
                checked={customIncludeB}
                onChange={(e) => setCustomIncludeB(e.target.checked)}
              />
              Include 1 Section B Case (10m)
            </label>
            <label className="flex items-center gap-2 font-medium text-[#14171A] dark:text-neutral-200">
              <input
                type="checkbox"
                checked={customIncludeC}
                onChange={(e) => setCustomIncludeC(e.target.checked)}
              />
              Include 1 Section C CR (10–15m)
            </label>
          </div>

          <div className="space-y-2 pt-1">
            <label className="flex items-center gap-2 font-medium text-[#14171A] dark:text-neutral-200">
              <input
                type="checkbox"
                checked={customPrioritizeUnseen}
                onChange={(e) => setCustomPrioritizeUnseen(e.target.checked)}
              />
              Prioritise Missed &amp; Unseen Qs
            </label>
            <p className="font-mono text-[11px] text-neutral-500 dark:text-neutral-400 tabular-nums">
              Actual Selection: {customPreviewTotals.totalMarks}m · {customPreviewTotals.minutes} min · Order: {appState.profile.preferredSectionOrder}
            </p>
          </div>
        </div>
      </div>

      {/* Specialized Skill Clinics */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <button
          type="button"
          onClick={() => setSubView('higher')}
          className="rounded-2xl border border-[#E6E4DD] bg-white p-5 text-left transition-colors hover:border-[#0F5132] dark:border-[#262C36] dark:bg-[#161B22] dark:hover:border-emerald-500"
        >
          <Award className="h-5 w-5 text-[#0F5132] dark:text-emerald-400" />
          <h3 className="mt-2.5 font-display text-base font-semibold text-[#14171A] dark:text-[#F0F3F6]">
            Higher-Skills 10-Mark Lab
          </h3>
          <p className="mt-1 text-xs text-neutral-600 dark:text-neutral-400">
            10 curated cross-tax planning &amp; comparison CRs (Q100, Q102, Q111, Specimen Q31 &amp; Q33).
          </p>
        </button>

        <button
          type="button"
          onClick={startEasyRapid10}
          className="rounded-2xl border border-[#E6E4DD] bg-white p-5 text-left transition-colors hover:border-[#0F5132] dark:border-[#262C36] dark:bg-[#161B22] dark:hover:border-emerald-500"
        >
          <Zap className="h-5 w-5 text-amber-600 dark:text-amber-400" />
          <h3 className="mt-2.5 font-display text-base font-semibold text-[#14171A] dark:text-[#F0F3F6]">
            Easy-Marks Rapid 10 Reps
          </h3>
          <p className="mt-1 text-xs text-neutral-600 dark:text-neutral-400">
            Rapid 10-question computational sprint with speed tricks &amp; zero-slip discipline.
          </p>
        </button>

        <button
          type="button"
          onClick={() => setSubView('theory')}
          className="rounded-2xl border border-[#E6E4DD] bg-white p-5 text-left transition-colors hover:border-[#0F5132] dark:border-[#262C36] dark:bg-[#161B22] dark:hover:border-emerald-500"
        >
          <PenTool className="h-5 w-5 text-[#1E3A5F] dark:text-sky-400" />
          <h3 className="mt-2.5 font-display text-base font-semibold text-[#14171A] dark:text-[#F0F3F6]">
            Written-Answer Clinic
          </h3>
          <p className="mt-1 text-xs text-neutral-600 dark:text-neutral-400">
            Drill 2–4 mark narrative points (iXBRL, MLRO ethics, loss choice, record retention).
          </p>
        </button>
      </div>

      {/* Past Mock History */}
      {appState.mockHistory.length > 0 && (
        <div className="rounded-2xl border border-[#E6E4DD] bg-white p-5 dark:border-[#262C36] dark:bg-[#161B22]">
          <h2 className="font-display text-base font-semibold text-[#14171A] dark:text-[#F0F3F6]">
            Completed Mock Attempts
          </h2>
          <div className="mt-3 divide-y divide-[#EFECE4] text-xs dark:divide-[#262C36]">
            {appState.mockHistory.map((m) => (
              <div key={m.id} className="flex items-center justify-between py-2.5">
                <div>
                  <span className="font-semibold text-[#14171A] dark:text-[#F0F3F6]">{m.title}</span>
                  <span className="ml-2 font-mono text-neutral-500 dark:text-neutral-400">
                    {m.completedIso.slice(0, 10)}
                  </span>
                </div>
                <span className="font-mono font-bold text-[#0F5132] dark:text-emerald-400 tabular-nums">
                  {m.marksScored}/{m.marksAvailable} (
                  {Math.round((m.marksScored / m.marksAvailable) * 100)}%)
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
