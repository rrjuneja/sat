import { useEffect, useRef, useState } from "react";
import { useAuth } from "../lib/auth";

export default function UserMenu() {
  const { enabled, user, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  if (!enabled || !user) return null;

  const initial = (user.name || user.email || "?").trim().charAt(0).toUpperCase();

  return (
    <div className="user-menu" ref={ref}>
      <button className="avatar-btn" onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open} title={user.email}>
        {user.picture ? (
          <img src={user.picture} alt="" referrerPolicy="no-referrer" />
        ) : (
          <span className="avatar-initial">{initial}</span>
        )}
      </button>
      {open && (
        <div className="user-pop card" role="menu">
          <div className="row" style={{ gap: 10, marginBottom: 10 }}>
            {user.picture ? (
              <img className="avatar-lg" src={user.picture} alt="" referrerPolicy="no-referrer" />
            ) : (
              <span className="avatar-initial lg">{initial}</span>
            )}
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 700 }}>{user.name}</div>
              <div className="faint small" style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{user.email}</div>
            </div>
          </div>
          <button className="btn sm block" onClick={() => { setOpen(false); signOut(); }}>
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
