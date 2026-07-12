import type { ReactNode } from "react";

export function Loader({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="loader">
      <div className="spinner" />
      <div>{label}</div>
    </div>
  );
}

export function accuracyClass(acc: number): "good" | "warn" | "bad" {
  if (acc >= 0.8) return "good";
  if (acc >= 0.6) return "warn";
  return "bad";
}

export function ProgressBar({ value, tone }: { value: number; tone?: "good" | "warn" | "bad" }) {
  const pct = Math.max(0, Math.min(100, value * 100));
  return (
    <div className={`pbar ${tone ?? ""}`}>
      <span style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Ring({
  value,
  size = 96,
  stroke = 9,
  label,
  sub,
}: {
  value: number;
  size?: number;
  stroke?: number;
  label?: ReactNode;
  sub?: ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(1, value));
  const tone = accuracyClass(pct);
  const color = tone === "good" ? "var(--good)" : tone === "warn" ? "var(--warn)" : "var(--bad)";
  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <svg width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--bg-elev-2)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: "stroke-dashoffset 0.5s ease" }}
        />
      </svg>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "grid",
          placeItems: "center",
          textAlign: "center",
          lineHeight: 1.1,
        }}
      >
        <div>
          <div style={{ fontWeight: 800, fontSize: size * 0.24 }}>{label}</div>
          {sub && <div className="faint" style={{ fontSize: size * 0.12 }}>{sub}</div>}
        </div>
      </div>
    </div>
  );
}

export function DifficultyChip({ difficulty }: { difficulty: string }) {
  const cls = difficulty.toLowerCase();
  return <span className={`chip ${cls}`}>{difficulty || "Unrated"}</span>;
}

export function Empty({ icon = "◎", title, children }: { icon?: string; title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <div className="big">{icon}</div>
      <h3>{title}</h3>
      {children && <p className="muted">{children}</p>}
    </div>
  );
}
