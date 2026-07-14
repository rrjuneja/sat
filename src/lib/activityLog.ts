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

/** Log one question attempt (on reveal or session submit). */
export function logQuestionAttempt(input: QuestionLogInput): void {
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
  void record(entry);
}

/** Recent activity — prefers Firestore when online, falls back to local cache. */
export async function fetchActivityLog(max = FETCH_LIMIT): Promise<ActivityEntry[]> {
  if (SYNC_ENABLED) {
    const db = getFirestoreDb();
    if (db) {
      try {
        const q = query(collection(db, COLLECTION), orderBy("ts", "desc"), limit(max));
        const snap = await getDocs(q);
        if (!snap.empty) {
          return snap.docs.map((d) => d.data() as ActivityEntry);
        }
      } catch (e) {
        console.warn("Activity log cloud read failed, using local cache", e);
      }
    }
  }
  const local = await readLocal();
  return [...local].sort((a, b) => b.ts - a.ts).slice(0, max);
}

export function onActivityLogChanged(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export async function clearActivityLogLocal(): Promise<void> {
  await localforage.removeItem(LOCAL_KEY);
  notify();
}
