import { doc, onSnapshot, runTransaction } from "firebase/firestore";
import type { Attempt, Session } from "../types";
import { getFirestoreDb } from "./firebase";
import { getAttempts, getBookmarks, getSessions, applyRemoteState } from "./store";

const DOC_PATH = ["appState", "main"] as const;

export interface SyncPayload {
  version: 1;
  sessions: Record<string, Session>;
  attempts: Attempt[];
  bookmarks: string[];
  updatedAt: number;
  updatedBy: string;
}

export type SyncStatus = "off" | "connecting" | "synced" | "syncing" | "error";

const listeners = new Set<() => void>();
const statusListeners = new Set<(s: SyncStatus) => void>();

let status: SyncStatus = "off";
let stopSnapshot: (() => void) | null = null;
let pushTimer: ReturnType<typeof setTimeout> | null = null;
let lastSeenRemoteAt = 0;
let lastPushAt = 0;
let activeEmail: string | null = null;

function emptyPayload(email: string): SyncPayload {
  return { version: 1, sessions: {}, attempts: [], bookmarks: [], updatedAt: 0, updatedBy: email };
}

function attemptKey(a: Attempt): string {
  return `${a.qid}|${a.sessionId}|${a.ts}`;
}

function sessionStamp(s: Session): number {
  return s.completedAt ?? s.startedAt ?? 0;
}

export function mergeSync(local: SyncPayload, remote: SyncPayload): SyncPayload {
  const sessions = { ...remote.sessions };
  for (const [id, s] of Object.entries(local.sessions)) {
    const r = sessions[id];
    if (!r || sessionStamp(s) >= sessionStamp(r)) sessions[id] = s;
  }

  const attemptMap = new Map<string, Attempt>();
  for (const a of remote.attempts) attemptMap.set(attemptKey(a), a);
  for (const a of local.attempts) attemptMap.set(attemptKey(a), a);
  const attempts = [...attemptMap.values()].sort((a, b) => a.ts - b.ts);

  const bookmarks = [...new Set([...remote.bookmarks, ...local.bookmarks])];

  return {
    version: 1,
    sessions,
    attempts,
    bookmarks,
    updatedAt: Math.max(local.updatedAt, remote.updatedAt),
    updatedBy: local.updatedAt >= remote.updatedAt ? local.updatedBy : remote.updatedBy,
  };
}

function setStatus(next: SyncStatus) {
  status = next;
  statusListeners.forEach((fn) => fn(next));
}

export function getSyncStatus(): SyncStatus {
  return status;
}

export function onSyncStatus(fn: (s: SyncStatus) => void): () => void {
  statusListeners.add(fn);
  fn(status);
  return () => statusListeners.delete(fn);
}

export function onDataChanged(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function notifyDataChanged() {
  listeners.forEach((fn) => fn());
}

async function readLocalPayload(email: string): Promise<SyncPayload> {
  const [sessions, attempts, bookmarks] = await Promise.all([getSessions(), getAttempts(), getBookmarks()]);
  return {
    version: 1,
    sessions,
    attempts,
    bookmarks,
    updatedAt: Date.now(),
    updatedBy: email,
  };
}

async function writeLocalPayload(payload: SyncPayload): Promise<void> {
  await applyRemoteState({
    sessions: payload.sessions,
    attempts: payload.attempts,
    bookmarks: payload.bookmarks,
  });
  notifyDataChanged();
}

async function pushNow(email: string): Promise<void> {
  const db = getFirestoreDb();
  if (!db) return;

  setStatus("syncing");
  try {
    const local = await readLocalPayload(email);
    const ref = doc(db, DOC_PATH[0], DOC_PATH[1]);

    const merged = await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      const remote = snap.exists() ? (snap.data() as SyncPayload) : emptyPayload(email);
      const out = mergeSync(local, remote);
      out.updatedAt = Date.now();
      out.updatedBy = email;
      tx.set(ref, out);
      return out;
    });

    lastPushAt = merged.updatedAt;
    lastSeenRemoteAt = Math.max(lastSeenRemoteAt, merged.updatedAt);
    await writeLocalPayload(merged);
    setStatus("synced");
  } catch (e) {
    console.warn("Cloud sync push failed", e);
    setStatus("error");
  }
}

/** Debounced push after a local write. */
export function scheduleSyncPush(email: string | null | undefined): void {
  if (!email) return;
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    pushTimer = null;
    void pushNow(email);
  }, 700);
}

export function startSync(email: string): void {
  const db = getFirestoreDb();
  if (!db) {
    setStatus("off");
    return;
  }

  stopSync();
  activeEmail = email;
  setStatus("connecting");

  const ref = doc(db, DOC_PATH[0], DOC_PATH[1]);
  stopSnapshot = onSnapshot(
    ref,
    (snap) => {
      void (async () => {
        if (!snap.exists()) {
          await pushNow(email);
          return;
        }

        const remote = snap.data() as SyncPayload;
        if (remote.updatedAt <= lastSeenRemoteAt) {
          setStatus("synced");
          return;
        }

        // Skip echo from our own recent push — local state already matches.
        if (remote.updatedBy === email && remote.updatedAt <= lastPushAt + 3000) {
          lastSeenRemoteAt = remote.updatedAt;
          setStatus("synced");
          return;
        }

        const local = await readLocalPayload(email);
        const merged = mergeSync(local, remote);
        lastSeenRemoteAt = remote.updatedAt;
        await writeLocalPayload(merged);
        setStatus("synced");
      })();
    },
    (err) => {
      console.warn("Cloud sync listener error", err);
      setStatus("error");
    },
  );
}

export function stopSync(): void {
  stopSnapshot?.();
  stopSnapshot = null;
  if (pushTimer) {
    clearTimeout(pushTimer);
    pushTimer = null;
  }
  activeEmail = null;
  lastSeenRemoteAt = 0;
  lastPushAt = 0;
  setStatus("off");
}

export function getActiveSyncEmail(): string | null {
  return activeEmail;
}
