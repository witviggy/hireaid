export type Theme = "light" | "dark" | "system";

export function getStoredTheme(): Theme {
  const t = localStorage.getItem("hireaid-theme") as Theme | null;
  return t === "light" || t === "dark" || t === "system" ? t : "light";
}

export function applyTheme(theme: Theme) {
  localStorage.setItem("hireaid-theme", theme);
  const root = document.documentElement;
  const isDark =
    theme === "dark" ||
    (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);

  if (isDark) {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }
}

// Initialize immediately on module load so there's no flicker
if (typeof window !== "undefined") {
  applyTheme(getStoredTheme());
}

