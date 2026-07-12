import type { DayActivity } from "../lib/stats";
import { dayKey } from "../lib/stats";

function level(n: number): string {
  if (n <= 0) return "";
  if (n < 5) return "l1";
  if (n < 12) return "l2";
  if (n < 25) return "l3";
  return "l4";
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default function CalendarHeatmap({
  activity,
  weeks = 26,
}: {
  activity: Map<string, DayActivity>;
  weeks?: number;
}) {
  const today = new Date();
  // start on the Sunday of the week that is (weeks-1) weeks ago
  const start = new Date(today);
  start.setDate(start.getDate() - start.getDay() - (weeks - 1) * 7);

  const cols: { date: Date; key: string }[][] = [];
  const monthLabels: { col: number; label: string }[] = [];
  let lastMonth = -1;

  for (let w = 0; w < weeks; w++) {
    const col: { date: Date; key: string }[] = [];
    for (let d = 0; d < 7; d++) {
      const date = new Date(start);
      date.setDate(start.getDate() + w * 7 + d);
      col.push({ date, key: dayKey(date.getTime()) });
    }
    const m = col[0].date.getMonth();
    if (m !== lastMonth) {
      monthLabels.push({ col: w, label: MONTHS[m] });
      lastMonth = m;
    }
    cols.push(col);
  }

  const todayKey = dayKey(today.getTime());

  return (
    <div>
      <div className="heatmap">
        {cols.map((col, i) => (
          <div className="week" key={i}>
            {col.map(({ date, key }) => {
              const a = activity.get(key);
              const future = date > today;
              const title = future
                ? ""
                : `${key}: ${a ? `${a.answered} answered, ${a.correct} correct` : "no activity"}`;
              return (
                <div
                  key={key}
                  className={`cell ${a ? level(a.answered) : ""} ${key === todayKey ? "today" : ""}`}
                  title={title}
                  style={future ? { visibility: "hidden" } : undefined}
                />
              );
            })}
          </div>
        ))}
      </div>
      <div className="heatmap-legend" style={{ marginTop: 8 }}>
        <span>Less</span>
        <div className="cell" style={{ width: 13, height: 13, borderRadius: 3 }} />
        <div className="cell l1" style={{ width: 13, height: 13, borderRadius: 3 }} />
        <div className="cell l2" style={{ width: 13, height: 13, borderRadius: 3 }} />
        <div className="cell l3" style={{ width: 13, height: 13, borderRadius: 3 }} />
        <div className="cell l4" style={{ width: 13, height: 13, borderRadius: 3 }} />
        <span>More</span>
        <span className="spacer" style={{ flex: 1 }} />
        <span>{monthLabels.map((m) => m.label).filter((v, i, a) => a.indexOf(v) === i).join(" · ")}</span>
      </div>
    </div>
  );
}
