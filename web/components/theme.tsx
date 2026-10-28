"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export type Theme = "dark" | "light";

const STORAGE_KEY = "ubu-theme";

type ThemeContextValue = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggle: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.classList.toggle("light", theme === "light");
  root.style.colorScheme = theme;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", theme === "light" ? "#f7f1e6" : "#131008");
}

function readStoredTheme(): Theme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "light" || stored === "dark") return stored;
  } catch {
    // private mode / blocked storage
  }
  if (typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: light)").matches) {
    return "light";
  }
  return "dark";
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("dark");

  useEffect(() => {
    const initial = readStoredTheme();
    setThemeState(initial);
    applyTheme(initial);
  }, []);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    applyTheme(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore
    }
  }, []);

  const toggle = useCallback(() => {
    // Read the class the boot script already painted. React state can still be
    // the server default for a moment, and a click in that window must flip
    // the theme the page is actually showing.
    const current = document.documentElement.classList.contains("light") ? "light" : "dark";
    setTheme(current === "dark" ? "light" : "dark");
  }, [setTheme]);

  const value = useMemo(
    () => ({ theme, setTheme, toggle }),
    [theme, setTheme, toggle]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}

/** Compact control for shell / profile. */
export function ThemeToggle({ className = "" }: { className?: string }) {
  const { toggle } = useTheme();

  return (
    <button
      type="button"
      onClick={toggle}
      className={`inline-flex h-9 items-center gap-1.5 rounded-full border border-ink-600 bg-ink-850 px-3 text-[11px] font-bold uppercase tracking-[0.12em] text-mist-100 transition hover:border-gold-line ${className}`}
    >
      <span className="theme-when-dark" aria-hidden>
        ☀
      </span>
      <span className="theme-when-light" aria-hidden>
        ☾
      </span>
      <span className="theme-when-dark hidden sm:inline">Dark</span>
      <span className="theme-when-light hidden sm:inline">Light</span>
      <span className="sr-only theme-when-dark">Switch to light mode</span>
      <span className="sr-only theme-when-light">Switch to dark mode</span>
    </button>
  );
}
