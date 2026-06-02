"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, MapPin, X } from "lucide-react";

const ALL_REGIONS = [
  "الحسكة", "حلب", "حماة", "الرقة", "حمص", "دير الزور",
  "دمشق", "اللاذقية", "ريف دمشق", "إدلب", "طرطوس",
  "السويداء", "درعا", "القنيطرة",
];

interface RegionSelectorProps {
  value: string | null;
  onChange: (region: string | null) => void;
}

export function RegionSelector({ value, onChange }: RegionSelectorProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={ref} className="relative" dir="rtl">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 px-3 py-2 rounded-xl glass-card border border-white/10 hover:border-emerald-500/30 transition-all text-sm"
      >
        <MapPin className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
        <span className={value ? "text-foreground" : "text-muted-foreground"}>
          {value ?? "جميع المحافظات"}
        </span>
        {value ? (
          <button
            onClick={(e) => { e.stopPropagation(); onChange(null); }}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-3 h-3" />
          </button>
        ) : (
          <ChevronDown
            className={`w-3.5 h-3.5 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
          />
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scaleY: 0.95 }}
            animate={{ opacity: 1, y: 0, scaleY: 1 }}
            exit={{ opacity: 0, y: -6, scaleY: 0.95 }}
            transition={{ duration: 0.14 }}
            className="absolute top-full mt-1.5 end-0 z-50 glass-card rounded-xl border border-white/10 shadow-xl overflow-hidden min-w-[160px]"
            style={{ transformOrigin: "top right" }}
          >
            <div className="py-1 max-h-64 overflow-y-auto">
              <button
                onClick={() => { onChange(null); setOpen(false); }}
                className={`w-full text-right px-4 py-2 text-[12px] transition-colors ${
                  !value
                    ? "text-emerald-400 bg-emerald-500/10"
                    : "text-muted-foreground hover:text-foreground hover:bg-white/[0.04]"
                }`}
              >
                جميع المحافظات
              </button>
              {ALL_REGIONS.map((gov) => (
                <button
                  key={gov}
                  onClick={() => { onChange(gov); setOpen(false); }}
                  className={`w-full text-right px-4 py-2 text-[12px] transition-colors ${
                    value === gov
                      ? "text-emerald-400 bg-emerald-500/10"
                      : "text-muted-foreground hover:text-foreground hover:bg-white/[0.04]"
                  }`}
                >
                  {gov}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
