import { useEffect, useState } from "react";
import { getSettings, saveSettings } from "../lib/store";
import { applyTheme } from "../lib/hooks";

export default function ThemeToggle() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    getSettings().then((s) => setTheme(s.theme));
  }, []);

  const toggle = async () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    applyTheme(next);
    const s = await getSettings();
    await saveSettings({ ...s, theme: next });
  };

  return (
    <button
      className="btn sm ghost"
      onClick={toggle}
      title={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
      aria-label="Toggle color theme"
    >
      {theme === "dark" ? "☀︎" : "☾"}
    </button>
  );
}
