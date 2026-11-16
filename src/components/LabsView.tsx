import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  Brain,
  CheckCircle2,
  Eye,
  RotateCcw,
  Split,
} from 'lucide-react';
import {
  CONFUSION_CLINIC_PAIRS,
  MEMORY_VAULT_CARDS,
  SEED_TRAP_LIBRARY,
} from '../data/taxReference';
import { addDaysIso, getDueMistakes } from '../engine/mastery';
import type { AppState, KitQuestion } from '../types/tx';
import { TrapLedgerDashboard } from './TrapLedgerDashboard';

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
  initialSubTab = 'srs',
  onRedrillQuestion,
  onRateMemoryCard,
  onLaunchMicroDrill,
}) => {
  const [subTab, setSubTab] = useState<LabSubTab>(initialSubTab);

  useEffect(() => {
    setSubTab(initialSubTab);
  }, [initialSubTab]);

  // Confusion Clinic interactive state
  const [activePairId, setActivePairId] = useState(CONFUSION_CLINIC_PAIRS[0].id);
  const [confuseChoices, setConfuseChoices] = useState<Record<number, 'left' | 'right'>>({});
  const [confuseSubmitted, setConfuseSubmitted] = useState(false);

  // Memory Vault flip state
  const [revealedCards, setRevealedCards] = useState<Record<string, boolean>>({});
  const [bucketFilter, setBucketFilter] = useState<'all' | 'must_memorise' | 'provided_in_exam'>('all');

  const dueMistakes = useMemo(() => getDueMistakes(appState.mistakes), [appState.mistakes]);
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

  return (
    <div className="space-y-6">
      {/* Header + Sub-tabs */}
      <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-xl font-bold text-slate-900">
            Mistake Bank, Spaced Repetition & Examiner Labs
          </h1>
          <p className="mt-0.5 text-xs text-slate-600">
            1/3/7-day SRS mistake queue · 14-category Trap Ledger · Confusion Clinic · Memory Vault
          </p>
        </div>

        <div className="inline-flex flex-wrap rounded-md border border-slate-200 bg-slate-100 p-0.5">
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
              className={`whitespace-nowrap rounded px-3 py-1.5 text-xs font-semibold transition-colors ${
                subTab === tab.id
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* 1. MISTAKE BANK & 1/3/7d SRS */}
      {subTab === 'srs' && (
        <div className="space-y-4">
          {appState.mistakes.length === 0 ? (
            <div className="rounded-lg border border-slate-200 bg-white p-8 text-center">
              <CheckCircle2 className="mx-auto h-7 w-7 text-teal-700" />
              <h2 className="mt-2 font-display text-base font-bold text-slate-900">
                Mistake Bank is Clean
              </h2>
              <p className="mt-1 text-xs text-slate-600">
                Any missed or skipped Kit question automatically logs here with a 1 → 3 → 7 day spaced-repetition schedule.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
              <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 font-semibold text-slate-600">
                    <th className="px-4 py-3">Question</th>
                    <th className="px-4 py-3">Rule Missed & Trap</th>
                    <th className="px-4 py-3">Your Answer vs Correct</th>
                    <th className="px-4 py-3">SRS Stage & Next Due</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {appState.mistakes.map((m) => {
                    const isDue = new Date(m.nextReviewIso).getTime() <= Date.now();
                    return (
                      <tr key={m.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3">
                          <span className="font-mono font-bold text-blue-700">
                            {m.questionId}
                          </span>
                          <p className="text-slate-600">{m.topicName}</p>
                          <p className="font-mono text-[11px] text-slate-400">
                            {m.kitCitation}
                          </p>
                        </td>
                        <td className="px-4 py-3 max-w-xs text-slate-800">
                          {m.ruleMissed}
                        </td>
                        <td className="px-4 py-3 font-mono">
                          <p className="text-red-700">Yours: {m.userAnswerSummary}</p>
                          <p className="text-teal-700">Ans: {m.correctAnswerSummary}</p>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`text-xs font-semibold ${
                              isDue ? 'text-amber-800' : 'text-slate-700'
                            }`}
                          >
                            {isDue ? 'Due Now · ' : ''}
                            {srsLabel(m.srsStage)}
                          </span>
                          <p className="mt-1 font-mono text-[11px] text-slate-500">
                            {m.nextReviewIso.slice(0, 10)}
                          </p>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => onRedrillQuestion(m.questionId)}
                            className="inline-flex items-center gap-1 rounded-md bg-blue-700 px-3 py-1.5 font-semibold text-white hover:bg-blue-800"
                          >
                            Re-Drill
                            <ArrowRight className="h-3 w-3" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
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
            <div className="rounded-lg border border-slate-200 bg-white p-5">
              <h2 className="font-display text-base font-bold text-slate-900">
                Canonical 14-Category FA25 Examiner Trapbook
              </h2>
              <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                {SEED_TRAP_LIBRARY.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-md border border-slate-200 bg-slate-50 p-3"
                  >
                    <p className="text-xs font-bold text-slate-900">
                      {String(item.id).padStart(2, '0')}. {item.category}
                    </p>
                    <p className="mt-1 text-xs text-slate-700">{item.rule}</p>
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
                className={`inline-flex items-center gap-1.5 rounded-md border px-3.5 py-2 text-xs font-semibold ${
                  activePairId === pair.id
                    ? 'border-blue-600 bg-blue-50 text-blue-900'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                <Split className="h-3.5 w-3.5" />
                {pair.title}
              </button>
            ))}
          </div>

          {/* Side-by-side Comparison Table */}
          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
              <h2 className="font-display text-base font-bold text-slate-900">
                {activePair.title} — Rule Comparison
              </h2>
            </div>
            <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
              <thead>
                <tr className="bg-slate-50 font-semibold text-slate-700">
                  <th className="px-4 py-2.5">Rule Aspect</th>
                  <th className="px-4 py-2.5 text-blue-900">{activePair.leftTitle}</th>
                  <th className="px-4 py-2.5 text-teal-900">{activePair.rightTitle}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {activePair.rows.map((r, i) => (
                  <tr key={i}>
                    <td className="px-4 py-2.5 font-semibold text-slate-800">{r.aspect}</td>
                    <td className="px-4 py-2.5 text-slate-700">{r.left}</td>
                    <td className="px-4 py-2.5 text-slate-700">{r.right}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 5-Scenario Discrimination Drill */}
          <div className="rounded-lg border border-slate-200 bg-white p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-sm font-bold text-slate-900">
                5-Scenario Discrimination Drill
              </h3>
              <button
                type="button"
                onClick={() => {
                  setConfuseChoices({});
                  setConfuseSubmitted(false);
                }}
                className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-slate-900"
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
                    className="rounded-md border border-slate-200 bg-slate-50 p-3.5 space-y-2"
                  >
                    <p className="text-xs font-medium text-slate-900">
                      {idx + 1}. {sc.prompt}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {(['left', 'right'] as const).map((side) => (
                        <button
                          key={side}
                          type="button"
                          disabled={confuseSubmitted}
                          onClick={() =>
                            setConfuseChoices((prev) => ({ ...prev, [idx]: side }))
                          }
                          className={`rounded border px-3 py-1 text-xs font-semibold ${
                            picked === side
                              ? 'border-blue-600 bg-blue-700 text-white'
                              : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          {side === 'left' ? activePair.leftTitle : activePair.rightTitle}
                        </button>
                      ))}
                    </div>
                    {confuseSubmitted && (
                      <p
                        className={`text-xs font-medium ${
                          isOk ? 'text-teal-800' : 'text-red-800'
                        }`}
                      >
                        {isOk ? '✓ Correct: ' : '✗ Incorrect: '}
                        {sc.explanation}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>

            {!confuseSubmitted && (
              <button
                type="button"
                onClick={() => setConfuseSubmitted(true)}
                className="rounded-md bg-blue-700 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-800"
              >
                Grade Discrimination Drill
              </button>
            )}
          </div>
        </div>
      )}

      {/* 4. MEMORY VAULT (/memory) */}
      {subTab === 'memory' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-4">
            <div className="flex items-center gap-2 text-xs text-slate-700">
              <Brain className="h-4 w-4 text-blue-700" />
              <span>
                Only memorise rules NOT printed in the ACCA CBE Tax Rates & Allowances sheet.
              </span>
            </div>

            <div className="inline-flex rounded-md border border-slate-200 bg-slate-100 p-0.5">
              {[
                { id: 'all' as const, label: 'All Cards (14)' },
                { id: 'must_memorise' as const, label: 'Must-Memorise (12)' },
                { id: 'provided_in_exam' as const, label: 'Provided in Exam (2)' },
              ].map((b) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => setBucketFilter(b.id)}
                  className={`rounded px-2.5 py-1 text-xs font-semibold ${
                    bucketFilter === b.id
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600'
                  }`}
                >
                  {b.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {memoryCards.map((card) => {
              const revealed = Boolean(revealedCards[card.id]);
              const saved = appState.memoryStates[card.id];
              return (
                <div
                  key={card.id}
                  className="flex flex-col justify-between rounded-lg border border-slate-200 bg-white p-4 space-y-3"
                >
                  <div>
                    <div className="flex items-center justify-between text-[11px] font-mono">
                      <span
                        className={`font-bold ${
                          card.bucket === 'must_memorise' ? 'text-amber-800' : 'text-teal-700'
                        }`}
                      >
                        {card.bucket === 'must_memorise'
                          ? 'MUST MEMORISE'
                          : 'PROVIDED IN EXAM TABLES'}
                      </span>
                      <span className="text-slate-500">{card.kitRef}</span>
                    </div>
                    <p className="mt-1.5 text-sm font-bold text-slate-900">{card.prompt}</p>
                  </div>

                  {revealed ? (
                    <div className="rounded-md border border-blue-200 bg-blue-50/70 p-3 text-xs text-slate-900">
                      {card.answer}
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() =>
                        setRevealedCards((prev) => ({ ...prev, [card.id]: true }))
                      }
                      className="inline-flex items-center gap-1.5 self-start rounded border border-slate-300 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-100"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      Reveal Answer
                    </button>
                  )}

                  <div className="flex items-center justify-between border-t border-slate-100 pt-2.5 text-xs">
                    <span className="text-slate-500">
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
                              ? 'border-blue-700 bg-blue-700 text-white'
                              : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
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
        </div>
      )}
    </div>
  );
};
