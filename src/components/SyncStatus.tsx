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
  const { user, syncError, connectCloudSync } = useAuth();
  const [status, setStatus] = useState<SyncStatus>(getSyncStatus());

  useEffect(() => onSyncStatus(setStatus), []);

  if (!SYNC_ENABLED || !user) return null;

  const icon = status === "synced" ? "☁" : status === "error" ? "⚠" : "↻";
  const needsConnect = status === "off" || status === "error";
  const title = syncError ?? "Cloud progress sync across your devices";

  if (needsConnect) {
    return (
      <button
        type="button"
        className={`sync-chip ${status === "error" || syncError ? "error" : "connecting"}`}
        title={title}
        onClick={connectCloudSync}
      >
        {icon} {syncError ? "Sync setup needed" : `${LABEL[status]} — tap to connect`}
      </button>
    );
  }

  return (
    <span className={`sync-chip ${status}`} title={title}>
      {icon} {LABEL[status]}
    </span>
  );
}
