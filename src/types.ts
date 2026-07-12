export type TestName = "Math" | "Reading and Writing";
export type Difficulty = "Easy" | "Medium" | "Hard";
export type QType = "mc" | "grid";

/** Lightweight record from data/index.json - one per question. */
export interface QuestionMeta {
  id: string;
  pdf: string;
  test: TestName;
  domain: string;
  skill: string;
  difficulty: Difficulty | "";
  page: number;
  type: QType;
  qImg: boolean;
  rImg: boolean;
}

/** Full content from data/content/<bundle>.json. */
export interface QuestionContent {
  id: string;
  stem: string;
  choices: Partial<Record<"A" | "B" | "C" | "D", string>>;
  type: QType;
  correct: string | null; // MC answer letter
  accepted: string[]; // grid-in accepted answers
  rationale: string;
  qImg: boolean;
  rImg: boolean;
}

export type Question = QuestionMeta & Partial<QuestionContent>;

/** Per-question state inside a running session. */
export interface SessionItem {
  id: string;
  answer: string | null; // chosen letter or typed grid-in value
  marked: boolean;
  eliminated: string[]; // MC choices crossed out
  visited: boolean;
  timeMs: number;
  correct: boolean | null; // graded on submit
}

export type SessionStatus = "active" | "completed";

export interface SessionConfig {
  label: string;
  tests: TestName[];
  domains: string[];
  skills: string[];
  difficulties: Difficulty[];
  count: number;
  timed: boolean;
  durationSec: number;
  source: "custom" | "review" | "quick";
}

export interface Session {
  id: string;
  config: SessionConfig;
  items: SessionItem[];
  cursor: number;
  status: SessionStatus;
  startedAt: number;
  completedAt: number | null;
  remainingSec: number | null;
}

/** Append-only log entry written each time a question is graded. */
export interface Attempt {
  qid: string;
  sessionId: string;
  test: TestName;
  domain: string;
  skill: string;
  difficulty: Difficulty | "";
  correct: boolean;
  answered: boolean;
  ts: number;
}

export interface Settings {
  theme: "dark" | "light";
  defaultTimed: boolean;
  perQuestionSec: number;
}
