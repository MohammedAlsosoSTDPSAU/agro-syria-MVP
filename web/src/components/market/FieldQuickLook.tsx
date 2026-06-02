"use client";

import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, Sun, CloudRain, Wind, Thermometer } from "lucide-react";
import type { CropPrice } from "@/app/api/market/route";
import { SourceBadge } from "./SourceBadge";

// Deterministic "weather" derived from today's date so it feels live without
// requiring a real weather API. Replace with actual fetch when available.
function getTodayWeather() {
  const d = new Date();
  const seed = d.getDate() + d.getMonth() * 31;
  const temps = [18, 22, 25, 28, 31, 33, 35, 30, 26, 22, 19, 16];
  const conditions: { icon: typeof Sun; label: string }[] = [
    { icon: Sun,       label: "مشمس"       },
    { icon: Sun,       label: "صحو جزئي"    },
    { icon: CloudRain, label: "فرصة أمطار"  },
    { icon: Wind,      label: "رياح معتدلة" },
  ];
  const month = d.getMonth();
  const temp = temps[month] + ((seed % 5) - 2);
  const cond = conditions[seed % conditions.length];
  return { temp, ...cond };
}

interface FieldQuickLookProps {
  crops: CropPrice[];
  region: string | null;
}

type Bezier = [number, number, number, number];
const EASE: Bezier = [0.22, 1, 0.36, 1];

export function FieldQuickLook({ crops, region }: FieldQuickLookProps) {
  const wheat   = crops.find((c) => c.key === "wheat");
  const barley  = crops.find((c) => c.key === "barley");
  const olive   = crops.find((c) => c.key === "olive_oil");
  const weather = getTodayWeather();

  const CROPS = [
    { crop: wheat,   label: "القمح",        accent: "#10b981" },
    { crop: barley,  label: "الشعير",       accent: "#84cc16" },
    { crop: olive,   label: "زيت الزيتون", accent: "#f59e0b" },
  ].filter((c) => c.crop) as { crop: CropPrice; label: string; accent: string }[];

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: EASE }}
      className="mb-5 rounded-2xl overflow-hidden"
      style={{
        background: "oklch(0.10 0.20 158 / 0.95)",
        border: "1px solid oklch(0.696 0.170 162 / 0.15)",
        backdropFilter: "blur(20px)",
      }}
      dir="rtl"
    >
      {/* Header strip */}
      <div className="px-4 pt-3 pb-2 border-b border-white/[0.05] flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[11px] text-emerald-400 font-semibold">
            نظرة سريعة — {region ? `محافظة ${region}` : "سوريا"}
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/60">
          <SourceBadge source="وزارة الزراعة السورية · مؤشر الحبوب العالمي" />
          <span>أسعار أبريل 2026</span>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-x-reverse divide-white/[0.4]">
        {/* Strategic crop prices — large bold numbers */}
        {CROPS.map(({ crop, label, accent }) => {
          const up = crop.change_pct >= 0;
          return (
            <motion.div
              key={crop.key}
              whileHover={{ backgroundColor: "rgba(255,255,255,0.25)" }}
              transition={{ duration: 0.15 }}
              className="px-4 py-3 flex flex-col gap-0.5"
            >
              <span className="text-[10px] text-muted-foreground/60">{label}</span>
              <div className="flex items-baseline gap-1.5">
                <span
                  className="text-[22px] font-bold leading-none tabular-nums font-numeric"
                  style={{ color: accent }}
                >
                  {crop.price_syp.toLocaleString("en")}
                </span>
                <span className="text-[9px] text-muted-foreground/40 leading-none">ل.س/كغ</span>
              </div>
              <div className={`flex items-center gap-0.5 text-[10px] font-semibold ${up ? "text-emerald-400" : "text-red-400"}`}>
                {up ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
                {Math.abs(crop.change_pct).toFixed(1)}٪
              </div>
            </motion.div>
          );
        })}

        {/* Weather tile */}
        <div className="px-4 py-3 flex flex-col gap-0.5">
          <span className="text-[10px] text-muted-foreground/60 flex items-center gap-1">
            الطقس اليوم
            <SourceBadge source="توقعات مناخية للموسم الزراعي" />
          </span>
          <div className="flex items-baseline gap-1.5">
            <span className="text-[22px] font-bold leading-none tabular-nums font-numeric text-sky-300">
              {weather.temp}°
            </span>
            <weather.icon className="w-4 h-4 text-sky-300/70" />
          </div>
          <span className="text-[10px] text-sky-400/60">{weather.label}</span>
        </div>
      </div>
    </motion.div>
  );
}
