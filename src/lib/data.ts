import type { QuestionContent, QuestionMeta, TestName } from "../types";

const BASE = import.meta.env.BASE_URL;

export function testKey(test: TestName): "math" | "rw" {
  return test === "Math" ? "math" : "rw";
}

export function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function bundleKey(test: TestName, domain: string): string {
  return `${testKey(test)}__${slug(domain) || "misc"}`;
}

export function questionImageUrl(id: string): string {
  return `${BASE}img/q/${id}.webp`;
}

export function rationaleImageUrl(id: string): string {
  return `${BASE}img/r/${id}.webp`;
}

let indexCache: QuestionMeta[] | null = null;
let indexPromise: Promise<QuestionMeta[]> | null = null;

export async function loadIndex(): Promise<QuestionMeta[]> {
  if (indexCache) return indexCache;
  if (!indexPromise) {
    indexPromise = fetch(`${BASE}data/index.json`)
      .then((r) => {
        if (!r.ok) throw new Error(`Failed to load question index (${r.status})`);
        return r.json();
      })
      .then((data: QuestionMeta[]) => {
        indexCache = data;
        return data;
      });
  }
  return indexPromise;
}

const bundleCache = new Map<string, Record<string, QuestionContent>>();
const bundlePromises = new Map<string, Promise<Record<string, QuestionContent>>>();

async function loadBundle(key: string): Promise<Record<string, QuestionContent>> {
  const cached = bundleCache.get(key);
  if (cached) return cached;
  let p = bundlePromises.get(key);
  if (!p) {
    p = fetch(`${BASE}data/content/${key}.json`)
      .then((r) => {
        if (!r.ok) throw new Error(`Failed to load content bundle ${key}`);
        return r.json();
      })
      .then((data: Record<string, QuestionContent>) => {
        bundleCache.set(key, data);
        return data;
      });
    bundlePromises.set(key, p);
  }
  return p;
}

/** Fetch full content for a single question given its index metadata. */
export async function loadContent(meta: QuestionMeta): Promise<QuestionContent> {
  const bundle = await loadBundle(bundleKey(meta.test, meta.domain));
  const c = bundle[meta.id];
  if (!c) throw new Error(`Question ${meta.id} not found in bundle`);
  return c;
}

/** Batch-load content for many questions (bundles are cached, so this is cheap). */
export async function loadContents(metas: QuestionMeta[]): Promise<Map<string, QuestionContent>> {
  const keys = new Set(metas.map((m) => bundleKey(m.test, m.domain)));
  await Promise.all([...keys].map(loadBundle));
  const out = new Map<string, QuestionContent>();
  for (const m of metas) {
    const bundle = bundleCache.get(bundleKey(m.test, m.domain));
    const c = bundle?.[m.id];
    if (c) out.set(m.id, c);
  }
  return out;
}
