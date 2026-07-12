# SAT Test Drive

A private, offline-first web app for practicing SAT questions in a "test drive" style,
with progress tracking, a category dashboard, and an activity calendar. Installable on
mobile as a Progressive Web App (PWA).

Built from the official **SAT Math** and **Reading & Writing** question-bank PDF exports
(**3,444 questions**). Because math equations, graphs, and reading passages don't survive
plain-text extraction, each question is rendered as a crisp image cropped so the answer
stays hidden until you submit.

## Features

- **Test-drive engine** modeled on the digital SAT: multiple-choice + grid-in answers,
  answer eliminator (cross out choices), **Skip**, **Mark for review**, a question
  navigator, and a review-and-submit flow.
- **Dashboard** with overall accuracy, day streak, a GitHub-style **activity calendar**,
  and **progress by section, domain, skill, and difficulty**.
- **Source reference** on every question — the source PDF name and page, with a
  "View source page" viewer.
- **Explanations** after submitting (rendered solutions for Math, text for R&W).
- **Review list** — save/mark questions and practice just those later.
- **Private by design** — progress syncs across your signed-in devices in real time (when
  Firebase is configured). Theme/preferences stay local. Export/import JSON backup anytime.
- **Mobile app** — responsive UI + installable PWA with offline support.

## Tech

- React + TypeScript + Vite, `react-router-dom` (HashRouter for static hosting)
- `localforage` (IndexedDB) for on-device progress cache
- Firebase Firestore for optional real-time sync across devices (shared family progress)
- `vite-plugin-pwa` (Workbox) for offline + install
- Python + PyMuPDF + Pillow pipeline (`tools/build_data.py`) to parse the PDFs into
  `public/data/*.json` and render `public/img/**/*.webp`

## Local development

```bash
npm install
npm run dev        # http://localhost:5173/
```

Production build / preview:

```bash
npm run build
npm run preview    # http://localhost:4173/sat/
```

## Regenerating the question data

The raw PDFs are **not** committed (they exceed GitHub's 100 MB file limit). Place the two
`questionbank-export-*.pdf` files in the project root and run:

```bash
python -m venv .venv
.venv/Scripts/python -m pip install pymupdf Pillow
.venv/Scripts/python tools/build_data.py     # writes public/data + public/img
```

## Cloud sync (optional, cross-device)

To sync progress in real time across computers/phones for the three allowed Google accounts:

1. Create a [Firebase](https://console.firebase.google.com/) project.
2. Enable **Authentication → Sign-in method → Google** (use the same OAuth client ID).
3. Create a **Firestore** database (production mode).
4. Deploy `firestore.rules` from this repo (`firebase deploy --only firestore:rules`).
5. Copy the web app config into `src/config.ts` under `CONFIGURED_FIREBASE`, or set
   `VITE_FIREBASE_*` env vars in GitHub Actions secrets for deploy builds.

Until `projectId` is set, the app works offline with local-only progress (as before).

## Deployment

Pushing to `main` triggers `.github/workflows/deploy.yml`, which builds the app and
publishes `dist/` to GitHub Pages at `https://rrjuneja.github.io/sat/`.

Enable it once under **Settings → Pages → Build and deployment → Source: GitHub Actions**.
