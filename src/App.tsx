import { useEffect, useMemo, useState } from 'react';
import questionsData from './data/questions.json';
import specimenData from './data/specimen.json';
import {
  createInitialAppState,
  getDueMistakes,
  recordAttemptAndUpdateState,
  STORAGE_KEY,
} from './engine/mastery';
import { generateTrapVariant } from './engine/taxCalculators';
import type {
  AppState,
  KitQuestion,
  MockResultRecord,
  NavTab,
  SectionType,
  UserProfile,
} from './types/tx';
import { AppShell } from './components/AppShell';
import { DashboardView } from './components/DashboardView';
import { TopicView } from './components/TopicView';
import { QuestionPlayer } from './components/QuestionPlayer';
import { LabsView, type LabSubTab } from './components/LabsView';
import { MockBuilderView } from './components/MockBuilderView';
import { TaxTablesDrawer, TaxTablesView } from './components/TaxTablesView';

const KIT_QUESTIONS = questionsData as KitQuestion[];
const SPECIMEN_QUESTIONS = specimenData as KitQuestion[];
const ALL_BANK_QUESTIONS: KitQuestion[] = [...KIT_QUESTIONS, ...SPECIMEN_QUESTIONS];
const THEME_STORAGE_KEY = 'tx_mastercoach_theme_v1';

function loadSavedState(): AppState {
  const base = createInitialAppState();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return base;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return base;
    return {
      ...base,
      ...parsed,
      profile: { ...base.profile, ...(parsed.profile ?? {}) },
      topicProgress: { ...base.topicProgress, ...(parsed.topicProgress ?? {}) },
    };
  } catch {
    return base;
  }
}

export default function App() {
  const [appState, setAppState] = useState<AppState>(() => loadSavedState());
  const [activeTab, setActiveTab] = useState<NavTab>('overview');
  const [labsSubTab, setLabsSubTab] = useState<LabSubTab>('srs');
  const [selectedTopicId, setSelectedTopicId] = useState<number>(5);
  const [activeQuestion, setActiveQuestion] = useState<KitQuestion>(
    () => KIT_QUESTIONS.find((q) => q.id === 'Q27') ?? KIT_QUESTIONS[0]
  );
  const [activeTier, setActiveTier] = useState<1 | 2 | 3 | 4>(2);
  const [autoLaunchSpecimen, setAutoLaunchSpecimen] = useState(false);
  const [globalTablesOpen, setGlobalTablesOpen] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try {
      return window.localStorage.getItem(THEME_STORAGE_KEY) === 'dark' ? 'dark' : 'light';
    } catch {
      return 'light';
    }
  });

  // Apply .dark class to <html> cleanly
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // Ignore storage error
    }
  }, [theme]);

  // Sync ?autostart=1 bypass
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('autostart') === '1') {
      setAppState((prev) =>
        prev.profile.onboarded
          ? prev
          : { ...prev, profile: { ...prev.profile, onboarded: true } }
      );
      setActiveTab('topics');
    }
  }, []);

  // Persist to localStorage on every state update
  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(appState));
    } catch {
      // Ignore storage quota issues cleanly
    }
  }, [appState]);

  const dueMistakes = useMemo(
    () => getDueMistakes(appState.mistakes),
    [appState.mistakes]
  );

  const handleSaveProfile = (profile: UserProfile) => {
    setAppState((prev) => ({ ...prev, profile }));
  };

  const handleSelectTopic = (topicId: number) => {
    setSelectedTopicId(topicId);
    setActiveTab('topics');
  };

  const handleLaunchQuestion = (question: KitQuestion, tier: 1 | 2 | 3 | 4 = 2) => {
    setActiveQuestion(question);
    setActiveTier(tier);
    setActiveTab('player');
  };

  const handleOpenQuestionById = (qId: string) => {
    const found = ALL_BANK_QUESTIONS.find((q) => q.id === qId);
    if (found) {
      handleLaunchQuestion(found, found.section === 'A' ? 2 : 3);
    }
  };

  const handleRecordAttempt = (params: {
    question: KitQuestion;
    tier: 1 | 2 | 3 | 4;
    marksScored: number;
    marksAvailable: number;
    freeMarksCaptured: number;
    freeMarksTotal: number;
    userAnswerSummary: string;
    correctAnswerSummary: string;
    elapsedSeconds: number;
  }): { microDrillTriggeredCategory: string | null } => {
    const { nextState, microDrillTriggeredCategory } = recordAttemptAndUpdateState(
      appState,
      params
    );
    setAppState(nextState);
    return { microDrillTriggeredCategory };
  };

  const handleLaunchMicroDrill = (trapCategory: string) => {
    const lower = trapCategory.toLowerCase();
    const attemptedIds = new Set(appState.attempts.map((a) => a.questionId));
    const missedIds = new Set(appState.mistakes.map((m) => m.questionId));
    const candidates = ALL_BANK_QUESTIONS.filter(
      (q) =>
        q.examiner_debrief.trap_category.toLowerCase() === lower &&
        q.id !== activeQuestion.id
    );
    const match =
      candidates.find((q) => missedIds.has(q.id)) ??
      candidates.find((q) => !attemptedIds.has(q.id)) ??
      candidates[0];
    if (match) {
      handleLaunchQuestion(match, 4);
      return;
    }
    const topicIdGuess =
      lower.includes('car') || lower.includes('fuel') || lower.includes('employment') || lower.includes('benefit')
        ? 5
        : lower.includes('property')
        ? 4
        : lower.includes('pension') || lower.includes('annual allowance')
        ? 6
        : lower.includes('capital allowance')
        ? 8
        : lower.includes('trading loss') || lower.includes('partnership')
        ? 10
        : lower.includes('pa') || lower.includes('ani') || lower.includes('savings') || lower.includes('dividend') || lower.includes('residence')
        ? 2
        : lower.includes('company loss')
        ? 14
        : lower.includes('group')
        ? 15
        : lower.includes('corporation') || lower.includes('ct ')
        ? 13
        : lower.includes('chattel') || lower.includes('cgt') || lower.includes('badr') || lower.includes('share') || lower.includes('prr')
        ? 17
        : lower.includes('iht') || lower.includes('inheritance')
        ? 22
        : lower.includes('vat')
        ? 23
        : 11;
    handleLaunchQuestion(
      generateTrapVariant(topicIdGuess, appState.attempts.length % 3),
      4
    );
  };

  const handleRateMemoryCard = (
    cardId: string,
    rating: number,
    nextReviewIso: string
  ) => {
    setAppState((prev) => ({
      ...prev,
      memoryStates: {
        ...prev.memoryStates,
        [cardId]: {
          cardId,
          rating,
          nextReviewIso,
          reviewCount: (prev.memoryStates[cardId]?.reviewCount ?? 0) + 1,
        },
      },
    }));
  };

  const handleSaveMockResult = (record: MockResultRecord) => {
    setAppState((prev) => ({
      ...prev,
      mockHistory: [record, ...prev.mockHistory],
    }));
  };

  const handleRecordMockAttempts = (
    entries: Array<{
      question: KitQuestion;
      marksScored: number;
      marksAvailable: number;
      freeMarksCaptured: number;
      freeMarksTotal: number;
      userAnswerSummary: string;
      correctAnswerSummary: string;
      elapsedSeconds: number;
    }>
  ) => {
    if (entries.length === 0) return;
    setAppState((prev) => {
      let current = prev;
      for (const entry of entries) {
        current = recordAttemptAndUpdateState(current, {
          ...entry,
          tier: entry.question.section === 'A' ? 2 : 3,
        }).nextState;
      }
      return current;
    });
  };

  const handleSyncMockCrMarks = (
    mockId: string,
    crEntries: Array<{
      question: KitQuestion;
      marksScored: number;
      marksAvailable: number;
      freeMarksCaptured: number;
      freeMarksTotal: number;
      userAnswerSummary: string;
      correctAnswerSummary: string;
      elapsedSeconds: number;
    }>,
    updatedSectionBreakdown: { section: SectionType; scored: number; available: number }[],
    updatedTotalScored: number
  ) => {
    setAppState((prev) => {
      let current = prev;
      for (const entry of crEntries) {
        current = recordAttemptAndUpdateState(current, {
          ...entry,
          tier: 3,
        }).nextState;
      }
      const nextHistory = current.mockHistory.map((m) =>
        m.id === mockId
          ? {
              ...m,
              marksScored: updatedTotalScored,
              sectionBreakdown: updatedSectionBreakdown,
            }
          : m
      );
      return {
        ...current,
        mockHistory: nextHistory,
      };
    });
  };

  const handleStudyTextUploaded = (name: string) => {
    setAppState((prev) => ({
      ...prev,
      studyTextLoaded: true,
      studyTextName: name,
    }));
  };

  const breadcrumbDetail =
    activeTab === 'player'
      ? `${activeQuestion.id} · Sec ${activeQuestion.section}`
      : activeTab === 'topics'
      ? `Topic ${selectedTopicId}`
      : undefined;

  return (
    <AppShell
      activeTab={activeTab}
      breadcrumbDetail={breadcrumbDetail}
      appState={appState}
      dueMistakeCount={dueMistakes.length}
      theme={theme}
      onToggleTheme={() => setTheme((t) => (t === 'light' ? 'dark' : 'light'))}
      onNavigate={(tab) => {
        setAutoLaunchSpecimen(false);
        if (tab === 'mistakes') setLabsSubTab('srs');
        setActiveTab(tab);
      }}
      onSaveProfile={handleSaveProfile}
      onOpenQuestionById={handleOpenQuestionById}
      onSelectTopic={handleSelectTopic}
      onStudyTextUploaded={handleStudyTextUploaded}
      onOpenTablesDrawer={() => setGlobalTablesOpen(true)}
      allQuestions={ALL_BANK_QUESTIONS}
    >
      <TaxTablesDrawer
        open={globalTablesOpen}
        onClose={() => setGlobalTablesOpen(false)}
        onOpenQuestionById={handleOpenQuestionById}
      />

      {activeTab === 'overview' && (
        <DashboardView
          appState={appState}
          totalQuestionsLoaded={KIT_QUESTIONS.length}
          specimenItemCount={SPECIMEN_QUESTIONS.length}
          onSelectTopic={handleSelectTopic}
          onLaunchSpecimenMock={() => {
            setAutoLaunchSpecimen(true);
            setActiveTab('mock');
          }}
          onOpenDueMistakes={() => {
            setLabsSubTab('srs');
            setActiveTab('mistakes');
          }}
          onOpenTrapLedgerTab={() => {
            setLabsSubTab('traps');
            setActiveTab('mistakes');
          }}
          onLaunchMicroDrill={handleLaunchMicroDrill}
          onOpenQuestionById={handleOpenQuestionById}
          onOpenMockTab={() => {
            setAutoLaunchSpecimen(false);
            setActiveTab('mock');
          }}
        />
      )}

      {activeTab === 'topics' && (
        <TopicView
          topicId={selectedTopicId}
          allQuestions={ALL_BANK_QUESTIONS}
          appState={appState}
          onSelectTopic={(id) => setSelectedTopicId(id)}
          onBackToOverview={() => setActiveTab('overview')}
          onLaunchQuestion={handleLaunchQuestion}
        />
      )}

      {activeTab === 'player' && (
        <QuestionPlayer
          question={activeQuestion}
          allQuestions={ALL_BANK_QUESTIONS}
          tier={activeTier}
          appState={appState}
          onSelectQuestion={(q) => {
            setActiveQuestion(q);
            setActiveTier(q.is_variant ? 4 : q.section === 'A' ? 2 : 3);
          }}
          onRecordAttempt={handleRecordAttempt}
          onLaunchMicroDrill={handleLaunchMicroDrill}
        />
      )}

      {activeTab === 'mistakes' && (
        <LabsView
          appState={appState}
          allQuestions={ALL_BANK_QUESTIONS}
          initialSubTab={labsSubTab}
          onRedrillQuestion={handleOpenQuestionById}
          onRateMemoryCard={handleRateMemoryCard}
          onLaunchMicroDrill={handleLaunchMicroDrill}
        />
      )}

      {activeTab === 'mock' && (
        <MockBuilderView
          allQuestions={KIT_QUESTIONS}
          specimenQuestions={SPECIMEN_QUESTIONS}
          appState={appState}
          autoLaunchSpecimen={autoLaunchSpecimen}
          onSaveMockResult={handleSaveMockResult}
          onRecordMockAttempts={handleRecordMockAttempts}
          onSyncMockCrMarks={handleSyncMockCrMarks}
          onOpenQuestionById={handleOpenQuestionById}
        />
      )}

      {activeTab === 'tables' && (
        <TaxTablesView
          appState={appState}
          onImportState={(nextState) => setAppState(nextState)}
          onOpenTopic={handleSelectTopic}
          onOpenQuestionById={handleOpenQuestionById}
        />
      )}
    </AppShell>
  );
}
