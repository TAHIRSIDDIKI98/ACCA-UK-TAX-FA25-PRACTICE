import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Search,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import { SEED_TRAP_LIBRARY } from '../data/taxReference';
import {
  categorizeTrapLedger,
  computeTrapImmunityPercent,
  type TrapFrequencyTier,
} from '../engine/mastery';
import type { AppState } from '../types/tx';

interface TrapLedgerDashboardProps {
  appState: AppState;
  compact?: boolean;
  onLaunchMicroDrill: (trapCategory: string) => void;
  onOpenQuestionById?: (qId: string) => void;
  onOpenFullTrapBank?: () => void;
}

const TIER_STYLES: Record<
  TrapFrequencyTier,
  { accentText: string; barBg: string; marker: string }
> = {
  critical: {
    accentText: 'text-red-700',
    barBg: 'bg-red-600',
    marker: 'Critical 3+ hits',
  },
  repeat: {
    accentText: 'text-amber-700',
    barBg: 'bg-amber-600',
    marker: 'Repeat 2 hits',
  },
  single: {
    accentText: 'text-slate-700',
    barBg: 'bg-slate-600',
    marker: '1st hit watch',
  },
  immune: {
    accentText: 'text-teal-700',
    barBg: 'bg-teal-600',
    marker: '0 hits · Immune',
  },
};

export const TrapLedgerDashboard: React.FC<TrapLedgerDashboardProps> = ({
  appState,
  compact = false,
  onLaunchMicroDrill,
  onOpenQuestionById,
  onOpenFullTrapBank,
}) => {
  const [tierFilter, setTierFilter] = useState<'all' | TrapFrequencyTier>('all');
  const [searchTerm, setSearchTerm] = useState('');

  const { buckets, totalHits, totalAvoided, repeatOffenceCategories } = useMemo(
    () => categorizeTrapLedger(appState.trapLedger),
    [appState.trapLedger]
  );
  const immunityPercent = useMemo(() => computeTrapImmunityPercent(appState), [appState]);

  const totalTracked = Object.keys(appState.trapLedger).length;

  const visibleBuckets = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return buckets
      .filter((b) => tierFilter === 'all' || b.tier === tierFilter)
      .map((b) => ({
        ...b,
        entries: q
          ? b.entries.filter(
              (e) =>
                e.trapCategory.toLowerCase().includes(q) ||
                e.ruleSummary.toLowerCase().includes(q) ||
                e.questionIds.some((id) => id.toLowerCase().includes(q))
            )
          : b.entries,
      }))
      .filter((b) => b.entries.length > 0);
  }, [buckets, tierFilter, searchTerm]);

  return (
    <section
      aria-label="Personal Trap Ledger"
      className="rounded-lg border border-slate-200 bg-white p-5 sm:p-6 space-y-5"
    >
      {/* Header + Summary Figures */}
      <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-4.5 w-4.5 text-red-700" />
            <h2 className="font-display text-base sm:text-lg font-bold text-slate-900">
              Personal Trap Ledger
            </h2>
          </div>
          <p className="mt-0.5 text-xs text-slate-600">
            Repeat examiner traps pulled from your practice & mock submissions, ordered by repeat-offence frequency.
          </p>
        </div>

        <div className="flex flex-wrap sm:flex-nowrap items-center gap-4 lg:gap-5 text-xs tabular-nums shrink-0">
          <div className="whitespace-nowrap">
            <span className="text-slate-500">Repeat Offences</span>
            <p className="font-mono text-sm font-bold text-red-700">
              {repeatOffenceCategories} categories
            </p>
          </div>
          <div className="h-6 w-px bg-slate-200 shrink-0" aria-hidden="true" />
          <div className="whitespace-nowrap">
            <span className="text-slate-500">Total Hits / Avoided</span>
            <p className="font-mono text-sm font-bold text-slate-900">
              {totalHits} hits · {totalAvoided} avoided
            </p>
          </div>
          <div className="h-6 w-px bg-slate-200 shrink-0" aria-hidden="true" />
          <div className="whitespace-nowrap">
            <span className="text-slate-500">Trap Immunity</span>
            <p className="font-mono text-sm font-bold text-teal-700">{immunityPercent}%</p>
          </div>
          {compact && onOpenFullTrapBank && (
            <button
              type="button"
              onClick={onOpenFullTrapBank}
              className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
            >
              Full Trap Lab
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {totalTracked === 0 ? (
        <div className="space-y-4">
          <div className="flex flex-col gap-3 rounded-md border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-2.5">
              <ShieldCheck className="mt-0.5 h-4.5 w-4.5 shrink-0 text-teal-700" />
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  Zero personal trap hits recorded yet
                </p>
                <p className="mt-0.5 text-xs text-slate-600">
                  Any missed Section A, B, or C trap automatically logs here by repeat frequency; hitting the same trap twice triggers a targeted 2-question micro-drill.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onLaunchMicroDrill('Employment & Cars')}
              className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md bg-blue-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
            >
              Drill Top FA25 Trap
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>

          {!compact && (
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                14 Canonical FA25 Examiner Trap Watchlist
              </h3>
              <div className="mt-2.5 grid grid-cols-1 gap-2.5 md:grid-cols-2">
                {SEED_TRAP_LIBRARY.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-start justify-between gap-3 rounded-md border border-slate-200 p-3 text-xs"
                  >
                    <div>
                      <p className="font-semibold text-slate-900">
                        {String(item.id).padStart(2, '0')}. {item.category}
                      </p>
                      <p className="mt-0.5 text-slate-600">{item.rule}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <>
          {/* Filter Controls */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="inline-flex flex-wrap rounded-md border border-slate-200 bg-slate-100 p-0.5">
              {(
                [
                  { id: 'all', label: `All (${totalTracked})` },
                  { id: 'critical', label: `Critical 3+ (${buckets[0].entries.length})` },
                  { id: 'repeat', label: `Repeat 2x (${buckets[1].entries.length})` },
                  { id: 'single', label: `1st Hit (${buckets[2].entries.length})` },
                  { id: 'immune', label: `Immune (${buckets[3].entries.length})` },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setTierFilter(tab.id)}
                  className={`whitespace-nowrap rounded px-2.5 py-1 text-xs font-semibold transition-colors ${
                    tierFilter === tab.id
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {!compact && (
              <div className="relative w-full sm:w-64">
                <Search className="pointer-events-none absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  aria-label="Filter trap ledger categories or questions"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Filter trap category or Q#..."
                  className="w-full rounded-md border border-slate-300 bg-white py-1.5 pl-8 pr-3 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                />
              </div>
            )}
          </div>

          {/* Categorised Repeat-Offence Frequency Buckets */}
          {visibleBuckets.length === 0 ? (
            <div className="rounded-md border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600">
              No trap entries match the selected filter.{' '}
              <button
                type="button"
                onClick={() => {
                  setTierFilter('all');
                  setSearchTerm('');
                }}
                className="font-semibold text-blue-700 hover:underline"
              >
                Reset filters
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {visibleBuckets.map((bucket) => {
                const style = TIER_STYLES[bucket.tier];
                const items = compact ? bucket.entries.slice(0, 3) : bucket.entries;
                return (
                  <div
                    key={bucket.tier}
                    className="overflow-hidden rounded-md border border-slate-200"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        {bucket.tier === 'immune' ? (
                          <CheckCircle2 className="h-4 w-4 text-teal-700" />
                        ) : (
                          <AlertTriangle className={`h-4 w-4 ${style.accentText}`} />
                        )}
                        <h3 className="font-display text-xs sm:text-sm font-bold text-slate-900">
                          {bucket.title}
                        </h3>
                      </div>
                      <span className="font-mono text-[11px] text-slate-500">
                        {bucket.subtitle}
                      </span>
                    </div>

                    <div className="divide-y divide-slate-100 bg-white">
                      {items.map((entry) => {
                        const total = entry.hitCount + entry.avoidedCount;
                        const avoidPct =
                          total > 0 ? Math.round((entry.avoidedCount / total) * 100) : 0;
                        return (
                          <div
                            key={entry.trapCategory}
                            className="flex flex-col gap-3 px-4 py-3 lg:flex-row lg:items-center lg:justify-between"
                          >
                            <div className="space-y-1 min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-sm font-bold text-slate-900">
                                  {entry.trapCategory}
                                </span>
                                <span className="text-slate-300" aria-hidden="true">
                                  ·
                                </span>
                                <span
                                  className={`font-mono text-xs font-semibold tabular-nums ${style.accentText}`}
                                >
                                  {entry.hitCount} {entry.hitCount === 1 ? 'hit' : 'hits'}
                                </span>
                                <span className="text-slate-300" aria-hidden="true">
                                  ·
                                </span>
                                <span className="font-mono text-xs font-semibold text-teal-700 tabular-nums">
                                  {entry.avoidedCount} avoided ({avoidPct}% immunity)
                                </span>
                              </div>

                              <p className="text-xs text-slate-600 leading-relaxed">
                                {entry.ruleSummary}
                              </p>

                              {entry.questionIds.length > 0 && (
                                <div className="flex flex-wrap items-center gap-1.5 pt-0.5 text-[11px] text-slate-500">
                                  <span>Missed on:</span>
                                  {entry.questionIds.map((qId) =>
                                    onOpenQuestionById ? (
                                      <button
                                        key={qId}
                                        type="button"
                                        onClick={() => onOpenQuestionById(qId)}
                                        className="font-mono font-semibold text-blue-700 hover:underline"
                                      >
                                        {qId}
                                      </button>
                                    ) : (
                                      <span key={qId} className="font-mono font-semibold text-slate-700">
                                        {qId}
                                      </span>
                                    )
                                  )}
                                </div>
                              )}
                            </div>

                            <div className="flex items-center gap-3 shrink-0">
                              <div className="hidden sm:block w-24">
                                <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                                  <div
                                    className={`h-full ${style.barBg}`}
                                    style={{
                                      width: `${Math.max(12, entry.hitCount > 0 ? Math.min(100, entry.hitCount * 25) : 100)}%`,
                                    }}
                                  />
                                </div>
                              </div>

                              <button
                                type="button"
                                onClick={() => onLaunchMicroDrill(entry.trapCategory)}
                                className={`whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
                                  entry.microDrillRequired || entry.hitCount >= 2
                                    ? 'bg-red-700 text-white hover:bg-red-800'
                                    : 'border border-slate-300 bg-white text-slate-800 hover:bg-slate-50'
                                }`}
                              >
                                {entry.microDrillRequired || entry.hitCount >= 2
                                  ? 'Start 2-Q Micro-Drill →'
                                  : 'Drill Trap →'}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </section>
  );
};
