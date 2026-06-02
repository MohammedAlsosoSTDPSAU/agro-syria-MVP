"use client";

import { useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { REGIONAL_YIELDS } from "./marketData";

type Metric =
  | "wheat_ton_ha"
  | "cotton_ton_ha"
  | "tomato_ton_ha"
  | "barley_ton_ha"
  | "lentils_ton_ha"
  | "citrus_ton_ha"
  | "pistachios_ton_ha"
  | "sugar_beet_ton_ha"
  | "grapes_ton_ha";

const METRIC_CONFIG: Record<Metric, { label_ar: string; color: string; unit: string }> = {
  wheat_ton_ha:       { label_ar: "قمح",         color: "#10b981", unit: "طن/هكتار" },
  cotton_ton_ha:      { label_ar: "قطن",         color: "#f59e0b", unit: "طن/هكتار" },
  tomato_ton_ha:      { label_ar: "طماطم",       color: "#ef4444", unit: "طن/هكتار" },
  barley_ton_ha:      { label_ar: "شعير",        color: "#84cc16", unit: "طن/هكتار" },
  lentils_ton_ha:     { label_ar: "عدس",         color: "#f97316", unit: "طن/هكتار" },
  citrus_ton_ha:      { label_ar: "حمضيات",      color: "#facc15", unit: "طن/هكتار" },
  pistachios_ton_ha:  { label_ar: "فستق حلبي",  color: "#4ade80", unit: "طن/هكتار" },
  sugar_beet_ton_ha:  { label_ar: "شمندر سكري", color: "#fb7185", unit: "طن/هكتار" },
  grapes_ton_ha:      { label_ar: "عنب",         color: "#c084fc", unit: "طن/هكتار" },
};

const METRICS: Metric[] = [
  "wheat_ton_ha", "cotton_ton_ha", "tomato_ton_ha",
  "barley_ton_ha", "lentils_ton_ha", "citrus_ton_ha",
  "pistachios_ton_ha", "sugar_beet_ton_ha", "grapes_ton_ha",
];

function CustomTooltip({
  active,
  payload,
  label,
  unit,
}: {
  active?: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload?: ReadonlyArray<any>;
  label?: string;
  unit: string;
}) {
  if (!active || !payload?.length) return null;
  const val = payload[0]?.value as number | undefined;
  return (
    <div className="glass-card rounded-xl px-3 py-2 shadow-xl border border-emerald-500/20" dir="rtl">
      <p className="text-[11px] font-bold text-foreground">{label}</p>
      <p className="text-[10px] text-emerald-400 mt-0.5">
        {val} {unit}
      </p>
    </div>
  );
}

export function RegionalChart() {
  const [metric, setMetric] = useState<Metric>("wheat_ton_ha");
  const cfg = METRIC_CONFIG[metric];

  const data = REGIONAL_YIELDS
    .filter((r) => r[metric] > 0)
    .sort((a, b) => b[metric] - a[metric]);

  const maxVal = Math.max(...data.map((d) => d[metric]));

  return (
    <div>
      {/* Metric selector */}
      <div className="flex gap-2 mb-4 flex-wrap" dir="rtl">
        {METRICS.map((m) => {
          const c = METRIC_CONFIG[m];
          return (
            <button
              key={m}
              onClick={() => setMetric(m)}
              className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-all border ${
                metric === m
                  ? "border-transparent text-background"
                  : "border-white/10 text-muted-foreground hover:text-foreground"
              }`}
              style={metric === m ? { background: c.color } : undefined}
            >
              {c.label_ar}
            </button>
          );
        })}
      </div>

      <ResponsiveContainer width="100%" height={220}>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 0, right: 12, left: 0, bottom: 0 }}
        >
          <XAxis
            type="number"
            domain={[0, maxVal * 1.15]}
            tick={{ fill: "oklch(0.58 0.45 158)", fontSize: 9 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `${v}`}
          />
          <YAxis
            type="category"
            dataKey="gov_ar"
            tick={{ fill: "oklch(0.58 0.45 158)", fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            width={56}
          />
          <Tooltip
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            content={(props: any) => <CustomTooltip {...props} unit={cfg.unit} />}
          />
          <Bar dataKey={metric} radius={[0, 4, 4, 0]} maxBarSize={18}>
            {data.map((entry, i) => (
              <Cell
                key={entry.gov_ar}
                fill={cfg.color}
                fillOpacity={0.55 + (data.length - i) / data.length * 0.4}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      <p className="text-[10px] text-muted-foreground/60 text-center mt-1" dir="rtl">
        الإنتاجية الزراعية المقارنة بين المحافظات السورية · موسم 2025
      </p>
    </div>
  );
}
