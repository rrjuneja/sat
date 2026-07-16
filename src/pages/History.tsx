import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import type { ActivityEntry } from "../types";
import { fetchActivityLog, onActivityLogChanged } from "../lib/activityLog";
import { filterEntriesByDay } from "../lib/stats";
import ActivityEntryList from "../components/ActivityEntryList";
import { Loader, Empty } from "../components/ui";

type Filter = "all" | "login" | "question";

function fmtDayLabel(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export default function History() {
  const [searchParams, setSearchParams] = useSearchParams();
  const dateFilter = searchParams.get("date");
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

  const scoped = useMemo(() => {
    if (!entries) return [];
    const base = dateFilter ? filterEntriesByDay(entries, dateFilter) : entries;
    if (filter === "all") return base;
    return base.filter((e) => e.kind === filter);
  }, [entries, filter, dateFilter]);

  const counts = useMemo(() => {
    const base = dateFilter && entries ? filterEntriesByDay(entries, dateFilter) : entries ?? [];
    const c = { login: 0, question: 0 };
    for (const e of base) {
      if (e.kind === "login") c.login++;
      else c.question++;
    }
    return c;
  }, [entries, dateFilter]);

  const clearDate = () => {
    const next = new URLSearchParams(searchParams);
    next.delete("date");
    setSearchParams(next, { replace: true });
  };

  if (entries === null && !error) return <Loader label="Loading activity history…" />;
  if (error) return <Empty icon="⚠" title="Couldn’t load history">{error}</Empty>;

  const totalForScope = dateFilter
    ? filterEntriesByDay(entries ?? [], dateFilter).length
    : entries?.length ?? 0;

  return (
    <div>
      <div className="row" style={{ marginBottom: 4 }}>
        <h1 style={{ margin: 0 }}>{dateFilter ? "Day activity" : "Activity history"}</h1>
        {dateFilter && (
          <Link className="btn sm ghost" to="/" style={{ marginLeft: 12 }}>
            ← Dashboard
          </Link>
        )}
      </div>
      {dateFilter ? (
        <p className="muted small" style={{ marginTop: 4 }}>
          {fmtDayLabel(dateFilter)} · {totalForScope} event{totalForScope === 1 ? "" : "s"}
          {" · "}
          <button type="button" className="linkish" onClick={clearDate}>
            Show all history
          </button>
        </p>
      ) : (
        <p className="muted small" style={{ marginTop: -4 }}>
          Every sign-in and every question attempt is logged here (shared across devices when cloud sync is on).
        </p>
      )}

      <div className="opts" style={{ margin: "16px 0" }}>
        {(
          [
            ["all", `All (${totalForScope})`],
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

      {!scoped.length ? (
        <Empty icon="📋" title={dateFilter ? "No activity this day" : "No activity yet"}>
          {dateFilter
            ? "Nothing was logged on this date. Pick another day on the dashboard calendar."
            : "Sign in and practice — attempts will appear here."}
        </Empty>
      ) : (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <ActivityEntryList entries={scoped} />
        </div>
      )}
    </div>
  );
}
