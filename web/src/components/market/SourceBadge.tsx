"use client";

import { useState } from "react";
import { Info } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

interface SourceBadgeProps {
  source: string;
  className?: string;
}

export function SourceBadge({ source, className = "" }: SourceBadgeProps) {
  const [open, setOpen] = useState(false);

  return (
    <span className={`relative inline-flex ${className}`}>
      <button
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        aria-label={`مصدر البيانات: ${source}`}
        className="text-muted-foreground/40 hover:text-emerald-400/70 transition-colors"
      >
        <Info className="w-3 h-3" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 4, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.95 }}
            transition={{ duration: 0.12 }}
            className="absolute bottom-full mb-1.5 end-0 z-50 whitespace-nowrap"
            role="tooltip"
            dir="rtl"
          >
            <div
              className="px-2.5 py-1.5 rounded-lg text-[10px] text-white/80 leading-tight"
              style={{
                background: "oklch(0.12 0.25 158 / 0.98)",
                border: "1px solid oklch(0.696 0.170 162 / 0.25)",
                backdropFilter: "blur(12px)",
                fontFamily: "var(--font-arabic, inherit)",
              }}
            >
              <span className="text-white/40 block text-[9px] mb-0.5">مصدر البيانات</span>
              {source}
            </div>
            {/* Arrow */}
            <div
              className="absolute -bottom-1 end-2 w-2 h-2 rotate-45"
              style={{ background: "oklch(0.12 0.25 158 / 0.98)", borderRight: "1px solid oklch(0.696 0.170 162 / 0.25)", borderBottom: "1px solid oklch(0.696 0.170 162 / 0.25)" }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </span>
  );
}
