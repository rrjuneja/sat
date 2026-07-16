import { useMemo, useState } from "react";
import type { DayActivity } from "../lib/stats";
import { dayKey, fmtDuration } from "../lib/stats";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function level(questions: number): string {
  if (questions <= 0) return "";
  if (questions < 5) return "l1";
  if (questions < 12) return "l2";
  if (questions < 25) return "l3";
  return "l4";
}

function parseKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function fmtDayLabel(key: string): string {
  return parseKey(key).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export default function ActivityCalendar({
  activity,
}: {
  activity: Map<string, DayActivity>;
}) {
  const today = new Date();
  const todayKey = dayKey(today.getTime());
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selected, setSelected] = useState<string | null>(todayKey);

  const cells = useMemo(() => {
    const first = new Date(viewYear, viewMonth, 1);
    const startPad = first.getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const rows: ({ key: string; day: number; inMonth: boolean } | null)[] = [];

    for (let i = 0; i < startPad; i++) rows.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(viewYear, viewMonth, d);
      rows.push({ key: dayKey(date.getTime()), day: d, inMonth: true });
    }
    while (rows.length % 7 !== 0) rows.push(null);
    return rows;
  }, [viewYear, viewMonth]);

  const monthSummary = useMemo(() => {
    let sessions = 0;
    let questions = 0;
    let timeMs = 0;
    let activeDays = 0;
    for (const [key, a] of activity) {
      const d = parseKey(key);
      if (d.getFullYear() !== viewYear || d.getMonth() !== viewMonth) continue;
      sessions += a.sessions;
      questions += a.answered;
      timeMs += a.timeMs;
      if (a.answered > 0) activeDays++;
    }
    return { sessions, questions, timeMs, activeDays };
  }, [activity, viewYear, viewMonth]);

  const selectedActivity = selected ? activity.get(selected) : undefined;

  const prevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else setViewMonth((m) => m - 1);
  };

  const nextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else setViewMonth((m) => m + 1);
  };

  const canGoNext =
    viewYear < today.getFullYear() ||
    (viewYear === today.getFullYear() && viewMonth < today.getMonth());

  return (
    <div className="activity-cal">
      <div className="activity-cal-head row">
        <button type="button" className="btn sm ghost" onClick={prevMonth} aria-label="Previous month">
          ←
        </button>
        <h3 style={{ margin: 0, flex: 1, textAlign: "center" }}>
          {MONTHS[viewMonth]} {viewYear}
        </h3>
        <button
          type="button"
          className="btn sm ghost"
          onClick={nextMonth}
          disabled={!canGoNext}
          aria-label="Next month"
        >
          →
        </button>
      </div>

      <div className="activity-cal-summary row small faint">
        <span>{monthSummary.activeDays} active day{monthSummary.activeDays === 1 ? "" : "s"}</span>
        <span>·</span>
        <span>{monthSummary.sessions} session{monthSummary.sessions === 1 ? "" : "s"}</span>
        <span>·</span>
        <span>{monthSummary.questions} question{monthSummary.questions === 1 ? "" : "s"}</span>
        <span>·</span>
        <span>⏱ {monthSummary.timeMs ? fmtDuration(monthSummary.timeMs) : "0:00"}</span>
      </div>

      <div className="activity-cal-grid">
        {WEEKDAYS.map((wd) => (
          <div key={wd} className="activity-cal-wd">
            {wd}
          </div>
        ))}
        {cells.map((cell, i) => {
          if (!cell) return <div key={`pad-${i}`} className="activity-cal-day empty" />;
          const a = activity.get(cell.key);
          const future = cell.key > todayKey;
          const has = !!a && a.answered > 0;
          const isSelected = selected === cell.key;
          const isToday = cell.key === todayKey;
          return (
            <button
              key={cell.key}
              type="button"
              className={`activity-cal-day ${has ? level(a!.answered) : ""} ${isSelected ? "selected" : ""} ${isToday ? "today" : ""}`}
              disabled={future}
              onClick={() => setSelected(cell.key)}
              title={
                has
                  ? `${cell.key}: ${a!.sessions} session(s), ${a!.answered} question(s), ${fmtDuration(a!.timeMs)}`
                  : future
                    ? undefined
                    : `${cell.key}: no activity`
              }
            >
              <span className="day-num">{cell.day}</span>
              {has && (
                <span className="day-stats">
                  <span>{a!.sessions}s</span>
                  <span>{a!.answered}q</span>
                  <span>{fmtDuration(a!.timeMs)}</span>
                </span>
              )}
            </button>
          );
        })}
      </div>

      {selected && (
        <div className="activity-cal-detail">
          <div className="small faint" style={{ marginBottom: 6 }}>
            {fmtDayLabel(selected)}
          </div>
          {selectedActivity && selectedActivity.answered > 0 ? (
            <div className="grid cols-3" style={{ gap: 10 }}>
              <div className="stat compact">
                <span className="value">{selectedActivity.sessions}</span>
                <span className="label">Session{selectedActivity.sessions === 1 ? "" : "s"}</span>
              </div>
              <div className="stat compact">
                <span className="value">{selectedActivity.answered}</span>
                <span className="label">Questions</span>
              </div>
              <div className="stat compact">
                <span className="value">⏱ {fmtDuration(selectedActivity.timeMs)}</span>
                <span className="label">Time spent</span>
              </div>
            </div>
          ) : (
            <p className="muted small" style={{ margin: 0 }}>
              No practice activity recorded this day.
            </p>
          )}
          {selectedActivity && selectedActivity.answered > 0 && (
            <p className="small faint" style={{ margin: "10px 0 0" }}>
              {selectedActivity.correct}/{selectedActivity.answered} correct (
              {Math.round((selectedActivity.correct / selectedActivity.answered) * 100)}%)
            </p>
          )}
        </div>
      )}
    </div>
  );
}
