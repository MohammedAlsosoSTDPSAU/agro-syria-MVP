"use client";

/**
 * Mobile navigation (md:hidden).
 *
 * A sleek glassmorphic bottom bar with the four primary destinations + a
 * "More" button that opens a full bottom-sheet drawer exposing every route,
 * the About link, and the Sun-Cycle theme toggle. Desktop keeps the Sidebar.
 */

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { LayoutDashboard, Bot, Map, TrendingUp, Menu, X } from "lucide-react";
import { NAV_ITEMS, BOTTOM_ITEMS, type NavItem } from "./Sidebar";
import { ThemeToggle } from "@/components/ThemeController";
import { cn } from "@/lib/utils";

// Four primary destinations surfaced on the bottom bar.
const PRIMARY: NavItem[] = [
  { id: "dashboard", labelAr: "الرئيسية", icon: LayoutDashboard, href: "/dashboard" },
  { id: "assistant", labelAr: "المساعد", icon: Bot, href: "/copilot" },
  { id: "fields", labelAr: "حقولي", icon: Map, href: "/fields" },
  { id: "market", labelAr: "السوق", icon: TrendingUp, href: "/dashboard/market" },
];

const ALL_ITEMS = [...NAV_ITEMS, ...BOTTOM_ITEMS];

function useActiveHref(): string | null {
  const pathname = usePathname() || "";
  // Longest matching href wins (so /dashboard/market beats /dashboard).
  let best: string | null = null;
  for (const it of ALL_ITEMS) {
    if (pathname === it.href || pathname.startsWith(it.href + "/")) {
      if (!best || it.href.length > best.length) best = it.href;
    }
  }
  return best;
}

export function MobileNav() {
  const [open, setOpen] = useState(false);
  const activeHref = useActiveHref();

  return (
    <>
      {/* ── Bottom bar ── */}
      <nav
        dir="rtl"
        className="md:hidden fixed bottom-0 inset-x-0 z-40 glass-sidebar border-t border-emerald-500/15 pb-[env(safe-area-inset-bottom)]"
      >
        <div className="flex items-stretch justify-around px-1.5 pt-1.5 pb-1.5">
          {PRIMARY.map((item) => {
            const Icon = item.icon;
            const active = activeHref === item.href;
            return (
              <Link
                key={item.id}
                href={item.href}
                className="relative flex flex-col items-center justify-center gap-0.5 flex-1 min-w-0 py-1.5 rounded-xl"
              >
                {active && (
                  <motion.span
                    layoutId="mnav-pill"
                    className="absolute inset-x-2 inset-y-0 rounded-xl bg-emerald-500/12 border border-emerald-500/25"
                    transition={{ type: "spring", stiffness: 400, damping: 34 }}
                  />
                )}
                <Icon className={cn("relative z-10 w-5 h-5 transition-colors", active ? "text-emerald-400" : "text-muted-foreground")} />
                <span className={cn("relative z-10 text-[9px] font-arabic truncate max-w-full", active ? "text-emerald-400 font-bold" : "text-muted-foreground")}>
                  {item.labelAr}
                </span>
              </Link>
            );
          })}

          {/* More */}
          <button
            onClick={() => setOpen(true)}
            aria-label="المزيد"
            className="flex flex-col items-center justify-center gap-0.5 flex-1 min-w-0 py-1.5 rounded-xl"
          >
            <Menu className="w-5 h-5 text-muted-foreground" />
            <span className="text-[9px] font-arabic text-muted-foreground">المزيد</span>
          </button>
        </div>
      </nav>

      {/* ── Full drawer ── */}
      <AnimatePresence>
        {open && (
          <div className="md:hidden fixed inset-0 z-50" dir="rtl">
            <motion.button
              aria-label="إغلاق القائمة"
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
            />
            <motion.div
              className="absolute inset-x-0 bottom-0 glass-sidebar rounded-t-3xl border-t border-emerald-500/20 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] max-h-[85vh] overflow-y-auto"
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 360, damping: 36 }}
            >
              {/* Grab handle + header */}
              <div className="flex items-center justify-between mb-4">
                <img src="/assets/agro-syria-logo.svg" alt="أغرو-سوريا" draggable={false} className="h-9 w-auto select-none" />
                <button onClick={() => setOpen(false)} aria-label="إغلاق"
                  className="w-8 h-8 rounded-lg bg-white/[0.06] border border-white/[0.08] flex items-center justify-center">
                  <X className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>

              {/* All routes */}
              <div className="grid grid-cols-3 gap-2">
                {ALL_ITEMS.map((item) => {
                  const Icon = item.icon;
                  const active = activeHref === item.href;
                  return (
                    <Link
                      key={item.id}
                      href={item.href}
                      onClick={() => setOpen(false)}
                      className={cn(
                        "relative flex flex-col items-center gap-2 rounded-2xl p-3 border transition-colors",
                        active
                          ? "bg-emerald-500/12 border-emerald-500/30 text-emerald-400"
                          : "bg-white/[0.04] border-white/[0.07] text-muted-foreground hover:text-foreground",
                      )}
                    >
                      <Icon className={cn("w-5 h-5", active ? "text-emerald-400" : "")} />
                      <span className="text-[11px] font-arabic text-center leading-tight">{item.labelAr}</span>
                      {item.badge && (
                        <span className="absolute top-1.5 end-1.5 text-[8px] font-bold bg-emerald-500/20 text-emerald-300 rounded-full px-1.5 py-0.5">
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>

              {/* Theme toggle */}
              <div className="mt-3 pt-3 border-t border-emerald-500/12">
                <ThemeToggle />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
