import { chromium } from "playwright";

const BASE = process.env.E2E_BASE ?? "http://localhost:4173/sat/";
const errors = [];

function log(...a) {
  console.log(...a);
}

const browser = await chromium.launch();
const ctx = await browser.newContext();
// Seed a valid allowlisted session so the auth gate lets us in without a real
// Google sign-in (which can't be automated). Mirrors src/lib/auth.tsx storage.
await ctx.addInitScript((s) => {
  try {
    localStorage.setItem("sat_auth_session", JSON.stringify(s));
  } catch {
    /* ignore */
  }
}, { email: "rjuneja@gmail.com", name: "Test User", picture: "", exp: Math.floor(Date.now() / 1000) + 86400 });
const page = await ctx.newPage();
page.on("console", (m) => {
  if (m.type() === "error") errors.push("console: " + m.text());
});
page.on("pageerror", (e) => errors.push("pageerror: " + e.message));

try {
  // 1. Dashboard
  await page.goto(BASE + "#/", { waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: "Dashboard" }).waitFor({ timeout: 15000 });
  log("✓ Dashboard loaded");

  // 2. Practice -> Quick 10
  await page.goto(BASE + "#/practice", { waitUntil: "domcontentloaded" });
  await page.getByText("Quick 10", { exact: false }).first().waitFor({ timeout: 15000 });
  log("✓ Practice page loaded");
  await page.getByText("Quick 10", { exact: false }).first().click();

  // 3. Session
  await page.locator(".session-bar").waitFor({ timeout: 15000 });
  const header = await page.locator(".session-bar strong").first().innerText();
  const total = parseInt(header.split("/")[1].trim(), 10);
  log(`✓ Session started with ${total} questions`);

  let marked = false;
  for (let i = 0; i < total; i++) {
    await page.locator(".qwrap").first().waitFor({ timeout: 10000 });
    // mark the 2nd question for review BEFORE answering (instant feedback hides
    // the mark button once the answer is revealed)
    if (i === 1 && !marked) {
      await page.locator("button.mark-btn", { hasText: "Mark" }).first().click().catch(() => {});
      marked = true;
    }
    // answer: MC choice or grid input (grid-in needs an explicit "Check answer")
    const choice = page.locator(".choice").first();
    const gridInput = page.locator(".gridin input");
    if (await choice.count()) {
      await choice.click();
    } else if (await gridInput.count()) {
      await gridInput.fill("5");
      await page.getByRole("button", { name: "Check answer" }).click().catch(() => {});
    }
    const next = page.getByRole("button", { name: "Next →" });
    if (await next.count()) {
      await next.click();
    } else {
      // last question -> review & submit
      await page.getByRole("button", { name: /Review & submit/ }).click();
      break;
    }
  }

  // 4. Submit from navigator
  await page.getByRole("button", { name: /Submit test/ }).waitFor({ timeout: 8000 });
  await page.getByRole("button", { name: /Submit test/ }).click();

  // 5. Results
  await page.getByRole("heading", { name: "Results" }).waitFor({ timeout: 15000 });
  const scoreText = await page.locator(".stat .value").first().innerText();
  log(`✓ Results page shown (score tile: ${scoreText})`);

  // switch review filter to All and ensure a QuestionView renders
  await page.getByRole("button", { name: /All \(/ }).click();
  await page.locator(".source-ref").first().waitFor({ timeout: 8000 });
  log("✓ Review renders question + source reference");

  // 6. Dashboard reflects progress
  await page.goto(BASE + "#/", { waitUntil: "domcontentloaded" });
  await page.getByText("Questions answered").waitFor({ timeout: 10000 });
  const answered = await page.locator(".card.stat .value").first().innerText();
  log(`✓ Dashboard updated (answered tile: ${answered})`);

  // 7. Review list (saved via mark-for-review)
  await page.goto(BASE + "#/review", { waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: "Review list" }).waitFor({ timeout: 8000 });
  log("✓ Review list loads");
} catch (e) {
  errors.push("TEST FAILURE: " + e.message);
} finally {
  await browser.close();
}

if (errors.length) {
  console.log("\n❌ ERRORS:");
  errors.forEach((e) => console.log("  - " + e));
  process.exit(1);
} else {
  console.log("\n✅ All end-to-end checks passed with no console/page errors.");
}
