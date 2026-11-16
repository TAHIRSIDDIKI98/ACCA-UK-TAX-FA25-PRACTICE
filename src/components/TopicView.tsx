import React, { useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Layers, Lock, Sparkles, Unlock } from 'lucide-react';
import { TOPICS } from '../data/taxReference';
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

  const topic: TopicDefinition =
    TOPICS.find((t) => t.id === topicId) ?? TOPICS[4]; // default Topic 5 Employment Income
  const tp = appState.topicProgress[topic.id];
  const unlockedTier = tp?.tierUnlocked ?? 1;

  const topicQuestions = useMemo(() => {
    return allQuestions.filter((q) => q.topic_id === topic.id);
  }, [allQuestions, topic.id]);

  const tierFiltered = useMemo(() => {
    if (selectedTier === 1) {
      return topicQuestions.filter((q) => q.section === 'A').slice(0, 6);
    }
    if (selectedTier === 2) {
      return topicQuestions.filter((q) => q.section === 'A');
    }
    if (selectedTier === 3) {
      return topicQuestions.filter((q) => q.section === 'B' || q.section === 'C');
    }
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

  return (
    <div className="space-y-6">
      {/* Topic Selector Header */}
      <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <button
            type="button"
            onClick={onBackToOverview}
            className="mt-0.5 inline-flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Map
          </button>
          <div>
            <p className="font-mono text-xs font-semibold text-blue-700">
              Topic {topic.id} of 24 · {topic.stChapter.toUpperCase()} · {topic.syllabusArea} · {topic.kitRange}
            </p>
            <h1 className="font-display text-xl font-bold text-slate-900">
              {topic.title}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <select
            aria-label="Switch syllabus topic"
            value={topic.id}
            onChange={(e) => onSelectTopic(Number(e.target.value))}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800"
          >
            {TOPICS.map((t) => (
              <option key={t.id} value={t.id}>
                {t.id}. {t.title} ({t.kitRange})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* PHASE 1: Quick Revision Card ("Exam Snapshot") */}
      <section className="rounded-lg border border-slate-200 bg-white p-5 sm:p-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
          <div>
            <span className="font-mono text-xs font-bold uppercase tracking-wider text-blue-700">
              Phase 1 · Quick Revision Card
            </span>
            <h2 className="font-display text-lg font-bold text-slate-900">
              Exam Snapshot — {topic.title}
            </h2>
          </div>
          <span className="rounded border border-slate-200 bg-slate-50 px-2.5 py-1 font-mono text-xs font-semibold text-slate-700">
            Examined {topic.phase1.frequencyCount}/8 sittings · {topic.phase1.kitRefs}
          </span>
        </div>

        <p className="rounded-md border border-blue-100 bg-blue-50/60 px-4 py-2.5 text-sm text-slate-800">
          <span className="font-semibold text-blue-900">How it is examined: </span>
          {topic.phase1.howExamined}
        </p>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {/* Core Rules */}
          <div className="space-y-3">
            <h3 className="font-display text-sm font-bold text-slate-900">
              Core FA25 Rules & Tax Law
            </h3>
            <ul className="space-y-2 text-sm text-slate-700">
              {topic.phase1.coreRules.map((rule, i) => (
                <li key={i} className="flex gap-2">
                  <span className="font-mono text-xs font-bold text-blue-700 mt-0.5">
                    0{i + 1}
                  </span>
                  <span>{rule}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Proforma & Key Numbers */}
          <div className="space-y-4">
            <div className="overflow-hidden rounded-md border border-slate-200">
              <div className="border-b border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-bold text-slate-900">
                {topic.phase1.proformaTitle}
              </div>
              <div className="bg-slate-900 px-3.5 py-3 font-mono text-xs leading-relaxed text-slate-100">
                {topic.phase1.proformaLines.map((line, i) => (
                  <div key={i}>{line}</div>
                ))}
              </div>
            </div>

            <div className="overflow-hidden rounded-md border border-slate-200">
              <div className="border-b border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-bold text-slate-900">
                FA25 Numbers & Thresholds
              </div>
              <div className="divide-y divide-slate-100">
                {topic.phase1.keyNumbers.map((kn, i) => (
                  <div key={i} className="flex items-center justify-between gap-2 px-3.5 py-2 text-xs">
                    <div>
                      <span className="font-semibold text-slate-800">{kn.label}</span>
                      {kn.note && <p className="text-slate-500">{kn.note}</p>}
                    </div>
                    <span className="font-mono font-bold text-blue-800 tabular-nums">
                      {kn.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Top Traps + Memory Hook */}
        <div className="grid grid-cols-1 gap-4 border-t border-slate-200 pt-4 lg:grid-cols-3">
          <div className="rounded-md border border-red-200 bg-red-50/50 p-3.5 lg:col-span-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-red-900">
              Examiner’s Top Traps in This Topic
            </h3>
            <ul className="mt-2 space-y-1.5 text-xs text-red-950">
              {topic.phase1.topTraps.map((trap, i) => (
                <li key={i}>• {trap}</li>
              ))}
            </ul>
          </div>

          <div className="rounded-md border border-teal-200 bg-teal-50/50 p-3.5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-teal-900">
              Memory Hook
            </h3>
            <p className="mt-2 text-sm font-semibold text-teal-950">
              {topic.phase1.memoryHook}
            </p>
          </div>
        </div>
      </section>

      {/* PHASE 2: 4-Tier Adaptive Practice Ladder */}
      <section className="rounded-lg border border-slate-200 bg-white p-5 sm:p-6 space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <span className="font-mono text-xs font-bold uppercase tracking-wider text-blue-700">
              Phase 2 · Practice Ladder
            </span>
            <h2 className="font-display text-lg font-bold text-slate-900">
              Adaptive Practice Tiers ({topicAttemptedCount}/{topicQuestions.length} attempted · Mastery {tp?.mastery ?? 0}%)
            </h2>
          </div>

          <button
            type="button"
            onClick={handleLaunchTier4Variant}
            className="inline-flex items-center gap-1.5 rounded-md bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800"
          >
            <Sparkles className="h-3.5 w-3.5 text-amber-400" />
            Launch Tier-4 Trap Variant
          </button>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { tier: 1 as const, label: 'Tier 1 · Foundation', desc: 'Single-rule Section A OTs' },
            { tier: 2 as const, label: 'Tier 2 · Kit Sec A', desc: 'Full Section A OTs (2 marks each)' },
            { tier: 3 as const, label: 'Tier 3 · Kit Sec B/C', desc: '10m OT cases & 10–15m CRs' },
            { tier: 4 as const, label: 'Tier 4 · Trap Variant', desc: 'Mastercoach trap-planted drill' },
          ].map((item) => {
            const active = selectedTier === item.tier;
            const isUnlocked = item.tier <= unlockedTier;
            return (
              <button
                key={item.tier}
                type="button"
                onClick={() => setSelectedTier(item.tier)}
                className={`rounded-md border p-3.5 text-left transition-colors ${
                  active
                    ? 'border-blue-600 bg-blue-50/70'
                    : 'border-slate-200 bg-white hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900">{item.label}</span>
                  {isUnlocked ? (
                    <Unlock className="h-3.5 w-3.5 text-teal-700" />
                  ) : (
                    <Lock className="h-3.5 w-3.5 text-slate-400" />
                  )}
                </div>
                <p className="mt-1 text-xs text-slate-600">{item.desc}</p>
              </button>
            );
          })}
        </div>

        {/* Question Table for Selected Tier */}
        {selectedTier === 4 ? (
          <div className="rounded-md border border-slate-200 bg-slate-50 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-slate-900">
                Mastercoach Trap-Planted Variant Engine
              </p>
              <p className="text-xs text-slate-600">
                Generates verified FA25 scenarios planting RDE2, partial fuel, net Gift Aid, CT marginal relief, CGT 5/3 chattels, IHT 25% CLT, and VAT FRS inclusive traps.
              </p>
            </div>
            <button
              type="button"
              onClick={handleLaunchTier4Variant}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-blue-700 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-800"
            >
              Generate & Drill Variant
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : tierFiltered.length === 0 ? (
          <div className="rounded-md border border-slate-200 bg-slate-50 p-5 text-sm text-slate-600">
            <Layers className="mb-2 h-5 w-5 text-slate-400" />
            {`No standalone questions in Tier ${selectedTier} filter for Topic ${topic.id} — switch tiers or launch a Tier-4 Trap Variant.`}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-md border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
              <thead>
                <tr className="bg-slate-50 text-xs font-semibold text-slate-600">
                  <th className="px-3.5 py-2.5">Kit ID & Name</th>
                  <th className="px-3.5 py-2.5">Section</th>
                  <th className="px-3.5 py-2.5">Type</th>
                  <th className="px-3.5 py-2.5">Marks</th>
                  <th className="px-3.5 py-2.5">Citation</th>
                  <th className="px-3.5 py-2.5">Last Score</th>
                  <th className="px-3.5 py-2.5 text-right">Drill</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {tierFiltered.map((q) => {
                  const last = attemptCountByQ.get(q.id);
                  return (
                    <tr key={q.id} className="hover:bg-slate-50">
                      <td className="px-3.5 py-2.5 font-medium text-slate-900">
                        <span className="font-mono text-xs font-bold text-blue-700 mr-1.5">
                          {q.id}
                        </span>
                        {q.title.replace(/^KIT\s+\w+\s*/, '')}
                      </td>
                      <td className="px-3.5 py-2.5 font-mono text-xs text-slate-700">
                        Sec {q.section}
                      </td>
                      <td className="px-3.5 py-2.5 text-xs uppercase text-slate-600">
                        {q.interaction.replace('_', ' ')}
                      </td>
                      <td className="px-3.5 py-2.5 font-mono text-xs font-semibold text-slate-800 tabular-nums">
                        {q.marks}m ({Math.round(q.marks * 1.8)}m)
                      </td>
                      <td className="px-3.5 py-2.5 font-mono text-xs text-slate-500">
                        {q.kit_page}
                      </td>
                      <td className="px-3.5 py-2.5 font-mono text-xs font-semibold tabular-nums">
                        {last ? `${last.scored}/${last.avail}` : '—'}
                      </td>
                      <td className="px-3.5 py-2.5 text-right">
                        <button
                          type="button"
                          onClick={() => onLaunchQuestion(q, selectedTier)}
                          className="rounded-md bg-blue-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-800"
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
