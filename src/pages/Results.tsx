import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { QuestionContent, QuestionMeta, Session } from "../types";
import { loadContents, loadIndex } from "../lib/data";
import { getBookmarks, getSession, saveSession, setBookmark } from "../lib/store";
import { buildSession, sessionScore } from "../lib/session";
import { fmtDuration } from "../lib/stats";
import QuestionView from "../components/QuestionView";
import { Empty, Loader, Ring } from "../components/ui";

type Filter = "all" | "incorrect" | "marked";

export default function Results() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [session, setSession] = useState<Session | null>(null);
  const [contents, setContents] = useState<Map<string, QuestionContent>>(new Map());
  const [metaById, setMetaById] = useState<Map<string, QuestionMeta>>(new Map());
  const [bookmarks, setBookmarks] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<Filter>("incorrect");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const s = id ? await getSession(id) : null;
        if (!s) return setError("Session not found.");
        const index = await loadIndex();
        const byId = new Map(index.map((m) => [m.id, m]));
        const metas = s.items.map((it) => byId.get(it.id)).filter((m): m is QuestionMeta => !!m);
        const cmap = await loadContents(metas);
        if (!alive) return;
        setMetaById(new Map(metas.map((m) => [m.id, m])));
        setContents(cmap);
        setBookmarks(new Set(await getBookmarks()));
        setSession(s);
      } catch (e) {
        if (alive) setError(String((e as Error)?.message ?? e));
      }
    })();
    return () => { alive = false; };
  }, [id]);

  const score = useMemo(() => (session ? sessionScore(session) : null), [session]);

  if (error) return <Empty icon="⚠" title="Results unavailable">{error}</Empty>;
  if (!session || !score) return <Loader label="Scoring…" />;

  const incorrect = session.items.filter((it) => !it.correct);
  const marked = session.items.filter((it) => it.marked);
  const filtered = filter === "all" ? session.items : filter === "incorrect" ? incorrect : marked;
  const acc = score.total ? score.correct / score.total : 0;
  const totalTimeMs = session.items.reduce((sum, it) => sum + (it.timeMs ?? 0), 0);
  const answeredItems = session.items.filter((it) => it.answer != null && it.answer !== "");
  const avgTimeMs = answeredItems.length
    ? answeredItems.reduce((s, it) => s + (it.timeMs ?? 0), 0) / answeredItems.length
    : 0;

  const index = [...metaById.values()];

  const retryIncorrect = async () => {
    const ids = incorrect.map((it) => it.id);
    if (!ids.length) return;
    const ns = buildSession(index, { ...session.config, label: "Retry incorrect", count: ids.length, source: "review" }, ids);
    await saveSession(ns);
    navigate(`/session/${ns.id}`);
  };

  const toggleBookmark = (qid: string, on: boolean) =>
    void setBookmark(qid, on).then((arr) => setBookmarks(new Set(arr)));

  return (
    <div>
      <div className="row" style={{ marginBottom: 6 }}>
        <button className="btn sm ghost" onClick={() => navigate("/")}>← Dashboard</button>
      </div>
      <h1>Results</h1>

      <div className="card">
        <div className="row wrap" style={{ gap: 24, alignItems: "center" }}>
          <Ring value={acc} size={124} label={`${Math.round(acc * 100)}%`} sub="score" />
          <div className="grid cols-3" style={{ flex: 1, minWidth: 240 }}>
            <div className="stat"><span className="value">{score.correct}/{score.total}</span><span className="label">Correct</span></div>
            <div className="stat"><span className="value">{score.answered}</span><span className="label">Answered</span></div>
            <div className="stat"><span className="value">{incorrect.length}</span><span className="label">Incorrect / skipped</span></div>
            <div className="stat"><span className="value">{fmtDuration(totalTimeMs)}</span><span className="label">Time on questions</span></div>
            <div className="stat"><span className="value">{fmtDuration(avgTimeMs)}</span><span className="label">Avg / question</span></div>
          </div>
        </div>
        <div className="qnav-btns" style={{ marginTop: 4 }}>
          <button className="btn" disabled={!incorrect.length} onClick={retryIncorrect}>Retry incorrect ({incorrect.length})</button>
          <button className="btn primary" onClick={() => navigate("/practice")}>New practice</button>
        </div>
      </div>

      <div className="section-title">
        <h2>Review</h2>
        <span className="spacer" style={{ flex: 1 }} />
        <div className="opts">
          {(["incorrect", "marked", "all"] as Filter[]).map((f) => (
            <button key={f} className={`opt ${filter === f ? "on" : ""}`} onClick={() => setFilter(f)}>
              {f === "incorrect" ? `Incorrect (${incorrect.length})` : f === "marked" ? `Marked (${marked.length})` : `All (${session.items.length})`}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <Empty icon="✓" title={filter === "incorrect" ? "Perfect — nothing incorrect!" : "Nothing here"}>
          {filter === "incorrect" ? "You answered every question correctly." : "Try another filter."}
        </Empty>
      ) : (
        filtered.map((it, n) => {
          const meta = metaById.get(it.id);
          const content = contents.get(it.id);
          if (!meta || !content) return null;
          return (
            <div className="card" key={it.id} style={{ marginTop: 16 }}>
              <div className="row" style={{ marginBottom: 4 }}>
                <span className="tag">Review #{n + 1}</span>
                <span className="spacer" style={{ flex: 1 }} />
                {it.timeMs > 0 && <span className="chip" title="Time spent on this question">⏱ {fmtDuration(it.timeMs)}</span>}
                <span className={`chip ${it.correct ? "easy" : "hard"}`}>{it.correct ? "Correct" : it.answer ? "Incorrect" : "Skipped"}</span>
              </div>
              <QuestionView
                meta={meta}
                content={content}
                item={it}
                mode="review"
                bookmarked={bookmarks.has(it.id)}
                onToggleBookmark={(on) => toggleBookmark(it.id, on)}
              />
            </div>
          );
        })
      )}
    </div>
  );
}
