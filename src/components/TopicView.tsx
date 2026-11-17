import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, ChevronLeft, ChevronRight, Layers, Lock, Play, Sparkles, Unlock } from 'lucide-react';
import { TOPICS } from '../data/taxReference';
import { formatInteractionLabel } from '../engine/mastery';
import { generateTrapVariant } from '../engine/taxCalculators';
import type { AppState, KitQuestion, TopicDefinition } from '../types/tx';

interface TopicViewProps {
  topicId: number;
  allQuestions: KitQuestion[];
  appState: AppState;
  onSelectTopic: (topicId: number) => void;
  onBackToOverview: () => void;
  onLaunchQuestion: (question: KitQuestion, tier: 1 | 2 | 3 | 4) => void;
}

const AREA_CHIPS = [
  'ALL',
  'Income Tax & NIC',
  'Corporation Tax',
  'Chargeable Gains',
  'Inheritance Tax',
  'VAT',
  'UK Tax System',
];

export const TopicView: React.FC<TopicViewProps> = ({
  topicId,
  allQuestions,
  appState,
  onSelectTopic,
  onBackToOverview,
  onLaunchQuestion,
}) => {
  const [selectedTier, setSelectedTier] = useState<1 | 2 | 3 | 4>(2);
  const [variantSeed, setVariantSeed] = useState(0);
  const [areaFilter, setAreaFilter] = useState<string>('ALL');

  const topic: TopicDefinition =
    TOPICS.find((t) => t.id === topicId) ?? TOPICS[4];
  const tp = appState.topicProgress[topic.id];
  const unlockedTier = tp?.tierUnlocked ?? 1;

  const visibleTopics = useMemo(() => {
    if (areaFilter === 'ALL') return TOPICS;
    return TOPICS.filter((t) => t.syllabusArea === areaFilter);
  }, [areaFilter]);

  const topicQuestions = useMemo(
    () => allQuestions.filter((q) => q.topic_id === topic.id),
    [allQuestions, topic.id]
  );

  const tierCounts = useMemo(() => {
    const secA = topicQuestions.filter((q) => q.section === 'A');
    const secBC = topicQuestions.filter((q) => q.section === 'B' || q.section === 'C');
    return {
      1: Math.min(6, secA.length),
      2: secA.length,
      3: secBC.length,
      4: 3,
    };
  }, [topicQuestions]);

  // Prevent empty-tier dead-ends (e.g., Topics 20, 21, 24 only have Sec B/C questions)
  useEffect(() => {
    if (selectedTier !== 4 && tierCounts[selectedTier] === 0) {
      if (tierCounts[2] > 0) setSelectedTier(2);
      else if (tierCounts[3] > 0) setSelectedTier(3);
      else setSelectedTier(4);
    }
  }, [topic.id, tierCounts, selectedTier]);

  const tierFiltered = useMemo(() => {
    if (selectedTier === 1) return topicQuestions.filter((q) => q.section === 'A').slice(0, 6);
    if (selectedTier === 2) return topicQuestions.filter((q) => q.section === 'A');
    if (selectedTier === 3) return topicQuestions.filter((q) => q.section === 'B' || q.section === 'C');
    return topicQuestions.slice(0, 4);
  }, [selectedTier, topicQuestions]);

  const handleLaunchTier4Variant = () => {
    const variant = generateTrapVariant(topic.id, variantSeed);
    setVariantSeed((s) => s + 1);
    onLaunchQuestion(variant, 4);
  };

  const attemptCountByQ = useMemo(() => {
    const map = new Map<string, { scored: number; avail: number }>();
    for (const a of appState.attempts) {
      if (!map.has(a.questionId)) {
        map.set(a.questionId, { scored: a.marksScored, avail: a.marksAvailable });
      }
    }
    return map;
  }, [appState.attempts]);

  const topicAttemptedCount = useMemo(
    () => topicQuestions.filter((q) => attemptCountByQ.has(q.id)).length,
    [topicQuestions, attemptCountByQ]
  );

  const nextRecommendedQ = useMemo(() => {
    const pool = tierFiltered.length > 0 ? tierFiltered : topicQuestions;
    return pool.find((q) => !attemptCountByQ.has(q.id)) ?? pool[0] ?? null;
  }, [tierFiltered, topicQuestions, attemptCountByQ]);

  return (
    <div className="space-y-6">
      {/* Area Filter Chips + Compact Topic Switcher */}
      <div className="rounded-2xl border border-[#E6E4DD] bg-white p-4 sm:p-5 space-y-4 dark:border-[#262C36] dark:bg-[#161B22]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={onBackToOverview}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#D8D4C8] bg-[#FAF9F6] px-3 py-1.5 text-xs font-semibold text-neutral-700 hover:bg-[#EFECE4] dark:border-[#303846] dark:bg-[#1C222B] dark:text-neutral-200"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Today Hub
          </button>

          <div className="flex flex-wrap gap-1.5">
            {AREA_CHIPS.map((area) => {
              const active = areaFilter === area;
              return (
                <button
                  key={area}
                  type="button"
                  onClick={() => setAreaFilter(area)}
                  className={`whitespace-nowrap rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors ${
                    active
                      ? 'bg-[#0F5132] text-white dark:bg-emerald-600'
                      : 'bg-[#FAF9F6] text-neutral-600 hover:bg-[#EFECE4] dark:bg-[#1C222B] dark:text-neutral-300'
                  }`}
                >
                  {area === 'ALL' ? 'All 24 Topics' : area}
                </button>
              );
            })}
          </div>
        </div>

        {/* Interactive Horizontal Topic Rail */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {visibleTopics.map((t) => {
            const isSelected = t.id === topic.id;
            const prog = appState.topicProgress[t.id];
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => onSelectTopic(t.id)}
                className={`shrink-0 rounded-xl border px-3 py-2 text-left transition-colors ${
                  isSelected
                    ? 'border-[#0F5132] bg-[#0F5132] text-white dark:border-emerald-500 dark:bg-emerald-700'
                    : 'border-[#E6E4DD] bg-[#FAF9F6] text-[#14171A] hover:border-[#0F5132]/50 dark:border-[#262C36] dark:bg-[#12161D] dark:text-[#F0F3F6]'
                }`}
              >
                <div className="flex items-center justify-between gap-3 font-mono text-[11px]">
                  <span className={isSelected ? 'text-emerald-100' : 'text-neutral-500 dark:text-neutral-400'}>
                    T{String(t.id).padStart(2, '0')}
                  </span>
                  <span className={isSelected ? 'text-emerald-100' : 'text-[#0F5132] dark:text-emerald-400'}>
                    {prog?.attempts ? `${prog.mastery}%` : `${t.extractedCount}Q`}
                  </span>
                </div>
                <p className="mt-0.5 max-w-[155px] truncate text-xs font-semibold">
                  {t.title}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* PHASE 1: Editorial Handbook Revision Spread */}
      <section className="rounded-2xl border border-[#E6E4DD] bg-white p-6 sm:p-7 space-y-6 dark:border-[#262C36] dark:bg-[#161B22]">
        <div className="flex flex-col gap-3 border-b border-[#EFECE4] pb-4 sm:flex-row sm:items-end sm:justify-between dark:border-[#262C36]">
          <div>
            <p className="font-mono text-xs font-semibold text-[#0F5132] dark:text-emerald-400">
              Topic {topic.id} of 24 · {topic.stChapter} · {topic.syllabusArea} · {topic.kitRange}
            </p>
            <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight text-[#14171A] dark:text-[#F0F3F6]">
              {topic.title}
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="font-mono text-xs font-semibold text-neutral-600 dark:text-neutral-300 tabular-nums">
              Examined {topic.phase1.frequencyCount}/8 sittings · {topic.phase1.kitRefs}
            </div>
            {nextRecommendedQ && (
              <button
                type="button"
                onClick={() =>
                  onLaunchQuestion(
                    nextRecommendedQ,
                    nextRecommendedQ.section === 'A' ? (selectedTier === 1 ? 1 : 2) : 3
                  )
                }
                className="inline-flex items-center gap-1 rounded-lg bg-[#0F5132] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#0B3D26] dark:bg-emerald-600 dark:hover:bg-emerald-500"
              >
                <Play className="h-3 w-3" />
                Practice {nextRecommendedQ.id}
              </button>
            )}
            <div className="inline-flex items-center gap-1">
              <button
                type="button"
                aria-label="Previous topic"
                disabled={topic.id <= 1}
                onClick={() => topic.id > 1 && onSelectTopic(topic.id - 1)}
                className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-[#D8D4C8] bg-[#FAF9F6] text-neutral-700 hover:bg-[#EFECE4] disabled:opacity-40 dark:border-[#303846] dark:bg-[#1C222B] dark:text-neutral-200"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                aria-label="Next topic"
                disabled={topic.id >= TOPICS.length}
                onClick={() => topic.id < TOPICS.length && onSelectTopic(topic.id + 1)}
                className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-[#D8D4C8] bg-[#FAF9F6] text-neutral-700 hover:bg-[#EFECE4] disabled:opacity-40 dark:border-[#303846] dark:bg-[#1C222B] dark:text-neutral-200"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>

        <p className="rounded-xl border border-[#E6E4DD] bg-[#FAF9F6] px-4 py-3 text-sm text-[#14171A] dark:border-[#262C36] dark:bg-[#12161D] dark:text-neutral-200">
          <strong className="text-[#0F5132] dark:text-emerald-400">How it is examined: </strong>
          {topic.phase1.howExamined}
        </p>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Core Law & Rules */}
          <div className="space-y-3 lg:col-span-6">
            <h2 className="font-display text-base font-semibold text-[#14171A] dark:text-[#F0F3F6]">
              Core FA25 Rules &amp; Tax Law
            </h2>
            <ul className="divide-y divide-[#EFECE4] text-sm text-neutral-700 dark:divide-[#262C36] dark:text-neutral-300">
              {topic.phase1.coreRules.map((rule, i) => (
                <li key={i} className="flex gap-3 py-2.5 first:pt-0">
                  <span className="font-mono text-xs font-bold text-[#0F5132] dark:text-emerald-400 mt-0.5 tabular-nums">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span>{rule}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Proforma Ledger + Key FA25 Figures */}
          <div className="space-y-4 lg:col-span-6">
            <div className="overflow-hidden rounded-xl border border-[#E6E4DD] dark:border-[#262C36]">
              <div className="border-b border-[#EFECE4] bg-[#FAF9F6] px-4 py-2 text-xs font-bold text-[#14171A] dark:border-[#262C36] dark:bg-[#12161D] dark:text-[#F0F3F6]">
                {topic.phase1.proformaTitle}
              </div>
              <div className="bg-[#14171A] px-4 py-3.5 font-mono text-xs leading-relaxed text-neutral-100 dark:bg-[#0D1117]">
                {topic.phase1.proformaLines.map((line, i) => (
                  <div key={i}>{line}</div>
                ))}
              </div>
            </div>

            <div className="overflow-hidden rounded-xl border border-[#E6E4DD] dark:border-[#262C36]">
              <div className="border-b border-[#EFECE4] bg-[#FAF9F6] px-4 py-2 text-xs font-bold text-[#14171A] dark:border-[#262C36] dark:bg-[#12161D] dark:text-[#F0F3F6]">
                FA25 Thresholds &amp; Numbers
              </div>
              <div className="divide-y divide-[#EFECE4] dark:divide-[#262C36]">
                {topic.phase1.keyNumbers.map((kn, i) => (
                  <div key={i} className="tax-study-row flex items-center justify-between gap-3 px-4 py-2.5 text-xs">
                    <div>
                      <span className="font-semibold text-[#14171A] dark:text-[#F0F3F6]">{kn.label}</span>
                      {kn.note && (
                        <p className="text-neutral-500 dark:text-neutral-400">{kn.note}</p>
                      )}
                    </div>
                    <span className="font-mono font-bold text-[#0F5132] dark:text-emerald-400 tabular-nums">
                      {kn.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Traps & Memory Hook */}
        <div className="grid grid-cols-1 gap-4 border-t border-[#EFECE4] pt-5 lg:grid-cols-3 dark:border-[#262C36]">
          <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 lg:col-span-2 dark:border-amber-900/60 dark:bg-amber-950/25">
            <h3 className="font-mono text-xs font-bold text-amber-900 dark:text-amber-300">
              Examiner’s Top Traps
            </h3>
            <ul className="mt-2 space-y-1.5 text-xs text-amber-950 dark:text-amber-100">
              {topic.phase1.topTraps.map((trap, i) => (
                <li key={i}>• {trap}</li>
              ))}
            </ul>
          </div>

          <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 dark:border-emerald-900/60 dark:bg-emerald-950/25">
            <h3 className="font-mono text-xs font-bold text-[#0F5132] dark:text-emerald-400">
              Memory Hook
            </h3>
            <p className="mt-2 text-sm font-semibold text-[#14171A] dark:text-emerald-100">
              {topic.phase1.memoryHook}
            </p>
          </div>
        </div>
      </section>

      {/* PHASE 2: 4-Tier Adaptive Practice Ladder */}
      <section className="rounded-2xl border border-[#E6E4DD] bg-white p-6 sm:p-7 space-y-5 dark:border-[#262C36] dark:bg-[#161B22]">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-mono text-xs font-semibold text-[#0F5132] dark:text-emerald-400">
              Phase 2 · 4-Tier Practice Ladder
            </p>
            <h2 className="font-display text-xl font-semibold text-[#14171A] dark:text-[#F0F3F6]">
              {topicAttemptedCount}/{topicQuestions.length} Attempted · Mastery {tp?.mastery ?? 0}%
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {nextRecommendedQ && (
              <button
                type="button"
                onClick={() =>
                  onLaunchQuestion(
                    nextRecommendedQ,
                    nextRecommendedQ.section === 'A' ? (selectedTier === 1 ? 1 : 2) : 3
                  )
                }
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#0F5132] px-4 py-2.5 text-xs font-semibold text-white hover:bg-[#0B3D26] dark:bg-emerald-600 dark:hover:bg-emerald-500"
              >
                <Play className="h-3.5 w-3.5" />
                Practice {nextRecommendedQ.id} →
              </button>
            )}
            <button
              type="button"
              onClick={handleLaunchTier4Variant}
              className="inline-flex items-center gap-2 rounded-lg bg-[#14171A] px-4 py-2.5 text-xs font-semibold text-white hover:bg-neutral-800 dark:border dark:border-[#303846] dark:bg-[#1C222B] dark:hover:bg-[#242C38]"
            >
              <Sparkles className="h-3.5 w-3.5 text-amber-300" />
              Launch Tier-4 Trap Variant
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { tier: 1 as const, label: 'Tier 1 · Foundation', desc: `Single-rule Sec A OTs (${tierCounts[1]})` },
            { tier: 2 as const, label: 'Tier 2 · Kit Sec A', desc: `Full Sec A OTs (${tierCounts[2]})` },
            { tier: 3 as const, label: 'Tier 3 · Kit Sec B/C', desc: `Cases & CRs (${tierCounts[3]})` },
            { tier: 4 as const, label: 'Tier 4 · Trap Variant', desc: 'FA25 trap-planted drill' },
          ].map((item) => {
            const active = selectedTier === item.tier;
            const isUnlocked = item.tier <= unlockedTier;
            return (
              <button
                key={item.tier}
                type="button"
                onClick={() => setSelectedTier(item.tier)}
                className={`rounded-xl border p-4 text-left transition-colors ${
                  active
                    ? 'border-[#0F5132] bg-emerald-50/70 dark:border-emerald-500 dark:bg-emerald-950/30'
                    : 'border-[#E6E4DD] bg-[#FAF9F6] hover:bg-[#EFECE4] dark:border-[#262C36] dark:bg-[#12161D] dark:hover:bg-[#1C222B]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#14171A] dark:text-[#F0F3F6]">{item.label}</span>
                  {isUnlocked ? (
                    <Unlock className="h-3.5 w-3.5 text-[#0F5132] dark:text-emerald-400" aria-label="Tier mastered" />
                  ) : (
                    <Lock className="h-3.5 w-3.5 text-neutral-400" aria-label="Recommended after earlier tier (open for practice)" />
                  )}
                </div>
                <p className="mt-1 font-mono text-xs text-neutral-600 dark:text-neutral-400">{item.desc}</p>
              </button>
            );
          })}
        </div>

        {selectedTier === 4 ? (
          <div className="flex flex-col gap-3 rounded-xl border border-[#E6E4DD] bg-[#FAF9F6] p-5 sm:flex-row sm:items-center sm:justify-between dark:border-[#262C36] dark:bg-[#12161D]">
            <div>
              <p className="text-sm font-bold text-[#14171A] dark:text-[#F0F3F6]">
                Mastercoach Trap-Planted Variant Engine
              </p>
              <p className="mt-0.5 text-xs text-neutral-600 dark:text-neutral-400">
                Generates fresh FA25 scenarios planting RDE2, partial fuel, net Gift Aid, CT marginal relief, CGT 5/3 chattels, IHT 25% CLT, and VAT FRS inclusive traps.
              </p>
            </div>
            <button
              type="button"
              onClick={handleLaunchTier4Variant}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-[#0F5132] px-4 py-2.5 text-xs font-semibold text-white hover:bg-[#0B3D26] dark:bg-emerald-600"
            >
              Generate &amp; Drill Variant
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : tierFiltered.length === 0 ? (
          <div className="rounded-xl border border-[#E6E4DD] bg-[#FAF9F6] p-6 text-sm text-neutral-600 dark:border-[#262C36] dark:bg-[#12161D] dark:text-neutral-400">
            <Layers className="mb-2 h-5 w-5 text-neutral-400" />
            {`No standalone questions in Tier ${selectedTier} filter for Topic ${topic.id} — switch tiers or launch a Tier-4 Trap Variant.`}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-[#E6E4DD] dark:border-[#262C36]">
            <table className="min-w-full border-separate border-spacing-0 text-left text-sm">
              <thead>
                <tr className="bg-[#FAF9F6] text-xs font-semibold text-neutral-600 dark:bg-[#12161D] dark:text-neutral-400">
                  <th className="border-b border-[#EFECE4] px-4 py-3 dark:border-[#262C36]">Kit ID &amp; Title</th>
                  <th className="border-b border-[#EFECE4] px-4 py-3 dark:border-[#262C36]">Section</th>
                  <th className="border-b border-[#EFECE4] px-4 py-3 dark:border-[#262C36]">Type</th>
                  <th className="border-b border-[#EFECE4] px-4 py-3 dark:border-[#262C36]">Marks &amp; Pace</th>
                  <th className="border-b border-[#EFECE4] px-4 py-3 dark:border-[#262C36]">Citation</th>
                  <th className="border-b border-[#EFECE4] px-4 py-3 dark:border-[#262C36]">Last</th>
                  <th className="border-b border-[#EFECE4] px-4 py-3 text-right dark:border-[#262C36]">Action</th>
                </tr>
              </thead>
              <tbody className="[&>tr:not(:first-child)>td]:border-t [&>tr:not(:first-child)>td]:border-[#EFECE4] dark:[&>tr:not(:first-child)>td]:border-[#262C36]">
                {tierFiltered.map((q) => {
                  const last = attemptCountByQ.get(q.id);
                  return (
                    <tr key={q.id} className="tax-study-row group">
                      <td className="px-4 py-3 font-medium text-[#14171A] dark:text-[#F0F3F6]">
                        <span className="font-mono text-xs font-bold text-[#0F5132] dark:text-emerald-400 mr-2">
                          {q.id}
                        </span>
                        {q.title.replace(/^KIT\s+\w+\s*/, '')}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-neutral-600 dark:text-neutral-300">
                        Sec {q.section}
                      </td>
                      <td className="px-4 py-3 text-xs text-neutral-600 dark:text-neutral-300 whitespace-nowrap">
                        {formatInteractionLabel(q.interaction)}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs font-semibold text-[#14171A] dark:text-[#F0F3F6] tabular-nums">
                        {q.marks}m ({Math.round(q.marks * 1.8)}m)
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-neutral-500 dark:text-neutral-400">
                        {q.kit_page}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs font-semibold tabular-nums">
                        {last ? `${last.scored}/${last.avail}` : '—'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => onLaunchQuestion(q, selectedTier)}
                          className="rounded-lg bg-[#0F5132] px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#0B3D26] dark:bg-emerald-600 dark:hover:bg-emerald-500"
                        >
                          Practice →
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};
