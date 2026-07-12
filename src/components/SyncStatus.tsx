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
  const { user } = useAuth();
  const [status, setStatus] = useState<SyncStatus>(getSyncStatus());

  useEffect(() => onSyncStatus(setStatus), []);

  if (!SYNC_ENABLED) return null;

  // Logged out — nothing to show (login gate is up).
  if (!user) return null;

  const icon = status === "synced" ? "☁" : status === "error" ? "⚠" : "↻";
  const hint =
    status === "off"
      ? "Sign out and sign back in to connect cloud sync"
      : "Cloud progress sync across your devices";

  return (
    <span className={`sync-chip ${status === "off" ? "error" : status}`} title={hint}>
      {icon} {LABEL[status]}
    </span>
  );
}
