import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { QuestionMeta } from "../types";
import { useIndex } from "../lib/hooks";
import { getBookmarks, saveSession, setBookmark } from "../lib/store";
import { buildSession } from "../lib/session";
import { DifficultyChip, Empty, Loader } from "../components/ui";

export default function Review() {
  const { index, loading } = useIndex();
  const navigate = useNavigate();
  const [bookmarks, setBookmarks] = useState<string[] | null>(null);

  useEffect(() => {
    getBookmarks().then(setBookmarks);
  }, []);

  if (loading || bookmarks === null || !index) return <Loader label="Loading your review list…" />;

  const byId = new Map(index.map((m) => [m.id, m]));
  const saved = bookmarks.map((id) => byId.get(id)).filter((m): m is QuestionMeta => !!m);

  const practiceSaved = async () => {
    if (!saved.length) return;
    const ns = buildSession(
      index,
      { label: "Saved for review", tests: [], domains: [], skills: [], difficulties: [], count: saved.length, timed: false, durationSec: 0, instant: true, source: "review" },
      saved.map((m) => m.id),
    );
    await saveSession(ns);
    navigate(`/session/${ns.id}`);
  };

  const remove = async (id: string) => {
    const arr = await setBookmark(id, false);
    setBookmarks(arr);
  };

  return (
    <div>
      <h1>Review list</h1>
      <p className="muted">Questions you marked for review or saved. Practice them again anytime.</p>

      {saved.length === 0 ? (
        <Empty icon="★" title="No saved questions yet">
          While attempting a test, tap <strong>Mark for review</strong> or <strong>Save</strong> to add questions here.
        </Empty>
      ) : (
        <>
          <button className="btn primary lg block" onClick={practiceSaved} style={{ marginBottom: 16 }}>
            Practice {saved.length} saved question{saved.length > 1 ? "s" : ""}
          </button>
          <div className="card">
            <ul className="clean">
              {saved.map((m) => (
                <li key={m.id} className="cat">
                  <div className="row wrap" style={{ gap: 8 }}>
                    <span className="chip brand">{m.test === "Math" ? "Math" : "R&W"}</span>
                    <span className="small">{m.skill}</span>
                    <DifficultyChip difficulty={m.difficulty} />
                    <span className="small faint">· pg {m.page}</span>
                    <span className="spacer" style={{ flex: 1 }} />
                    <button className="btn sm ghost" onClick={() => remove(m.id)}>Remove</button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
