import { useEffect, useState } from "react";
import type { QuestionMeta, Settings } from "../types";
import { loadIndex } from "./data";
import { getSettings } from "./store";

export function useIndex() {
  const [index, setIndex] = useState<QuestionMeta[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    loadIndex()
      .then((d) => alive && setIndex(d))
      .catch((e) => alive && setError(String(e?.message ?? e)));
    return () => {
      alive = false;
    };
  }, []);
  return { index, error, loading: !index && !error };
}

export function useSettings(): [Settings | null, (s: Settings) => void] {
  const [settings, setSettings] = useState<Settings | null>(null);
  useEffect(() => {
    getSettings().then(setSettings);
  }, []);
  return [settings, setSettings];
}

/** Apply the theme attribute to <html> so CSS variables switch. */
export function applyTheme(theme: "dark" | "light") {
  document.documentElement.setAttribute("data-theme", theme);
}
