"use client";

/** Elegant page-header guide: a thin summary line + an optional collapsible
 *  list of the page's core services/utilities. */

import { useState } from "react";
import { Info, ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

export function PageGuide({ summary, services }: { summary: string; services?: string[] }) {
  const [open, setOpen] = useState(false);
  const hasServices = !!services?.length;

  return (
    <div className="mt-1.5" dir="rtl">
      <button
        type="button"
        onClick={() => hasServices && setOpen(v => !v)}
        className={cn(
          "inline-flex items-start gap-1.5 text-xs text-muted-foreground font-arabic leading-relaxed text-start",
          hasServices && "hover:text-foreground transition-colors cursor-pointer",
        )}
      >
        <Info className="w-3.5 h-3.5 text-emerald-400/70 flex-shrink-0 mt-0.5" />
        <span>{summary}</span>
        {hasServices && (
          <ChevronDown className={cn("w-3 h-3 mt-0.5 flex-shrink-0 transition-transform duration-200", open && "rotate-180")} />
        )}
      </button>
      <AnimatePresence initial={false}>
        {open && hasServices && (
          <motion.ul
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden mt-2 flex flex-wrap gap-1.5"
          >
            {services!.map(s => (
              <li key={s} className="text-[10px] text-emerald-200/85 bg-emerald-500/[0.08] border border-emerald-500/20 rounded-full px-2.5 py-1 font-arabic">
                {s}
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}
