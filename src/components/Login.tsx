import { useEffect, useRef } from "react";
import { SYNC_ENABLED } from "../config";
import { useAuth } from "../lib/auth";

export default function Login() {
  const { ready, error, renderButton, signInWithGoogle } = useAuth();
  const btnRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!SYNC_ENABLED && ready && btnRef.current) renderButton(btnRef.current);
  }, [ready, renderButton]);

  return (
    <div className="login-screen">
      <div className="login-card card">
        <div className="brand" style={{ justifyContent: "center", marginBottom: 8 }}>
          <div className="logo">SAT</div>
          <div>
            Test Drive <small>· syncs across devices</small>
          </div>
        </div>
        <h2 style={{ textAlign: "center", marginBottom: 4 }}>Sign in to continue</h2>
        <p className="muted center small" style={{ marginTop: 0 }}>
          This app is restricted to approved accounts. Please sign in with Google.
        </p>

        {SYNC_ENABLED ? (
          <button className="btn primary block" style={{ marginTop: 8 }} disabled={!ready} onClick={() => void signInWithGoogle()}>
            Sign in with Google
          </button>
        ) : (
          <div className="login-btn-wrap" ref={btnRef} />
        )}
        {!ready && <p className="faint center small">Loading sign-in…</p>}

        {error && (
          <div className="banner warn" style={{ marginTop: 16 }}>
            {error}
          </div>
        )}

        <p className="faint small center" style={{ marginTop: 20 }}>
          Trouble signing in? Make sure you’re using an approved account and that pop-ups aren’t blocked.
        </p>
      </div>
    </div>
  );
}
