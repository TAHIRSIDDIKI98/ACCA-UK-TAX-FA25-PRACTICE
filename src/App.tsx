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
  SectionType,
  UserProfile,
} from './types/tx';
import { TopBar, type NavTab } from './components/TopBar';
import { DashboardView } from './components/DashboardView';
import { TopicView } from './components/TopicView';
import { QuestionPlayer } from './components/QuestionPlayer';
import { LabsView, type LabSubTab } from './components/LabsView';
import { MockBuilderView } from './components/MockBuilderView';
import { TaxTablesView } from './components/TaxTablesView';

const KIT_QUESTIONS = questionsData as KitQuestion[];
const SPECIMEN_QUESTIONS = specimenData as KitQuestion[];
const ALL_BANK_QUESTIONS: KitQuestion[] = [...KIT_QUESTIONS, ...SPECIMEN_QUESTIONS];

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

  // Sync ?autostart=1 bypass per prompt/spec
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
    // Pick a question matching that trap category (or generate a trap variant for its topic)
    const match = ALL_BANK_QUESTIONS.find(
      (q) =>
        q.examiner_debrief.trap_category.toLowerCase() === trapCategory.toLowerCase() &&
        q.id !== activeQuestion.id
    );
    if (match) {
      handleLaunchQuestion(match, 4);
      return;
    }
    const topicIdGuess = trapCategory.toLowerCase().includes('car')
      ? 5
      : trapCategory.toLowerCase().includes('pa') || trapCategory.toLowerCase().includes('ani')
      ? 2
      : 11;
    handleLaunchQuestion(generateTrapVariant(topicIdGuess, 0), 4);
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

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <TopBar
        activeTab={activeTab}
        onNavigate={(tab) => {
          setAutoLaunchSpecimen(false);
          if (tab === 'mistakes') setLabsSubTab('srs');
          setActiveTab(tab);
        }}
        dueMistakeCount={dueMistakes.length}
      />

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {activeTab === 'overview' && (
          <DashboardView
            appState={appState}
            totalQuestionsLoaded={KIT_QUESTIONS.length}
            specimenItemCount={SPECIMEN_QUESTIONS.length}
            onSaveProfile={handleSaveProfile}
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
            onStudyTextUploaded={handleStudyTextUploaded}
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
            onSelectQuestion={(q) => setActiveQuestion(q)}
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
          />
        )}
      </main>
    </div>
  );
}
