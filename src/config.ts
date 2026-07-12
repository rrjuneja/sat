// Google OAuth "Web application" Client ID. This is a PUBLIC identifier (safe to
// commit / ship in client code) — it is NOT a secret. Paste the Client ID from
// Google Cloud Console here, or provide it at build time via VITE_GOOGLE_CLIENT_ID.
//
// While this is empty, sign-in is disabled and the app opens directly (useful for
// local development before the OAuth client exists).
const CONFIGURED_CLIENT_ID = "470039515525-9rscfuo8lq0sbfd4rp3dc0itsef2mekd.apps.googleusercontent.com";

export const GOOGLE_CLIENT_ID = (
  (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined) ||
  CONFIGURED_CLIENT_ID ||
  ""
).trim();

// Only these Google accounts may sign in. All allowed users share the same data.
export const ALLOWED_EMAILS = [
  "rjuneja@gmail.com",
  "rohanrjuneja@gmail.com",
  "reemapuri2@gmail.com",
].map((e) => e.toLowerCase());

export const AUTH_ENABLED = GOOGLE_CLIENT_ID.length > 0;

export function isAllowedEmail(email: string | undefined | null): boolean {
  return !!email && ALLOWED_EMAILS.includes(email.toLowerCase());
}

// Firebase (Firestore) — public web config, safe to ship in client code.
// Create a Firebase project, enable Google sign-in + Firestore, then paste the
// web-app config below or provide via VITE_FIREBASE_* env vars at build time.
// While `projectId` is empty, cloud sync is disabled and progress stays local.
const CONFIGURED_FIREBASE = {
  apiKey: "AIzaSyB6m1_m9eCBm8PphsFQKhy7IMYX_u1jMYo",
  authDomain: "sat-web-9bd1e.firebaseapp.com",
  projectId: "sat-web-9bd1e",
  storageBucket: "sat-web-9bd1e.firebasestorage.app",
  messagingSenderId: "228407528342",
  appId: "1:228407528342:web:74efef12f0d7519ae42bb7",
};

export const FIREBASE_CONFIG = {
  apiKey: ((import.meta.env.VITE_FIREBASE_API_KEY as string | undefined) || CONFIGURED_FIREBASE.apiKey).trim(),
  authDomain: ((import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined) || CONFIGURED_FIREBASE.authDomain).trim(),
  projectId: ((import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined) || CONFIGURED_FIREBASE.projectId).trim(),
  storageBucket: ((import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string | undefined) || CONFIGURED_FIREBASE.storageBucket).trim(),
  messagingSenderId: ((import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string | undefined) || CONFIGURED_FIREBASE.messagingSenderId).trim(),
  appId: ((import.meta.env.VITE_FIREBASE_APP_ID as string | undefined) || CONFIGURED_FIREBASE.appId).trim(),
};

export const SYNC_ENABLED = FIREBASE_CONFIG.projectId.length > 0;
