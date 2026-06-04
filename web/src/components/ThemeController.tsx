"use client";

/**
 * Sun-Cycle theme controller.
 *
 * Auto mode renders Light between 06:00–18:00 local time and the dark
 * futuristic theme at night. Users may override to a fixed Light/Dark via the
 * ThemeToggle; the preference persists in localStorage. The no-FOUC class is
 * applied by the inline script in `layout.tsx` before paint — this component
 * keeps it in sync (auto flip at the 6AM/6PM boundary, cross-tab, manual).
 */

import { useCallback, useEffect, useState } from "react";
import { Sun, Moon, SunMoon } from "lucide-react";
import { cn } from "@/lib/utils";

type Mode = "auto" | "light" | "dark";
const KEY = "agro-theme";
const EVENT = "agro-theme-change";

function resolve(mode: Mode): "light" | "dark" {
  if (mode === "auto") {
    const h = new Date().getHours();
    return h >= 6 && h < 18 ? "light" : "dark";
  }
  return mode;
}

function applyTheme(mode: Mode): void {
  const cls = document.documentElement.classList;
  cls.remove("light", "dark");
  cls.add(resolve(mode));
}

function getMode(): Mode {
  if (typeof window === "undefined") return "auto";
  const v = localStorage.getItem(KEY);
  return v === "light" || v === "dark" || v === "auto" ? v : "auto";
}

/** Mount once (e.g. in WorkspaceLayout) to drive automatic sun-cycle switching. */
export function ThemeController() {
  useEffect(() => {
    applyTheme(getMode());
    // Re-evaluate every minute so an open session flips at 6AM / 6PM.
    const id = window.setInterval(() => {
      if (getMode() === "auto") applyTheme("auto");
    }, 60_000);
    const onChange = () => applyTheme(getMode());
    window.addEventListener(EVENT, onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.clearInterval(id);
      window.removeEventListener(EVENT, onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);
  return null;
}

/** Elegant tri-state toggle: Auto → Light → Dark. */
export function ThemeToggle({ collapsed = false }: { collapsed?: boolean }) {
  const [mode, setMode] = useState<Mode>("auto");
  const [resolved, setResolved] = useState<"light" | "dark">("dark");

  useEffect(() => {
    const m = getMode();
    setMode(m);
    setResolved(resolve(m));
  }, []);

  const cycle = useCallback(() => {
    const order: Mode[] = ["auto", "light", "dark"];
    const next = order[(order.indexOf(getMode()) + 1) % order.length];
    localStorage.setItem(KEY, next);
    applyTheme(next);
    setMode(next);
    setResolved(resolve(next));
    window.dispatchEvent(new Event(EVENT));
  }, []);

  const Icon = mode === "auto" ? SunMoon : mode === "light" ? Sun : Moon;
  const label =
    mode === "auto"
      ? `تلقائي · ${resolved === "light" ? "نهار" : "ليل"}`
      : mode === "light"
        ? "وضع النهار"
        : "وضع الليل";

  return (
    <button
      onClick={cycle}
      title={`السمة: ${label}`}
      aria-label={`تبديل السمة (${label})`}
      className={cn(
        "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl",
        "text-muted-foreground hover:text-foreground hover:bg-emerald-500/[0.08]",
        "transition-all duration-200",
        collapsed && "justify-center",
      )}
    >
      <Icon className="w-5 h-5 flex-shrink-0" />
      {!collapsed && <span className="text-sm font-medium truncate">{label}</span>}
    </button>
  );
}
