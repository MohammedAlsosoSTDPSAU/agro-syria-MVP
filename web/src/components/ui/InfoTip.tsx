"use client";

/**
 * Contextual InfoTip — a prominent ⓘ that opens a CENTERED modal dialog
 * (portaled to <body>, so it never clips behind overflow containers).
 * Content has two parts: a simple definition + the available services.
 */

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Info, X, Sparkles, CheckCircle2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

export function InfoTip({
  title, definition, services, className,
}: {
  title: string;
  definition: string;
  services?: string[];
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!open) return;
    const onEsc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", onEsc);
    document.body.style.overflow = "hidden";   // lock background scroll while open
    return () => { document.removeEventListener("keydown", onEsc); document.body.style.overflow = ""; };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen(true); }}
        aria-label={`شرح: ${title}`}
        className={cn(
          "inline-flex items-center justify-center w-5 h-5 rounded-full flex-shrink-0",
          "bg-emerald-500/15 border border-emerald-500/40 text-emerald-400",
          "hover:bg-emerald-500/25 hover:scale-110 active:scale-95 transition-all",
          className,
        )}
      >
        <Info className="w-3 h-3" />
      </button>

      {mounted && createPortal(
        <AnimatePresence>
          {open && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" dir="rtl">
              <motion.button
                aria-label="إغلاق"
                onClick={() => setOpen(false)}
                className="absolute inset-0 bg-black/65 backdrop-blur-sm"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              />
              <motion.div
                role="dialog" aria-modal="true"
                initial={{ opacity: 0, scale: 0.94, y: 14 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96, y: 8 }}
                transition={{ type: "spring", stiffness: 380, damping: 30 }}
                className="relative w-full max-w-sm glass-card rounded-3xl border border-emerald-500/25 emerald-glow-sm p-5 max-h-[85dvh] overflow-y-auto"
              >
                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center flex-shrink-0">
                      <Info className="w-4 h-4 text-emerald-400" />
                    </div>
                    <h3 className="text-sm font-black text-foreground font-arabic truncate">{title}</h3>
                  </div>
                  <button
                    onClick={() => setOpen(false)} aria-label="إغلاق"
                    className="w-7 h-7 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.08] flex items-center justify-center text-muted-foreground transition-colors flex-shrink-0"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* التعريف الميسّر */}
                <div className="rounded-2xl bg-emerald-500/[0.06] border border-emerald-500/15 p-3.5 mb-3">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-[11px] font-bold text-emerald-300 font-arabic">التعريف الميسّر</span>
                  </div>
                  <p className="text-[12.5px] text-foreground/85 leading-relaxed font-arabic">{definition}</p>
                </div>

                {/* الخدمات المتاحة */}
                {services && services.length > 0 && (
                  <div className="rounded-2xl bg-white/[0.03] border border-white/[0.07] p-3.5">
                    <div className="flex items-center gap-1.5 mb-2.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-[11px] font-bold text-emerald-300 font-arabic">الخدمات المتاحة</span>
                    </div>
                    <ul className="space-y-2">
                      {services.map(s => (
                        <li key={s} className="flex items-start gap-2 text-[12px] text-foreground/85 font-arabic leading-relaxed">
                          <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
                          {s}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </>
  );
}
