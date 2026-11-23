"use client";

import { Moon, Sun } from "lucide-react";

interface ThemeSwitcherProps {
  theme: "dark" | "light";
  onToggleTheme: (nextTheme: "dark" | "light") => void;
}

export function ThemeSwitcher({ theme, onToggleTheme }: ThemeSwitcherProps) {
  return (
    <div
      className="af-surface-inset inline-flex items-center gap-0.5 rounded-full p-1"
      role="group"
      aria-label="Color theme switcher"
    >
      <button
        type="button"
        onClick={() => onToggleTheme("dark")}
        aria-label="Dark theme"
        aria-pressed={theme === "dark"}
        title="Dark theme"
        className="inline-flex h-7 w-7 items-center justify-center rounded-full transition-all duration-300"
        style={
          theme === "dark"
            ? {
                backgroundColor: "var(--accent-bg)",
                color: "var(--accent-text)",
              }
            : { color: "var(--text-secondary)" }
        }
      >
        <Moon className="h-3.5 w-3.5 transition-transform duration-300" />
      </button>
      <button
        type="button"
        onClick={() => onToggleTheme("light")}
        aria-label="Light theme"
        aria-pressed={theme === "light"}
        title="Light theme"
        className="inline-flex h-7 w-7 items-center justify-center rounded-full transition-all duration-300"
        style={
          theme === "light"
            ? {
                backgroundColor: "var(--accent-bg)",
                color: "var(--accent-text)",
              }
            : { color: "var(--text-secondary)" }
        }
      >
        <Sun className="h-3.5 w-3.5 transition-transform duration-300" />
      </button>
    </div>
  );
}
