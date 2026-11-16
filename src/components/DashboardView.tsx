import React, { useMemo, useState } from 'react';
import {
  ArrowRight,
  Calendar,
  CheckCircle2,
  Flame,
  ShieldCheck,
  Target,
} from 'lucide-react';
import { EXAM_CARD, KIT_INDEX_SUMMARY, TOPICS } from '../data/taxReference';
import {
  computeExamPredictions,
  computeFreeMarksHarvestPercent,
  computeOverallReadiness,
  computeStudyPlanDays,
  computeTaxHeadSummaries,
  computeTrapImmunityPercent,
  getDueMistakes,
  getRecommendedNextAction,
} from '../engine/mastery';
import type { AppState, RagStatus } from '../types/tx';
import { TrapLedgerDashboard } from './TrapLedgerDashboard';

interface DashboardViewProps {
  appState: AppState;
  totalQuestionsLoaded: number;
  specimenItemCount: number;
  onSelectTopic: (topicId: number) => void;
  onLaunchSpecimenMock: () => void;
  onOpenDueMistakes: () => void;
  onOpenTrapLedgerTab: () => void;
  onLaunchMicroDrill: (trapCategory: string) => void;
  onOpenQuestionById: (qId: string) => void;
  onOpenMockTab: () => void;
}

function getRagStatusCopy(rag: RagStatus): { label: string; colorClass: string } {
  switch (rag) {
    case 'green':
      return { label: 'Pass Ready', colorClass: 'text-[#0F5132] dark:text-emerald-400' };
    case 'amber':
      return { label: 'Developing', colorClass: 'text-amber-700 dark:text-amber-400' };
    case 'red':
      return { label: 'Needs Drill', colorClass: 'text-red-700 dark:text-red-400' };
    default:
      return { label: 'Unstarted', colorClass: 'text-neutral-500 dark:text-neutral-400' };
  }
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  appState,
  totalQuestionsLoaded,
  specimenItemCount,
  onSelectTopic,
  onLaunchSpecimenMock,
  onOpenDueMistakes,
  onOpenTrapLedgerTab,
  onLaunchMicroDrill,
  onOpenQuestionById,
  onOpenMockTab,
}) => {
  const [showBattleCard, setShowBattleCard] = useState(false);
  const [expandedArea, setExpandedArea] = useState<string | null>(null);
  const [showCoverageTable, setShowCoverageTable] = useState(false);

  const readiness = useMemo(() => computeOverallReadiness(appState), [appState]);
  const trapImmunity = useMemo(() => computeTrapImmunityPercent(appState), [appState]);
  const freeMarksHarvest = useMemo(() => computeFreeMarksHarvestPercent(appState), [appState]);
  const dueMistakes = useMemo(() => getDueMistakes(appState.mistakes), [appState.mistakes]);
  const predictions = useMemo(() => computeExamPredictions(appState), [appState]);
  const planInfo = useMemo(() => computeStudyPlanDays(appState.profile, appState), [appState]);
  const taxHeadSummaries = useMemo(() => computeTaxHeadSummaries(appState), [appState]);
  const recommended = useMemo(() => getRecommendedNextAction(appState), [appState]);

  const handleRunRecommended = () => {
    if (recommended.kind === 'micro_drill' && recommended.trapCategory) {
      onLaunchMicroDrill(recommended.trapCategory);
    } else if (recommended.kind === 'srs' && recommended.questionId) {
      onOpenQuestionById(recommended.questionId);
    } else if (recommended.kind === 'specimen_mock') {
      onLaunchSpecimenMock();
    } else if (recommended.topicId) {
      onSelectTopic(recommended.topicId);
    }
  };

  return (
    <div className="space-y-8">
      {/* 1. Focal Anchor Hero: Today's Study Mission + Unified Readiness Grid */}
      <section className="grid grid-cols-1 items-stretch gap-5 lg:grid-cols-12">
        {/* Left: Primary Study Mission */}
        <div className="flex flex-col justify-between rounded-2xl border border-[#E6E4DD] bg-white p-6 sm:p-7 lg:col-span-7 dark:border-[#262C36] dark:bg-[#161B22]">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400">
              <span className="font-mono font-semibold text-[#0F5132] dark:text-emerald-400">
                {EXAM_CARD.financeAct}
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">{planInfo.daysUntilExam} days to sitting</span>
              <span aria-hidden="true">·</span>
              <span>{recommended.kicker}</span>
            </div>

            <h1 className="mt-3 font-display text-2xl sm:text-3xl font-semibold tracking-tight text-[#14171A] dark:text-[#F0F3F6]">
              {recommended.title}
            </h1>
            <p className="mt-2.5 max-w-2xl text-sm leading-relaxed text-neutral-600 dark:text-neutral-300">
              {recommended.detail}
            </p>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3 pt-4 border-t border-[#EFECE4] dark:border-[#262C36]">
            <button
              type="button"
              onClick={handleRunRecommended}
              className="inline-flex items-center gap-2 rounded-lg bg-[#0F5132] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#0B3D26] dark:bg-emerald-600 dark:hover:bg-emerald-500"
            >
              {recommended.ctaLabel}
              <ArrowRight className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={onLaunchSpecimenMock}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#D8D4C8] bg-[#FAF9F6] px-3.5 py-2.5 text-xs font-semibold text-[#14171A] hover:bg-[#EFECE4] dark:border-[#303846] dark:bg-[#1C222B] dark:text-[#F0F3F6] dark:hover:bg-[#242C38]"
            >
              Sit 100m Specimen CBE
            </button>
            <button
              type="button"
              aria-expanded={showBattleCard}
              onClick={() => setShowBattleCard((v) => !v)}
              className="rounded-lg px-3 py-2 text-xs font-semibold text-neutral-600 hover:bg-[#EFECE4] hover:text-[#14171A] dark:text-neutral-300 dark:hover:bg-[#1C222B]"
            >
              {showBattleCard ? 'Hide Exam Battle Card' : 'Exam-Day Battle Card'}
            </button>
          </div>
        </div>

        {/* Right: Unified 2x2 Readiness Telemetry Matrix (No nested floating boxes) */}
        <div className="grid grid-cols-2 divide-x divide-y divide-[#EFECE4] rounded-2xl border border-[#E6E4DD] bg-white lg:col-span-5 dark:divide-[#262C36] dark:border-[#262C36] dark:bg-[#161B22]">
          <div className="p-5 flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs font-semibold text-neutral-500 dark:text-neutral-400">
              <span>Readiness</span>
              <Target className="h-4 w-4 text-[#0F5132] dark:text-emerald-400" />
            </div>
            <p className="mt-3 font-mono text-3xl font-bold text-[#14171A] dark:text-[#F0F3F6] tabular-nums">
              {readiness}%
            </p>
            <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
              Pass 50% · Target 60%+
            </p>
          </div>

          <div className="p-5 flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs font-semibold text-neutral-500 dark:text-neutral-400">
              <span>Trap Immunity</span>
              <ShieldCheck className="h-4 w-4 text-[#1E3A5F] dark:text-sky-400" />
            </div>
            <p className="mt-3 font-mono text-3xl font-bold text-[#14171A] dark:text-[#F0F3F6] tabular-nums">
              {trapImmunity}%
            </p>
            <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
              {Object.keys(appState.trapLedger).length} trap categories
            </p>
          </div>

          <div className="p-5 flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs font-semibold text-neutral-500 dark:text-neutral-400">
              <span>Free Marks</span>
              <CheckCircle2 className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            </div>
            <p className="mt-3 font-mono text-3xl font-bold text-[#14171A] dark:text-[#F0F3F6] tabular-nums">
              {freeMarksHarvest}%
            </p>
            <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
              Zeros, headings &amp; W1
            </p>
          </div>

          <div className="p-5 flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs font-semibold text-neutral-500 dark:text-neutral-400">
              <span>Streak &amp; SRS</span>
              <Flame className="h-4 w-4 text-orange-600 dark:text-orange-400" />
            </div>
            <p className="mt-3 font-mono text-3xl font-bold text-[#14171A] dark:text-[#F0F3F6] tabular-nums">
              {appState.streakDays}d · {dueMistakes.length}
            </p>
            <button
              type="button"
              onClick={onOpenDueMistakes}
              className="mt-1 text-left text-xs font-semibold text-[#0F5132] hover:underline dark:text-emerald-400"
            >
              {dueMistakes.length > 0 ? 'Clear SRS queue →' : 'Open Mistake Bank →'}
            </button>
          </div>
        </div>
      </section>

      {/* Collapsible Exam-Day Battle Card */}
      {showBattleCard && (
        <section className="rounded-2xl border border-amber-200 bg-amber-50/70 p-5 dark:border-amber-900/60 dark:bg-amber-950/20">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-200/80 pb-3 dark:border-amber-900/50">
            <h2 className="font-display text-base font-semibold text-[#14171A] dark:text-[#F0F3F6]">
              {planInfo.isCountdown
                ? `Final ${planInfo.daysUntilExam}-Day Exam Battle Card (8 December 2026)`
                : 'Exam-Day Battle Card (3 Hours 10 Mins CBE)'}
            </h2>
            <span className="font-mono text-xs font-semibold text-amber-900 dark:text-amber-300 tabular-nums">
              Order: {appState.profile.preferredSectionOrder} · 1.8 min/mark cap
            </span>
          </div>
          <div className="mt-3.5 grid grid-cols-1 gap-4 text-xs text-neutral-800 md:grid-cols-3 dark:text-neutral-200">
            <div>
              <p className="font-bold text-[#14171A] dark:text-white">Section Timing Splits</p>
              <p className="mt-1">Sec A (30m): 54 min — flag &amp; move on at 3.5m.</p>
              <p>Sec B (30m): 54 min — 18 min per 5-OT case.</p>
              <p>Sec C (40m): 72 min — 18m (10m) &amp; 27m (15m CR).</p>
            </div>
            <div>
              <p className="font-bold text-[#14171A] dark:text-white">Free-Marks Protocol</p>
              <p className="mt-1">1. Show &ldquo;0&rdquo; for every exempt item.</p>
              <p>2. Label (W1), (W2) inside marked response (not Scratch Pad).</p>
              <p>3. Deduct PAYE at foot; write full 4-digit years.</p>
            </div>
            <div>
              <p className="font-bold text-[#14171A] dark:text-white">Active Focus Watchlist</p>
              <p className="mt-1">
                #1 Yield: {predictions[0]?.title} ({predictions[0]?.frequencyOutOf8}/8 sittings)
              </p>
              <p>
                Due SRS Reviews: {dueMistakes.length} items · Never leave any OT blank.
              </p>
            </div>
          </div>
        </section>
      )}

      {/* 2. 6-Tax-Head Mastery Overview (Clean visual map replacing giant 24-row spreadsheet) */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="font-display text-xl font-semibold text-[#14171A] dark:text-[#F0F3F6]">
              Syllabus Mastery by Tax Head
            </h2>
            <p className="text-xs text-neutral-600 dark:text-neutral-400">
              {totalQuestionsLoaded} Kaplan Exam Kit questions + {specimenItemCount} Specimen CBE items organized across the 6 ACCA TX-UK syllabus heads.
            </p>
          </div>
          <button
            type="button"
            onClick={onOpenMockTab}
            className="text-xs font-semibold text-[#0F5132] hover:underline dark:text-emerald-400"
          >
            Build Custom Area Mock →
          </button>
        </div>

        <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-2 lg:grid-cols-3">
          {taxHeadSummaries.map((head) => {
            const isExpanded = expandedArea === head.area;
            const areaTopics = TOPICS.filter((t) => t.syllabusArea === head.area);
            return (
              <div
                key={head.area}
                className="flex flex-col justify-between rounded-2xl border border-[#E6E4DD] bg-white p-5 dark:border-[#262C36] dark:bg-[#161B22]"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-display text-base font-semibold text-[#14171A] dark:text-[#F0F3F6]">
                        {head.shortLabel}
                      </h3>
                      <p className="mt-0.5 font-mono text-[11px] text-neutral-500 dark:text-neutral-400">
                        {head.topicsCount} {head.topicsCount === 1 ? 'topic' : 'topics'} · {head.questionCount} Kit Qs
                      </p>
                    </div>
                    <span className="font-mono text-lg font-bold text-[#0F5132] dark:text-emerald-400 tabular-nums">
                      {head.averageMastery}%
                    </span>
                  </div>

                  {/* Clean progress rule */}
                  <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-[#EFECE4] dark:bg-[#262C36]">
                    <div
                      className="h-full bg-[#0F5132] dark:bg-emerald-500 transition-all"
                      style={{ width: `${Math.max(3, head.averageMastery)}%` }}
                    />
                  </div>

                  <div className="mt-3 flex items-center justify-between text-xs text-neutral-600 dark:text-neutral-400">
                    <span>
                      {head.masteredTopics}/{head.topicsCount} green
                    </span>
                    <button
                      type="button"
                      aria-expanded={isExpanded}
                      onClick={() => setExpandedArea(isExpanded ? null : head.area)}
                      className="font-semibold text-[#14171A] hover:underline dark:text-neutral-200"
                    >
                      {isExpanded ? 'Hide topics' : `Show ${head.topicsCount} ${head.topicsCount === 1 ? 'topic' : 'topics'}`}
                    </button>
                  </div>

                  {isExpanded && (
                    <div className="mt-3 divide-y divide-[#EFECE4] border-t border-[#EFECE4] pt-2 dark:divide-[#262C36] dark:border-[#262C36]">
                      {areaTopics.map((t) => {
                        const tp = appState.topicProgress[t.id];
                        const status = getRagStatusCopy(tp?.rag ?? 'unstarted');
                        return (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => onSelectTopic(t.id)}
                            className="flex w-full items-center justify-between gap-2 py-2 text-left text-xs hover:bg-[#FAF9F6] dark:hover:bg-[#1C222B] px-1 rounded"
                          >
                            <span className="truncate font-medium text-[#14171A] dark:text-[#F0F3F6]">
                              <span className="font-mono text-neutral-400 mr-1.5">
                                {String(t.id).padStart(2, '0')}
                              </span>
                              {t.title}
                            </span>
                            <span className={`shrink-0 font-mono text-[11px] font-semibold tabular-nums ${status.colorClass}`}>
                              {tp?.attempts ? `${tp.mastery}%` : status.label}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="mt-4 pt-3 border-t border-[#EFECE4] flex items-center justify-between gap-2 dark:border-[#262C36]">
                  <span className="truncate text-[11px] text-neutral-500 dark:text-neutral-400">
                    Next: {head.weakestTopicTitle}
                  </span>
                  <button
                    type="button"
                    onClick={() => onSelectTopic(head.weakestTopicId)}
                    className="shrink-0 text-xs font-semibold text-[#0F5132] hover:underline dark:text-emerald-400"
                  >
                    Revise →
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 3. Personal Trap Ledger Summary */}
      <TrapLedgerDashboard
        appState={appState}
        compact
        onLaunchMicroDrill={onLaunchMicroDrill}
        onOpenQuestionById={onOpenQuestionById}
        onOpenFullTrapBank={onOpenTrapLedgerTab}
      />

      {/* 4. High-Yield Predictor & Countdown Plan + Key Sec C CR Launches */}
      <section className="grid grid-cols-1 items-stretch gap-5 lg:grid-cols-2">
        <div className="flex flex-col rounded-2xl border border-[#E6E4DD] bg-white p-5 sm:p-6 dark:border-[#262C36] dark:bg-[#161B22]">
          <div className="flex items-center justify-between border-b border-[#EFECE4] pb-3 dark:border-[#262C36]">
            <h2 className="font-display text-lg font-semibold text-[#14171A] dark:text-[#F0F3F6]">
              High-Yield Priority Predictor
            </h2>
            <span className="font-mono text-xs text-neutral-500 dark:text-neutral-400">
              Frequency × Gap
            </span>
          </div>
          <div className="mt-2 divide-y divide-[#EFECE4] flex-1 dark:divide-[#262C36]">
            {predictions.slice(0, 5).map((item) => {
              const ragStatus = getRagStatusCopy(item.rag);
              return (
                <div
                  key={item.topicId}
                  className="flex items-center justify-between gap-3 py-3"
                >
                  <div className="min-w-0">
                    <button
                      type="button"
                      onClick={() => onSelectTopic(item.topicId)}
                      className="text-left text-sm font-semibold text-[#14171A] hover:text-[#0F5132] dark:text-[#F0F3F6] dark:hover:text-emerald-400"
                    >
                      {item.topicId}. {item.title}
                    </button>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">{item.reason}</p>
                  </div>
                  <span className={`shrink-0 whitespace-nowrap font-mono text-xs font-semibold ${ragStatus.colorClass}`}>
                    {ragStatus.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col justify-between rounded-2xl border border-[#E6E4DD] bg-white p-5 sm:p-6 dark:border-[#262C36] dark:bg-[#161B22]">
          <div>
            <div className="flex items-center justify-between border-b border-[#EFECE4] pb-3 dark:border-[#262C36]">
              <h2 className="font-display text-lg font-semibold text-[#14171A] dark:text-[#F0F3F6]">
                Countdown Study Roadmap
              </h2>
              <span className="inline-flex items-center gap-1.5 font-mono text-xs font-semibold text-neutral-600 tabular-nums dark:text-neutral-300">
                <Calendar className="h-3.5 w-3.5 text-[#0F5132] dark:text-emerald-400" />
                {planInfo.daysUntilExam}d to {appState.profile.examDate}
              </span>
            </div>
            <div className="mt-3 divide-y divide-[#EFECE4] dark:divide-[#262C36]">
              {planInfo.blocks.map((b) => (
                <div key={b.phase} className="py-3 first:pt-1 last:pb-1">
                  <p className="text-xs font-bold text-[#14171A] dark:text-[#F0F3F6]">{b.phase}</p>
                  <p className="mt-0.5 text-xs text-neutral-600 leading-relaxed dark:text-neutral-400">
                    {b.detail}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-[#EFECE4] pt-4 dark:border-[#262C36]">
            <span className="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400 mr-1">
              Key Section C CRs:
            </span>
            {[
              { id: 'Q101', label: 'Q101 Sheldon (15m)' },
              { id: 'Q256', label: 'Q256 CT CR (15m)' },
              { id: 'Q175', label: 'Q175 CGT CR (10m)' },
              { id: 'Q210', label: 'Q210 IHT CR (10m)' },
              { id: 'SPEC-Q31', label: 'Spec Q31 Sarah (10m)' },
            ].map((cr) => (
              <button
                key={cr.id}
                type="button"
                onClick={() => onOpenQuestionById(cr.id)}
                className="rounded-lg border border-[#D8D4C8] bg-[#FAF9F6] px-2.5 py-1 text-xs font-semibold text-[#14171A] hover:border-[#0F5132] hover:bg-emerald-50/40 dark:border-[#303846] dark:bg-[#1C222B] dark:text-neutral-200 dark:hover:border-emerald-500"
              >
                {cr.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Quiet Collapsible Kit Coverage Appendix (keeps Overview decluttered) */}
      <section className="rounded-2xl border border-[#E6E4DD] bg-white px-5 py-4 dark:border-[#262C36] dark:bg-[#161B22]">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-neutral-600 dark:text-neutral-400">
            <strong className="text-[#14171A] dark:text-[#F0F3F6]">Kaplan FA25 Bank Verified:</strong>{' '}
            306 Exam Kit questions (Q1–Q306) + 21 Official Specimen items loaded and audited.
          </p>
          <button
            type="button"
            aria-expanded={showCoverageTable}
            onClick={() => setShowCoverageTable((v) => !v)}
            className="text-xs font-semibold text-[#0F5132] hover:underline dark:text-emerald-400"
          >
            {showCoverageTable ? 'Hide Coverage Index' : 'View Kit Coverage Index'}
          </button>
        </div>

        {showCoverageTable && (
          <div className="mt-4 overflow-x-auto border-t border-[#EFECE4] pt-4 dark:border-[#262C36]">
            <table className="min-w-full divide-y divide-[#EFECE4] text-xs dark:divide-[#262C36]">
              <thead>
                <tr className="text-left font-semibold text-neutral-500 dark:text-neutral-400">
                  <th className="py-2 pr-4">Syllabus Block</th>
                  <th className="py-2 pr-4">Sec A / B / C</th>
                  <th className="py-2 pr-4">Kit Pages</th>
                  <th className="py-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EFECE4] dark:divide-[#262C36]">
                {KIT_INDEX_SUMMARY.map((row) => (
                  <tr key={row.area}>
                    <td className="py-2 pr-4 font-semibold text-[#14171A] dark:text-[#F0F3F6]">
                      {row.area}
                    </td>
                    <td className="py-2 pr-4 font-mono text-neutral-600 dark:text-neutral-300 tabular-nums">
                      {row.secACount} / {row.secBCount} / {row.secCCount} ({row.total})
                    </td>
                    <td className="py-2 pr-4 font-mono text-neutral-500 dark:text-neutral-400">
                      Q {row.qPages} · A {row.aPages}
                    </td>
                    <td className="py-2 font-semibold text-[#0F5132] dark:text-emerald-400">
                      {row.loadedInBank ? 'Loaded in Bank' : 'On-disk PDF'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};
