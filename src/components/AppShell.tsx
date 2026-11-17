import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  Calendar,
  Compass,
  FileText,
  GraduationCap,
  Layers,
  Menu,
  Moon,
  PlayCircle,
  Search,
  Settings2,
  ShieldAlert,
  Sun,
  Table2,
  Upload,
  X,
} from 'lucide-react';
import { EXAM_CARD } from '../data/taxReference';
import {
  computeStudyPlanDays,
  resolveQuestionJump,
  searchQuickJumpTargets,
  type QuickJumpTarget,
} from '../engine/mastery';
import type { AppState, KitQuestion, NavTab, UserProfile } from '../types/tx';

interface AppShellProps {
  activeTab: NavTab;
  breadcrumbDetail?: string;
  appState: AppState;
  dueMistakeCount: number;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  onNavigate: (tab: NavTab) => void;
  onSaveProfile: (profile: UserProfile) => void;
  onOpenQuestionById: (qId: string) => void;
  onSelectTopic?: (topicId: number) => void;
  onStudyTextUploaded: (name: string) => void;
  onOpenTablesDrawer: () => void;
  allQuestions?: Array<Pick<KitQuestion, 'id' | 'title' | 'topic' | 'section' | 'marks'>>;
  children: React.ReactNode;
}

const RAIL_LINKS: {
  id: NavTab;
  label: string;
  hint: string;
  icon: React.FC<{ className?: string }>;
}[] = [
  { id: 'overview', label: 'Today', hint: 'Plan & readiness', icon: Compass },
  { id: 'topics', label: 'Syllabus', hint: '24 topics & rules', icon: Layers },
  { id: 'player', label: 'Practice Studio', hint: '327 Kit + Specimen', icon: PlayCircle },
  { id: 'mock', label: 'CBE Mock', hint: 'Timed exams & clinics', icon: GraduationCap },
  { id: 'mistakes', label: 'Revision Clinic', hint: 'SRS, traps & memory', icon: ShieldAlert },
  { id: 'tables', label: 'FA25 Tables', hint: 'Rates, rules & examples', icon: Table2 },
];

export const AppShell: React.FC<AppShellProps> = ({
  activeTab,
  breadcrumbDetail,
  appState,
  dueMistakeCount,
  theme,
  onToggleTheme,
  onNavigate,
  onSaveProfile,
  onOpenQuestionById,
  onSelectTopic,
  onStudyTextUploaded,
  onOpenTablesDrawer,
  allQuestions = [],
  children,
}) => {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [jumpOpen, setJumpOpen] = useState(false);
  const [jumpQuery, setJumpQuery] = useState('');
  const [jumpHighlightIdx, setJumpHighlightIdx] = useState(0);
  const jumpInputRef = useRef<HTMLInputElement | null>(null);
  const [draftProfile, setDraftProfile] = useState<UserProfile>(appState.profile);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [kitLookupQ, setKitLookupQ] = useState('128');
  const [kitLookupResult, setKitLookupResult] = useState<string | null>(null);

  const planInfo = computeStudyPlanDays(appState.profile, appState);
  const activeLabel = RAIL_LINKS.find((r) => r.id === activeTab)?.label ?? 'Today';

  const jumpTargets = useMemo(
    () => searchQuickJumpTargets(allQuestions, jumpQuery),
    [allQuestions, jumpQuery]
  );

  const handleSelectNav = (tab: NavTab) => {
    onNavigate(tab);
    setMobileNavOpen(false);
  };

  const handleProfileSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveProfile({ ...draftProfile, onboarded: true });
    setSettingsOpen(false);
  };

  const executeJumpTarget = (target: QuickJumpTarget) => {
    if (target.kind === 'question') {
      onOpenQuestionById(target.id);
    } else if (target.kind === 'topic' && target.topicId) {
      if (onSelectTopic) {
        onSelectTopic(target.topicId);
      } else {
        onNavigate('topics');
      }
    } else if (target.kind === 'nav' && target.navTab) {
      onNavigate(target.navTab);
    }
    setJumpOpen(false);
    setJumpQuery('');
    setJumpHighlightIdx(0);
  };

  // Global Cmd/Ctrl+K Quick Jump + Escape handling
  useEffect(() => {
    const onGlobalKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setJumpOpen((prev) => !prev);
        setSettingsOpen(false);
        setMobileNavOpen(false);
        return;
      }
      if (e.key === 'Escape') {
        if (jumpOpen) {
          e.preventDefault();
          setJumpOpen(false);
        } else if (settingsOpen || mobileNavOpen) {
          setSettingsOpen(false);
          setMobileNavOpen(false);
        }
      }
    };
    window.addEventListener('keydown', onGlobalKey);
    return () => window.removeEventListener('keydown', onGlobalKey);
  }, [jumpOpen, settingsOpen, mobileNavOpen]);

  useEffect(() => {
    if (jumpOpen) {
      setJumpHighlightIdx(0);
      window.setTimeout(() => jumpInputRef.current?.focus(), 20);
    }
  }, [jumpOpen]);

  useEffect(() => {
    setDraftProfile(appState.profile);
  }, [appState.profile]);

  const quickJumpMatch = resolveQuestionJump(allQuestions, kitLookupQ);

  const handleOpenQuickJump = () => {
    onOpenQuestionById(quickJumpMatch.id);
    setSettingsOpen(false);
  };

  const handleStudyTextFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 25 * 1024 * 1024) {
      setUploadStatus('File exceeds 25 MB upload limit. Please attach a compressed PDF.');
      return;
    }
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
          setUploadStatus(`Attached ${file.name} (${json.studyText.pageCount} pages).`);
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
    const targetId = quickJumpMatch.id;
    setKitLookupResult('Searching Exam Kit PDF...');
    try {
      const res = await fetch(`/api/kit/lookup?q=${encodeURIComponent(targetId)}`);
      const data = await res.json();
      if (data.ok) {
        setKitLookupResult(
          `${data.label ?? `Kit Q${data.qNum}`}${data.bookPage ? ` (Kit p.${data.bookPage})` : ''}: ${data.snippet}`
        );
      } else {
        setKitLookupResult(data.error || 'Lookup failed');
      }
    } catch {
      setKitLookupResult('Lookup endpoint unavailable.');
    }
  };

  const renderRailContent = () => (
    <div className="flex h-full flex-col justify-between px-4 py-5">
      <div className="space-y-6">
        {/* Brand Wordmark */}
        <button
          type="button"
          onClick={() => handleSelectNav('overview')}
          className="flex w-full items-center gap-3 rounded-lg px-2 py-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0F5132]"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#0F5132] text-white dark:bg-emerald-600">
            <BookOpen className="h-4 w-4" />
          </span>
          <span className="min-w-0">
            <span className="block font-display text-base font-bold tracking-tight text-[#14171A] dark:text-[#F0F3F6] whitespace-nowrap">
              TX Mastercoach
            </span>
            <span className="block font-mono text-[11px] font-medium text-neutral-500 dark:text-neutral-400">
              ACCA TX-UK · FA25
            </span>
          </span>
        </button>

        {/* Exam Countdown Summary Strip */}
        <div className="rounded-xl border border-[#E6E4DD] bg-[#FAF9F6] px-3.5 py-3 dark:border-[#262C36] dark:bg-[#12161D]">
          <div className="flex items-center justify-between text-xs">
            <span className="inline-flex items-center gap-1.5 font-semibold text-neutral-600 dark:text-neutral-300">
              <Calendar className="h-3.5 w-3.5 text-[#0F5132] dark:text-emerald-400" />
              Exam Sitting
            </span>
            <span className="font-mono font-bold text-[#0F5132] dark:text-emerald-400 tabular-nums">
              {planInfo.daysUntilExam}d left
            </span>
          </div>
          <p className="mt-1 font-mono text-xs font-semibold text-[#14171A] dark:text-[#F0F3F6] tabular-nums">
            {appState.profile.examDate} · {appState.profile.preferredSectionOrder}
          </p>
        </div>

        {/* Navigation Links */}
        <nav aria-label="Workspace navigation" className="space-y-1">
          {RAIL_LINKS.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelectNav(item.id)}
                className={`flex w-full items-center justify-between gap-2.5 rounded-lg px-3 py-2.5 text-left transition-colors ${
                  active
                    ? 'bg-[#0F5132] text-white dark:bg-emerald-700/90 dark:text-white'
                    : 'text-neutral-700 hover:bg-[#EFECE4] dark:text-neutral-300 dark:hover:bg-[#1C222B]'
                }`}
              >
                <span className="flex items-center gap-2.5 min-w-0">
                  <Icon
                    className={`h-4 w-4 shrink-0 ${
                      active ? 'text-emerald-100' : 'text-neutral-500 dark:text-neutral-400'
                    }`}
                  />
                  <span className="truncate text-sm font-semibold whitespace-nowrap">
                    {item.label}
                  </span>
                </span>
                {item.id === 'mistakes' && dueMistakeCount > 0 && (
                  <span
                    className={`font-mono text-xs font-bold tabular-nums ${
                      active ? 'text-emerald-100' : 'text-amber-700 dark:text-amber-400'
                    }`}
                  >
                    {dueMistakeCount}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom Utility Actions */}
      <div className="space-y-2 border-t border-[#E6E4DD] pt-4 dark:border-[#262C36]">
        <button
          type="button"
          onClick={() => {
            setDraftProfile(appState.profile);
            setSettingsOpen(true);
            setMobileNavOpen(false);
          }}
          className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-xs font-semibold text-neutral-700 hover:bg-[#EFECE4] dark:text-neutral-300 dark:hover:bg-[#1C222B]"
        >
          <span className="inline-flex items-center gap-2">
            <Settings2 className="h-3.5 w-3.5" />
            Study Profile &amp; Kit PDF
          </span>
          <span className="font-mono text-[11px] text-neutral-500 dark:text-neutral-400">
            {appState.profile.hoursPerWeek}h/w
          </span>
        </button>

        <button
          type="button"
          onClick={onToggleTheme}
          className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-xs font-semibold text-neutral-700 hover:bg-[#EFECE4] dark:text-neutral-300 dark:hover:bg-[#1C222B]"
        >
          <span className="inline-flex items-center gap-2">
            {theme === 'dark' ? (
              <Sun className="h-3.5 w-3.5 text-amber-400" />
            ) : (
              <Moon className="h-3.5 w-3.5 text-neutral-600" />
            )}
            {theme === 'dark' ? 'Warm Stone Light' : 'Midnight Study Dark'}
          </span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F7F6F2] text-[#14171A] dark:bg-[#0D1117] dark:text-[#F0F3F6] lg:flex">
      {/* Desktop Studio Sidebar Rail */}
      <aside className="hidden lg:sticky lg:top-0 lg:block lg:h-screen lg:w-64 lg:shrink-0 lg:border-r lg:border-[#E6E4DD] lg:bg-white dark:lg:border-[#262C36] dark:lg:bg-[#161B22]">
        {renderRailContent()}
      </aside>

      {/* Mobile Navigation Drawer */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="fixed inset-0 bg-black/40"
            onClick={() => setMobileNavOpen(false)}
          />
          <aside className="relative z-10 h-full w-72 max-w-[85vw] border-r border-[#E6E4DD] bg-white dark:border-[#262C36] dark:bg-[#161B22]">
            <button
              type="button"
              aria-label="Close navigation drawer"
              onClick={() => setMobileNavOpen(false)}
              className="absolute right-3 top-4 inline-flex h-8 w-8 items-center justify-center rounded-md text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
            >
              <X className="h-4 w-4" />
            </button>
            {renderRailContent()}
          </aside>
        </div>
      )}

      {/* Study Profile, Kit Jump & PDF Slide-Over Drawer */}
      {settingsOpen && (
        <div
          onClick={() => setSettingsOpen(false)}
          className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-[1px]"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex h-full w-full max-w-md flex-col border-l border-[#E6E4DD] bg-white shadow-2xl dark:border-[#262C36] dark:bg-[#161B22]"
          >
            <div className="flex items-center justify-between border-b border-[#E6E4DD] px-5 py-4 dark:border-[#262C36]">
              <div>
                <h2 className="font-display text-base font-bold text-[#14171A] dark:text-[#F0F3F6]">
                  Study Profile &amp; Kaplan Sources
                </h2>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  {EXAM_CARD.financeAct} · {EXAM_CARD.examWindow}
                </p>
              </div>
              <button
                type="button"
                aria-label="Close study profile drawer"
                onClick={() => setSettingsOpen(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[#E6E4DD] text-neutral-600 hover:bg-neutral-100 dark:border-[#262C36] dark:text-neutral-300 dark:hover:bg-neutral-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-6">
              <form onSubmit={handleProfileSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                    Target Exam Date
                  </label>
                  <input
                    type="date"
                    value={draftProfile.examDate}
                    onChange={(e) =>
                      setDraftProfile({ ...draftProfile, examDate: e.target.value })
                    }
                    className="mt-1 w-full rounded-lg border border-[#D8D4C8] bg-[#FAF9F6] px-3 py-2 text-sm text-[#14171A] dark:border-[#303846] dark:bg-[#0D1117] dark:text-[#F0F3F6]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300">
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
                      className="mt-1 w-full rounded-lg border border-[#D8D4C8] bg-[#FAF9F6] px-2.5 py-2 text-sm text-[#14171A] dark:border-[#303846] dark:bg-[#0D1117] dark:text-[#F0F3F6]"
                    >
                      <option value="first">First attempt</option>
                      <option value="resit">Resit candidate</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                      Hours / Week
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
                      className="mt-1 w-full rounded-lg border border-[#D8D4C8] bg-[#FAF9F6] px-3 py-2 font-mono text-sm text-[#14171A] tabular-nums dark:border-[#303846] dark:bg-[#0D1117] dark:text-[#F0F3F6]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                    Preferred Mock Section Order
                  </label>
                  <select
                    value={draftProfile.preferredSectionOrder}
                    onChange={(e) =>
                      setDraftProfile({
                        ...draftProfile,
                        preferredSectionOrder: e.target.value as 'A-B-C' | 'C-B-A' | 'B-C-A',
                      })
                    }
                    className="mt-1 w-full rounded-lg border border-[#D8D4C8] bg-[#FAF9F6] px-3 py-2 text-sm text-[#14171A] dark:border-[#303846] dark:bg-[#0D1117] dark:text-[#F0F3F6]"
                  >
                    <option value="A-B-C">Section A → B → C</option>
                    <option value="C-B-A">Section C → B → A</option>
                    <option value="B-C-A">Section B → C → A</option>
                  </select>
                </div>

                <button
                  type="submit"
                  className="w-full rounded-lg bg-[#0F5132] px-4 py-2.5 text-xs font-semibold text-white hover:bg-[#0B3D26] dark:bg-emerald-600 dark:hover:bg-emerald-500"
                >
                  Save Study Profile
                </button>
              </form>

              {/* Quick Question Jump & Kit PDF Lookup */}
              <div className="border-t border-[#E6E4DD] pt-5 space-y-3 dark:border-[#262C36]">
                <h3 className="text-xs font-bold text-[#14171A] dark:text-[#F0F3F6]">
                  Quick Question Jump &amp; Exam Kit PDF Lookup
                </h3>
                <div className="flex flex-wrap gap-2">
                  <input
                    type="text"
                    aria-label="Jump to question number or keyword"
                    placeholder="e.g. 128, Sheldon, SPEC-Q3, Opal"
                    value={kitLookupQ}
                    onChange={(e) => setKitLookupQ(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleOpenQuickJump();
                      }
                    }}
                    className="w-44 rounded-lg border border-[#D8D4C8] bg-[#FAF9F6] px-2.5 py-1.5 font-mono text-xs text-[#14171A] dark:border-[#303846] dark:bg-[#0D1117] dark:text-[#F0F3F6]"
                  />
                  <button
                    type="button"
                    onClick={handleOpenQuickJump}
                    className="rounded-lg bg-[#0F5132] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#0B3D26] dark:bg-emerald-600"
                  >
                    Open {quickJumpMatch.id} →
                  </button>
                  <button
                    type="button"
                    onClick={handleKitLookup}
                    className="rounded-lg border border-[#D8D4C8] bg-white px-3 py-1.5 text-xs font-semibold text-neutral-800 hover:bg-neutral-50 dark:border-[#303846] dark:bg-[#1C222B] dark:text-neutral-200"
                  >
                    Read PDF
                  </button>
                </div>
                {quickJumpMatch.matchedByKeyword && (
                  <p className="font-mono text-[11px] text-[#0F5132] dark:text-emerald-400">
                    Matched: {quickJumpMatch.label}
                  </p>
                )}
                {kitLookupResult && (
                  <p className="max-h-32 overflow-y-auto rounded-lg border border-[#E6E4DD] bg-[#FAF9F6] p-2.5 text-xs text-neutral-700 dark:border-[#262C36] dark:bg-[#0D1117] dark:text-neutral-300">
                    {kitLookupResult}
                  </p>
                )}
              </div>

              {/* Kaplan Study Text Upload */}
              <div className="border-t border-[#E6E4DD] pt-5 space-y-2.5 dark:border-[#262C36]">
                <h3 className="text-xs font-bold text-[#14171A] dark:text-[#F0F3F6]">
                  Kaplan Study Text FA25 PDF
                </h3>
                <div className="flex items-start gap-2 rounded-lg border border-[#E6E4DD] bg-[#FAF9F6] px-3 py-2.5 text-xs dark:border-[#262C36] dark:bg-[#0D1117]">
                  {appState.studyTextLoaded ? (
                    <>
                      <FileText className="mt-0.5 h-4 w-4 shrink-0 text-[#0F5132] dark:text-emerald-400" />
                      <span className="font-medium text-[#0F5132] dark:text-emerald-300 truncate">
                        {appState.studyTextName}
                      </span>
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                      <span className="text-neutral-600 dark:text-neutral-400">
                        Exam Kit FA25 PDF is active on disk. Attach your Study Text PDF optionally for local chapter indexing.
                      </span>
                    </>
                  )}
                </div>
                <label className="inline-flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-[#D8D4C8] bg-white px-3 py-2 text-xs font-semibold text-neutral-800 hover:bg-neutral-50 dark:border-[#303846] dark:bg-[#1C222B] dark:text-neutral-200">
                  <Upload className="h-3.5 w-3.5" />
                  Attach Study Text PDF
                  <input
                    type="file"
                    accept="application/pdf"
                    onChange={handleStudyTextFile}
                    className="hidden"
                  />
                </label>
                {uploadStatus && (
                  <p className="text-xs text-[#0F5132] dark:text-emerald-400">{uploadStatus}</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Global Quick Jump Palette (Cmd/Ctrl+K) */}
      {jumpOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Quick Jump to Question, Topic, or FA25 Revision"
          onClick={() => setJumpOpen(false)}
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/45 px-4 pt-16 sm:pt-24 backdrop-blur-[1px]"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="tax-card-enter w-full max-w-xl overflow-hidden rounded-2xl border border-[#E6E4DD] bg-white shadow-2xl dark:border-[#262C36] dark:bg-[#161B22]"
          >
            <div className="flex items-center gap-2.5 border-b border-[#EFECE4] px-4 py-3 dark:border-[#262C36]">
              <Search className="h-4 w-4 shrink-0 text-[#0F5132] dark:text-emerald-400" />
              <input
                ref={jumpInputRef}
                type="text"
                aria-label="Quick jump search"
                value={jumpQuery}
                onChange={(e) => {
                  setJumpQuery(e.target.value);
                  setJumpHighlightIdx(0);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    if (jumpTargets.length > 0) {
                      setJumpHighlightIdx((idx) => (idx + 1) % jumpTargets.length);
                    }
                  } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    if (jumpTargets.length > 0) {
                      setJumpHighlightIdx(
                        (idx) => (idx - 1 + jumpTargets.length) % jumpTargets.length
                      );
                    }
                  } else if (e.key === 'Enter' && jumpTargets.length > 0) {
                    e.preventDefault();
                    executeJumpTarget(jumpTargets[jumpHighlightIdx] ?? jumpTargets[0]);
                  }
                }}
                placeholder="Jump to Q#, Specimen (sc2), topic, or FA25 hub..."
                className="w-full bg-transparent text-sm text-[#14171A] placeholder:text-neutral-400 focus:outline-none dark:text-[#F0F3F6]"
              />
              <button
                type="button"
                aria-label="Close quick jump"
                onClick={() => setJumpOpen(false)}
                className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="max-h-80 divide-y divide-[#EFECE4] overflow-y-auto dark:divide-[#262C36]">
              {jumpTargets.length === 0 ? (
                <p className="px-4 py-6 text-center text-xs text-neutral-500 dark:text-neutral-400">
                  No matching Kit questions, topics, or sections found.
                </p>
              ) : (
                jumpTargets.map((item, idx) => {
                  const active = idx === jumpHighlightIdx;
                  return (
                    <button
                      key={`${item.kind}-${item.id}`}
                      type="button"
                      onMouseEnter={() => setJumpHighlightIdx(idx)}
                      onClick={() => executeJumpTarget(item)}
                      className={`tax-study-row flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left ${
                        active ? 'bg-[#F4F1E8] dark:bg-[#1B222D]' : ''
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="rounded border border-[#D4DFD7] bg-emerald-50 px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase text-[#0F5132] dark:border-emerald-900/50 dark:bg-emerald-950/50 dark:text-emerald-300">
                            {item.kind === 'question'
                              ? 'Question'
                              : item.kind === 'topic'
                              ? 'Topic'
                              : 'Hub'}
                          </span>
                          <span className="truncate text-xs sm:text-sm font-semibold text-[#14171A] dark:text-[#F0F3F6]">
                            {item.title}
                          </span>
                        </div>
                        <p className="mt-0.5 truncate text-[11px] text-neutral-500 dark:text-neutral-400">
                          {item.subtitle}
                        </p>
                      </div>
                      <ArrowRight className="h-3.5 w-3.5 shrink-0 text-[#0F5132] dark:text-emerald-400" />
                    </button>
                  );
                })
              )}
            </div>

            <div className="flex items-center justify-between border-t border-[#EFECE4] bg-[#FAF9F6] px-4 py-2 font-mono text-[11px] text-neutral-500 dark:border-[#262C36] dark:bg-[#12161D] dark:text-neutral-400">
              <span>↑↓ navigate · Enter open</span>
              <span>Esc close</span>
            </div>
          </div>
        </div>
      )}

      {/* Main Workspace Column */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Clean Contextual Top Bar (<= 56px mobile height, 3-zone contract) */}
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-4 border-b border-[#E6E4DD] bg-[#F7F6F2]/95 px-4 backdrop-blur-sm sm:px-6 lg:px-8 dark:border-[#262C36] dark:bg-[#0D1117]/95">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              aria-label="Open navigation menu"
              onClick={() => setMobileNavOpen(true)}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#D8D4C8] bg-white text-neutral-700 hover:bg-neutral-50 lg:hidden dark:border-[#303846] dark:bg-[#161B22] dark:text-neutral-200"
            >
              <Menu className="h-4 w-4" />
            </button>
            <div className="flex min-w-0 items-center gap-2 text-xs sm:text-sm">
              <span className="font-semibold text-neutral-500 dark:text-neutral-400 whitespace-nowrap">
                TX-UK FA25
              </span>
              <span className="text-neutral-400" aria-hidden="true">
                /
              </span>
              <span className="truncate font-semibold text-[#14171A] dark:text-[#F0F3F6]">
                {activeLabel}
              </span>
              {breadcrumbDetail && (
                <>
                  <span className="hidden text-neutral-400 sm:inline" aria-hidden="true">
                    /
                  </span>
                  <span className="hidden truncate font-mono text-xs text-neutral-500 sm:inline dark:text-neutral-400">
                    {breadcrumbDetail}
                  </span>
                </>
              )}
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              aria-label="Open quick jump palette"
              onClick={() => setJumpOpen(true)}
              className="inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg border border-[#D8D4C8] bg-white px-2.5 py-1.5 text-xs font-semibold text-neutral-700 transition-colors hover:bg-neutral-50 dark:border-[#303846] dark:bg-[#161B22] dark:text-neutral-200 dark:hover:bg-[#1C222B]"
            >
              <Search className="h-3.5 w-3.5 text-[#0F5132] dark:text-emerald-400" />
              <span className="hidden sm:inline">Jump</span>
              <span className="hidden rounded border border-[#E6E4DD] px-1 font-mono text-[10px] text-neutral-400 md:inline dark:border-[#303846]">
                ⌘K
              </span>
            </button>
            <button
              type="button"
              onClick={onOpenTablesDrawer}
              className="whitespace-nowrap shrink-0 rounded-lg border border-[#D8D4C8] bg-white px-3 py-1.5 text-xs font-semibold text-neutral-800 hover:bg-neutral-50 dark:border-[#303846] dark:bg-[#161B22] dark:text-neutral-200 dark:hover:bg-[#1C222B]"
            >
              Exam Tables
            </button>
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
};
