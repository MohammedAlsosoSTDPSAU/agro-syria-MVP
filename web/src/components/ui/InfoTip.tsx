"use client";

/** Lightweight contextual info popover — a tiny ⓘ that explains a card/section. */

import { useEffect, useRef, useState } from "react";
import { Info } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

export function InfoTip({ text, label, className }: { text: string; label?: string; className?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onEsc);
    return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("keydown", onEsc); };
  }, [open]);

  return (
    <div ref={ref} className={cn("relative inline-flex", className)}>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen(v => !v); }}
        aria-label={label ?? "معلومات عن هذا القسم"}
        className={cn(
          "w-5 h-5 rounded-full flex items-center justify-center transition-colors flex-shrink-0",
          open ? "text-emerald-400 bg-emerald-500/12" : "text-muted-foreground/45 hover:text-emerald-400 hover:bg-emerald-500/10",
        )}
      >
        <Info className="w-3.5 h-3.5" />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 4, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.96 }}
            transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
            className="absolute z-[60] top-full mt-1.5 end-0 w-56 max-w-[78vw] glass-card rounded-xl border border-emerald-500/22 p-3 shadow-xl text-start"
            dir="rtl"
            role="tooltip"
          >
            {label && <p className="text-[11px] font-bold text-emerald-300 font-arabic mb-1">{label}</p>}
            <p className="text-[11px] text-foreground/80 leading-relaxed font-arabic">{text}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
