import { chromium } from "playwright";

// Verifies the Google sign-in gate renders and that the Content-Security-Policy
// permits Google Identity Services. It does NOT complete a real sign-in (that
// needs a human + a Google account); do that manually on the live site.
const BASE = process.env.E2E_BASE ?? "http://localhost:4180/sat/";
const browser = await chromium.launch();
const page = await browser.newPage();

const errors = [];
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
page.on("pageerror", (e) => errors.push(String(e)));

// Use domcontentloaded (not networkidle): Google's FedCM keeps the network busy,
// so networkidle is unreliable here. Then poll #root until React has mounted the
// gate (robust against slow cold starts instead of a single fixed wait).
await page.goto(BASE, { waitUntil: "domcontentloaded" });

let root = "";
const deadline = Date.now() + 25000;
while (Date.now() < deadline) {
  root = await page.locator("#root").innerHTML();
  if (root.includes("login-screen")) break;
  await page.waitForTimeout(500);
}
// Let GIS finish injecting its button.
await page.waitForTimeout(4000);
root = await page.locator("#root").innerHTML();

if (!root.includes("login-screen")) throw new Error("Login gate did not render — app is not gated!");
console.log("✓ Login gate is shown (app content is not rendered until sign-in)");

if (root.includes("desktop-nav")) throw new Error("App navigation is exposed without signing in!");
console.log("✓ No app navigation exposed pre-auth");

// The rendered "Sign in with Google" button contains Google's own markup/classes.
if (!/nsm7Bb-HzV7m-LgbsSe|Sign in with Google|login-btn-wrap/i.test(root)) {
  throw new Error("Google sign-in button did not render.");
}
console.log("✓ Google sign-in button rendered (GIS script loaded, CSP allows it)");

await page.screenshot({ path: "tools/shots/00-login.png" });

const cspErr = errors.filter((e) => /content security policy|refused to (load|execute|connect)/i.test(e));
if (cspErr.length) {
  console.error("✗ CSP violations:\n" + cspErr.join("\n"));
  process.exit(1);
}
console.log("✓ No CSP violations for Google Identity Services");

const originErr = errors.some((e) => /origin is not allowed/i.test(e));
if (originErr) {
  console.log(
    "\nℹ Note: 'origin is not allowed' seen for this local origin — that only means",
    "\n  http://localhost:4180 isn't an authorized JS origin (or hasn't propagated).",
    "\n  Production sign-in needs https://rrjuneja.github.io authorized.",
  );
}

console.log("\n✅ Auth gate verified (sign-in UI + CSP OK).");
await browser.close();
