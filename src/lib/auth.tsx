import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { GoogleAuthProvider, onAuthStateChanged, signInWithCredential, signOut as fbSignOut, type User } from "firebase/auth";
import { AUTH_ENABLED, GOOGLE_CLIENT_ID, SYNC_ENABLED, isAllowedEmail } from "../config";
import { getFirebaseAuth } from "./firebase";
import { setWriteHook } from "./store";
import { scheduleSyncPush, startSync, stopSync } from "./sync";

export interface AuthUser {
  email: string;
  name: string;
  picture: string;
  exp: number; // seconds since epoch
}

interface AuthState {
  enabled: boolean;
  ready: boolean;
  user: AuthUser | null;
  /** Sign-in / account gate errors only (never Firebase sync errors). */
  error: string | null;
  /** Cloud sync connection errors (shown in the sync chip, not on the login screen). */
  syncError: string | null;
  renderButton: (el: HTMLElement) => void;
  connectCloudSync: () => void;
  signOut: () => void;
}

const AuthContext = createContext<AuthState | null>(null);
const STORAGE_KEY = "sat_auth_session";

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    google?: any;
  }
}

function decodeJwt(token: string): Record<string, any> | null {
  try {
    const payload = token.split(".")[1];
    const b64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const json = decodeURIComponent(
      atob(b64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join(""),
    );
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function validate(claims: Record<string, any> | null): AuthUser | { error: string } {
  if (!claims) return { error: "Could not read the sign-in response." };
  const validIss = claims.iss === "accounts.google.com" || claims.iss === "https://accounts.google.com";
  if (!validIss) return { error: "Unrecognized sign-in issuer." };
  if (claims.aud !== GOOGLE_CLIENT_ID) return { error: "Sign-in was issued for a different app." };
  if (!claims.exp || claims.exp * 1000 < Date.now()) return { error: "Sign-in expired, please try again." };
  if (claims.email_verified === false) return { error: "Your Google email is not verified." };
  if (!isAllowedEmail(claims.email)) {
    return { error: `The account ${claims.email ?? ""} is not authorized to use this app.` };
  }
  return {
    email: String(claims.email),
    name: String(claims.name ?? claims.email),
    picture: String(claims.picture ?? ""),
    exp: Number(claims.exp),
  };
}

function fbUserToAuthUser(fb: User): AuthUser | null {
  const email = fb.email?.toLowerCase();
  if (!email || !isAllowedEmail(email)) return null;
  return {
    email,
    name: fb.displayName ?? email,
    picture: fb.photoURL ?? "",
    exp: Math.floor(Date.now() / 1000) + 3600,
  };
}

function syncHint(code: string): string {
  if (code === "auth/internal-error") {
    return (
      "Cloud sync setup incomplete. In Google Cloud (project sat-web-9bd1e): " +
      "enable Identity Toolkit API, and ensure your Firebase API key allows " +
      "https://rrjuneja.github.io/* as an HTTP referrer. " +
      "Also confirm Firebase → Authentication → Google is enabled."
    );
  }
  if (code === "auth/invalid-credential" || code === "auth/credential-already-in-use") {
    return "Cloud sync could not verify your Google sign-in. Sign out, wait a moment, and sign in again.";
  }
  return `Cloud sync error (${code}). You can still practice — progress stays on this device until sync connects.`;
}

function loadGis(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.id) return resolve();
    const existing = document.getElementById("gis-script");
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("Failed to load Google sign-in.")));
      return;
    }
    const s = document.createElement("script");
    s.id = "gis-script";
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Failed to load Google sign-in."));
    document.head.appendChild(s);
  });
}

function restoreSession(): AuthUser | null {
  if (!AUTH_ENABLED) return null;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return null;
    const u = JSON.parse(saved) as AuthUser;
    if (u.exp * 1000 > Date.now() && isAllowedEmail(u.email)) return u;
  } catch {
    /* ignore corrupt session */
  }
  localStorage.removeItem(STORAGE_KEY);
  return null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(restoreSession);
  const [ready, setReady] = useState(!AUTH_ENABLED);
  const [error, setError] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const initialized = useRef(false);

  const persist = (u: AuthUser | null) => {
    if (u) localStorage.setItem(STORAGE_KEY, JSON.stringify(u));
    else localStorage.removeItem(STORAGE_KEY);
  };

  const linkFirebase = useCallback(async (idToken: string) => {
    const auth = getFirebaseAuth();
    if (!auth || !idToken) return;
    try {
      await signInWithCredential(auth, GoogleAuthProvider.credential(idToken));
      setSyncError(null);
    } catch (e: unknown) {
      const code = (e as { code?: string })?.code ?? "";
      console.warn("Firebase link failed", e);
      setSyncError(code ? syncHint(code) : "Cloud sync could not connect. Progress stays on this device for now.");
    }
  }, []);

  const connectCloudSync = useCallback(() => {
    setSyncError(null);
    if (!window.google?.accounts?.id) {
      setSyncError("Google sign-in is still loading — try again in a moment.");
      return;
    }
    window.google.accounts.id.prompt();
  }, []);

  const handleCredential = useCallback(
    (response: { credential?: string }) => {
      const idToken = response.credential ?? "";
      const result = validate(decodeJwt(idToken));
      if ("error" in result) {
        setError(result.error);
        setUser(null);
        persist(null);
        window.google?.accounts?.id?.disableAutoSelect?.();
      } else {
        setError(null);
        setSyncError(null);
        setUser(result);
        persist(result);
        // Link Firebase in the background — login must succeed even if this fails.
        if (SYNC_ENABLED && idToken) void linkFirebase(idToken);
      }
    },
    [linkFirebase],
  );

  useEffect(() => {
    if (!AUTH_ENABLED || initialized.current) return;
    initialized.current = true;

    loadGis()
      .then(() => {
        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: handleCredential,
          auto_select: true,
          cancel_on_tap_outside: false,
          use_fedcm_for_prompt: false,
        });
        setReady(true);
      })
      .catch((e) => {
        setError(String(e?.message ?? e));
        setReady(true);
      });
  }, [handleCredential]);

  useEffect(() => {
    if (!SYNC_ENABLED) return;
    const auth = getFirebaseAuth();
    if (!auth) return;
    return onAuthStateChanged(auth, (fbUser) => {
      if (fbUser) {
        const u = fbUserToAuthUser(fbUser);
        if (!u) {
          setError(`${fbUser.email ?? "This account"} is not authorized.`);
          void fbSignOut(auth);
          return;
        }
        setSyncError(null);
        setUser(u);
        persist(u);
        setWriteHook(() => scheduleSyncPush(u.email));
        startSync(u.email);
      } else {
        setWriteHook(null);
        stopSync();
      }
    });
  }, []);

  const renderButton = useCallback((el: HTMLElement) => {
    if (!window.google?.accounts?.id) return;
    el.innerHTML = "";
    window.google.accounts.id.renderButton(el, {
      theme: "filled_blue",
      size: "large",
      shape: "pill",
      text: "signin_with",
      logo_alignment: "left",
    });
    window.google.accounts.id.prompt();
  }, []);

  const signOut = useCallback(() => {
    window.google?.accounts?.id?.disableAutoSelect?.();
    const auth = getFirebaseAuth();
    if (auth) void fbSignOut(auth);
    stopSync();
    setWriteHook(null);
    setUser(null);
    setError(null);
    setSyncError(null);
    persist(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{ enabled: AUTH_ENABLED, ready, user, error, syncError, renderButton, connectCloudSync, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
