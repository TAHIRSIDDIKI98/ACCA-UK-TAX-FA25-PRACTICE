import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Calendar,
  CheckCircle2,
  FileText,
  Flame,
  ShieldCheck,
  Target,
  Upload,
} from 'lucide-react';
import {
  EXAM_CARD,
  KIT_INDEX_SUMMARY,
  TOPICS,
} from '../data/taxReference';
import {
  computeExamPredictions,
  computeFreeMarksHarvestPercent,
  computeOverallReadiness,
  computeStudyPlanDays,
  computeTrapImmunityPercent,
  getDueMistakes,
} from '../engine/mastery';
import type { AppState, RagStatus, UserProfile } from '../types/tx';
import { TrapLedgerDashboard } from './TrapLedgerDashboard';

interface DashboardViewProps {
  appState: AppState;
  totalQuestionsLoaded: number;
  specimenItemCount: number;
  onSaveProfile: (profile: UserProfile) => void;
  onSelectTopic: (topicId: number) => void;
  onLaunchSpecimenMock: () => void;
  onOpenDueMistakes: () => void;
  onOpenTrapLedgerTab: () => void;
  onLaunchMicroDrill: (trapCategory: string) => void;
  onOpenQuestionById: (qId: string) => void;
  onStudyTextUploaded: (name: string) => void;
}

function getRagLabel(rag: RagStatus): { text: string; textClass: string } {
  switch (rag) {
    case 'green':
      return {
        text: 'Green · Pass Ready',
        textClass: 'text-teal-700',
      };
    case 'amber':
      return {
        text: 'Amber · Developing',
        textClass: 'text-amber-700',
      };
    case 'red':
      return {
        text: 'Red · Needs Drill',
        textClass: 'text-red-700',
      };
    default:
      return {
        text: 'Unstarted',
        textClass: 'text-slate-500',
      };
  }
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  appState,
  totalQuestionsLoaded,
  specimenItemCount,
  onSaveProfile,
  onSelectTopic,
  onLaunchSpecimenMock,
  onOpenDueMistakes,
  onOpenTrapLedgerTab,
  onLaunchMicroDrill,
  onOpenQuestionById,
  onStudyTextUploaded,
}) => {
  const [editingProfile, setEditingProfile] = useState(!appState.profile.onboarded);
  const [draftProfile, setDraftProfile] = useState<UserProfile>(appState.profile);
  const [showBattleCard, setShowBattleCard] = useState(false);
  const [areaFilter, setAreaFilter] = useState<string>('ALL');
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [kitLookupQ, setKitLookupQ] = useState('128');
  const [kitLookupResult, setKitLookupResult] = useState<string | null>(null);

  const readiness = useMemo(() => computeOverallReadiness(appState), [appState]);
  const trapImmunity = useMemo(() => computeTrapImmunityPercent(appState), [appState]);
  const freeMarksHarvest = useMemo(() => computeFreeMarksHarvestPercent(appState), [appState]);
  const dueMistakes = useMemo(() => getDueMistakes(appState.mistakes), [appState.mistakes]);
  const predictions = useMemo(() => computeExamPredictions(appState), [appState]);
  const planInfo = useMemo(
    () => computeStudyPlanDays(appState.profile, appState),
    [appState]
  );

  const filteredTopics = useMemo(() => {
    if (areaFilter === 'ALL') return TOPICS;
    return TOPICS.filter((t) => t.syllabusArea === areaFilter);
  }, [areaFilter]);

  const handleProfileSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveProfile({ ...draftProfile, onboarded: true });
    setEditingProfile(false);
  };

  const handleStudyTextFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadStatus('Reading PDF metadata...');
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const res = await fetch('/api/study-text/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fileName: file.name,
            base64Data: String(reader.result ?? ''),
          }),
        });
        const json = await res.json();
        if (json.ok) {
          onStudyTextUploaded(file.name);
          setUploadStatus(
            `Attached ${file.name} (${json.studyText.pageCount} pages).`
          );
        } else {
          setUploadStatus(json.error || 'Could not parse Study Text PDF.');
        }
      } catch {
        onStudyTextUploaded(file.name);
        setUploadStatus(`Attached locally: ${file.name}.`);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleKitLookup = async () => {
    setKitLookupResult('Searching Exam Kit PDF...');
    try {
      const res = await fetch(`/api/kit/lookup?q=${encodeURIComponent(kitLookupQ)}`);
      const data = await res.json();
      if (data.ok) {
        setKitLookupResult(
          `Kit Q${data.qNum}${data.bookPage ? ` (Kit p.${data.bookPage})` : ''}: ${data.snippet}`
        );
      } else {
        setKitLookupResult(data.error || 'Lookup failed');
      }
    } catch {
      setKitLookupResult('Lookup endpoint unavailable.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Compact Hero / Exam Header + Study Profile Onboarding */}
      <section className="rounded-lg border border-slate-200 bg-white p-5 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="font-mono text-xs font-semibold uppercase tracking-wider text-blue-700">
              {EXAM_CARD.financeAct} · {EXAM_CARD.examWindow}
            </p>
            <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-slate-900">
              {EXAM_CARD.paper}
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              {totalQuestionsLoaded} Exam Kit questions (Q1–Q306) · {specimenItemCount} Specimen CBE items (100 marks) · 1.8 min/mark budget · Target bank ≥60%
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 lg:shrink-0 lg:flex-nowrap">
            <button
              type="button"
              onClick={() => setShowBattleCard((v) => !v)}
              className="whitespace-nowrap rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50"
            >
              {showBattleCard ? 'Hide Battle Card' : 'Battle Card'}
            </button>
            <button
              type="button"
              onClick={() => setEditingProfile((v) => !v)}
              className="whitespace-nowrap rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50"
            >
              {editingProfile ? 'Close Profile' : 'Study Profile'}
            </button>
            <button
              type="button"
              onClick={onLaunchSpecimenMock}
              className="inline-flex whitespace-nowrap items-center gap-1.5 rounded-md bg-blue-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-800"
            >
              Sit Specimen Mock
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Onboarding / Study Profile Form */}
        {editingProfile && (
          <form
            onSubmit={handleProfileSubmit}
            className="mt-5 grid grid-cols-1 gap-4 rounded-md border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2 lg:grid-cols-5"
          >
            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Target Exam Date
              </label>
              <input
                type="date"
                value={draftProfile.examDate}
                onChange={(e) =>
                  setDraftProfile({ ...draftProfile, examDate: e.target.value })
                }
                className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Sitting Type
              </label>
              <select
                value={draftProfile.attemptType}
                onChange={(e) =>
                  setDraftProfile({
                    ...draftProfile,
                    attemptType: e.target.value as 'first' | 'resit',
                  })
                }
                className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-900"
              >
                <option value="first">First-time attempt</option>
                <option value="resit">Resit candidate</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Study Hours / Week
              </label>
              <input
                type="number"
                min={1}
                max={50}
                value={draftProfile.hoursPerWeek}
                onChange={(e) =>
                  setDraftProfile({
                    ...draftProfile,
                    hoursPerWeek: Number(e.target.value) || 8,
                  })
                }
                className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-900 tabular-nums"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Preferred Exam Order
              </label>
              <select
                value={draftProfile.preferredSectionOrder}
                onChange={(e) =>
                  setDraftProfile({
                    ...draftProfile,
                    preferredSectionOrder: e.target.value as 'A-B-C' | 'C-B-A' | 'B-C-A',
                  })
                }
                className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-900"
              >
                <option value="A-B-C">Section A → B → C</option>
                <option value="C-B-A">Section C → B → A</option>
                <option value="B-C-A">Section B → C → A</option>
              </select>
            </div>

            <div className="flex items-end gap-2">
              <button
                type="submit"
                className="w-full rounded-md bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800"
              >
                Save & Build Study Plan
              </button>
            </div>
          </form>
        )}

        {/* Exam-Day Battle Card & Countdown */}
        {(showBattleCard || planInfo.isCountdown) && (
          <div className="mt-5 rounded-md border border-amber-200 bg-amber-50/50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-200/80 pb-2.5">
              <h2 className="font-display text-sm font-bold text-slate-900">
                {planInfo.isCountdown
                  ? `Final ${planInfo.daysUntilExam}-Day Countdown Mode Active`
                  : 'Exam-Day Battle Card (3 Hours 10 Mins CBE)'}
              </h2>
              <span className="font-mono text-xs font-semibold text-amber-900 tabular-nums">
                Order: {appState.profile.preferredSectionOrder} · 1.8 min/mark hard cap
              </span>
            </div>
            <div className="mt-3 grid grid-cols-1 divide-y divide-amber-200/80 text-xs text-slate-800 md:grid-cols-3 md:divide-x md:divide-y-0">
              <div className="pb-3 md:pb-0 md:pr-4">
                <p className="font-bold text-slate-900">Section Timing Splits</p>
                <p className="mt-1">Sec A (30m): 54 min (flag & move on at 3.5m).</p>
                <p>Sec B (30m): 54 min (18 min per 5-OT case).</p>
                <p>Sec C (40m): 72 min (18m for 10m; 27m per 15m CR).</p>
              </div>
              <div className="py-3 md:py-0 md:px-4">
                <p className="font-bold text-slate-900">Free-Marks Checklist</p>
                <p className="mt-1">1. Show &ldquo;0&rdquo; for every exempt/non-adjustable line.</p>
                <p>2. Label (W1), (W2) — never put work in Scratch Pad.</p>
                <p>3. Deduct PAYE at foot; full 4-digit year on dates.</p>
              </div>
              <div className="pt-3 md:pt-0 md:pl-4">
                <p className="font-bold text-slate-900">Personal Watchlist</p>
                <p className="mt-1">
                  Top priority: {predictions[0]?.title} ({predictions[0]?.frequencyOutOf8}/8 sittings)
                </p>
                <p>
                  Due SRS Reviews: {dueMistakes.length} items · Never leave any OT blank.
                </p>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* 4 Core KPI Telemetry Cards */}
      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
            <span>Exam Readiness</span>
            <Target className="h-4 w-4 text-blue-700" />
          </div>
          <p className="mt-2 font-mono text-2xl font-bold text-slate-900 tabular-nums">
            {readiness}%
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Pass mark 50% · Target bank 60%+
          </p>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
            <span>Trap Immunity</span>
            <ShieldCheck className="h-4 w-4 text-teal-700" />
          </div>
          <p className="mt-2 font-mono text-2xl font-bold text-slate-900 tabular-nums">
            {trapImmunity}%
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {Object.keys(appState.trapLedger).length} trap categories tracked
          </p>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
            <span>Free-Marks Harvest</span>
            <CheckCircle2 className="h-4 w-4 text-amber-600" />
          </div>
          <p className="mt-2 font-mono text-2xl font-bold text-slate-900 tabular-nums">
            {freeMarksHarvest}%
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Zeros, headings, W1 labels & dates
          </p>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
            <span>Streak & SRS Queue</span>
            <Flame className="h-4 w-4 text-orange-600" />
          </div>
          <p className="mt-2 font-mono text-2xl font-bold text-slate-900 tabular-nums">
            {appState.streakDays}d · {dueMistakes.length} due
          </p>
          <button
            type="button"
            onClick={onOpenDueMistakes}
            className="mt-1 text-xs font-semibold text-blue-700 hover:underline"
          >
            {dueMistakes.length > 0 ? 'Clear SRS queue now →' : 'View Mistake Bank →'}
          </button>
        </div>
      </section>

      {/* Personal Trap Ledger Dashboard (categorized by repeat-offence frequency) */}
      <TrapLedgerDashboard
        appState={appState}
        compact
        onLaunchMicroDrill={onLaunchMicroDrill}
        onOpenQuestionById={onOpenQuestionById}
        onOpenFullTrapBank={onOpenTrapLedgerTab}
      />

      {/* Frequency Intelligence & Adaptive Study Plan */}
      <section className="grid grid-cols-1 items-stretch gap-5 lg:grid-cols-2">
        <div className="flex flex-col rounded-lg border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h2 className="font-display text-base font-bold text-slate-900">
              High-Yield Priority Predictor
            </h2>
            <span className="font-mono text-xs text-slate-500">Frequency × Mastery Gap</span>
          </div>
          <div className="mt-2 divide-y divide-slate-100 flex-1">
            {predictions.slice(0, 5).map((item) => {
              const ragStatus = getRagLabel(item.rag);
              return (
                <div
                  key={item.topicId}
                  className="flex items-center justify-between gap-3 py-2.5"
                >
                  <div>
                    <button
                      type="button"
                      onClick={() => onSelectTopic(item.topicId)}
                      className="text-left text-sm font-semibold text-slate-900 hover:text-blue-700"
                    >
                      {item.topicId}. {item.title}
                    </button>
                    <p className="text-xs text-slate-500">{item.reason}</p>
                  </div>
                  <span className={`shrink-0 whitespace-nowrap text-xs font-semibold ${ragStatus.textClass}`}>
                    {ragStatus.text}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col rounded-lg border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h2 className="font-display text-base font-bold text-slate-900">
              Adaptive Study Plan
            </h2>
            <span className="inline-flex items-center gap-1 font-mono text-xs font-semibold text-slate-600 tabular-nums">
              <Calendar className="h-3.5 w-3.5" />
              {planInfo.daysUntilExam} {planInfo.daysUntilExam === 1 ? 'day' : 'days'} to {appState.profile.examDate}
            </span>
          </div>
          <div className="mt-3 divide-y divide-slate-100 flex-1">
            {planInfo.blocks.map((b) => (
              <div key={b.phase} className="py-2.5 first:pt-0 last:pb-0">
                <p className="text-xs font-bold text-slate-900">{b.phase}</p>
                <p className="mt-0.5 text-xs text-slate-600 leading-relaxed">{b.detail}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
            <span className="text-[11px] font-semibold text-slate-500 mr-1">Key Sec C CRs:</span>
            <button
              type="button"
              onClick={() => onOpenQuestionById('Q101')}
              className="rounded border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Q101 Sheldon (15m)
            </button>
            <button
              type="button"
              onClick={() => onOpenQuestionById('Q256')}
              className="rounded border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Q256 CT CR (15m)
            </button>
            <button
              type="button"
              onClick={() => onOpenQuestionById('Q175')}
              className="rounded border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Q175 CGT CR (10m)
            </button>
            <button
              type="button"
              onClick={() => onOpenQuestionById('Q210')}
              className="rounded border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Q210 IHT CR (10m)
            </button>
            <button
              type="button"
              onClick={() => onOpenQuestionById('SPEC-Q31')}
              className="rounded border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Spec Q31 Sarah (10m)
            </button>
          </div>
        </div>
      </section>

      {/* 24-Topic Syllabus Mastery & RAG Map */}
      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-display text-base font-bold text-slate-900">
              24-Topic Syllabus Mastery & RAG Map
            </h2>
            <p className="text-xs text-slate-500">
              Select any topic to open its Phase-1 Revision Card & 4-Tier Practice Ladder. Green requires ≥80% mastery + Tier 3 Sec B/C pass.
            </p>
          </div>

          <select
            value={areaFilter}
            onChange={(e) => setAreaFilter(e.target.value)}
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800"
          >
            <option value="ALL">All 24 Syllabus Topics</option>
            <option value="UK Tax System">UK Tax System</option>
            <option value="Income Tax & NIC">Income Tax & NIC (Q1–127)</option>
            <option value="Corporation Tax">Corporation Tax (Q213–270)</option>
            <option value="Chargeable Gains">Chargeable Gains (Q128–179)</option>
            <option value="Inheritance Tax">Inheritance Tax (Q180–212)</option>
            <option value="VAT">VAT (Q271–306)</option>
          </select>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
            <thead>
              <tr className="bg-slate-50 text-xs font-semibold text-slate-600">
                <th className="px-3 py-2.5"># · Topic</th>
                <th className="px-3 py-2.5">Area</th>
                <th className="px-3 py-2.5">Kit Range</th>
                <th className="px-3 py-2.5">Sitting Freq</th>
                <th className="px-3 py-2.5">Tier</th>
                <th className="px-3 py-2.5">Mastery</th>
                <th className="px-3 py-2.5">RAG Status</th>
                <th className="px-3 py-2.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredTopics.map((topic) => {
                const tp = appState.topicProgress[topic.id];
                const rag = tp?.rag ?? 'unstarted';
                const badge = getRagLabel(rag);
                return (
                  <tr
                    key={topic.id}
                    className="transition-colors hover:bg-slate-50/80"
                  >
                    <td className="px-3 py-2.5 font-medium text-slate-900">
                      <span className="font-mono text-xs text-slate-400 mr-1.5">
                        {String(topic.id).padStart(2, '0')}
                      </span>
                      {topic.title}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-slate-600">
                      {topic.syllabusArea}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-xs text-slate-700">
                      {topic.kitRange}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-xs text-slate-700 tabular-nums">
                      {topic.phase1.frequencyCount}/8
                    </td>
                    <td className="px-3 py-2.5 font-mono text-xs text-slate-700 tabular-nums">
                      T{tp?.tierUnlocked ?? 1}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-xs font-semibold text-slate-900 tabular-nums">
                      {tp?.attempts ? `${tp.mastery}%` : '—'}
                    </td>
                    <td className="px-3 py-2.5">
                      <span
                        className={`inline-block whitespace-nowrap text-xs font-semibold ${badge.textClass}`}
                      >
                        {badge.text}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <button
                        type="button"
                        onClick={() => onSelectTopic(topic.id)}
                        className="rounded border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-50"
                      >
                        Open →
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Kit Index Coverage & Study Text PDF Ingestion */}
      <section className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-white p-5 lg:col-span-2">
          <h2 className="font-display text-base font-bold text-slate-900">
            Kaplan TX-UK FA25 Exam Kit Bank Coverage (306 Qs + Specimen)
          </h2>
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-xs">
              <thead>
                <tr className="bg-slate-50 font-semibold text-slate-600">
                  <th className="px-3 py-2 text-left">Block</th>
                  <th className="px-3 py-2 text-left">Sec A / B / C</th>
                  <th className="px-3 py-2 text-left">Pages</th>
                  <th className="px-3 py-2 text-left">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {KIT_INDEX_SUMMARY.map((row) => (
                  <tr key={row.area}>
                    <td className="px-3 py-2 font-medium text-slate-900">{row.area}</td>
                    <td className="px-3 py-2 font-mono text-slate-600">
                      {row.secACount} / {row.secBCount} / {row.secCCount} ({row.total})
                    </td>
                    <td className="px-3 py-2 font-mono text-slate-500">
                      Q {row.qPages} · A {row.aPages}
                    </td>
                    <td className="px-3 py-2">
                      {row.loadedInBank ? (
                        <span className="font-semibold text-teal-700">
                          Loaded in Bank
                        </span>
                      ) : (
                        <span className="text-slate-500">
                          On-disk PDF (lookup below)
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-5 space-y-4">
          <div>
            <h2 className="font-display text-sm font-bold text-slate-900">
              Source PDFs & Lookup
            </h2>
            <p className="mt-1 text-xs text-slate-600">
              Exam Kit FA25 PDF is active on disk. Attach your Kaplan Study Text FA25 PDF if you want local chapter lookup:
            </p>
            <div className="mt-2.5 flex items-center gap-2 rounded border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
              {appState.studyTextLoaded ? (
                <>
                  <FileText className="h-4 w-4 text-teal-700" />
                  <span className="font-medium text-teal-800 truncate">
                    {appState.studyTextName}
                  </span>
                </>
              ) : (
                <>
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  <span className="text-slate-600">
                    Study Text PDF not attached (chapters cited; exact ST page numbers omitted unless verified).
                  </span>
                </>
              )}
            </div>
            <label className="mt-2.5 inline-flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50">
              <Upload className="h-3.5 w-3.5" />
              Attach Kaplan Study Text PDF
              <input
                type="file"
                accept="application/pdf"
                onChange={handleStudyTextFile}
                className="hidden"
              />
            </label>
            {uploadStatus && (
              <p className="mt-1.5 text-xs text-blue-700">{uploadStatus}</p>
            )}
          </div>

          <div className="border-t border-slate-200 pt-3">
            <label className="block text-xs font-semibold text-slate-700">
              Quick Question Jump & PDF Lookup (Q1–306)
            </label>
            <div className="mt-1.5 flex flex-wrap gap-2">
              <input
                type="number"
                min={1}
                max={306}
                value={kitLookupQ}
                onChange={(e) => setKitLookupQ(e.target.value)}
                className="w-20 rounded-md border border-slate-300 px-2.5 py-1.5 font-mono text-xs text-slate-900"
              />
              <button
                type="button"
                onClick={() => onOpenQuestionById(`Q${Math.min(306, Math.max(1, Number(kitLookupQ) || 1))}`)}
                className="rounded-md bg-blue-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-800"
              >
                Open Q{kitLookupQ || 1} →
              </button>
              <button
                type="button"
                onClick={handleKitLookup}
                className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
              >
                Read PDF
              </button>
            </div>
            {kitLookupResult && (
              <p className="mt-2 max-h-28 overflow-y-auto rounded border border-slate-200 bg-slate-50 p-2 text-xs text-slate-700">
                {kitLookupResult}
              </p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
};
