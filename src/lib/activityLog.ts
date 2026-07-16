import localforage from "localforage";
import { addDoc, collection, getDocs, limit, orderBy, query } from "firebase/firestore";
import type { ActivityEntry, ActivityLogin, ActivityQuestion } from "../types";
import { SYNC_ENABLED } from "../config";
import { getFirestoreDb } from "./firebase";

const LOCAL_KEY = "activityLog";
const COLLECTION = "activityLog";
const MAX_LOCAL = 5000;
const FETCH_LIMIT = 300;

const listeners = new Set<() => void>();

export function questionLogKey(sessionId: string, qid: string): string {
  return `${sessionId}:${qid}`;
}

function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

function notify() {
  listeners.forEach((fn) => fn());
}

async function readLocal(): Promise<ActivityEntry[]> {
  return (await localforage.getItem<ActivityEntry[]>(LOCAL_KEY)) ?? [];
}

async function appendLocal(entry: ActivityEntry): Promise<void> {
  const all = await readLocal();
  all.push(entry);
  if (all.length > MAX_LOCAL) all.splice(0, all.length - MAX_LOCAL);
  await localforage.setItem(LOCAL_KEY, all);
  notify();
}

async function pushCloud(entry: ActivityEntry): Promise<void> {
  if (!SYNC_ENABLED) return;
  const db = getFirestoreDb();
  if (!db) return;
  try {
    await addDoc(collection(db, COLLECTION), entry);
  } catch (e) {
    console.warn("Activity log cloud write failed", e);
  }
}

async function record(entry: ActivityEntry): Promise<void> {
  await appendLocal(entry);
  void pushCloud(entry);
}

/** Log a successful Google sign-in. */
export function logLogin(email: string, name: string): void {
  const entry: ActivityLogin = {
    id: uid(),
    kind: "login",
    ts: Date.now(),
    email: email.toLowerCase(),
    name,
  };
  void record(entry);
}

export interface QuestionLogInput {
  email: string;
  qid: string;
  sessionId: string;
  test: ActivityQuestion["test"];
  domain: string;
  skill: string;
  difficulty: ActivityQuestion["difficulty"];
  answer: string | null;
  correct: boolean;
  answered: boolean;
  timeMs: number;
  source: ActivityQuestion["source"];
  instant: boolean;
}

/** Log one question attempt (on reveal or session submit). Skips duplicates for the same session + question. */
export function logQuestionAttempt(input: QuestionLogInput): void {
  void (async () => {
    const key = questionLogKey(input.sessionId, input.qid);
    const local = await readLocal();
    if (local.some((e) => e.kind === "question" && questionLogKey(e.sessionId, e.qid) === key)) {
      return;
    }

    const entry: ActivityQuestion = {
      id: uid(),
      kind: "question",
      ts: Date.now(),
      email: input.email.toLowerCase(),
      qid: input.qid,
      sessionId: input.sessionId,
      test: input.test,
      domain: input.domain,
      skill: input.skill,
      difficulty: input.difficulty,
      answer: input.answer,
      correct: input.correct,
      answered: input.answered,
      timeMs: input.timeMs,
      source: input.source,
      instant: input.instant,
    };
    await record(entry);
  })();
}

/** Question keys already logged for a session (used to avoid re-logging after re-open). */
export async function loggedQuestionKeysForSession(sessionId: string): Promise<Set<string>> {
  const entries = await fetchActivityLog(5000);
  const keys = new Set<string>();
  for (const e of entries) {
    if (e.kind === "question" && e.sessionId === sessionId) {
      keys.add(questionLogKey(e.sessionId, e.qid));
    }
  }
  return keys;
}

/** Recent activity — merges local cache with Firestore, newest first. */
export async function fetchActivityLog(max = FETCH_LIMIT): Promise<ActivityEntry[]> {
  const local = await readLocal();
  let remote: ActivityEntry[] = [];

  if (SYNC_ENABLED) {
    const db = getFirestoreDb();
    if (db) {
      try {
        const q = query(collection(db, COLLECTION), orderBy("ts", "desc"), limit(max));
        const snap = await getDocs(q);
        if (!snap.empty) {
          remote = snap.docs.map((d) => d.data() as ActivityEntry);
        }
      } catch (e) {
        console.warn("Activity log cloud read failed, using local cache", e);
      }
    }
  }

  const byId = new Map<string, ActivityEntry>();
  for (const e of local) byId.set(e.id, e);
  for (const e of remote) byId.set(e.id, e);
  return [...byId.values()].sort((a, b) => b.ts - a.ts).slice(0, max);
}

export function onActivityLogChanged(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export async function clearActivityLogLocal(): Promise<void> {
  await localforage.removeItem(LOCAL_KEY);
  notify();
}
