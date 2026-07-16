import { Link } from "react-router-dom";
import type { ActivityEntry } from "../types";
import { fmtDuration } from "../lib/stats";

function fmtWhen(ts: number): string {
  return new Date(ts).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function ActivityEntryList({ entries }: { entries: ActivityEntry[] }) {
  if (!entries.length) {
    return <p className="muted small" style={{ margin: 0 }}>No activity recorded.</p>;
  }

  return (
    <ul className="clean activity-list">
      {entries.map((e) => (
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
  );
}
