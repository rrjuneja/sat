import { useState } from "react";
import type { QuestionContent, QuestionMeta, SessionItem } from "../types";
import { questionImageUrl, rationaleImageUrl } from "../lib/data";
import { DifficultyChip } from "./ui";
import Lightbox from "./Lightbox";

const LETTERS = ["A", "B", "C", "D"] as const;

interface Props {
  meta: QuestionMeta;
  content: QuestionContent;
  item: SessionItem;
  mode: "attempt" | "review";
  bookmarked: boolean;
  onAnswer?: (value: string | null) => void;
  onToggleEliminate?: (letter: string) => void;
  onToggleMark?: () => void;
  onToggleBookmark?: (on: boolean) => void;
}

export default function QuestionView({
  meta,
  content,
  item,
  mode,
  bookmarked,
  onAnswer,
  onToggleEliminate,
  onToggleMark,
  onToggleBookmark,
}: Props) {
  const [lightbox, setLightbox] = useState<{ src: string; title: string } | null>(null);
  const review = mode === "review";
  const correct = content.correct;

  return (
    <div className="qwrap">
      <div className="qmeta">
        <span className="chip brand">{meta.test}</span>
        <span className="chip">{meta.domain}</span>
        <span className="chip">{meta.skill}</span>
        <DifficultyChip difficulty={meta.difficulty} />
        <span className="spacer" style={{ flex: 1 }} />
        {mode === "attempt" && onToggleMark && (
          <button
            className={`btn sm mark-btn ${item.marked ? "active" : ""}`}
            onClick={onToggleMark}
            aria-pressed={item.marked}
          >
            {item.marked ? "★ Marked" : "☆ Mark for review"}
          </button>
        )}
        {onToggleBookmark && (
          <button
            className={`btn sm mark-btn ${bookmarked ? "active" : ""}`}
            onClick={() => onToggleBookmark(!bookmarked)}
            title="Save to your review list"
          >
            {bookmarked ? "★ Saved" : "☆ Save"}
          </button>
        )}
      </div>

      {/* Question body — rendered image preserves equations, figures & formatting */}
      {content.qImg ? (
        <div className="qimg-frame">
          <img src={questionImageUrl(meta.id)} alt="Question" loading="lazy" />
        </div>
      ) : (
        <div className="qstem">{content.stem}</div>
      )}

      {/* Answer input */}
      {content.type === "mc" ? (
        <div className="choices">
          {LETTERS.map((letter) => {
            const text = content.choices?.[letter];
            const selected = item.answer === letter;
            const eliminated = item.eliminated.includes(letter);
            let cls = "choice";
            if (review) {
              if (letter === correct) cls += " correct";
              else if (selected) cls += " incorrect";
            } else {
              if (selected) cls += " selected";
              if (eliminated) cls += " eliminated";
            }
            return (
              <div
                key={letter}
                className={cls}
                onClick={() => !review && !eliminated && onAnswer?.(letter)}
                role="button"
                aria-pressed={selected}
              >
                <span className="key">{letter}</span>
                <span className="body">{text || <span className="faint">(see question above)</span>}</span>
                {!review && onToggleEliminate && (
                  <button
                    className="elim"
                    title={eliminated ? "Restore option" : "Cross out option"}
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleEliminate(letter);
                    }}
                  >
                    {eliminated ? "↺" : "✕"}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="gridin">
          <label className="field">
            <span className="tag">Your answer</span>
            <div style={{ height: 8 }} />
            <input
              type="text"
              inputMode="text"
              placeholder="Type your answer"
              value={item.answer ?? ""}
              disabled={review}
              onChange={(e) => onAnswer?.(e.target.value)}
            />
          </label>
          {review && (
            <div className="banner" style={{ marginTop: 4 }}>
              Accepted answer{content.accepted.length > 1 ? "s" : ""}:{" "}
              <strong className="mono">{content.accepted.join("  ·  ")}</strong>
            </div>
          )}
        </div>
      )}

      {/* Source reference — the requested PDF name + page + navigation link */}
      <div className="source-ref">
        <span>📄</span>
        <span>
          Source: <strong>{meta.pdf}</strong> · Page <strong>{meta.page}</strong>
        </span>
        <span className="spacer" style={{ flex: 1 }} />
        <button
          className="btn sm ghost"
          onClick={() => setLightbox({ src: questionImageUrl(meta.id), title: `${meta.pdf} — Page ${meta.page}` })}
        >
          View source page
        </button>
      </div>

      {/* Explanation (review mode) */}
      {review && (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="row" style={{ marginBottom: 10 }}>
            <span className="tag">Explanation</span>
            <span className="spacer" style={{ flex: 1 }} />
            {content.type === "mc" && (
              <span className="chip brand">Correct answer: {correct}</span>
            )}
          </div>
          {content.rImg ? (
            <div className="qimg-frame">
              <img src={rationaleImageUrl(meta.id)} alt="Explanation" loading="lazy" />
            </div>
          ) : content.rationale ? (
            <p style={{ whiteSpace: "pre-wrap", lineHeight: 1.6, margin: 0 }}>{content.rationale}</p>
          ) : (
            <p className="muted" style={{ margin: 0 }}>
              No written explanation was captured for this question. Use “View source page” to see the original.
            </p>
          )}
        </div>
      )}

      {lightbox && <Lightbox src={lightbox.src} title={lightbox.title} onClose={() => setLightbox(null)} />}
    </div>
  );
}
