import type {
  Attempt,
  Difficulty,
  QuestionContent,
  QuestionMeta,
  Session,
  SessionConfig,
  SessionItem,
} from "../types";

export function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function filterQuestions(index: QuestionMeta[], config: SessionConfig): QuestionMeta[] {
  const tests = new Set(config.tests);
  const domains = new Set(config.domains);
  const skills = new Set(config.skills);
  const diffs = new Set(config.difficulties);
  return index.filter((q) => {
    if (tests.size && !tests.has(q.test)) return false;
    if (domains.size && !domains.has(q.domain)) return false;
    if (skills.size && !skills.has(q.skill)) return false;
    if (diffs.size && q.difficulty && !diffs.has(q.difficulty as Difficulty)) return false;
    return true;
  });
}

export function buildSession(index: QuestionMeta[], config: SessionConfig, ids?: string[]): Session {
  let pool: QuestionMeta[];
  if (ids && ids.length) {
    const byId = new Map(index.map((q) => [q.id, q]));
    pool = ids.map((id) => byId.get(id)).filter((q): q is QuestionMeta => !!q);
  } else {
    pool = shuffle(filterQuestions(index, config)).slice(0, config.count);
  }
  const items: SessionItem[] = pool.map((q) => ({
    id: q.id,
    answer: null,
    marked: false,
    eliminated: [],
    visited: false,
    revealed: false,
    timeMs: 0,
    correct: null,
  }));
  return {
    id: uid(),
    config: { ...config, count: items.length },
    items,
    cursor: 0,
    status: "active",
    startedAt: Date.now(),
    completedAt: null,
    remainingSec: config.timed ? config.durationSec : null,
  };
}

function normalizeGrid(v: string): string {
  return v.trim().toLowerCase().replace(/\s+/g, "").replace(/^\+/, "");
}

function toNumber(v: string): number | null {
  const s = v.trim();
  const frac = s.match(/^(-?\d+(?:\.\d+)?)\/(-?\d+(?:\.\d+)?)$/);
  if (frac) {
    const d = parseFloat(frac[2]);
    return d !== 0 ? parseFloat(frac[1]) / d : null;
  }
  const pct = s.match(/^(-?\d+(?:\.\d+)?)%$/);
  if (pct) return parseFloat(pct[1]);
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export function isCorrect(content: QuestionContent, answer: string | null): boolean {
  if (answer == null || answer === "") return false;
  if (content.type === "mc") return answer === content.correct;
  const ua = normalizeGrid(answer);
  const accepted = content.accepted ?? [];
  for (const acc of accepted) {
    if (normalizeGrid(acc) === ua) return true;
    const an = toNumber(acc);
    const un = toNumber(answer);
    if (an != null && un != null && Math.abs(an - un) < 1e-6) return true;
  }
  return false;
}

export function gradeSession(
  session: Session,
  contents: Map<string, QuestionContent>,
  metaById: Map<string, QuestionMeta>,
): { session: Session; attempts: Attempt[] } {
  const now = Date.now();
  const items = session.items.map((it) => {
    const c = contents.get(it.id);
    const correct = c ? isCorrect(c, it.answer) : false;
    return { ...it, correct };
  });
  const graded: Session = { ...session, items, status: "completed", completedAt: now };
  const attempts: Attempt[] = items.map((it) => {
    const m = metaById.get(it.id)!;
    return {
      qid: it.id,
      sessionId: session.id,
      test: m.test,
      domain: m.domain,
      skill: m.skill,
      difficulty: m.difficulty,
      correct: it.correct === true,
      answered: it.answer != null && it.answer !== "",
      timeMs: it.timeMs,
      ts: now,
    };
  });
  return { session: graded, attempts };
}

export function sessionScore(session: Session): { correct: number; answered: number; total: number } {
  let correct = 0;
  let answered = 0;
  for (const it of session.items) {
    if (it.correct) correct++;
    if (it.answer != null && it.answer !== "") answered++;
  }
  return { correct, answered, total: session.items.length };
}
