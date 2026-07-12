import { useEffect, useState } from "react";
import { SYNC_ENABLED } from "../config";
import { useAuth } from "../lib/auth";
import { getSyncStatus, onSyncStatus, type SyncStatus } from "../lib/sync";

const LABEL: Record<SyncStatus, string> = {
  off: "Not connected",
  connecting: "Syncing…",
  syncing: "Saving…",
  synced: "Synced",
  error: "Sync error",
};

export default function SyncStatus() {
  const { user, signInWithGoogle } = useAuth();
  const [status, setStatus] = useState<SyncStatus>(getSyncStatus());
  const [busy, setBusy] = useState(false);

  useEffect(() => onSyncStatus(setStatus), []);

  if (!SYNC_ENABLED || !user) return null;

  const icon = status === "synced" ? "☁" : status === "error" ? "⚠" : "↻";
  const needsConnect = status === "off" || status === "error";

  const connect = async () => {
    setBusy(true);
    try {
      await signInWithGoogle();
    } finally {
      setBusy(false);
    }
  };

  if (needsConnect) {
    return (
      <button
        type="button"
        className={`sync-chip ${status === "error" ? "error" : "connecting"}`}
        title="Connect cloud sync across your devices"
        disabled={busy}
        onClick={() => void connect()}
      >
        {busy ? "↻ Connecting…" : `${icon} ${LABEL[status]} — tap to connect`}
      </button>
    );
  }

  return (
    <span className={`sync-chip ${status}`} title="Cloud progress sync across your devices">
      {icon} {LABEL[status]}
    </span>
  );
}
