"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useTheme } from "@/hooks/use-theme";

export function ThemeToggle() {
  const reduceMotion = useReducedMotion();
  const { theme, toggle } = useTheme();

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={
        theme === "dark" ? "Switch to light theme" : "Switch to dark theme"
      }
      className="flex h-8 w-8 items-center justify-center rounded-lg border border-edge text-ink-soft transition-colors hover:border-edge-strong hover:text-ink"
    >
      <motion.span
        key={theme}
        initial={reduceMotion ? false : { opacity: 0, rotate: -40 }}
        animate={{ opacity: 1, rotate: 0 }}
        transition={{ duration: 0.2 }}
        className="flex"
      >
        {theme === "dark" ? <SunIcon /> : <MoonIcon />}
      </motion.span>
    </button>
  );
}

function MoonIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4" />
    </svg>
  );
}
