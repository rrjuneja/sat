import type { Attempt, QuestionMeta, TestName } from "../types";

export interface CategoryStat {
  key: string;
  label: string;
  attempted: number; // unique questions attempted
  total: number; // total questions available
  correct: number; // attempts correct (latest per question)
  answered: number; // attempts answered
  accuracy: number; // correct / answered
  coverage: number; // attempted / total
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
  const metaById = new Map(index.map((q) => [q.id, q]));
  for (const [qid, a] of latest) {
    if (!metaById.has(qid)) continue;
    const k = keyOf(metaById.get(qid)!);
    attempted.set(k, (attempted.get(k) ?? 0) + 1);
    if (a.answered) answered.set(k, (answered.get(k) ?? 0) + 1);
    if (a.correct) correct.set(k, (correct.get(k) ?? 0) + 1);
  }
  const out: CategoryStat[] = [];
  for (const [k, total] of totals) {
    const att = attempted.get(k) ?? 0;
    const ans = answered.get(k) ?? 0;
    const cor = correct.get(k) ?? 0;
    out.push({
      key: k,
      label: labels.get(k) ?? k,
      attempted: att,
      total,
      correct: cor,
      answered: ans,
      accuracy: ans ? cor / ans : 0,
      coverage: total ? att / total : 0,
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
  answered: number;
  correct: number;
}

export function activityByDay(attempts: Attempt[]): Map<string, DayActivity> {
  const map = new Map<string, DayActivity>();
  for (const a of attempts) {
    const key = dayKey(a.ts);
    const d = map.get(key) ?? { date: key, answered: 0, correct: 0 };
    d.answered += 1;
    if (a.correct) d.correct += 1;
    map.set(key, d);
  }
  return map;
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
}

export function overallTotals(index: QuestionMeta[], latest: Map<string, Attempt>): Totals {
  let answered = 0;
  let correct = 0;
  for (const a of latest.values()) {
    if (a.answered) answered++;
    if (a.correct) correct++;
  }
  return {
    answered,
    correct,
    accuracy: answered ? correct / answered : 0,
    attemptedUnique: latest.size,
    totalQuestions: index.length,
  };
}
