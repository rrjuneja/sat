import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { ActivityEntry } from "../types";
import { fetchActivityLog, onActivityLogChanged } from "../lib/activityLog";
import { fmtDuration } from "../lib/stats";
import { Loader, Empty } from "../components/ui";

type Filter = "all" | "login" | "question";

function fmtWhen(ts: number): string {
  return new Date(ts).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function History() {
  const [entries, setEntries] = useState<ActivityEntry[] | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(() => {
    fetchActivityLog()
      .then(setEntries)
      .catch((e) => setError(String((e as Error)?.message ?? e)));
  }, []);

  useEffect(() => {
    reload();
    return onActivityLogChanged(reload);
  }, [reload]);

  const filtered = useMemo(() => {
    if (!entries) return [];
    if (filter === "all") return entries;
    return entries.filter((e) => e.kind === filter);
  }, [entries, filter]);

  const counts = useMemo(() => {
    const c = { login: 0, question: 0 };
    for (const e of entries ?? []) {
      if (e.kind === "login") c.login++;
      else c.question++;
    }
    return c;
  }, [entries]);

  if (entries === null && !error) return <Loader label="Loading activity history…" />;
  if (error) return <Empty icon="⚠" title="Couldn’t load history">{error}</Empty>;

  return (
    <div>
      <h1>Activity history</h1>
      <p className="muted small" style={{ marginTop: -4 }}>
        Every sign-in and every question attempt is logged here (shared across devices when cloud sync is on).
      </p>

      <div className="opts" style={{ margin: "16px 0" }}>
        {(
          [
            ["all", `All (${entries?.length ?? 0})`],
            ["login", `Logins (${counts.login})`],
            ["question", `Questions (${counts.question})`],
          ] as const
        ).map(([k, label]) => (
          <button key={k} className={`opt ${filter === k ? "on" : ""}`} onClick={() => setFilter(k)}>
            {label}
          </button>
        ))}
        <span className="spacer" style={{ flex: 1 }} />
        <button className="btn sm ghost" onClick={reload}>
          Refresh
        </button>
      </div>

      {!filtered.length ? (
        <Empty icon="📋" title="No activity yet">
          Sign in and practice — attempts will appear here.
        </Empty>
      ) : (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <ul className="clean activity-list">
            {filtered.map((e) => (
              <li key={e.id} className="activity-row">
                {e.kind === "login" ? (
                  <div className="row" style={{ gap: 12, alignItems: "flex-start" }}>
                    <span className="chip brand">Login</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 650 }}>{e.name}</div>
                      <div className="small faint">{e.email}</div>
                    </div>
                    <span className="small faint">{fmtWhen(e.ts)}</span>
                  </div>
                ) : (
                  <div className="row" style={{ gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
                    <span className={`chip ${e.correct ? "easy" : e.answered ? "hard" : ""}`}>
                      {e.correct ? "Correct" : e.answered ? "Incorrect" : "Skipped"}
                    </span>
                    <div style={{ flex: 1, minWidth: 180 }}>
                      <div style={{ fontWeight: 650 }}>
                        {e.domain} <span className="faint">· {e.skill}</span>
                      </div>
                      <div className="small faint">
                        {e.test === "Math" ? "Math" : "R&W"}
                        {e.difficulty ? ` · ${e.difficulty}` : ""} · {e.email}
                      </div>
                      {e.answered && (
                        <div className="small mono" style={{ marginTop: 4 }}>
                          Answer: <strong>{e.answer}</strong>
                          {e.source === "reveal" && <span className="faint"> · instant check</span>}
                        </div>
                      )}
                    </div>
                    <div className="row small faint" style={{ gap: 8 }}>
                      {e.timeMs > 0 && <span>⏱ {fmtDuration(e.timeMs)}</span>}
                      <Link to={`/results/${e.sessionId}`} className="chip">
                        Session
                      </Link>
                      <span>{fmtWhen(e.ts)}</span>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
