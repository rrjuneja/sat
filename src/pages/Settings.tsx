import { useEffect, useRef, useState } from "react";
import type { Settings as SettingsType } from "../types";
import { applyTheme } from "../lib/hooks";
import { DEFAULT_SETTINGS, exportAll, getSettings, importAll, resetAll, saveSettings } from "../lib/store";
import { Loader } from "../components/ui";

export default function Settings() {
  const [settings, setSettings] = useState<SettingsType | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getSettings().then(setSettings);
  }, []);

  if (!settings) return <Loader />;

  const update = async (patch: Partial<SettingsType>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    await saveSettings(next);
    if (patch.theme) applyTheme(patch.theme);
  };

  const doExport = async () => {
    const json = await exportAll();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sat-testdrive-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setMsg("Progress exported.");
  };

  const doImport = async (file: File) => {
    try {
      await importAll(await file.text());
      setMsg("Progress imported. Reloading…");
      setTimeout(() => window.location.reload(), 800);
    } catch {
      setMsg("Import failed — the file wasn’t a valid backup.");
    }
  };

  const doReset = async () => {
    if (!confirm("Delete ALL progress, sessions and saved questions on this device? This cannot be undone.")) return;
    await resetAll();
    setMsg("All progress cleared.");
    setTimeout(() => window.location.reload(), 800);
  };

  return (
    <div>
      <h1>Settings</h1>

      {msg && <div className="banner good" style={{ marginBottom: 16 }}>{msg}</div>}

      <div className="card">
        <h3>Appearance</h3>
        <div className="field">
          <label className="switch">
            <input type="checkbox" checked={settings.theme === "light"} onChange={(e) => update({ theme: e.target.checked ? "light" : "dark" })} />
            <span className="track" />
            <span>Light theme</span>
          </label>
        </div>
      </div>

      <div className="card">
        <h3>Practice defaults</h3>
        <div className="field">
          <label className="switch">
            <input type="checkbox" checked={settings.defaultTimed} onChange={(e) => update({ defaultTimed: e.target.checked })} />
            <span className="track" />
            <span>Timed mode by default</span>
          </label>
        </div>
        <div className="field">
          <label>Seconds per question (timed): <strong>{settings.perQuestionSec}s</strong></label>
          <div className="count-input">
            <input type="range" min={30} max={120} step={5} value={settings.perQuestionSec} onChange={(e) => update({ perQuestionSec: Number(e.target.value) })} />
            <span className="mono">{settings.perQuestionSec}s</span>
          </div>
        </div>
      </div>

      <div className="card">
        <h3>Your data</h3>
        <p className="muted small">
          Progress (sessions, attempts, saved questions) syncs in real time across all signed-in devices when cloud
          sync is configured. Theme and practice defaults stay on this device. You can still export/import a JSON backup.
        </p>
        <div className="row wrap" style={{ gap: 10 }}>
          <button className="btn" onClick={doExport}>Export backup</button>
          <button className="btn" onClick={() => fileRef.current?.click()}>Import backup</button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            style={{ display: "none" }}
            onChange={(e) => e.target.files?.[0] && doImport(e.target.files[0])}
          />
          <span className="spacer" style={{ flex: 1 }} />
          <button className="btn danger" onClick={doReset}>Reset all progress</button>
        </div>
      </div>

      <div className="card">
        <h3>About</h3>
        <p className="muted small" style={{ margin: 0 }}>
          SAT Test Drive · offline-first practice app. Questions rendered from the official SAT question-bank exports.
          Works offline once loaded and installs to your home screen as an app.
        </p>
        <button className="btn sm ghost" style={{ marginTop: 12 }} onClick={() => update({ ...DEFAULT_SETTINGS })}>
          Restore default settings
        </button>
      </div>
    </div>
  );
}
