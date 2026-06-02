"use client";

import { useState, memo } from "react";
import { motion } from "framer-motion";
import { TrendingUp, Globe } from "lucide-react";
import { cn } from "@/lib/utils";

type PriceMode = "local" | "global";

const CROPS = [
  { key: "wheat",   name: "قمح",         unit: "ل.س/كغ", local: 1400, global: 285,  change: +3.2, prices7d: [1280, 1300, 1320, 1290, 1350, 1380, 1400] },
  { key: "cotton",  name: "قطن",         unit: "ل.س/كغ", local: 1850, global: 820,  change: -1.8, prices7d: [1920, 1900, 1880, 1890, 1870, 1860, 1850] },
  { key: "beet",    name: "شمندر سكري", unit: "ل.س/كغ", local: 420,  global:  95,  change: +0.5, prices7d: [410, 415, 412, 418, 416, 419, 420]         },
  { key: "tobacco", name: "تبغ",         unit: "ل.س/كغ", local: 3200, global: 1200, change: +5.1, prices7d: [3000, 350, 380, 3100, 3150, 3180, 3200]  },
  { key: "olive",   name: "زيت زيتون",  unit: "ل.س/ل",  local: 8500, global: 3200, change: -2.3, prices7d: [8800, 8750, 8700, 8650, 8620, 8560, 8500]  },
];

const Sparkline = memo(function Sparkline({ data, up }: { data: number[]; up: boolean }) {
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pts = data
    .map((v, i) => `${(i / (data.length - 1)) * 44},${12 - ((v - min) / range) * 12}`)
    .join(" ");
  const lastX = 44;
  const lastY = 12 - ((data[data.length - 1] - min) / range) * 12;
  const color = up ? "oklch(0.696 0.170 162)" : "oklch(0.628 0.258 29.234)";
  return (
    <svg width={44} height={14} viewBox="0 0 44 14">
      <polyline points={pts} fill="none" stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={lastX} cy={lastY} r={2.2} fill={color} />
    </svg>
  );
});

export function MarketTicker() {
  const [mode, setMode] = useState<PriceMode>("local");

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4 }}
      className="glass-card rounded-2xl p-4 mb-4"
    >
      <div className="flex items-center justify-between mb-3" dir="rtl">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-emerald-400" />
          <span className="text-sm font-bold text-foreground">نبض السوق الاستراتيجي</span>
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative rounded-full h-1.5 w-1.5 bg-emerald-400" />
          </span>
        </div>
        <div className="flex gap-0.5 bg-white/[0.04] rounded-full p-0.5 border border-white/[0.06]">
          {(["local", "global"] as PriceMode[]).map((val) => (
            <button
              key={val}
              onClick={() => setMode(val)}
              className={cn(
                "text-[10px] font-semibold px-2.5 py-1 rounded-full transition-all flex items-center gap-1",
                mode === val
                  ? "bg-emerald-500/20 text-emerald-300"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {val === "global" && <Globe className="w-2.5 h-2.5" />}
              {val === "local" ? "محلي" : "عالمي"}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-none" dir="rtl">
        {CROPS.map((crop) => {
          const up = crop.change > 0;
          const price = mode === "local"
            ? `${crop.local.toLocaleString()} ${crop.unit}`
            : `$${crop.global}/طن`;
          return (
            <div
              key={crop.key}
              className="flex-shrink-0 flex flex-col gap-2 p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:border-emerald-500/20 transition-colors"
              style={{ minWidth: 128 }}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-foreground">{crop.name}</span>
                <span className={cn(
                  "text-[10px] font-bold px-1.5 py-0.5 rounded-full",
                  up ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"
                )}>
                  {up ? "▲" : "▼"} {Math.abs(crop.change)}٪
                </span>
              </div>
              <Sparkline data={crop.prices7d} up={up} />
              <div>
                <p className="text-[9px] text-muted-foreground mb-0.5">السعر</p>
                <p className="text-[11px] font-semibold text-foreground" dir="ltr">{price}</p>
              </div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}
