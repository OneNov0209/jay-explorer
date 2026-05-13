import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";

type Theme = "dark" | "light";

function getInitial(): Theme {
  if (typeof window === "undefined") return "dark";
  const stored = localStorage.getItem("theme") as Theme | null;
  if (stored === "light" || stored === "dark") return stored;
  return "dark";
}

function apply(theme: Theme) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.classList.toggle("light", theme === "light");
  root.classList.toggle("dark", theme === "dark");
}

export function ThemeToggle({ className = "" }: { className?: string }) {
  const [theme, setTheme] = useState<Theme>(getInitial);

  useEffect(() => {
    apply(theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  const isLight = theme === "light";
  return (
    <button
      type="button"
      role="switch"
      aria-checked={isLight}
      aria-label="Toggle theme"
      title={isLight ? "Switch to dark" : "Switch to light"}
      onClick={() => setTheme(isLight ? "dark" : "light")}
      className={`relative inline-flex h-8 w-14 items-center rounded-full border border-border transition-colors ${
        isLight ? "bg-amber-200/40" : "bg-sidebar-accent/60"
      } ${className}`}
    >
      <span
        className={`absolute left-1.5 transition-opacity ${isLight ? "opacity-100" : "opacity-40"}`}
      >
        <Sun className="h-3.5 w-3.5 text-amber-500" />
      </span>
      <span
        className={`absolute right-1.5 transition-opacity ${isLight ? "opacity-40" : "opacity-100"}`}
      >
        <Moon className="h-3.5 w-3.5 text-primary" />
      </span>
      <span
        className={`relative z-10 inline-block h-6 w-6 rounded-full bg-background shadow-md ring-1 ring-border transition-transform ${
          isLight ? "translate-x-7" : "translate-x-1"
        }`}
      />
    </button>
  );
}
