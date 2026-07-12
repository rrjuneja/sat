import { useEffect } from "react";

export default function Lightbox({
  src,
  title,
  onClose,
}: {
  src: string;
  title: string;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="lightbox" onClick={onClose} role="dialog" aria-modal="true" aria-label={title}>
      <div className="lb-bar" onClick={(e) => e.stopPropagation()}>
        <strong>{title}</strong>
        <span className="spacer" style={{ flex: 1 }} />
        <button className="btn sm" onClick={onClose}>
          Close ✕
        </button>
      </div>
      <div className="lb-body" onClick={(e) => e.stopPropagation()}>
        <img src={src} alt={title} loading="lazy" />
      </div>
    </div>
  );
}
