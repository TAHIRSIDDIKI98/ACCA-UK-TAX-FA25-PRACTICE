import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Search,
  ShieldAlert,
  ShieldCheck,
  X,
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
  { accentText: string; barBg: string }
> = {
  critical: {
    accentText: 'text-red-700 dark:text-red-400',
    barBg: 'bg-red-600',
  },
  repeat: {
    accentText: 'text-amber-700 dark:text-amber-400',
    barBg: 'bg-amber-600',
  },
  single: {
    accentText: 'text-neutral-700 dark:text-neutral-300',
    barBg: 'bg-neutral-500',
  },
  immune: {
    accentText: 'text-[#0F5132] dark:text-emerald-400',
    barBg: 'bg-[#0F5132]',
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
      className="rounded-2xl border border-[#E6E4DD] bg-white p-5 sm:p-6 space-y-5 dark:border-[#262C36] dark:bg-[#161B22]"
    >
      <div className="flex flex-col gap-3 border-b border-[#EFECE4] pb-4 lg:flex-row lg:items-center lg:justify-between dark:border-[#262C36]">
        <div>
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-red-700 dark:text-red-400" />
            <h2 className="font-display text-lg font-semibold text-[#14171A] dark:text-[#F0F3F6]">
              Personal Trap Ledger
            </h2>
          </div>
          <p className="mt-0.5 text-xs text-neutral-600 dark:text-neutral-400">
            Repeat examiner traps logged from your practice &amp; mock submissions, sorted by repeat frequency.
          </p>
        </div>

        <div className="flex flex-wrap sm:flex-nowrap items-center gap-4 lg:gap-5 text-xs tabular-nums shrink-0">
          <div className="whitespace-nowrap">
            <span className="text-neutral-500 dark:text-neutral-400">Repeat Offences</span>
            <p className="font-mono text-sm font-bold text-red-700 dark:text-red-400">
              {repeatOffenceCategories} categories
            </p>
          </div>
          <div className="h-6 w-px bg-[#EFECE4] dark:bg-[#262C36] shrink-0" aria-hidden="true" />
          <div className="whitespace-nowrap">
            <span className="text-neutral-500 dark:text-neutral-400">Hits / Avoided</span>
            <p className="font-mono text-sm font-bold text-[#14171A] dark:text-[#F0F3F6]">
              {totalHits} hits · {totalAvoided} avoided
            </p>
          </div>
          <div className="h-6 w-px bg-[#EFECE4] dark:bg-[#262C36] shrink-0" aria-hidden="true" />
          <div className="whitespace-nowrap">
            <span className="text-neutral-500 dark:text-neutral-400">Immunity</span>
            <p className="font-mono text-sm font-bold text-[#0F5132] dark:text-emerald-400">
              {immunityPercent}%
            </p>
          </div>
          {compact && onOpenFullTrapBank && (
            <button
              type="button"
              onClick={onOpenFullTrapBank}
              className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-lg border border-[#D8D4C8] bg-[#FAF9F6] px-3 py-1.5 text-xs font-semibold text-[#14171A] hover:bg-[#EFECE4] dark:border-[#303846] dark:bg-[#1C222B] dark:text-neutral-200"
            >
              Full Trap Lab
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {totalTracked === 0 ? (
        <div className="space-y-4">
          <div className="flex flex-col gap-3 rounded-xl border border-[#E6E4DD] bg-[#FAF9F6] p-4 sm:flex-row sm:items-center sm:justify-between dark:border-[#262C36] dark:bg-[#12161D]">
            <div className="flex items-start gap-2.5">
              <ShieldCheck className="mt-0.5 h-4.5 w-4.5 shrink-0 text-[#0F5132] dark:text-emerald-400" />
              <div>
                <p className="text-sm font-semibold text-[#14171A] dark:text-[#F0F3F6]">
                  Zero personal trap hits recorded yet
                </p>
                <p className="mt-0.5 text-xs text-neutral-600 dark:text-neutral-400">
                  Any missed Section A, B, or C trap automatically logs here; hitting the same trap twice triggers a 2-question micro-drill.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onLaunchMicroDrill('Employment & Cars')}
              className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg bg-[#0F5132] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#0B3D26] dark:bg-emerald-600"
            >
              Drill Top FA25 Trap
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>

          {!compact && (
            <div>
              <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                14 Canonical FA25 Examiner Trap Watchlist
              </h3>
              <div className="mt-2.5 grid grid-cols-1 gap-2.5 md:grid-cols-2">
                {SEED_TRAP_LIBRARY.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-xl border border-[#E6E4DD] bg-[#FAF9F6] p-3.5 text-xs dark:border-[#262C36] dark:bg-[#12161D]"
                  >
                    <p className="font-semibold text-[#14171A] dark:text-[#F0F3F6]">
                      {String(item.id).padStart(2, '0')}. {item.category}
                    </p>
                    <p className="mt-0.5 text-neutral-600 dark:text-neutral-400">{item.rule}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="inline-flex flex-wrap rounded-lg border border-[#E6E4DD] bg-[#FAF9F6] p-0.5 dark:border-[#262C36] dark:bg-[#12161D]">
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
                  className={`whitespace-nowrap rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${
                    tierFilter === tab.id
                      ? 'bg-[#0F5132] text-white dark:bg-emerald-600'
                      : 'text-neutral-600 hover:text-[#14171A] dark:text-neutral-300'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {!compact && (
              <div className="relative w-full sm:w-64">
                <Search className="pointer-events-none absolute left-2.5 top-2 h-3.5 w-3.5 text-neutral-400" />
                <input
                  type="text"
                  aria-label="Filter trap ledger categories or questions"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Filter trap category or Q#..."
                  className="w-full rounded-lg border border-[#D8D4C8] bg-[#FAF9F6] py-1.5 pl-8 pr-8 text-xs text-[#14171A] focus:border-[#0F5132] focus:outline-none dark:border-[#303846] dark:bg-[#0D1117] dark:text-[#F0F3F6]"
                />
                {searchTerm && (
                  <button
                    type="button"
                    aria-label="Clear trap filter"
                    onClick={() => setSearchTerm('')}
                    className="absolute right-2 top-1.5 rounded p-0.5 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            )}
          </div>

          {visibleBuckets.length === 0 ? (
            <div className="rounded-xl border border-[#E6E4DD] bg-[#FAF9F6] p-4 text-xs text-neutral-600 dark:border-[#262C36] dark:bg-[#12161D] dark:text-neutral-400">
              No trap entries match the selected filter.{' '}
              <button
                type="button"
                onClick={() => {
                  setTierFilter('all');
                  setSearchTerm('');
                }}
                className="font-semibold text-[#0F5132] hover:underline dark:text-emerald-400"
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
                    className="overflow-hidden rounded-xl border border-[#E6E4DD] dark:border-[#262C36]"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#EFECE4] bg-[#FAF9F6] px-4 py-2.5 dark:border-[#262C36] dark:bg-[#12161D]">
                      <div className="flex items-center gap-2">
                        {bucket.tier === 'immune' ? (
                          <CheckCircle2 className="h-4 w-4 text-[#0F5132] dark:text-emerald-400" />
                        ) : (
                          <AlertTriangle className={`h-4 w-4 ${style.accentText}`} />
                        )}
                        <h3 className="font-display text-sm font-semibold text-[#14171A] dark:text-[#F0F3F6]">
                          {bucket.title}
                        </h3>
                      </div>
                      <span className="font-mono text-[11px] text-neutral-500 dark:text-neutral-400">
                        {bucket.subtitle}
                      </span>
                    </div>

                    <div className="divide-y divide-[#EFECE4] bg-white dark:divide-[#262C36] dark:bg-[#161B22]">
                      {items.map((entry) => {
                        const total = entry.hitCount + entry.avoidedCount;
                        const avoidPct =
                          total > 0 ? Math.round((entry.avoidedCount / total) * 100) : 0;
                        return (
                          <div
                            key={entry.trapCategory}
                            className="flex flex-col gap-3 px-4 py-3.5 lg:flex-row lg:items-center lg:justify-between"
                          >
                            <div className="space-y-1 min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-sm font-bold text-[#14171A] dark:text-[#F0F3F6]">
                                  {entry.trapCategory}
                                </span>
                                <span className="text-neutral-300 dark:text-neutral-600" aria-hidden="true">
                                  ·
                                </span>
                                <span
                                  className={`font-mono text-xs font-semibold tabular-nums ${style.accentText}`}
                                >
                                  {entry.hitCount} {entry.hitCount === 1 ? 'hit' : 'hits'}
                                </span>
                                <span className="text-neutral-300 dark:text-neutral-600" aria-hidden="true">
                                  ·
                                </span>
                                <span className="font-mono text-xs font-semibold text-[#0F5132] dark:text-emerald-400 tabular-nums">
                                  {entry.avoidedCount} avoided ({avoidPct}% immunity)
                                </span>
                              </div>

                              <p className="text-xs text-neutral-600 leading-relaxed dark:text-neutral-400">
                                {entry.ruleSummary}
                              </p>

                              {entry.questionIds.length > 0 && (
                                <div className="flex flex-wrap items-center gap-1.5 pt-0.5 text-[11px] text-neutral-500 dark:text-neutral-400">
                                  <span>Missed on:</span>
                                  {entry.questionIds.map((qId) =>
                                    onOpenQuestionById ? (
                                      <button
                                        key={qId}
                                        type="button"
                                        onClick={() => onOpenQuestionById(qId)}
                                        className="font-mono font-semibold text-[#0F5132] hover:underline dark:text-emerald-400"
                                      >
                                        {qId}
                                      </button>
                                    ) : (
                                      <span key={qId} className="font-mono font-semibold">
                                        {qId}
                                      </span>
                                    )
                                  )}
                                </div>
                              )}
                            </div>

                            <div className="flex items-center gap-3 shrink-0">
                              <div className="hidden sm:block w-24">
                                <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#EFECE4] dark:bg-[#262C36]">
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
                                className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                                  entry.microDrillRequired || entry.hitCount >= 2
                                    ? 'bg-red-700 text-white hover:bg-red-800'
                                    : 'border border-[#D8D4C8] bg-[#FAF9F6] text-[#14171A] hover:bg-[#EFECE4] dark:border-[#303846] dark:bg-[#1C222B] dark:text-neutral-200'
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
