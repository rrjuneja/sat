import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { Attempt, Session, TestName } from "../types";
import { useIndex } from "../lib/hooks";
import { getAttempts, getSessions } from "../lib/store";
import {
  activityByDay,
  currentStreak,
  latestPerQuestion,
  overallTotals,
  statsByDifficulty,
  statsByDomain,
  statsByTest,
  type CategoryStat,
} from "../lib/stats";
import { ProgressBar, Ring, Loader, Empty, accuracyClass } from "../components/ui";
import CalendarHeatmap from "../components/CalendarHeatmap";

function CategoryList({ stats }: { stats: CategoryStat[] }) {
  return (
    <div>
      {stats.map((s) => (
        <div className="cat" key={s.key}>
          <div className="head">
            <span className="name">{s.label}</span>
            <span className="pct" style={{ color: s.answered ? undefined : "var(--text-faint)" }}>
              {s.answered ? `${Math.round(s.accuracy * 100)}%` : "—"}
            </span>
          </div>
          <ProgressBar value={s.answered ? s.accuracy : 0} tone={s.answered ? accuracyClass(s.accuracy) : undefined} />
          <div className="row small faint" style={{ marginTop: 6, gap: 12 }}>
            <span>{s.correct}/{s.answered || 0} correct</span>
            <span className="spacer" style={{ flex: 1 }} />
            <span>{s.attempted}/{s.total} attempted</span>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function Dashboard() {
  const { index, loading, error } = useIndex();
  const [attempts, setAttempts] = useState<Attempt[] | null>(null);
  const [sessions, setSessions] = useState<Record<string, Session>>({});
  const [domainTest, setDomainTest] = useState<TestName | "all">("all");

  useEffect(() => {
    getAttempts().then(setAttempts);
    getSessions().then(setSessions);
  }, []);

  const latest = useMemo(() => latestPerQuestion(attempts ?? []), [attempts]);
  const activity = useMemo(() => activityByDay(attempts ?? []), [attempts]);

  if (loading || attempts === null) return <Loader label="Loading your progress…" />;
  if (error) return <Empty icon="⚠" title="Couldn’t load questions">{error}</Empty>;
  if (!index) return null;

  const totals = overallTotals(index, latest);
  const streak = currentStreak(activity);
  const byTest = statsByTest(index, latest);
  const byDomain = statsByDomain(index, latest, domainTest === "all" ? undefined : domainTest);
  const byDiff = statsByDifficulty(index, latest);
  const recent = Object.values(sessions)
    .filter((s) => s.status === "completed")
    .sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0))
    .slice(0, 6);

  const noData = totals.answered === 0;

  return (
    <div>
      <div className="row" style={{ marginBottom: 6 }}>
        <h1 style={{ margin: 0 }}>Dashboard</h1>
        <span className="spacer" style={{ flex: 1 }} />
        <Link className="btn primary" to="/practice">Start practice</Link>
      </div>
      <p className="muted" style={{ marginTop: 4 }}>
        {totals.totalQuestions.toLocaleString()} questions across Math and Reading &amp; Writing.
      </p>

      {noData && (
        <div className="banner warn" style={{ marginBottom: 16 }}>
          You haven’t answered any questions yet. Head to <Link to="/practice">Practice</Link> to start your first test drive — your progress will appear here.
        </div>
      )}

      {/* Overview */}
      <div className="grid cols-4">
        <div className="card row" style={{ gap: 14 }}>
          <Ring value={totals.accuracy} size={84} label={`${Math.round(totals.accuracy * 100)}%`} />
          <div className="stat"><span className="label">Overall accuracy</span><span className="value" style={{ fontSize: "1.2rem" }}>{totals.correct}/{totals.answered}</span></div>
        </div>
        <div className="card stat"><span className="value">{totals.answered.toLocaleString()}</span><span className="label">Questions answered</span></div>
        <div className="card stat"><span className="value">{totals.attemptedUnique.toLocaleString()}</span><span className="label">Unique attempted</span></div>
        <div className="card stat"><span className="value">🔥 {streak}</span><span className="label">Day streak</span></div>
      </div>

      {/* Calendar */}
      <div className="section-title"><h2>Activity calendar</h2></div>
      <div className="card">
        <CalendarHeatmap activity={activity} weeks={26} />
      </div>

      {/* By section */}
      <div className="section-title"><h2>By section</h2></div>
      <div className="grid cols-2">
        {byTest.map((s) => (
          <div className="card row" key={s.key} style={{ gap: 16 }}>
            <Ring value={s.answered ? s.accuracy : 0} size={92} label={s.answered ? `${Math.round(s.accuracy * 100)}%` : "—"} sub={s.label.startsWith("Math") ? "Math" : "R&W"} />
            <div style={{ flex: 1 }}>
              <h3 style={{ marginBottom: 8 }}>{s.label}</h3>
              <div className="small faint" style={{ marginBottom: 6 }}>{s.correct}/{s.answered || 0} correct · {s.attempted}/{s.total} attempted</div>
              <ProgressBar value={s.coverage} />
              <div className="small faint" style={{ marginTop: 6 }}>{Math.round(s.coverage * 100)}% coverage</div>
            </div>
          </div>
        ))}
      </div>

      {/* By domain */}
      <div className="section-title">
        <h2>By domain</h2>
        <span className="spacer" style={{ flex: 1 }} />
        <div className="opts">
          {(["all", "Math", "Reading and Writing"] as const).map((t) => (
            <button key={t} className={`opt ${domainTest === t ? "on" : ""}`} onClick={() => setDomainTest(t)}>
              {t === "all" ? "All" : t === "Math" ? "Math" : "R&W"}
            </button>
          ))}
        </div>
      </div>
      <div className="card"><CategoryList stats={byDomain} /></div>

      {/* By difficulty */}
      <div className="section-title"><h2>By difficulty</h2></div>
      <div className="card"><CategoryList stats={byDiff} /></div>

      {/* Recent sessions */}
      <div className="section-title"><h2>Recent sessions</h2></div>
      {recent.length === 0 ? (
        <div className="card muted small">No completed sessions yet.</div>
      ) : (
        <div className="card">
          <ul className="clean">
            {recent.map((s) => {
              const total = s.items.length;
              const correct = s.items.filter((it) => it.correct).length;
              const acc = total ? correct / total : 0;
              return (
                <li key={s.id} className="cat">
                  <Link to={`/results/${s.id}`} className="row" style={{ color: "inherit", textDecoration: "none" }}>
                    <div>
                      <div style={{ fontWeight: 650 }}>{s.config.label}</div>
                      <div className="small faint">{new Date(s.completedAt ?? s.startedAt).toLocaleString()} · {total} questions</div>
                    </div>
                    <span className="spacer" style={{ flex: 1 }} />
                    <span className={`chip ${accuracyClass(acc) === "good" ? "easy" : accuracyClass(acc) === "warn" ? "medium" : "hard"}`}>
                      {correct}/{total} · {Math.round(acc * 100)}%
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
