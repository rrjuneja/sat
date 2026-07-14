import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { QuestionContent, QuestionMeta, Session, SessionItem } from "../types";
import { loadContents, loadIndex } from "../lib/data";
import { appendAttempts, getBookmarks, getSession, saveSession, setBookmark } from "../lib/store";
import { gradeSession, isCorrect } from "../lib/session";
import { logQuestionAttempt } from "../lib/activityLog";
import { useAuth } from "../lib/auth";
import QuestionView from "../components/QuestionView";
import { Empty, Loader } from "../components/ui";

function fmt(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function SessionPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [session, setSession] = useState<Session | null>(null);
  const [contents, setContents] = useState<Map<string, QuestionContent>>(new Map());
  const [metaById, setMetaById] = useState<Map<string, QuestionMeta>>(new Map());
  const [bookmarks, setBookmarks] = useState<Set<string>>(new Set());
  const [showNav, setShowNav] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submitting = useRef(false);
  const loggedQuestions = useRef(new Set<string>());

  const logKey = (sessionId: string, qid: string) => `${sessionId}:${qid}`;

  const recordQuestion = useCallback(
    (
      s: Session,
      item: SessionItem,
      source: "reveal" | "submit",
    ) => {
      const email = user?.email;
      if (!email) return;
      const key = logKey(s.id, item.id);
      if (loggedQuestions.current.has(key)) return;
      const meta = metaById.get(item.id);
      const content = contents.get(item.id);
      if (!meta || !content) return;
      loggedQuestions.current.add(key);
      logQuestionAttempt({
        email,
        qid: item.id,
        sessionId: s.id,
        test: meta.test,
        domain: meta.domain,
        skill: meta.skill,
        difficulty: meta.difficulty,
        answer: item.answer,
        correct: isCorrect(content, item.answer),
        answered: item.answer != null && item.answer !== "",
        timeMs: item.timeMs,
        source,
        instant: !!s.config.instant,
      });
    },
    [user?.email, metaById, contents],
  );

  const maybeLogReveal = useCallback(
    (s: Session, item: SessionItem) => {
      if (item.revealed) recordQuestion(s, item, "reveal");
    },
    [recordQuestion],
  );

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const s = id ? await getSession(id) : null;
        if (!s) {
          setError("Session not found.");
          return;
        }
        if (s.status === "completed") {
          navigate(`/results/${s.id}`, { replace: true });
          return;
        }
        const index = await loadIndex();
        const byId = new Map(index.map((m) => [m.id, m]));
        const metas = s.items.map((it) => byId.get(it.id)).filter((m): m is QuestionMeta => !!m);
        const cmap = await loadContents(metas);
        const bms = new Set(await getBookmarks());
        if (!alive) return;
        setMetaById(new Map(metas.map((m) => [m.id, m])));
        setContents(cmap);
        setBookmarks(bms);
        setSession(s);
      } catch (e) {
        if (alive) setError(String((e as Error)?.message ?? e));
      }
    })();
    return () => {
      alive = false;
    };
  }, [id, navigate]);

  const update = useCallback((mut: (s: Session) => Session) => {
    setSession((prev) => {
      if (!prev) return prev;
      const next = mut(prev);
      void saveSession(next);
      return next;
    });
  }, []);

  const submit = useCallback(() => {
    if (submitting.current) return;
    submitting.current = true;
    setSession((prev) => {
      if (!prev) return prev;
      const { session: graded, attempts } = gradeSession(prev, contents, metaById);
      for (const it of graded.items) {
        recordQuestion(graded, it, "submit");
      }
      void (async () => {
        await saveSession(graded);
        await appendAttempts(attempts);
        navigate(`/results/${graded.id}`, { replace: true });
      })();
      return graded;
    });
  }, [contents, metaById, navigate, recordQuestion]);

  // Timer + per-question time accumulation (1s tick while active)
  useEffect(() => {
    if (!session || session.status !== "active") return;
    const t = setInterval(() => {
      setSession((prev) => {
        if (!prev || prev.status !== "active") return prev;
        // Stop accruing time on a question once its answer is revealed (instant
        // feedback) so per-question time reflects time-to-answer, not reading.
        const items = prev.items.map((it, i) =>
          i === prev.cursor && !it.revealed ? { ...it, timeMs: it.timeMs + 1000 } : it,
        );
        let remainingSec = prev.remainingSec;
        if (remainingSec != null) {
          remainingSec = Math.max(0, remainingSec - 1);
          if (remainingSec === 0) {
            const next = { ...prev, items, remainingSec };
            void saveSession(next);
            return next;
          }
        }
        const next = { ...prev, items, remainingSec };
        void saveSession(next);
        return next;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [session?.status]);

  useEffect(() => {
    if (session && session.remainingSec === 0 && session.status === "active") submit();
  }, [session?.remainingSec, session?.status, submit]);

  const current = session?.items[session.cursor];
  const meta = current ? metaById.get(current.id) : undefined;
  const content = current ? contents.get(current.id) : undefined;

  const answeredCount = useMemo(
    () => session?.items.filter((it) => it.answer != null && it.answer !== "").length ?? 0,
    [session],
  );

  if (error) return <div className="content"><Empty icon="⚠" title="Can’t open this test">{error} <div style={{ marginTop: 16 }}><button className="btn" onClick={() => navigate("/practice")}>Back to Practice</button></div></Empty></div>;
  if (!session) return <div className="content"><Loader label="Preparing your test drive…" /></div>;
  if (!current || !meta || !content) {
    return (
      <div className="content">
        <Empty icon="⚠" title="Couldn’t load this question">
          The question data didn’t load. Try exiting and starting a new session.
          <div style={{ marginTop: 16 }}>
            <button className="btn" onClick={() => navigate("/practice")}>Back to Practice</button>
          </div>
        </Empty>
      </div>
    );
  }

  const instant = !!session.config.instant;

  const goto = (i: number) => update((s) => ({ ...s, cursor: Math.max(0, Math.min(s.items.length - 1, i)) }));
  const answer = (value: string | null) =>
    update((s) => {
      const next = {
        ...s,
        items: s.items.map((it, i) => {
          if (i !== s.cursor) return it;
          const reveal = it.revealed || (instant && content.type === "mc" && value != null && value !== "");
          return { ...it, answer: value, visited: true, revealed: reveal };
        }),
      };
      const item = next.items[next.cursor];
      if (item.revealed) maybeLogReveal(next, item);
      return next;
    });
  const revealAnswer = () =>
    update((s) => {
      const next = {
        ...s,
        items: s.items.map((it, i) =>
          i === s.cursor ? { ...it, revealed: (it.answer ?? "").toString().trim() !== "" } : it,
        ),
      };
      const item = next.items[next.cursor];
      if (item.revealed) maybeLogReveal(next, item);
      return next;
    });
  const toggleEliminate = (letter: string) =>
    update((s) => ({
      ...s,
      items: s.items.map((it, i) =>
        i === s.cursor
          ? { ...it, eliminated: it.eliminated.includes(letter) ? it.eliminated.filter((l) => l !== letter) : [...it.eliminated, letter] }
          : it,
      ),
    }));
  const toggleMark = () => {
    update((s) => ({ ...s, items: s.items.map((it, i) => (i === s.cursor ? { ...it, marked: !it.marked } : it)) }));
    const on = !current.marked;
    void setBookmark(current.id, on).then((arr) => setBookmarks(new Set(arr)));
  };
  const toggleBookmark = (on: boolean) => {
    void setBookmark(current.id, on).then((arr) => setBookmarks(new Set(arr)));
  };

  const isLast = session.cursor === session.items.length - 1;

  return (
    <div className="app-shell">
      <div className="content" style={{ paddingBottom: 40 }}>
        <div className="session-bar">
          <button className="btn sm ghost" onClick={() => navigate("/practice")}>← Exit</button>
          <strong>
            Question {session.cursor + 1} <span className="faint">/ {session.items.length}</span>
          </strong>
          <span className="chip">{answeredCount} answered</span>
          <span className="spacer" style={{ flex: 1 }} />
          {session.remainingSec != null && (
            <span className={`timer ${session.remainingSec < 60 ? "low" : ""}`}>⏱ {fmt(session.remainingSec)}</span>
          )}
          <button className="btn sm" onClick={() => setShowNav(true)}>Navigator</button>
        </div>

        <QuestionView
          meta={meta}
          content={content}
          item={current}
          mode={current.revealed ? "review" : "attempt"}
          bookmarked={bookmarks.has(current.id)}
          instant={instant}
          onAnswer={answer}
          onReveal={revealAnswer}
          onToggleEliminate={toggleEliminate}
          onToggleMark={toggleMark}
          onToggleBookmark={toggleBookmark}
        />

        {current.revealed && (
          <div className={`feedback qwrap ${isCorrect(content, current.answer) ? "good" : "bad"}`}>
            {isCorrect(content, current.answer)
              ? "✓ Correct!"
              : content.type === "mc"
                ? `✗ Not quite — the correct answer is ${content.correct}. See the explanation below.`
                : "✗ Not quite — see the accepted answer and explanation below."}
          </div>
        )}

        <div className="qnav-btns qwrap">
          <button className="btn" disabled={session.cursor === 0} onClick={() => goto(session.cursor - 1)}>← Previous</button>
          {!current.revealed && (
            <button className="btn ghost" onClick={() => (isLast ? setShowNav(true) : goto(session.cursor + 1))}>
              Skip →
            </button>
          )}
          <span className="spacer" style={{ flex: 1 }} />
          {isLast ? (
            <button className="btn primary" onClick={() => setShowNav(true)}>Review &amp; submit</button>
          ) : (
            <button className="btn primary" onClick={() => goto(session.cursor + 1)}>Next →</button>
          )}
        </div>
      </div>

      {showNav && (
        <div className="lightbox" onClick={() => setShowNav(false)}>
          <div className="lb-bar" onClick={(e) => e.stopPropagation()}>
            <strong>Question navigator</strong>
            <span className="spacer" style={{ flex: 1 }} />
            <button className="btn sm" onClick={() => setShowNav(false)}>Close ✕</button>
          </div>
          <div className="lb-body" style={{ background: "var(--bg-elev)", padding: 18, color: "var(--text)" }} onClick={(e) => e.stopPropagation()}>
            <div className="row wrap small muted" style={{ marginBottom: 14, gap: 16 }}>
              <span>● Answered: {answeredCount}</span>
              <span>★ Marked: {session.items.filter((it) => it.marked).length}</span>
              <span>○ Unanswered: {session.items.length - answeredCount}</span>
            </div>
            <div className="navigator">
              {session.items.map((it, i) => {
                const answered = it.answer != null && it.answer !== "";
                return (
                  <button
                    key={it.id}
                    className={`navcell ${answered ? "answered" : ""} ${it.marked ? "marked" : ""} ${i === session.cursor ? "current" : ""}`}
                    onClick={() => { goto(i); setShowNav(false); }}
                  >
                    {i + 1}
                  </button>
                );
              })}
            </div>
            <div className="divider" />
            <button className="btn primary lg block" onClick={submit}>
              Submit test ({answeredCount}/{session.items.length} answered)
            </button>
            <p className="faint small center" style={{ marginTop: 10 }}>
              Unanswered questions will be marked incorrect. You can review explanations afterwards.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
