import { useEffect, useState } from "react";
import { SYNC_ENABLED } from "../config";
import { getSyncStatus, onSyncStatus, type SyncStatus } from "../lib/sync";

const LABEL: Record<SyncStatus, string> = {
  off: "",
  connecting: "Syncing…",
  syncing: "Saving…",
  synced: "Synced",
  error: "Sync error",
};

export default function SyncStatus() {
  const [status, setStatus] = useState<SyncStatus>(getSyncStatus());

  useEffect(() => onSyncStatus(setStatus), []);

  if (!SYNC_ENABLED || status === "off") return null;

  return (
    <span className={`sync-chip ${status}`} title="Cloud progress sync across your devices">
      {status === "synced" ? "☁" : status === "error" ? "⚠" : "↻"} {LABEL[status]}
    </span>
  );
}
