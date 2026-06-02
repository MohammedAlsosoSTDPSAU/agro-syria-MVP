"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Area,
  AreaChart,
  ReferenceLine,
} from "recharts";
import { PRICE_HISTORY } from "./marketData";

type Crop = "wheat" | "cotton" | "tomato" | "olive_oil" | "barley" | "lentils" | "citrus" | "pistachios" | "sugar_beet" | "grapes";

const CROP_CONFIG: Record<Crop, { label_ar: string; color: string; unit: string }> = {
  wheat:      { label_ar: "قمح",           color: "#10b981", unit: "ل.س/كغ" },
  cotton:     { label_ar: "قطن",           color: "#f59e0b", unit: "ل.س/كغ" },
  tomato:     { label_ar: "طماطم",         color: "#ef4444", unit: "ل.س/كغ" },
  olive_oil:  { label_ar: "زيت الزيتون",  color: "#a78bfa", unit: "ل.س/كغ" },
  barley:     { label_ar: "شعير",          color: "#84cc16", unit: "ل.س/كغ" },
  lentils:    { label_ar: "عدس",           color: "#f97316", unit: "ل.س/كغ" },
  citrus:     { label_ar: "حمضيات",        color: "#facc15", unit: "ل.س/كغ" },
  pistachios: { label_ar: "فستق حلبي",    color: "#4ade80", unit: "ل.س/كغ" },
  sugar_beet: { label_ar: "شمندر سكري",   color: "#fb7185", unit: "ل.س/كغ" },
  grapes:     { label_ar: "عنب",           color: "#c084fc", unit: "ل.س/كغ" },
};

const CROPS: Crop[] = ["wheat", "cotton", "tomato", "olive_oil", "barley", "lentils", "citrus", "pistachios", "sugar_beet", "grapes"];

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  const month = PRICE_HISTORY.find((p) => p.month === label)?.month_ar ?? label;
  return (
    <div
      className="glass-card rounded-xl px-3 py-2.5 shadow-xl border border-emerald-500/20"
      dir="rtl"
    >
      <p className="text-[11px] font-bold text-foreground mb-2">{month}</p>
      <div className="space-y-1">
        {payload.map((entry) => {
          const crop = CROPS.find(
            (c) => CROP_CONFIG[c].label_ar === entry.name
          );
          return (
            <div key={entry.name} className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-1.5">
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ background: entry.color }}
                />
                <span className="text-[10px] text-muted-foreground">{entry.name}</span>
              </div>
              <span className="text-[10px] font-bold text-foreground" dir="ltr">
                {entry.value.toLocaleString("en")} {crop ? CROP_CONFIG[crop].unit : ""}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function PriceTrendChart() {
  const [activeCrops, setActiveCrops] = useState<Set<Crop>>(
    new Set<Crop>(["wheat", "cotton"])
  );

  const toggle = (crop: Crop) =>
    setActiveCrops((prev) => {
      const next = new Set(prev);
      if (next.has(crop) && next.size > 1) next.delete(crop);
      else next.add(crop);
      return next;
    });

  const chartData = PRICE_HISTORY.map((p) => ({
    month: p.month,
    month_ar: p.month_ar,
    ...(activeCrops.has("wheat")      ? { [CROP_CONFIG.wheat.label_ar]:      p.wheat }      : {}),
    ...(activeCrops.has("cotton")     ? { [CROP_CONFIG.cotton.label_ar]:     p.cotton }     : {}),
    ...(activeCrops.has("tomato")     ? { [CROP_CONFIG.tomato.label_ar]:     p.tomato }     : {}),
    ...(activeCrops.has("olive_oil")  ? { [CROP_CONFIG.olive_oil.label_ar]:  p.olive_oil }  : {}),
    ...(activeCrops.has("barley")     ? { [CROP_CONFIG.barley.label_ar]:     p.barley }     : {}),
    ...(activeCrops.has("lentils")    ? { [CROP_CONFIG.lentils.label_ar]:    p.lentils }    : {}),
    ...(activeCrops.has("citrus")     ? { [CROP_CONFIG.citrus.label_ar]:     p.citrus }     : {}),
    ...(activeCrops.has("pistachios") ? { [CROP_CONFIG.pistachios.label_ar]: p.pistachios } : {}),
    ...(activeCrops.has("sugar_beet") ? { [CROP_CONFIG.sugar_beet.label_ar]: p.sugar_beet } : {}),
    ...(activeCrops.has("grapes")     ? { [CROP_CONFIG.grapes.label_ar]:     p.grapes }     : {}),
  }));

  return (
    <div>
      {/* Crop toggles */}
      <div className="flex flex-wrap gap-2 mb-4" dir="rtl">
        {CROPS.map((crop) => {
          const cfg = CROP_CONFIG[crop];
          const active = activeCrops.has(crop);
          return (
            <button
              key={crop}
              onClick={() => toggle(crop)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium transition-all border ${
                active
                  ? "border-transparent text-background"
                  : "border-white/10 text-muted-foreground hover:text-foreground"
              }`}
              style={active ? { background: cfg.color } : undefined}
            >
              <span
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ background: cfg.color }}
              />
              {cfg.label_ar}
            </button>
          );
        })}
      </div>

      <ResponsiveContainer width="100%" height={240}>
        <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
          <defs>
            {CROPS.filter((c) => activeCrops.has(c)).map((crop) => (
              <linearGradient key={crop} id={`grad-${crop}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={CROP_CONFIG[crop].color} stopOpacity={0.25} />
                <stop offset="95%" stopColor={CROP_CONFIG[crop].color} stopOpacity={0}    />
              </linearGradient>
            ))}
          </defs>
          <XAxis
            dataKey="month"
            tick={{ fill: "oklch(0.58 0.45 158)", fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) =>
              PRICE_HISTORY.find((p) => p.month === v)?.month_ar ?? v
            }
          />
          <YAxis
            tick={{ fill: "oklch(0.58 0.45 158)", fontSize: 9 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `${v.toLocaleString("en")}`}
            width={48}
          />
          <Tooltip content={<CustomTooltip />} />
          {CROPS.filter((c) => activeCrops.has(c)).map((crop) => (
            <Area
              key={crop}
              type="monotone"
              dataKey={CROP_CONFIG[crop].label_ar}
              stroke={CROP_CONFIG[crop].color}
              strokeWidth={2}
              fill={`url(#grad-${crop})`}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 0 }}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>

      <p className="text-[10px] text-muted-foreground/60 text-center mt-1" dir="rtl">
        أسعار السوق المحلي — ليرة سورية لكل كيلوغرام · نوفمبر 2025 – أبريل 2026
      </p>
    </div>
  );
}
