import { initializeApp, type FirebaseApp } from "firebase/app";
import { browserLocalPersistence, initializeAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";
import { FIREBASE_CONFIG, SYNC_ENABLED } from "../config";

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;

export function getFirebaseApp(): FirebaseApp | null {
  if (!SYNC_ENABLED) return null;
  if (!app) app = initializeApp(FIREBASE_CONFIG);
  return app;
}

export function getFirebaseAuth(): Auth | null {
  const a = getFirebaseApp();
  if (!a) return null;
  if (!auth) {
    auth = initializeAuth(a, { persistence: browserLocalPersistence });
  }
  return auth;
}

export function getFirestoreDb(): Firestore | null {
  const a = getFirebaseApp();
  if (!a) return null;
  if (!db) db = getFirestore(a);
  return db;
}
