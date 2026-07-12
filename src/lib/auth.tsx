import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { GoogleAuthProvider, onAuthStateChanged, signInWithCredential, signOut as fbSignOut } from "firebase/auth";
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
  error: string | null;
  renderButton: (el: HTMLElement) => void;
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

/** Client-side validation of a Google ID token (soft gate; see README security note). */
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
  // Restore a still-valid session synchronously so returning users skip the gate.
  const [user, setUser] = useState<AuthUser | null>(restoreSession);
  const [ready, setReady] = useState(!AUTH_ENABLED);
  const [error, setError] = useState<string | null>(null);
  const initialized = useRef(false);

  const persist = (u: AuthUser | null) => {
    if (u) localStorage.setItem(STORAGE_KEY, JSON.stringify(u));
    else localStorage.removeItem(STORAGE_KEY);
  };

  const handleCredential = useCallback((response: { credential?: string }) => {
    const idToken = response.credential ?? "";
    const result = validate(decodeJwt(idToken));
    if ("error" in result) {
      setError(result.error);
      setUser(null);
      persist(null);
      window.google?.accounts?.id?.disableAutoSelect?.();
    } else {
      setError(null);
      setUser(result);
      persist(result);
      if (SYNC_ENABLED && idToken) void linkFirebase(idToken);
    }
  }, []);

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
          use_fedcm_for_prompt: true,
        });
        setReady(true);
      })
      .catch((e) => {
        setError(String(e?.message ?? e));
        setReady(true);
      });
  }, [handleCredential]);

  // Keep Firestore sync tied to Firebase Auth (persists across reloads).
  useEffect(() => {
    if (!SYNC_ENABLED) return;
    const auth = getFirebaseAuth();
    if (!auth) return;
    return onAuthStateChanged(auth, (fbUser) => {
      const email = fbUser?.email?.toLowerCase() ?? null;
      if (email && isAllowedEmail(email)) {
        setWriteHook(() => scheduleSyncPush(email));
        startSync(email);
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
    persist(null);
  }, []);

  return (
    <AuthContext.Provider value={{ enabled: AUTH_ENABLED, ready, user, error, renderButton, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

async function linkFirebase(idToken: string): Promise<void> {
  const auth = getFirebaseAuth();
  if (!auth) return;
  try {
    await signInWithCredential(auth, GoogleAuthProvider.credential(idToken));
    // onAuthStateChanged wires cloud sync once Firebase Auth is ready.
  } catch (e) {
    console.warn("Firebase sign-in failed — cloud sync unavailable.", e);
  }
}
