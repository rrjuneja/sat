import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Difficulty, SessionConfig, TestName } from "../types";
import { useIndex } from "../lib/hooks";
import { buildSession, filterQuestions } from "../lib/session";
import { saveSession } from "../lib/store";
import { fmtDuration } from "../lib/stats";
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
  const [paceSec, setPaceSec] = useState(75);
  const [instant, setInstant] = useState(true);

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
    durationSec: count * paceSec,
    instant,
    source: "custom",
  };

  const matches = useMemo(() => (index ? filterQuestions(index, config).length : 0), [index, config]);
  const effCount = Math.min(count, matches) || 0;

  if (loading) return <Loader label="Loading question bank…" />;
  if (error) return <Empty icon="⚠" title="Couldn’t load questions">{error}</Empty>;
  if (!index) return null;

  const toggle = <T,>(list: T[], v: T, set: (l: T[]) => void) =>
    set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  const start = async () => {
    const session = buildSession(index, { ...config, count: effCount, durationSec: effCount * paceSec });
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
          <label>Number of questions: <strong>{Math.min(count, matches) || 0}</strong> <span className="faint">/ {matches} available</span></label>
          <div className="opts" style={{ marginBottom: 10 }}>
            {[10, 20, 40, 100].map((n) => (
              <button key={n} className={`opt ${count === n ? "on" : ""}`} disabled={n > matches} onClick={() => setCount(n)}>
                {n}
              </button>
            ))}
            <button className={`opt ${count >= matches && matches > 0 ? "on" : ""}`} disabled={!matches} onClick={() => setCount(matches)}>
              All ({matches})
            </button>
          </div>
          <div className="count-input">
            <input
              type="number"
              min={1}
              max={matches || 1}
              value={Math.min(count, matches) || ""}
              onChange={(e) => setCount(Math.max(1, Math.min(Number(e.target.value) || 1, matches)))}
              style={{ width: 110 }}
            />
            <span className="faint small">Enter any amount up to {matches}.</span>
          </div>
        </div>

        <div className="field">
          <label>Feedback</label>
          <label className={`toggle-row ${instant ? "on" : ""}`}>
            <span className="switch">
              <input type="checkbox" checked={instant} onChange={(e) => setInstant(e.target.checked)} />
              <span className="track" />
            </span>
            <span className="toggle-copy">
              <span className="t-title">Instant feedback · {instant ? "on" : "off"}</span>
              <span className="faint small">
                Reveal the correct answer and explanation right after you answer each question. Turn off
                for exam-style practice, where you answer everything first and review at the end.
              </span>
            </span>
          </label>
        </div>

        <div className="field">
          <label>Timing</label>
          <label className={`toggle-row ${timed ? "on" : ""}`}>
            <span className="switch">
              <input type="checkbox" checked={timed} onChange={(e) => setTimed(e.target.checked)} />
              <span className="track" />
            </span>
            <span className="toggle-copy">
              <span className="t-title">Timed mode · {timed ? "on" : "off"}</span>
              <span className="faint small">
                Shows a countdown while you work. When it reaches 0:00 the test auto-submits and any
                unanswered questions are marked incorrect. Leave off to practice at your own pace.
              </span>
            </span>
          </label>

          {timed && (
            <>
              <div className="opts" style={{ marginTop: 12, alignItems: "center" }}>
                <span className="faint small" style={{ marginRight: 4 }}>Pace per question:</span>
                {[60, 75, 90].map((p) => (
                  <button key={p} className={`opt ${paceSec === p ? "on" : ""}`} onClick={() => setPaceSec(p)}>
                    {p}s
                  </button>
                ))}
              </div>
              <div className="time-budget">
                <span className="faint small">Total time budget:</span>
                <span className="big">{fmtDuration(effCount * paceSec * 1000)}</span>
                <span className="faint small">for {effCount} question{effCount === 1 ? "" : "s"} ({paceSec}s each)</span>
              </div>
            </>
          )}
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
