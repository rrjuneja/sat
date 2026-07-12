import localforage from "localforage";
import type { Attempt, Session, Settings } from "../types";

localforage.config({
  name: "sat-testdrive",
  storeName: "progress",
  description: "SAT practice progress (local cache + optional cloud sync)",
});

const K = {
  sessions: "sessions",
  attempts: "attempts",
  bookmarks: "bookmarks",
  settings: "settings",
} as const;

let writeHook: (() => void) | null = null;
let applyingRemote = false;

/** Called by the cloud-sync layer to push after local writes. */
export function setWriteHook(fn: (() => void) | null): void {
  writeHook = fn;
}

function bump(): void {
  if (applyingRemote) return;
  writeHook?.();
}

/** Apply a remote snapshot without triggering a cloud push. */
export async function applyRemoteState(data: {
  sessions: Record<string, Session>;
  attempts: Attempt[];
  bookmarks: string[];
}): Promise<void> {
  applyingRemote = true;
  try {
    await Promise.all([
      localforage.setItem(K.sessions, data.sessions),
      localforage.setItem(K.attempts, data.attempts),
      localforage.setItem(K.bookmarks, data.bookmarks),
    ]);
  } finally {
    applyingRemote = false;
  }
}

export const DEFAULT_SETTINGS: Settings = {
  theme: "dark",
  defaultTimed: false,
  perQuestionSec: 75,
};

// ---- Sessions --------------------------------------------------------------

export async function getSessions(): Promise<Record<string, Session>> {
  return (await localforage.getItem<Record<string, Session>>(K.sessions)) ?? {};
}

export async function getSession(id: string): Promise<Session | null> {
  const all = await getSessions();
  return all[id] ?? null;
}

export async function saveSession(session: Session): Promise<void> {
  const all = await getSessions();
  all[session.id] = session;
  await localforage.setItem(K.sessions, all);
  bump();
}

export async function deleteSession(id: string): Promise<void> {
  const all = await getSessions();
  delete all[id];
  await localforage.setItem(K.sessions, all);
  bump();
}

// ---- Attempts (append-only history) ---------------------------------------

export async function getAttempts(): Promise<Attempt[]> {
  return (await localforage.getItem<Attempt[]>(K.attempts)) ?? [];
}

export async function appendAttempts(entries: Attempt[]): Promise<void> {
  if (!entries.length) return;
  const all = await getAttempts();
  all.push(...entries);
  await localforage.setItem(K.attempts, all);
  bump();
}

// ---- Bookmarks / marked-for-review (persistent) ---------------------------

export async function getBookmarks(): Promise<string[]> {
  return (await localforage.getItem<string[]>(K.bookmarks)) ?? [];
}

export async function setBookmark(qid: string, on: boolean): Promise<string[]> {
  const set = new Set(await getBookmarks());
  if (on) set.add(qid);
  else set.delete(qid);
  const arr = [...set];
  await localforage.setItem(K.bookmarks, arr);
  bump();
  return arr;
}

// ---- Settings --------------------------------------------------------------

export async function getSettings(): Promise<Settings> {
  return { ...DEFAULT_SETTINGS, ...((await localforage.getItem<Settings>(K.settings)) ?? {}) };
}

export async function saveSettings(s: Settings): Promise<void> {
  await localforage.setItem(K.settings, s);
}

// ---- Data export / import / reset -----------------------------------------

export async function exportAll(): Promise<string> {
  const [sessions, attempts, bookmarks, settings] = await Promise.all([
    getSessions(),
    getAttempts(),
    getBookmarks(),
    getSettings(),
  ]);
  return JSON.stringify(
    { version: 1, exportedAt: Date.now(), sessions, attempts, bookmarks, settings },
    null,
    2,
  );
}

export async function importAll(json: string): Promise<void> {
  const data = JSON.parse(json);
  if (data.sessions) await localforage.setItem(K.sessions, data.sessions);
  if (data.attempts) await localforage.setItem(K.attempts, data.attempts);
  if (data.bookmarks) await localforage.setItem(K.bookmarks, data.bookmarks);
  if (data.settings) await localforage.setItem(K.settings, data.settings);
  bump();
}

export async function resetAll(): Promise<void> {
  await Promise.all([
    localforage.removeItem(K.sessions),
    localforage.removeItem(K.attempts),
    localforage.removeItem(K.bookmarks),
  ]);
  bump();
}
