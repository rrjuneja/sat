import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// Project is deployed to https://rrjuneja.github.io/sat/ so the base path is /sat/
// everywhere (dev, preview and build) to keep local behaviour identical to prod.
// Override with VITE_BASE if the repo/site name ever changes.
const base = process.env.VITE_BASE ?? "/sat/";

// A strict Content-Security-Policy injected only in production builds. GitHub
// Pages cannot set HTTP headers, so we ship it as a <meta http-equiv>. It is
// build-only so that Vite's dev server (which needs inline scripts + eval for
// HMR) keeps working. The app loads zero third-party resources.
const csp = [
  "default-src 'self'",
  // Google Identity Services + Firebase (Auth + Firestore when cloud sync is on).
  "img-src 'self' data: blob: https://*.googleusercontent.com https://accounts.google.com",
  "style-src 'self' 'unsafe-inline' https://accounts.google.com/gsi/style",
  "script-src 'self' https://accounts.google.com/gsi/client",
  [
    "connect-src 'self'",
    "https://accounts.google.com/gsi/",
    "https://*.googleapis.com",
    "https://firestore.googleapis.com",
    "https://identitytoolkit.googleapis.com",
    "https://securetoken.googleapis.com",
    "https://*.firebaseio.com",
    "wss://*.firebaseio.com",
  ].join(" "),
  "frame-src https://accounts.google.com/gsi/ https://*.firebaseapp.com",
  "font-src 'self'",
  "manifest-src 'self'",
  "worker-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  // Note: frame-ancestors / X-Frame-Options only work as HTTP headers, which
  // GitHub Pages cannot set, so they are intentionally omitted from this meta CSP.
  "upgrade-insecure-requests",
].join("; ");

const cspPlugin = {
  name: "inject-csp",
  apply: "build" as const,
  transformIndexHtml(html: string) {
    const meta =
      `<meta http-equiv="Content-Security-Policy" content="${csp}" />\n` +
      `    <meta http-equiv="X-Content-Type-Options" content="nosniff" />\n` +
      `    <meta name="referrer" content="no-referrer" />`;
    return html.replace("</title>", `</title>\n    ${meta}`);
  },
};

export default defineConfig({
  base,
  plugins: [
    react(),
    cspPlugin,
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg", "robots.txt"],
      manifest: {
        name: "SAT Test Drive",
        short_name: "SAT Drive",
        description: "Private, offline-first SAT practice with progress tracking",
        theme_color: "#0b1220",
        background_color: "#0b1220",
        display: "standalone",
        orientation: "portrait",
        scope: base,
        start_url: base,
        icons: [
          { src: "icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        // App shell + data are precached; question images are large, so cache them
        // lazily at runtime instead of precaching everything.
        globPatterns: ["**/*.{js,css,html,svg,woff2}"],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        navigateFallbackDenylist: [/^\/api/],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.includes("/img/"),
            handler: "CacheFirst",
            options: {
              cacheName: "question-images",
              expiration: { maxEntries: 1200, maxAgeSeconds: 60 * 60 * 24 * 60 },
            },
          },
          {
            urlPattern: ({ url }) => url.pathname.includes("/data/"),
            handler: "StaleWhileRevalidate",
            options: { cacheName: "question-data" },
          },
        ],
      },
    }),
  ],
});
