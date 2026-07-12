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
