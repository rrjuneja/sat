import { chromium } from "playwright";
import fs from "node:fs";

const BASE = process.env.E2E_BASE ?? "http://localhost:4180/sat/";
const OUT = "tools/shots";
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();

async function shot(page, name) {
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
  console.log("shot:", name);
}

// Desktop
const ctx = await browser.newContext({ viewport: { width: 1200, height: 900 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();

await page.goto(BASE + "#/practice", { waitUntil: "networkidle" });
await page.getByText("Quick 10", { exact: false }).first().waitFor();
await shot(page, "01-practice");

await page.getByText("Quick 10", { exact: false }).first().click();
await page.locator(".session-bar").waitFor();
const total = parseInt((await page.locator(".session-bar strong").first().innerText()).split("/")[1], 10);
// answer a question so the choice highlight shows
const c = page.locator(".choice");
if (await c.count()) await c.nth(1).click();
await page.locator(".choices, .gridin").first().waitFor();
await shot(page, "02-session");

for (let i = 0; i < total; i++) {
  const choice = page.locator(".choice").first();
  const grid = page.locator(".gridin input");
  if (await choice.count()) await choice.click();
  else if (await grid.count()) await grid.fill("5");
  const next = page.getByRole("button", { name: "Next →" });
  if (await next.count()) await next.click();
  else { await page.getByRole("button", { name: /Review & submit/ }).click(); break; }
}
await page.getByRole("button", { name: /Submit test/ }).click();
await page.getByRole("heading", { name: "Results" }).waitFor();
await page.getByRole("button", { name: /All \(/ }).click();
await page.locator(".source-ref").first().waitFor();
await shot(page, "03-results");

await page.goto(BASE + "#/", { waitUntil: "networkidle" });
await page.getByText("Activity calendar").waitFor();
await shot(page, "04-dashboard");

// Mobile
const mctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true });
const mpage = await mctx.newPage();
await mpage.goto(BASE + "#/", { waitUntil: "networkidle" });
await mpage.getByText("Activity calendar").waitFor();
await shot(mpage, "05-mobile-dashboard");

await browser.close();
console.log("done");
