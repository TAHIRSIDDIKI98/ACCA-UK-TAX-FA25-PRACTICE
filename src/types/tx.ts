export type SectionType = 'A' | 'B' | 'C';
export type QuestionType = 'mcq' | 'multi' | 'number' | 'case' | 'cr';
export type InteractionType =
  | 'single_mcq'
  | 'grid_2x2'
  | 'multi_select'
  | 'matrix'
  | 'pair_dropdown'
  | 'numeric_input'
  | 'case_5ot'
  | 'constructed_response';

export interface McqOption {
  key: string;
  text: string;
}

export interface MatrixOptions {
  columns: string[];
  rows: string[];
}

export interface PairDropdownGroup {
  group: string;
  choices: string[];
}

export interface CaseSubQuestion {
  sub_num: number;
  marks: number;
  type: 'mcq' | 'multi' | 'number';
  interaction: InteractionType;
  prompt: string;
  options: McqOption[] | MatrixOptions | PairDropdownGroup[];
  correct_answer: string | string[] | Record<string, string[]>;
  worked_solution: string;
}

export interface MarkSchemeStep {
  id: string;
  label: string;
  marks: number;
}

export interface ExaminerDebriefData {
  trap_category: string;
  trap_of_question: string;
  distractor_forensics: string;
  examiner_playbook: string;
  speed_trick: string;
  twist_prediction: string;
}

export interface KitQuestion {
  id: string;
  q_num: number;
  title: string;
  topic: string;
  topic_id: number;
  st_chapter: string;
  section: SectionType;
  type: QuestionType;
  interaction: InteractionType;
  marks: number;
  scenario: string;
  requirement: string;
  options: McqOption[] | MatrixOptions | PairDropdownGroup[] | CaseSubQuestion[];
  correct_answer:
    | string
    | string[]
    | Record<string, string[]>
    | Array<string | string[] | Record<string, string[]>>;
  full_worked_solution: string;
  mark_scheme_steps: MarkSchemeStep[];
  kit_page: string;
  answer_page: string;
  past_exam: string;
  exam_frequency_tag: string;
  examiner_debrief: ExaminerDebriefData;
  free_marks_items: string[];
  is_variant?: boolean;
  planted_trap?: string;
}

export interface TopicPhase1Card {
  howExamined: string;
  frequencyCount: number; // out of last 8 sittings
  coreRules: string[];
  keyNumbers: { label: string; value: string; note?: string }[];
  proformaTitle: string;
  proformaLines: string[];
  topTraps: string[];
  memoryHook: string;
  kitRefs: string;
}

export interface TopicDefinition {
  id: number;
  title: string;
  stChapter: string;
  syllabusArea: 'Income Tax & NIC' | 'Corporation Tax' | 'Chargeable Gains' | 'Inheritance Tax' | 'VAT' | 'UK Tax System';
  kitRange: string;
  extractedCount: number;
  totalKitCount: number;
  phase1: TopicPhase1Card;
}

export type RagStatus = 'unstarted' | 'red' | 'amber' | 'green';

export interface TopicProgress {
  topicId: number;
  attempts: number;
  marksScored: number;
  marksAvailable: number;
  mastery: number; // 0-100
  rag: RagStatus;
  tierUnlocked: 1 | 2 | 3 | 4;
  consecutiveCleanPasses: number;
  tier3Passed: boolean;
  lastPracticedIso: string | null;
}

export interface MistakeEntry {
  id: string;
  questionId: string;
  topicId: number;
  topicName: string;
  ruleMissed: string;
  userAnswerSummary: string;
  correctAnswerSummary: string;
  kitCitation: string;
  createdIso: string;
  srsStage: 0 | 1 | 2 | 3; // 0=+1d, 1=+3d, 2=+7d, 3=graduated(+14d)
  nextReviewIso: string;
  resolvedCount: number;
}

export interface TrapLedgerEntry {
  trapCategory: string;
  ruleSummary: string;
  hitCount: number;
  avoidedCount: number;
  questionIds: string[];
  lastHitIso: string;
  microDrillRequired: boolean;
}

export interface AttemptRecord {
  id: string;
  questionId: string;
  topicId: number;
  section: SectionType;
  tier: 1 | 2 | 3 | 4;
  marksScored: number;
  marksAvailable: number;
  freeMarksCaptured: number;
  freeMarksTotal: number;
  trapAvoided: boolean;
  trapCategory: string;
  timestampIso: string;
  elapsedSeconds: number;
  isVariant?: boolean;
}

export interface MemoryCardState {
  cardId: string;
  rating: number; // 1-5
  nextReviewIso: string;
  reviewCount: number;
}

export interface UserProfile {
  examDate: string; // YYYY-MM-DD
  attemptType: 'first' | 'resit';
  previousScore?: number;
  hoursPerWeek: number;
  preferredSectionOrder: 'A-B-C' | 'C-B-A' | 'B-C-A';
  onboarded: boolean;
}

export interface MockResultRecord {
  id: string;
  mode: 'full_specimen' | 'quick_mock' | 'it_abc_mock' | 'custom_mock';
  title: string;
  completedIso: string;
  marksScored: number;
  marksAvailable: number;
  sectionBreakdown: { section: SectionType; scored: number; available: number }[];
  elapsedSeconds: number;
}

export interface AppState {
  version: number;
  profile: UserProfile;
  streakDays: number;
  lastStudyDate: string | null; // YYYY-MM-DD
  topicProgress: Record<number, TopicProgress>;
  attempts: AttemptRecord[];
  mistakes: MistakeEntry[];
  trapLedger: Record<string, TrapLedgerEntry>;
  memoryStates: Record<string, MemoryCardState>;
  mockHistory: MockResultRecord[];
  studyTextLoaded: boolean;
  studyTextName: string | null;
}
