"use client";

import { useEffect, useState } from "react";

const THEME_STORAGE_KEY = "bejewely-theme";

function getSystemTheme() {
  if (typeof window === "undefined") {
    return "light";
  }

  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(theme) {
  if (typeof document === "undefined") {
    return;
  }

  const nextTheme = theme === "dark" ? "dark" : "light";
  const root = document.documentElement;
  root.classList.toggle("dark", nextTheme === "dark");
  root.classList.toggle("scheme-dark", nextTheme === "dark");
  root.classList.toggle("scheme-light", nextTheme !== "dark");
  root.dataset.theme = nextTheme;
}

export default function ThemeToggle({ locale = "ko", compact = false, className = "" }) {
  const [theme, setTheme] = useState("light");

  useEffect(() => {
    const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    const initialTheme = storedTheme === "dark" || storedTheme === "light" ? storedTheme : getSystemTheme();
    setTheme(initialTheme);
    applyTheme(initialTheme);
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    setTheme(nextTheme);
    applyTheme(nextTheme);
  };

  const isDark = theme === "dark";
  const label = locale === "en" ? (isDark ? "Dark" : "Light") : (isDark ? "다크" : "라이트");
  const nextLabel = locale === "en" ? (isDark ? "Light" : "Dark") : (isDark ? "라이트" : "다크");
  const ariaLabel = locale === "en" ? `Switch to ${nextLabel} theme` : `${nextLabel} 테마로 전환`;

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={ariaLabel}
      className={[
        "inline-flex items-center justify-center rounded-full border border-[#ead2ca] bg-white/[0.82] text-xs font-medium text-[#5a2d3c] shadow-sm transition hover:border-[#dbaea4] hover:bg-white dark:border-[#5a3543] dark:bg-white/5 dark:text-[#f4dce3] dark:hover:border-[#7a4c5d] dark:hover:bg-white/10",
        compact ? "h-8 px-3" : "h-9 px-3.5",
        className
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {label}
    </button>
  );
}
