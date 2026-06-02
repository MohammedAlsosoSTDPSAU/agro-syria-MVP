"use client";

import { motion } from "framer-motion";
import { Map, BarChart2, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { SyriaHeatMap } from "./SyriaHeatMap";
import type { VisualizationData, ChartBar } from "@/lib/api";

// ── Types ──────────────────────────────────────────────────────────────
type Bezier = [number, number, number, number];
const EASE: Bezier = [0.22, 1, 0.36, 1];

// ── Bar Chart ──────────────────────────────────────────────────────────
function BarChart({ bars }: { bars: ChartBar[] }) {
  const maxVal = Math.max(...bars.map((b) => b.value), 1);

  const colorClass = (color: ChartBar["color"]) =>
    color === "red"
      ? "bg-red-500/70"
      : color === "amber"
      ? "bg-amber-400/80"
      : "bg-emerald-500/70";

  const textColorClass = (color: ChartBar["color"]) =>
    color === "red"
      ? "text-red-400"
      : color === "amber"
      ? "text-amber-400"
      : "text-emerald-400";

  return (
    <div className="space-y-2.5 px-1" dir="rtl">
      {bars.map((bar, i) => {
        const pct = (bar.value / maxVal) * 100;
        return (
          <motion.div
            key={bar.label_ar}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.08, duration: 0.35, ease: EASE }}
            className="flex items-center gap-2.5"
          >
            <span className="text-[11px] text-muted-foreground w-28 flex-shrink-0 text-right leading-tight">
              {bar.label_ar}
            </span>
            <div className="flex-1 h-5 bg-white/[0.05] rounded-full overflow-hidden">
              <motion.div
                className={cn("h-full rounded-full", colorClass(bar.color))}
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ delay: i * 0.08 + 0.1, duration: 0.55, ease: EASE }}
              />
            </div>
            <span className={cn("text-[11px] font-semibold w-14 flex-shrink-0 text-left", textColorClass(bar.color))}>
              {bar.value.toLocaleString("en")}
            </span>
          </motion.div>
        );
      })}
    </div>
  );
}

// ── Main VisualWorkspace component ─────────────────────────────────────
export function VisualWorkspace({ data }: { data: VisualizationData }) {
  const Icon = data.type === "map" ? Map : BarChart2;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: EASE }}
      className="mt-3 glass-card rounded-xl overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-emerald-500/10">
        <div className="w-7 h-7 rounded-lg bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center flex-shrink-0">
          <Icon className="w-3.5 h-3.5 text-emerald-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-bold text-foreground truncate" dir="rtl">
            {data.title_ar}
          </p>
          {data.source_ar && (
            <p className="text-[9px] text-muted-foreground/60 truncate" dir="rtl">
              {data.source_ar}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1 text-[9px] text-emerald-400/60 flex-shrink-0">
          <Info className="w-3 h-3" />
          <span>{data.type === "map" ? "خريطة تفاعلية" : "مخطط بياني"}</span>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 py-3">
        {data.type === "map" && data.points && data.points.length > 0 ? (
          <SyriaHeatMap points={data.points} compact />
        ) : data.type === "bar_chart" && data.bars && data.bars.length > 0 ? (
          <BarChart bars={data.bars} />
        ) : (
          <p className="text-[11px] text-muted-foreground text-center py-4" dir="rtl">
            لا توجد بيانات مرئية
          </p>
        )}
      </div>
    </motion.div>
  );
}
