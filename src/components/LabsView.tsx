import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Bot,
  Brain,
  CheckCircle2,
  Eye,
  Layers,
  RotateCcw,
  Search,
  Split,
  X,
} from 'lucide-react';
import {
  CONFUSION_CLINIC_PAIRS,
  MEMORY_VAULT_CARDS,
  SEED_TRAP_LIBRARY,
} from '../data/taxReference';
import { addDaysIso, getDueMistakes } from '../engine/mastery';
import type { AppState, KitQuestion } from '../types/tx';
import { MistakeBatchDiagnosisPanel, MistakeTutorInlinePanel } from './MistakeAiCoach';
import { TrapLedgerDashboard } from './TrapLedgerDashboard';
import { WorkedSolutionBlock } from './WorkedSolutionBlock';

export type LabSubTab = 'srs' | 'traps' | 'confuse' | 'memory';

interface LabsViewProps {
  appState: AppState;
  allQuestions: KitQuestion[];
  initialSubTab?: LabSubTab;
  onRedrillQuestion: (qId: string) => void;
  onRateMemoryCard: (cardId: string, rating: number, nextReviewIso: string) => void;
  onLaunchMicroDrill: (trapCategory: string) => void;
}

export const LabsView: React.FC<LabsViewProps> = ({
  appState,
  allQuestions,
  initialSubTab = 'srs',
  onRedrillQuestion,
  onRateMemoryCard,
  onLaunchMicroDrill,
}) => {
  const [subTab, setSubTab] = useState<LabSubTab>(initialSubTab);

  useEffect(() => {
    setSubTab(initialSubTab);
  }, [initialSubTab]);

  // Mistake Bank filter & inline explanation / Gemini Tutor row
  const [srsFilter, setSrsFilter] = useState<'all' | 'due'>('all');
  const [mistakeSearch, setMistakeSearch] = useState('');
  const [activeTutorMistakeId, setActiveTutorMistakeId] = useState<string | null>(null);
  const [expandedMistakeIds, setExpandedMistakeIds] = useState<Record<string, boolean>>({});

  // Confusion Clinic interactive state
  const [activePairId, setActivePairId] = useState(CONFUSION_CLINIC_PAIRS[0].id);
  const [confuseChoices, setConfuseChoices] = useState<Record<number, 'left' | 'right'>>({});
  const [confuseSubmitted, setConfuseSubmitted] = useState(false);

  // Memory Vault Deck vs Grid state
  const [revealedCards, setRevealedCards] = useState<Record<string, boolean>>({});
  const [bucketFilter, setBucketFilter] = useState<'all' | 'must_memorise' | 'provided_in_exam'>('all');
  const [memoryMode, setMemoryMode] = useState<'deck' | 'grid'>('deck');
  const [deckIdx, setDeckIdx] = useState(0);
  const [deckFlipped, setDeckFlipped] = useState(false);

  const dueMistakes = useMemo(() => getDueMistakes(appState.mistakes), [appState.mistakes]);

  const visibleMistakes = useMemo(() => {
    const base = srsFilter === 'due' ? dueMistakes : appState.mistakes;
    const q = mistakeSearch.trim().toLowerCase();
    if (!q) return base;
    return base.filter(
      (m) =>
        m.questionId.toLowerCase().includes(q) ||
        m.topicName.toLowerCase().includes(q) ||
        m.ruleMissed.toLowerCase().includes(q) ||
        m.kitCitation.toLowerCase().includes(q)
    );
  }, [srsFilter, dueMistakes, appState.mistakes, mistakeSearch]);

  const srsLabel = (stage: number) => {
    if (stage === 0) return 'Stage 1 · +1d review';
    if (stage === 1) return 'Stage 2 · +3d review';
    if (stage === 2) return 'Stage 3 · +7d review';
    return 'Graduated · +14d';
  };

  const activePair =
    CONFUSION_CLINIC_PAIRS.find((p) => p.id === activePairId) ?? CONFUSION_CLINIC_PAIRS[0];

  const hasTrackedTraps = Object.keys(appState.trapLedger).length > 0;

  const memoryCards = useMemo(() => {
    if (bucketFilter === 'all') return MEMORY_VAULT_CARDS;
    return MEMORY_VAULT_CARDS.filter((c) => c.bucket === bucketFilter);
  }, [bucketFilter]);

  const safeDeckIdx = memoryCards.length > 0 ? deckIdx % memoryCards.length : 0;
  const activeDeckCard = memoryCards[safeDeckIdx];

  // Keyboard shortcuts for Memory Vault Flash Deck (Space flip, Left/Right step, 1-5 rate)
  useEffect(() => {
    if (subTab !== 'memory' || memoryMode !== 'deck' || !activeDeckCard) return;
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === ' ') {
        if (tag === 'BUTTON') return;
        e.preventDefault();
        setDeckFlipped((f) => !f);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setDeckIdx((i) => (i - 1 + memoryCards.length) % memoryCards.length);
        setDeckFlipped(false);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        setDeckIdx((i) => (i + 1) % memoryCards.length);
        setDeckFlipped(false);
      } else if (['1', '2', '3', '4', '5'].includes(e.key)) {
        e.preventDefault();
        const r = Number(e.key);
        const days = r <= 2 ? 1 : r === 3 ? 3 : 7;
        onRateMemoryCard(
          activeDeckCard.id,
          r,
          addDaysIso(new Date().toISOString(), days)
        );
        setDeckIdx((i) => (i + 1) % memoryCards.length);
        setDeckFlipped(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [subTab, memoryMode, activeDeckCard, memoryCards.length, onRateMemoryCard]);

  const confuseScore = useMemo(
    () => activePair.scenarios.filter((sc, idx) => confuseChoices[idx] === sc.answer).length,
    [activePair, confuseChoices]
  );

  return (
    <div className="space-y-6">
      {/* Header + Clean Sub-tabs */}
      <div className="flex flex-col gap-4 rounded-2xl border border-[#E6E4DD] bg-white p-5 sm:flex-row sm:items-center sm:justify-between dark:border-[#262C36] dark:bg-[#161B22]">
        <div>
          <h1 className="font-display text-2xl font-semibold text-[#14171A] dark:text-[#F0F3F6]">
            Revision Clinic &amp; Spaced Repetition
          </h1>
          <p className="mt-0.5 text-xs text-neutral-600 dark:text-neutral-400">
            1/3/7-day SRS mistake queue · 14-category Trap Ledger · Confusion Clinic · Memory Deck
          </p>
        </div>

        <div className="inline-flex flex-wrap rounded-xl border border-[#E6E4DD] bg-[#FAF9F6] p-1 dark:border-[#262C36] dark:bg-[#12161D]">
          {[
            { id: 'srs' as const, label: `Mistake Bank (${dueMistakes.length} due)` },
            { id: 'traps' as const, label: 'Trap Ledger' },
            { id: 'confuse' as const, label: 'Confusion Clinic' },
            { id: 'memory' as const, label: 'Memory Vault' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSubTab(tab.id)}
              className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                subTab === tab.id
                  ? 'bg-[#0F5132] text-white dark:bg-emerald-600'
                  : 'text-neutral-600 hover:text-[#14171A] dark:text-neutral-300 dark:hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* 1. MISTAKE BANK & 1/3/7d SRS + GEMINI AI COACH */}
      {subTab === 'srs' && (
        <div className="space-y-4">
          {appState.mistakes.length === 0 ? (
            <div className="rounded-2xl border border-[#E6E4DD] bg-white p-10 text-center dark:border-[#262C36] dark:bg-[#161B22]">
              <CheckCircle2 className="mx-auto h-8 w-8 text-[#0F5132] dark:text-emerald-400" />
              <h2 className="mt-3 font-display text-lg font-semibold text-[#14171A] dark:text-[#F0F3F6]">
                Mistake Bank is Clean
              </h2>
              <p className="mx-auto mt-1 max-w-md text-xs text-neutral-600 dark:text-neutral-400">
                Any missed or skipped Kit question logs here automatically on a 1 → 3 → 7 day spaced-repetition schedule, ready for Gemini pattern diagnosis and step-by-step tutoring.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <MistakeBatchDiagnosisPanel
                mistakes={visibleMistakes.length > 0 ? visibleMistakes : appState.mistakes}
                trapLedger={appState.trapLedger}
                onOpenQuestionById={onRedrillQuestion}
              />

              <div className="flex flex-wrap items-center justify-between gap-2.5">
                <div className="inline-flex rounded-lg border border-[#E6E4DD] bg-white p-1 dark:border-[#262C36] dark:bg-[#161B22]">
                  <button
                    type="button"
                    onClick={() => setSrsFilter('all')}
                    className={`rounded-md px-3 py-1 text-xs font-semibold ${
                      srsFilter === 'all'
                        ? 'bg-[#0F5132] text-white dark:bg-emerald-600'
                        : 'text-neutral-600 dark:text-neutral-300'
                    }`}
                  >
                    All Logged ({appState.mistakes.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setSrsFilter('due')}
                    className={`rounded-md px-3 py-1 text-xs font-semibold ${
                      srsFilter === 'due'
                        ? 'bg-[#0F5132] text-white dark:bg-emerald-600'
                        : 'text-neutral-600 dark:text-neutral-300'
                    }`}
                  >
                    Due Now ({dueMistakes.length})
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <div className="relative w-56 sm:w-64">
                    <Search className="pointer-events-none absolute left-2.5 top-2 h-3.5 w-3.5 text-neutral-400" />
                    <input
                      type="text"
                      aria-label="Filter logged mistakes"
                      value={mistakeSearch}
                      onChange={(e) => setMistakeSearch(e.target.value)}
                      placeholder="Filter Q#, topic, or trap..."
                      className="w-full rounded-lg border border-[#D8D4C8] bg-white py-1.5 pl-8 pr-7 text-xs text-[#14171A] focus:border-[#0F5132] focus:outline-none dark:border-[#303846] dark:bg-[#161B22] dark:text-[#F0F3F6]"
                    />
                    {mistakeSearch && (
                      <button
                        type="button"
                        aria-label="Clear mistake filter"
                        onClick={() => setMistakeSearch('')}
                        className="absolute right-2 top-1.5 rounded p-0.5 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    Click <strong className="text-[#14171A] dark:text-neutral-200">AI Tutor</strong> on any row for Gemini Socratic breakdown.
                  </p>
                </div>
              </div>

              {visibleMistakes.length === 0 ? (
                <div className="rounded-2xl border border-[#E6E4DD] bg-white p-6 text-center text-xs text-neutral-600 dark:border-[#262C36] dark:bg-[#161B22] dark:text-neutral-400">
                  {mistakeSearch.trim() ? (
                    <>
                      No mistakes match &ldquo;{mistakeSearch.trim()}&rdquo;.{' '}
                      <button
                        type="button"
                        onClick={() => {
                          setMistakeSearch('');
                          setSrsFilter('all');
                        }}
                        className="font-semibold text-[#0F5132] hover:underline dark:text-emerald-400"
                      >
                        Reset filter
                      </button>
                    </>
                  ) : (
                    <>
                      No spaced-repetition items due right now. Switch to{' '}
                      <button
                        type="button"
                        onClick={() => setSrsFilter('all')}
                        className="font-semibold text-[#0F5132] hover:underline dark:text-emerald-400"
                      >
                        All Logged ({appState.mistakes.length})
                      </button>{' '}
                      to inspect or ask Gemini about past mistakes.
                    </>
                  )}
                </div>
              ) : (
                <div className="overflow-hidden rounded-2xl border border-[#E6E4DD] bg-white dark:border-[#262C36] dark:bg-[#161B22]">
                  <div className="hidden lg:grid lg:grid-cols-12 gap-3 border-b border-[#EFECE4] bg-[#FAF9F6] px-4 py-3 text-xs font-semibold text-neutral-600 dark:border-[#262C36] dark:bg-[#12161D] dark:text-neutral-400">
                    <div className="lg:col-span-2">Question</div>
                    <div className="lg:col-span-3">Rule Missed &amp; Trap</div>
                    <div className="lg:col-span-3">Your Answer vs Correct</div>
                    <div className="lg:col-span-2">SRS Stage &amp; Due Date</div>
                    <div className="lg:col-span-2 text-right">Actions</div>
                  </div>

                  <div className="divide-y divide-[#EFECE4] dark:divide-[#262C36]">
                    {visibleMistakes.map((m) => {
                      const isDue = new Date(m.nextReviewIso).getTime() <= Date.now();
                      const tutorOpen = activeTutorMistakeId === m.id;
                      const explainOpen = Boolean(expandedMistakeIds[m.id]);
                      const matchedQuestion = allQuestions.find((q) => q.id === m.questionId);
                      return (
                        <div key={m.id}>
                          <div className="grid grid-cols-1 gap-3 px-4 py-4 text-xs hover:bg-[#FAF9F6] lg:grid-cols-12 lg:items-center dark:hover:bg-[#1C222B]">
                            <div className="lg:col-span-2">
                              <span className="font-mono font-bold text-[#0F5132] dark:text-emerald-400">
                                {m.questionId}
                              </span>
                              <p className="font-medium text-neutral-800 dark:text-neutral-200">
                                {m.topicName}
                              </p>
                              <p className="font-mono text-[11px] text-neutral-400">
                                {m.kitCitation}
                              </p>
                            </div>

                            <div className="lg:col-span-3 leading-relaxed text-[#14171A] dark:text-[#F0F3F6]">
                              {m.ruleMissed}
                            </div>

                            <div className="lg:col-span-3 font-mono space-y-0.5">
                              <p className="text-red-700 dark:text-red-400">
                                Yours: {m.userAnswerSummary}
                              </p>
                              <p className="text-[#0F5132] dark:text-emerald-400">
                                Ans: {m.correctAnswerSummary}
                              </p>
                            </div>

                            <div className="lg:col-span-2">
                              <span
                                className={`text-xs font-semibold ${
                                  isDue
                                    ? 'text-amber-700 dark:text-amber-400'
                                    : 'text-neutral-700 dark:text-neutral-300'
                                }`}
                              >
                                {isDue ? 'Due Now · ' : ''}
                                {srsLabel(m.srsStage)}
                              </span>
                              <p className="mt-0.5 font-mono text-[11px] text-neutral-500">
                                {m.nextReviewIso.slice(0, 10)}
                              </p>
                            </div>

                            <div className="lg:col-span-2 flex flex-wrap items-center gap-1.5 lg:justify-end">
                              {matchedQuestion && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setExpandedMistakeIds((prev) => ({
                                      ...prev,
                                      [m.id]: !prev[m.id],
                                    }))
                                  }
                                  className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 font-semibold transition-colors ${
                                    explainOpen
                                      ? 'border-[#0F5132] bg-[#FAF9F6] text-[#0F5132] dark:border-emerald-500 dark:bg-[#1C222B] dark:text-emerald-300'
                                      : 'border-[#D8D4C8] bg-white text-[#14171A] hover:bg-[#EFECE4] dark:border-[#303846] dark:bg-[#161B22] dark:text-neutral-200'
                                  }`}
                                >
                                  <BookOpen className="h-3.5 w-3.5 text-[#0F5132] dark:text-emerald-400" />
                                  {explainOpen ? 'Hide Answer' : 'Explanation'}
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() =>
                                  setActiveTutorMistakeId(tutorOpen ? null : m.id)
                                }
                                className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 font-semibold transition-colors ${
                                  tutorOpen
                                    ? 'border-[#0F5132] bg-[#FAF9F6] text-[#0F5132] dark:border-emerald-500 dark:bg-[#1C222B] dark:text-emerald-300'
                                    : 'border-[#D8D4C8] bg-white text-[#14171A] hover:bg-[#EFECE4] dark:border-[#303846] dark:bg-[#161B22] dark:text-neutral-200'
                                }`}
                              >
                                <Bot className="h-3.5 w-3.5 text-[#0F5132] dark:text-emerald-400" />
                                {tutorOpen ? 'Hide Tutor' : 'AI Tutor'}
                              </button>
                              <button
                                type="button"
                                onClick={() => onRedrillQuestion(m.questionId)}
                                className="inline-flex items-center gap-1 rounded-lg bg-[#0F5132] px-3 py-1.5 font-semibold text-white hover:bg-[#0B3D26] dark:bg-emerald-600"
                              >
                                Re-Drill
                                <ArrowRight className="h-3 w-3" />
                              </button>
                            </div>
                          </div>

                          {explainOpen && matchedQuestion && (
                            <div className="border-t border-[#EFECE4] bg-[#FAF9F6] px-4 py-4 space-y-3 dark:border-[#262C36] dark:bg-[#12161D]">
                              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 text-xs">
                                <div className="rounded-lg border border-red-200 bg-red-50/70 px-3 py-2 dark:border-red-900/50 dark:bg-red-950/25">
                                  <span className="font-semibold text-red-700 dark:text-red-400">Your Answer: </span>
                                  <span className="font-mono font-bold text-[#14171A] dark:text-[#F0F3F6]">
                                    {m.userAnswerSummary}
                                  </span>
                                </div>
                                <div className="rounded-lg border border-emerald-200 bg-emerald-50/70 px-3 py-2 dark:border-emerald-900/50 dark:bg-emerald-950/25">
                                  <span className="font-semibold text-[#0F5132] dark:text-emerald-400">Correct Answer: </span>
                                  <span className="font-mono font-bold text-[#14171A] dark:text-[#F0F3F6]">
                                    {m.correctAnswerSummary}
                                  </span>
                                </div>
                              </div>
                              <div>
                                <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-neutral-600 dark:text-neutral-300">
                                  Explanation &amp; Worked Solution
                                </p>
                                <WorkedSolutionBlock text={matchedQuestion.full_worked_solution} compact />
                              </div>
                              {matchedQuestion.examiner_debrief.distractor_forensics && (
                                <p className="rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-2 text-xs text-neutral-800 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-neutral-200">
                                  <strong className="text-amber-800 dark:text-amber-300">Distractor Check: </strong>
                                  {matchedQuestion.examiner_debrief.distractor_forensics}
                                </p>
                              )}
                            </div>
                          )}

                          {tutorOpen && (
                            <MistakeTutorInlinePanel
                              mistake={m}
                              question={matchedQuestion}
                              onClose={() => setActiveTutorMistakeId(null)}
                              onRedrillQuestion={onRedrillQuestion}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 2. PERSONAL TRAP LEDGER & 14-CATEGORY SEED TRAPBOOK */}
      {subTab === 'traps' && (
        <div className="space-y-5">
          <TrapLedgerDashboard
            appState={appState}
            onLaunchMicroDrill={onLaunchMicroDrill}
            onOpenQuestionById={onRedrillQuestion}
          />

          {hasTrackedTraps && (
            <div className="rounded-2xl border border-[#E6E4DD] bg-white p-6 dark:border-[#262C36] dark:bg-[#161B22]">
              <h2 className="font-display text-lg font-semibold text-[#14171A] dark:text-[#F0F3F6]">
                Canonical 14-Category FA25 Examiner Trapbook
              </h2>
              <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                {SEED_TRAP_LIBRARY.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-xl border border-[#E6E4DD] bg-[#FAF9F6] p-3.5 dark:border-[#262C36] dark:bg-[#12161D]"
                  >
                    <p className="text-xs font-bold text-[#14171A] dark:text-[#F0F3F6]">
                      {String(item.id).padStart(2, '0')}. {item.category}
                    </p>
                    <p className="mt-1 text-xs text-neutral-600 dark:text-neutral-400">{item.rule}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 3. CONFUSION CLINIC */}
      {subTab === 'confuse' && (
        <div className="space-y-5">
          <div className="flex flex-wrap gap-2">
            {CONFUSION_CLINIC_PAIRS.map((pair) => (
              <button
                key={pair.id}
                type="button"
                onClick={() => {
                  setActivePairId(pair.id);
                  setConfuseChoices({});
                  setConfuseSubmitted(false);
                }}
                className={`inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-semibold transition-colors ${
                  activePairId === pair.id
                    ? 'border-[#0F5132] bg-[#0F5132] text-white dark:border-emerald-500 dark:bg-emerald-600'
                    : 'border-[#E6E4DD] bg-white text-neutral-700 hover:bg-[#FAF9F6] dark:border-[#262C36] dark:bg-[#161B22] dark:text-neutral-200'
                }`}
              >
                <Split className="h-3.5 w-3.5" />
                {pair.title}
              </button>
            ))}
          </div>

          <div className="overflow-hidden rounded-2xl border border-[#E6E4DD] bg-white dark:border-[#262C36] dark:bg-[#161B22]">
            <div className="border-b border-[#EFECE4] bg-[#FAF9F6] px-5 py-3.5 dark:border-[#262C36] dark:bg-[#12161D]">
              <h2 className="font-display text-lg font-semibold text-[#14171A] dark:text-[#F0F3F6]">
                {activePair.title} — Rule Comparison
              </h2>
            </div>
            <table className="min-w-full divide-y divide-[#EFECE4] text-left text-xs dark:divide-[#262C36]">
              <thead>
                <tr className="bg-[#FAF9F6] font-semibold text-neutral-600 dark:bg-[#12161D] dark:text-neutral-300">
                  <th className="px-4 py-3">Rule Aspect</th>
                  <th className="px-4 py-3 text-[#1E3A5F] dark:text-sky-300">{activePair.leftTitle}</th>
                  <th className="px-4 py-3 text-[#0F5132] dark:text-emerald-300">{activePair.rightTitle}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EFECE4] dark:divide-[#262C36]">
                {activePair.rows.map((r, i) => (
                  <tr key={i}>
                    <td className="px-4 py-3 font-semibold text-[#14171A] dark:text-[#F0F3F6]">{r.aspect}</td>
                    <td className="px-4 py-3 text-neutral-700 dark:text-neutral-300">{r.left}</td>
                    <td className="px-4 py-3 text-neutral-700 dark:text-neutral-300">{r.right}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="rounded-2xl border border-[#E6E4DD] bg-white p-5 sm:p-6 space-y-4 dark:border-[#262C36] dark:bg-[#161B22]">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-base font-semibold text-[#14171A] dark:text-[#F0F3F6]">
                5-Scenario Discrimination Drill
              </h3>
              <button
                type="button"
                onClick={() => {
                  setConfuseChoices({});
                  setConfuseSubmitted(false);
                }}
                className="inline-flex items-center gap-1 text-xs font-semibold text-neutral-600 hover:text-[#14171A] dark:text-neutral-300"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Reset
              </button>
            </div>

            <div className="space-y-3">
              {activePair.scenarios.map((sc, idx) => {
                const picked = confuseChoices[idx];
                const isOk = picked === sc.answer;
                return (
                  <div
                    key={idx}
                    className="rounded-xl border border-[#E6E4DD] bg-[#FAF9F6] p-4 space-y-2.5 dark:border-[#262C36] dark:bg-[#12161D]"
                  >
                    <p className="text-xs font-semibold text-[#14171A] dark:text-[#F0F3F6]">
                      {idx + 1}. {sc.prompt}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {(['left', 'right'] as const).map((side) => {
                        const title = side === 'left' ? activePair.leftTitle : activePair.rightTitle;
                        let btnStyle =
                          picked === side
                            ? 'border-[#0F5132] bg-[#0F5132] text-white dark:bg-emerald-600'
                            : 'border-[#D8D4C8] bg-white text-neutral-700 hover:bg-neutral-50 dark:border-[#303846] dark:bg-[#1C222B] dark:text-neutral-200';
                        let badge: string | null = null;

                        if (confuseSubmitted) {
                          if (side === sc.answer) {
                            btnStyle =
                              'border-[#0F5132] bg-[#0F5132] text-white dark:border-emerald-500 dark:bg-emerald-700';
                            badge = '✓ Correct';
                          } else if (picked === side) {
                            btnStyle =
                              'border-red-600 bg-red-600 text-white dark:border-red-500 dark:bg-red-700';
                            badge = '✗ Your Choice';
                          } else {
                            btnStyle =
                              'border-[#E6E4DD] bg-white/70 text-neutral-500 dark:border-[#262C36] dark:bg-[#161B22] dark:text-neutral-400';
                          }
                        }

                        return (
                          <button
                            key={side}
                            type="button"
                            disabled={confuseSubmitted}
                            onClick={() =>
                              setConfuseChoices((prev) => ({ ...prev, [idx]: side }))
                            }
                            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${btnStyle}`}
                          >
                            <span>{title}</span>
                            {badge && (
                              <span className="rounded bg-black/15 px-1.5 py-0.5 text-[10px] font-bold">
                                {badge}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                    {confuseSubmitted && (
                      <div
                        className={`rounded-lg border px-3 py-2 text-xs leading-relaxed ${
                          isOk
                            ? 'border-emerald-200 bg-emerald-50/70 text-[#0F5132] dark:border-emerald-900/50 dark:bg-emerald-950/25 dark:text-emerald-300'
                            : 'border-red-200 bg-red-50/70 text-red-800 dark:border-red-900/50 dark:bg-red-950/25 dark:text-red-300'
                        }`}
                      >
                        <p className="font-semibold">
                          {isOk
                            ? '✓ Correct: '
                            : `✗ Incorrect — Correct answer: ${
                                sc.answer === 'left' ? activePair.leftTitle : activePair.rightTitle
                              }. `}
                          <span className="font-normal text-[#14171A] dark:text-neutral-200">
                            {sc.explanation}
                          </span>
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {!confuseSubmitted ? (
              <button
                type="button"
                onClick={() => setConfuseSubmitted(true)}
                className="rounded-lg bg-[#0F5132] px-4 py-2 text-xs font-semibold text-white hover:bg-[#0B3D26] dark:bg-emerald-600"
              >
                Grade Discrimination Drill
              </button>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50/70 px-4 py-3 dark:border-emerald-900/50 dark:bg-emerald-950/25">
                <p className="font-mono text-xs font-bold text-[#0F5132] dark:text-emerald-300 tabular-nums">
                  Drill Score: {confuseScore} / {activePair.scenarios.length} (
                  {Math.round((confuseScore / activePair.scenarios.length) * 100)}%)
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setConfuseChoices({});
                    setConfuseSubmitted(false);
                  }}
                  className="inline-flex items-center gap-1 rounded-lg border border-[#D8D4C8] bg-white px-3 py-1.5 text-xs font-semibold text-[#14171A] hover:bg-neutral-50 dark:border-[#303846] dark:bg-[#1C222B] dark:text-neutral-200"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Retry Drill
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 4. MEMORY VAULT (Deck Focus Mode + Grid View) */}
      {subTab === 'memory' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#E6E4DD] bg-white p-4 dark:border-[#262C36] dark:bg-[#161B22]">
            <div className="flex items-center gap-2 text-xs text-neutral-700 dark:text-neutral-300">
              <Brain className="h-4 w-4 text-[#0F5132] dark:text-emerald-400" />
              <span>
                Focus study on rules NOT printed on the ACCA CBE Tax Rates &amp; Allowances sheet.
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex rounded-lg border border-[#E6E4DD] bg-[#FAF9F6] p-0.5 dark:border-[#262C36] dark:bg-[#12161D]">
                {[
                  { id: 'all' as const, label: 'All (14)' },
                  { id: 'must_memorise' as const, label: 'Must-Memorise (12)' },
                  { id: 'provided_in_exam' as const, label: 'Exam Tables (2)' },
                ].map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => {
                      setBucketFilter(b.id);
                      setDeckIdx(0);
                      setDeckFlipped(false);
                    }}
                    className={`rounded-md px-2.5 py-1 text-xs font-semibold ${
                      bucketFilter === b.id
                        ? 'bg-white text-[#14171A] shadow-xs dark:bg-[#1C222B] dark:text-white'
                        : 'text-neutral-600 dark:text-neutral-400'
                    }`}
                  >
                    {b.label}
                  </button>
                ))}
              </div>

              <div className="inline-flex rounded-lg border border-[#E6E4DD] bg-[#FAF9F6] p-0.5 dark:border-[#262C36] dark:bg-[#12161D]">
                <button
                  type="button"
                  onClick={() => setMemoryMode('deck')}
                  className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold ${
                    memoryMode === 'deck'
                      ? 'bg-[#0F5132] text-white dark:bg-emerald-600'
                      : 'text-neutral-600 dark:text-neutral-400'
                  }`}
                >
                  <Layers className="h-3 w-3" />
                  Flash Deck
                </button>
                <button
                  type="button"
                  onClick={() => setMemoryMode('grid')}
                  className={`rounded-md px-2.5 py-1 text-xs font-semibold ${
                    memoryMode === 'grid'
                      ? 'bg-[#0F5132] text-white dark:bg-emerald-600'
                      : 'text-neutral-600 dark:text-neutral-400'
                  }`}
                >
                  All Cards
                </button>
              </div>
            </div>
          </div>

          {memoryMode === 'deck' && activeDeckCard ? (
            <div className="mx-auto max-w-2xl rounded-2xl border border-[#E6E4DD] bg-white p-6 sm:p-8 space-y-6 dark:border-[#262C36] dark:bg-[#161B22]">
              <div className="flex items-center justify-between font-mono text-xs">
                <span
                  className={`font-bold ${
                    activeDeckCard.bucket === 'must_memorise'
                      ? 'text-amber-700 dark:text-amber-400'
                      : 'text-[#0F5132] dark:text-emerald-400'
                  }`}
                >
                  {activeDeckCard.bucket === 'must_memorise'
                    ? 'MUST MEMORISE'
                    : 'PROVIDED IN EXAM TABLES'}
                </span>
                <span className="text-neutral-500 dark:text-neutral-400 tabular-nums">
                  Card {safeDeckIdx + 1} / {memoryCards.length} · {activeDeckCard.kitRef}
                </span>
              </div>

              <h2 className="font-display text-xl font-semibold text-[#14171A] dark:text-[#F0F3F6]">
                {activeDeckCard.prompt}
              </h2>

              {deckFlipped ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 text-sm font-medium text-[#14171A] dark:border-emerald-900/60 dark:bg-emerald-950/25 dark:text-emerald-100">
                  {activeDeckCard.answer}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setDeckFlipped(true)}
                  className="inline-flex items-center gap-2 rounded-lg bg-[#0F5132] px-4 py-2.5 text-xs font-semibold text-white hover:bg-[#0B3D26] dark:bg-emerald-600"
                >
                  <Eye className="h-4 w-4" />
                  Flip &amp; Reveal Rule
                </button>
              )}

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#EFECE4] pt-4 dark:border-[#262C36]">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setDeckIdx((i) => (i - 1 + memoryCards.length) % memoryCards.length);
                      setDeckFlipped(false);
                    }}
                    className="inline-flex items-center gap-1 rounded-lg border border-[#D8D4C8] px-3 py-1.5 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 dark:border-[#303846] dark:text-neutral-200"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    Prev
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDeckIdx((i) => (i + 1) % memoryCards.length);
                      setDeckFlipped(false);
                    }}
                    className="inline-flex items-center gap-1 rounded-lg border border-[#D8D4C8] px-3 py-1.5 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 dark:border-[#303846] dark:text-neutral-200"
                  >
                    Next
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>

                <div className="flex items-center gap-2 text-xs">
                  <span className="text-neutral-500 dark:text-neutral-400">Rate &amp; advance:</span>
                  {[1, 2, 3, 4, 5].map((r) => {
                    const saved = appState.memoryStates[activeDeckCard.id];
                    return (
                      <button
                        key={r}
                        type="button"
                        onClick={() => {
                          const days = r <= 2 ? 1 : r === 3 ? 3 : 7;
                          onRateMemoryCard(
                            activeDeckCard.id,
                            r,
                            addDaysIso(new Date().toISOString(), days)
                          );
                          setDeckIdx((i) => (i + 1) % memoryCards.length);
                          setDeckFlipped(false);
                        }}
                        className={`h-7 w-7 rounded-md border font-mono text-xs font-bold ${
                          saved?.rating === r
                            ? 'border-[#0F5132] bg-[#0F5132] text-white dark:bg-emerald-600'
                            : 'border-[#D8D4C8] bg-[#FAF9F6] text-neutral-700 hover:bg-[#EFECE4] dark:border-[#303846] dark:bg-[#1C222B] dark:text-neutral-200'
                        }`}
                      >
                        {r}
                      </button>
                    );
                  })}
                </div>
              </div>
              <p className="text-center font-mono text-[11px] text-neutral-500 dark:text-neutral-400">
                Keys: Space flip · ←/→ step · 1–5 rate &amp; advance
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {memoryCards.map((card) => {
                const revealed = Boolean(revealedCards[card.id]);
                const saved = appState.memoryStates[card.id];
                return (
                  <div
                    key={card.id}
                    className="flex flex-col justify-between rounded-2xl border border-[#E6E4DD] bg-white p-5 space-y-3 dark:border-[#262C36] dark:bg-[#161B22]"
                  >
                    <div>
                      <div className="flex items-center justify-between font-mono text-[11px]">
                        <span
                          className={`font-bold ${
                            card.bucket === 'must_memorise'
                              ? 'text-amber-700 dark:text-amber-400'
                              : 'text-[#0F5132] dark:text-emerald-400'
                          }`}
                        >
                          {card.bucket === 'must_memorise'
                            ? 'MUST MEMORISE'
                            : 'PROVIDED IN EXAM TABLES'}
                        </span>
                        <span className="text-neutral-500">{card.kitRef}</span>
                      </div>
                      <p className="mt-1.5 text-sm font-bold text-[#14171A] dark:text-[#F0F3F6]">
                        {card.prompt}
                      </p>
                    </div>

                    {revealed ? (
                      <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3 text-xs text-[#14171A] dark:border-emerald-900/50 dark:bg-emerald-950/25 dark:text-emerald-100">
                        {card.answer}
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() =>
                          setRevealedCards((prev) => ({ ...prev, [card.id]: true }))
                        }
                        className="inline-flex items-center gap-1.5 self-start rounded-lg border border-[#D8D4C8] bg-[#FAF9F6] px-3 py-1.5 text-xs font-semibold text-[#14171A] hover:bg-[#EFECE4] dark:border-[#303846] dark:bg-[#1C222B] dark:text-neutral-200"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        Reveal Answer
                      </button>
                    )}

                    <div className="flex items-center justify-between border-t border-[#EFECE4] pt-2.5 text-xs dark:border-[#262C36]">
                      <span className="text-neutral-500 dark:text-neutral-400">
                        Confidence: {saved ? `${saved.rating}/5` : 'Unrated'}
                      </span>
                      <div className="flex gap-1">
                        {[1, 2, 3, 4, 5].map((r) => (
                          <button
                            key={r}
                            type="button"
                            onClick={() => {
                              const days = r <= 2 ? 1 : r === 3 ? 3 : 7;
                              onRateMemoryCard(
                                card.id,
                                r,
                                addDaysIso(new Date().toISOString(), days)
                              );
                            }}
                            className={`h-6 w-6 rounded border font-mono text-xs font-semibold ${
                              saved?.rating === r
                                ? 'border-[#0F5132] bg-[#0F5132] text-white dark:bg-emerald-600'
                                : 'border-[#D8D4C8] bg-white text-neutral-700 hover:bg-neutral-50 dark:border-[#303846] dark:bg-[#1C222B] dark:text-neutral-200'
                            }`}
                          >
                            {r}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
