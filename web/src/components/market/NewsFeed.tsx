"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle, ChevronDown,
  TrendingUp, CloudLightning, FileText, Bug, Globe,
  type LucideProps,
} from "lucide-react";
import { NEWS_FEED, CATEGORY_CONFIG } from "./marketData";

type Category = keyof typeof CATEGORY_CONFIG | "all";

// ── Category → icon + container color ────────────────────────────────────────
const CATEGORY_ICON: Record<keyof typeof CATEGORY_CONFIG, {
  Icon: React.ComponentType<LucideProps>;
  bg: string;
  ring: string;
}> = {
  price:   { Icon: TrendingUp,      bg: "bg-emerald-500/15", ring: "border-emerald-500/30" },
  weather: { Icon: CloudLightning,  bg: "bg-amber-500/15",   ring: "border-amber-500/30"   },
  policy:  { Icon: FileText,        bg: "bg-sky-500/15",     ring: "border-sky-500/30"     },
  pest:    { Icon: Bug,             bg: "bg-red-500/15",     ring: "border-red-500/30"     },
  export:  { Icon: Globe,           bg: "bg-purple-500/15",  ring: "border-purple-500/30"  },
};

const FILTER_TABS: { id: Category; label_ar: string }[] = [
  { id: "all",     label_ar: "الكل"    },
  { id: "price",   label_ar: "أسعار"   },
  { id: "weather", label_ar: "طقس"     },
  { id: "pest",    label_ar: "آفات"    },
  { id: "policy",  label_ar: "سياسات"  },
  { id: "export",  label_ar: "تصدير"   },
];

export function NewsFeed() {
  const [filter, setFilter]   = useState<Category>("all");
  const [expanded, setExpanded] = useState<string | null>(null);

  const items = filter === "all"
    ? NEWS_FEED
    : NEWS_FEED.filter((n) => n.category === filter);

  return (
    <div dir="rtl">
      {/* Filter tabs */}
      <div className="flex gap-1.5 mb-4 flex-wrap">
        {FILTER_TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setFilter(tab.id)}
            className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-all ${
              filter === tab.id
                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                : "text-muted-foreground hover:text-foreground border border-white/5 hover:border-white/10"
            }`}
          >
            {tab.label_ar}
          </button>
        ))}
      </div>

      {/* News items */}
      <div className="space-y-2">
        <AnimatePresence mode="popLayout">
          {items.map((item, i) => {
            const cat    = CATEGORY_CONFIG[item.category];
            const catIcon = CATEGORY_ICON[item.category];
            const Icon   = catIcon.Icon;
            const isOpen = expanded === item.id;
            const isFirst = i === 0;

            return (
              <motion.div
                key={item.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ delay: i * 0.04, duration: 0.25 }}
                className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden"
              >
                <button
                  onClick={() => setExpanded(isOpen ? null : item.id)}
                  className="w-full text-right p-3 flex items-center gap-2.5"
                >
                  {/* Category icon badge */}
                  <div className="relative flex-shrink-0">
                    <div className={`w-7 h-7 rounded-lg border flex items-center justify-center ${catIcon.bg} ${catIcon.ring}`}>
                      <Icon className={`w-3.5 h-3.5 ${cat.color}`} />
                    </div>
                    {/* Live pulsing dot on the most recent item */}
                    {isFirst && (
                      <span className="absolute -top-0.5 -right-0.5 w-2 h-2 flex items-center justify-center">
                        <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
                        <span className="relative inline-flex w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      </span>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    {/* Category badge + date */}
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${catIcon.bg} ${catIcon.ring} ${cat.color}`}>
                        {cat.label_ar}
                      </span>
                      <span className="text-[9px] text-muted-foreground/50 tabular-nums">
                        {item.date_ar}
                      </span>
                      {item.urgent && (
                        <AlertTriangle className="w-3 h-3 text-amber-400" />
                      )}
                    </div>
                    {/* Title — single line by default, expands on open */}
                    <p className={`text-[11px] font-semibold text-foreground leading-snug text-right ${isOpen ? "" : "truncate"}`}>
                      {item.title_ar}
                    </p>
                  </div>

                  <motion.span
                    animate={{ rotate: isOpen ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                    className="flex-shrink-0"
                  >
                    <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                  </motion.span>
                </button>

                <AnimatePresence>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.22 }}
                      className="overflow-hidden"
                    >
                      <div className="px-3 pb-3 border-t border-white/[0.04]">
                        <p className="text-[11px] text-muted-foreground leading-relaxed mt-2">
                          {item.summary_ar}
                        </p>
                        <p className="text-[9px] text-muted-foreground/40 mt-1.5">
                          المصدر: {item.source_ar}
                        </p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
