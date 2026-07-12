import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Difficulty, SessionConfig, TestName } from "../types";
import { useIndex } from "../lib/hooks";
import { buildSession, filterQuestions } from "../lib/session";
import { saveSession } from "../lib/store";
import { Empty, Loader } from "../components/ui";

const DIFFS: Difficulty[] = ["Easy", "Medium", "Hard"];

export default function Practice() {
  const { index, loading, error } = useIndex();
  const navigate = useNavigate();

  const [tests, setTests] = useState<TestName[]>([]);
  const [domains, setDomains] = useState<string[]>([]);
  const [skills, setSkills] = useState<string[]>([]);
  const [diffs, setDiffs] = useState<Difficulty[]>([]);
  const [count, setCount] = useState(10);
  const [timed, setTimed] = useState(false);

  const allTests = useMemo<TestName[]>(
    () => [...new Set((index ?? []).map((q) => q.test))] as TestName[],
    [index],
  );
  const availableDomains = useMemo(() => {
    const scoped = (index ?? []).filter((q) => !tests.length || tests.includes(q.test));
    return [...new Set(scoped.map((q) => q.domain))].sort();
  }, [index, tests]);
  const availableSkills = useMemo(() => {
    const scoped = (index ?? []).filter(
      (q) => (!tests.length || tests.includes(q.test)) && (!domains.length || domains.includes(q.domain)),
    );
    return [...new Set(scoped.map((q) => q.skill))].sort();
  }, [index, tests, domains]);

  const config: SessionConfig = {
    label: "Custom practice",
    tests,
    domains,
    skills,
    difficulties: diffs,
    count,
    timed,
    durationSec: count * 75,
    source: "custom",
  };

  const matches = useMemo(() => (index ? filterQuestions(index, config).length : 0), [index, config]);

  if (loading) return <Loader label="Loading question bank…" />;
  if (error) return <Empty icon="⚠" title="Couldn’t load questions">{error}</Empty>;
  if (!index) return null;

  const toggle = <T,>(list: T[], v: T, set: (l: T[]) => void) =>
    set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  const start = async () => {
    const session = buildSession(index, { ...config, count: Math.min(count, matches) });
    if (!session.items.length) return;
    await saveSession(session);
    navigate(`/session/${session.id}`);
  };

  const quickStart = async (cfg: Partial<SessionConfig>) => {
    const full: SessionConfig = { ...config, ...cfg };
    const session = buildSession(index, full);
    if (!session.items.length) return;
    await saveSession(session);
    navigate(`/session/${session.id}`);
  };

  return (
    <div>
      <h1>Practice</h1>
      <p className="muted">Build a custom test drive, or jump straight in with a quick set.</p>

      <div className="grid cols-3" style={{ marginBottom: 8 }}>
        <button className="card" style={btn} onClick={() => quickStart({ label: "Quick 10 · mixed", tests: [], domains: [], skills: [], difficulties: [], count: 10, source: "quick" })}>
          <div style={{ fontSize: "1.6rem" }}>⚡</div>
          <strong>Quick 10</strong>
          <span className="faint small">Mixed, untimed</span>
        </button>
        <button className="card" style={btn} onClick={() => quickStart({ label: "Math sprint · 15", tests: ["Math"], domains: [], skills: [], difficulties: [], count: 15, timed: true, durationSec: 15 * 90, source: "quick" })}>
          <div style={{ fontSize: "1.6rem" }}>🧮</div>
          <strong>Math sprint</strong>
          <span className="faint small">15 questions, timed</span>
        </button>
        <button className="card" style={btn} onClick={() => quickStart({ label: "Reading & Writing · 15", tests: ["Reading and Writing"], domains: [], skills: [], difficulties: [], count: 15, source: "quick" })}>
          <div style={{ fontSize: "1.6rem" }}>📖</div>
          <strong>R&amp;W set</strong>
          <span className="faint small">15 questions, untimed</span>
        </button>
      </div>

      <div className="card">
        <h3>Custom test drive</h3>

        <div className="field">
          <label>Section</label>
          <div className="opts">
            {allTests.map((t) => (
              <button key={t} className={`opt ${tests.includes(t) ? "on" : ""}`} onClick={() => { toggle(tests, t, setTests); setDomains([]); setSkills([]); }}>
                {t}
              </button>
            ))}
          </div>
          <div className="hint">Leave empty to include all sections.</div>
        </div>

        <div className="field">
          <label>Domain</label>
          <div className="opts">
            {availableDomains.map((d) => (
              <button key={d} className={`opt ${domains.includes(d) ? "on" : ""}`} onClick={() => { toggle(domains, d, setDomains); setSkills([]); }}>
                {d}
              </button>
            ))}
          </div>
        </div>

        {availableSkills.length > 0 && availableSkills.length <= 30 && (
          <div className="field">
            <label>Skill</label>
            <div className="opts">
              {availableSkills.map((s) => (
                <button key={s} className={`opt ${skills.includes(s) ? "on" : ""}`} onClick={() => toggle(skills, s, setSkills)}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="field">
          <label>Difficulty</label>
          <div className="opts">
            {DIFFS.map((d) => (
              <button key={d} className={`opt ${diffs.includes(d) ? "on" : ""}`} onClick={() => toggle(diffs, d, setDiffs)}>
                {d}
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <label>Number of questions: <strong>{Math.min(count, matches)}</strong> <span className="faint">/ {matches} available</span></label>
          <div className="count-input">
            <input type="range" min={5} max={50} step={5} value={count} onChange={(e) => setCount(Number(e.target.value))} />
            <span className="mono" style={{ width: 34, textAlign: "right" }}>{count}</span>
          </div>
        </div>

        <div className="field">
          <label className="switch">
            <input type="checkbox" checked={timed} onChange={(e) => setTimed(e.target.checked)} />
            <span className="track" />
            <span>Timed mode {timed && <span className="faint">· {Math.round((count * 75) / 60)} min</span>}</span>
          </label>
        </div>

        <button className="btn primary lg block" disabled={!matches} onClick={start}>
          {matches ? `Start test drive (${Math.min(count, matches)} questions)` : "No questions match your filters"}
        </button>
      </div>
    </div>
  );
}

const btn: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 4,
  alignItems: "flex-start",
  cursor: "pointer",
  textAlign: "left",
};
