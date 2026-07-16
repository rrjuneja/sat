import type { ActivityEntry, Attempt, QuestionMeta, TestName } from "../types";

export interface CategoryStat {
  key: string;
  label: string;
  attempted: number; // unique questions attempted
  total: number; // total questions available
  correct: number; // attempts correct (latest per question)
  answered: number; // attempts answered
  accuracy: number; // correct / answered
  coverage: number; // attempted / total
  timeMs: number; // total time across answered questions
  avgTimeMs: number; // time per answered question
}

/** Keep only the most recent attempt per question, so accuracy reflects current skill. */
export function latestPerQuestion(attempts: Attempt[]): Map<string, Attempt> {
  const map = new Map<string, Attempt>();
  for (const a of attempts) {
    const prev = map.get(a.qid);
    if (!prev || a.ts > prev.ts) map.set(a.qid, a);
  }
  return map;
}

function build(
  index: QuestionMeta[],
  latest: Map<string, Attempt>,
  keyOf: (q: QuestionMeta) => string,
  labelOf: (q: QuestionMeta) => string,
): CategoryStat[] {
  const totals = new Map<string, number>();
  const labels = new Map<string, string>();
  for (const q of index) {
    const k = keyOf(q);
    totals.set(k, (totals.get(k) ?? 0) + 1);
    if (!labels.has(k)) labels.set(k, labelOf(q));
  }
  const attempted = new Map<string, number>();
  const correct = new Map<string, number>();
  const answered = new Map<string, number>();
  const timeMs = new Map<string, number>();
  const metaById = new Map(index.map((q) => [q.id, q]));
  for (const [qid, a] of latest) {
    if (!metaById.has(qid)) continue;
    const k = keyOf(metaById.get(qid)!);
    attempted.set(k, (attempted.get(k) ?? 0) + 1);
    if (a.answered) {
      answered.set(k, (answered.get(k) ?? 0) + 1);
      timeMs.set(k, (timeMs.get(k) ?? 0) + (a.timeMs ?? 0));
    }
    if (a.correct) correct.set(k, (correct.get(k) ?? 0) + 1);
  }
  const out: CategoryStat[] = [];
  for (const [k, total] of totals) {
    const att = attempted.get(k) ?? 0;
    const ans = answered.get(k) ?? 0;
    const cor = correct.get(k) ?? 0;
    const tms = timeMs.get(k) ?? 0;
    out.push({
      key: k,
      label: labels.get(k) ?? k,
      attempted: att,
      total,
      correct: cor,
      answered: ans,
      accuracy: ans ? cor / ans : 0,
      coverage: total ? att / total : 0,
      timeMs: tms,
      avgTimeMs: ans ? tms / ans : 0,
    });
  }
  return out.sort((a, b) => a.label.localeCompare(b.label));
}

export function statsByTest(index: QuestionMeta[], latest: Map<string, Attempt>): CategoryStat[] {
  return build(index, latest, (q) => q.test, (q) => q.test);
}

export function statsByDomain(
  index: QuestionMeta[],
  latest: Map<string, Attempt>,
  test?: TestName,
): CategoryStat[] {
  const scoped = test ? index.filter((q) => q.test === test) : index;
  return build(scoped, latest, (q) => `${q.test}::${q.domain}`, (q) => q.domain);
}

export function statsBySkill(
  index: QuestionMeta[],
  latest: Map<string, Attempt>,
  test: TestName,
  domain: string,
): CategoryStat[] {
  const scoped = index.filter((q) => q.test === test && q.domain === domain);
  return build(scoped, latest, (q) => q.skill, (q) => q.skill);
}

export function statsByDifficulty(index: QuestionMeta[], latest: Map<string, Attempt>): CategoryStat[] {
  const order = ["Easy", "Medium", "Hard", ""];
  return build(index, latest, (q) => q.difficulty || "Unrated", (q) => q.difficulty || "Unrated").sort(
    (a, b) => order.indexOf(a.label === "Unrated" ? "" : a.label) - order.indexOf(b.label === "Unrated" ? "" : b.label),
  );
}

// ---- Calendar / streaks ----------------------------------------------------

export function dayKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export interface DayActivity {
  date: string;
  /** Questions attempted (graded) that day. */
  answered: number;
  correct: number;
  /** Total time spent on questions that day. */
  timeMs: number;
  /** Distinct practice sessions with activity that day. */
  sessions: number;
}

export function activityByDay(attempts: Attempt[]): Map<string, DayActivity> {
  const map = new Map<string, DayActivity>();
  const sessionIds = new Map<string, Set<string>>();
  for (const a of attempts) {
    const key = dayKey(a.ts);
    const d = map.get(key) ?? { date: key, answered: 0, correct: 0, timeMs: 0, sessions: 0 };
    d.answered += 1;
    if (a.correct) d.correct += 1;
    d.timeMs += a.timeMs ?? 0;
    if (!sessionIds.has(key)) sessionIds.set(key, new Set());
    sessionIds.get(key)!.add(a.sessionId);
    map.set(key, d);
  }
  for (const [key, ids] of sessionIds) {
    const d = map.get(key);
    if (d) d.sessions = ids.size;
  }
  return map;
}

/** Daily totals from the activity audit log (includes instant-feedback reveals). */
export function activityByDayFromLog(entries: ActivityEntry[]): Map<string, DayActivity> {
  const map = new Map<string, DayActivity>();
  const sessionIds = new Map<string, Set<string>>();
  for (const e of entries) {
    if (e.kind !== "question") continue;
    const key = dayKey(e.ts);
    const d = map.get(key) ?? { date: key, answered: 0, correct: 0, timeMs: 0, sessions: 0 };
    d.answered += 1;
    if (e.correct) d.correct += 1;
    d.timeMs += e.timeMs ?? 0;
    if (!sessionIds.has(key)) sessionIds.set(key, new Set());
    sessionIds.get(key)!.add(e.sessionId);
    map.set(key, d);
  }
  for (const [key, ids] of sessionIds) {
    const d = map.get(key);
    if (d) d.sessions = ids.size;
  }
  return map;
}

/**
 * Calendar activity — prefer the audit log (matches History), backfill older days
 * from submitted attempts when no log exists for that day.
 */
export function calendarActivity(attempts: Attempt[], log: ActivityEntry[]): Map<string, DayActivity> {
  const fromLog = activityByDayFromLog(log);
  const fromAttempts = activityByDay(attempts);
  const out = new Map(fromLog);
  for (const [key, a] of fromAttempts) {
    const existing = out.get(key);
    if (!existing?.answered && a.answered > 0) out.set(key, a);
  }
  return out;
}

/** Activity log entries for a single calendar day (newest first). */
export function filterEntriesByDay(entries: ActivityEntry[], dateKey: string): ActivityEntry[] {
  return entries.filter((e) => dayKey(e.ts) === dateKey).sort((a, b) => b.ts - a.ts);
}

export function currentStreak(activity: Map<string, DayActivity>): number {
  let streak = 0;
  const d = new Date();
  // if there is no activity today, start counting from yesterday
  if (!activity.has(dayKey(d.getTime()))) d.setDate(d.getDate() - 1);
  while (activity.has(dayKey(d.getTime()))) {
    streak++;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

export interface Totals {
  answered: number;
  correct: number;
  accuracy: number;
  attemptedUnique: number;
  totalQuestions: number;
  timeMs: number; // total time across answered questions
  avgTimeMs: number; // time per answered question
}

export function overallTotals(index: QuestionMeta[], latest: Map<string, Attempt>): Totals {
  let answered = 0;
  let correct = 0;
  let timeMs = 0;
  for (const a of latest.values()) {
    if (a.answered) {
      answered++;
      timeMs += a.timeMs ?? 0;
    }
    if (a.correct) correct++;
  }
  return {
    answered,
    correct,
    accuracy: answered ? correct / answered : 0,
    attemptedUnique: latest.size,
    totalQuestions: index.length,
    timeMs,
    avgTimeMs: answered ? timeMs / answered : 0,
  };
}

// ---- Time analysis ---------------------------------------------------------

/** Format a millisecond duration as m:ss (or h:mm:ss for long spans). */
export function fmtDuration(ms: number): string {
  const total = Math.round(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export interface SlowQuestion {
  meta: QuestionMeta;
  timeMs: number;
  correct: boolean;
  sessionId: string;
}

/** Answered questions ranked by time spent (latest attempt per question). */
export function slowestQuestions(
  index: QuestionMeta[],
  latest: Map<string, Attempt>,
  limit = 8,
): SlowQuestion[] {
  const metaById = new Map(index.map((q) => [q.id, q]));
  const rows: SlowQuestion[] = [];
  for (const [qid, a] of latest) {
    const meta = metaById.get(qid);
    if (!meta || !a.answered || !(a.timeMs > 0)) continue;
    rows.push({ meta, timeMs: a.timeMs, correct: a.correct, sessionId: a.sessionId });
  }
  return rows.sort((x, y) => y.timeMs - x.timeMs).slice(0, limit);
}
