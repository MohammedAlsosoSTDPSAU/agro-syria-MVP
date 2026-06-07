"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  CloudSun, Sun, CloudRain, Cloud, Wind, Droplets,
  TrendingUp, TrendingDown, Clock, Sprout,
  Thermometer,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PROVINCES, VIEW_BOX } from "@/components/workspace/SyriaMap";

type Bezier = [number, number, number, number];
const EASE: Bezier = [0.22, 1, 0.36, 1];

// ══════════════════════════════════════════════════════════════════════
// WEATHER INSIGHT CARD
// ══════════════════════════════════════════════════════════════════════

type WeatherIconKey = "sunny" | "partly" | "cloudy" | "rainy" | "hot";

interface DayForecast {
  dayAr:    string;
  iconKey:  WeatherIconKey;
  tempHigh: number;
  tempLow:  number;
  humidity: number;
  wind:     number;
}

interface CityForecast {
  nameAr:   string;
  forecast: DayForecast[];
}

const CITY_FORECASTS: Record<string, CityForecast> = {
  damascus: {
    nameAr: "دمشق",
    forecast: [
      { dayAr: "اليوم",    iconKey: "sunny",  tempHigh: 29, tempLow: 18, humidity: 42, wind: 14 },
      { dayAr: "الغد",     iconKey: "partly", tempHigh: 31, tempLow: 19, humidity: 38, wind: 16 },
      { dayAr: "بعد غد",  iconKey: "hot",    tempHigh: 33, tempLow: 21, humidity: 35, wind: 12 },
    ],
  },
  aleppo: {
    nameAr: "حلب",
    forecast: [
      { dayAr: "اليوم",   iconKey: "partly", tempHigh: 28, tempLow: 16, humidity: 52, wind: 18 },
      { dayAr: "الغد",    iconKey: "sunny",  tempHigh: 30, tempLow: 17, humidity: 48, wind: 20 },
      { dayAr: "بعد غد", iconKey: "partly", tempHigh: 29, tempLow: 16, humidity: 50, wind: 15 },
    ],
  },
  homs: {
    nameAr: "حمص",
    forecast: [
      { dayAr: "اليوم",   iconKey: "hot",   tempHigh: 31, tempLow: 19, humidity: 40, wind: 12 },
      { dayAr: "الغد",    iconKey: "hot",   tempHigh: 33, tempLow: 20, humidity: 37, wind: 10 },
      { dayAr: "بعد غد", iconKey: "sunny", tempHigh: 32, tempLow: 18, humidity: 39, wind: 14 },
    ],
  },
  latakia: {
    nameAr: "اللاذقية",
    forecast: [
      { dayAr: "اليوم",   iconKey: "partly", tempHigh: 24, tempLow: 17, humidity: 76, wind: 12 },
      { dayAr: "الغد",    iconKey: "cloudy", tempHigh: 22, tempLow: 16, humidity: 82, wind: 14 },
      { dayAr: "بعد غد", iconKey: "rainy",  tempHigh: 21, tempLow: 15, humidity: 88, wind: 18 },
    ],
  },
  deir: {
    nameAr: "دير الزور",
    forecast: [
      { dayAr: "اليوم",   iconKey: "hot", tempHigh: 38, tempLow: 24, humidity: 28, wind: 22 },
      { dayAr: "الغد",    iconKey: "hot", tempHigh: 40, tempLow: 25, humidity: 25, wind: 20 },
      { dayAr: "بعد غد", iconKey: "hot", tempHigh: 39, tempLow: 24, humidity: 26, wind: 18 },
    ],
  },
};

function WIcon({ k }: { k: WeatherIconKey }) {
  if (k === "sunny") return <Sun className="w-4 h-4 text-amber-400" />;
  if (k === "hot")   return <Thermometer className="w-4 h-4 text-red-400" />;
  if (k === "partly") return <CloudSun className="w-4 h-4 text-sky-400" />;
  if (k === "cloudy") return <Cloud className="w-4 h-4 text-slate-400" />;
  return <CloudRain className="w-4 h-4 text-sky-400" />;
}

export function WeatherInsightCard({ city = "damascus" }: { city?: string }) {
  const key  = CITY_FORECASTS[city] ? city : "damascus";
  const data = CITY_FORECASTS[key];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.4, ease: EASE }}
      className="mt-3 rounded-2xl border border-sky-500/25 bg-sky-500/5 overflow-hidden"
      dir="rtl"
    >
      {/* Card header */}
      <div className="flex items-center gap-2 px-4 pt-3.5 pb-2.5 border-b border-sky-500/15">
        <div className="w-6 h-6 rounded-lg bg-sky-500/15 border border-sky-500/25 flex items-center justify-center">
          <CloudSun className="w-3.5 h-3.5 text-sky-400" />
        </div>
        <p className="text-[11px] font-bold text-sky-400">توقعات الطقس الزراعية — {data.nameAr}</p>
        <span className="ms-auto text-[9px] text-muted-foreground/50 font-numeric">3 أيام</span>
      </div>

      {/* 3-day grid */}
      <div className="grid grid-cols-3 divide-x divide-x-reverse divide-sky-500/10 p-0">
        {data.forecast.map((day, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: i * 0.1 + 0.15 }}
            className={cn(
              "flex flex-col items-center px-3 py-3.5 text-center",
              i === 0 && "bg-sky-500/8",
            )}
          >
            <p className="text-[9px] font-semibold text-muted-foreground/55 mb-2">{day.dayAr}</p>
            <WIcon k={day.iconKey} />
            <p className="text-sm font-bold text-foreground font-numeric mt-2">
              {day.tempHigh}°
              <span className="text-[10px] text-muted-foreground/45 font-numeric">/{day.tempLow}°</span>
            </p>
            <div className="flex items-center gap-2.5 mt-1.5">
              <div className="flex items-center gap-0.5">
                <Droplets className="w-2.5 h-2.5 text-sky-400/60" />
                <span className="text-[9px] text-muted-foreground/50 font-numeric">{day.humidity}%</span>
              </div>
              <div className="flex items-center gap-0.5">
                <Wind className="w-2.5 h-2.5 text-slate-400/60" />
                <span className="text-[9px] text-muted-foreground/50 font-numeric">{day.wind}</span>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <p className="text-center text-[9px] text-muted-foreground/35 py-2 border-t border-sky-500/10">
        وكيل الطقس · بيانات لحظية · مئوية · رياح كم/س
      </p>
    </motion.div>
  );
}

// ══════════════════════════════════════════════════════════════════════
// MARKET FORECAST CARD
// ══════════════════════════════════════════════════════════════════════

type TrendDir = "up" | "down" | "stable";
type RecKey  = "sell" | "hold" | "buy";

interface CropMarketData {
  nameAr:        string;
  currentPrice:  number;
  changeWeekPct: number;
  trend:         TrendDir;
  prices:        number[];
  recommendation: RecKey;
  recommendationAr: string;
}

const CROP_MARKET: Record<string, CropMarketData> = {
  wheat: {
    nameAr: "قمح", currentPrice: 951, changeWeekPct: 7.2, trend: "up",
    prices: [887, 900, 918, 910, 932, 940, 951],
    recommendation: "sell", recommendationAr: "نافذة بيع مثالية",
  },
  cotton: {
    nameAr: "قطن", currentPrice: 3991, changeWeekPct: -3.2, trend: "down",
    prices: [4100, 4080, 4060, 4050, 4020, 4005, 3991],
    recommendation: "hold", recommendationAr: "احتفظ بالمحصول",
  },
  olive: {
    nameAr: "زيتون", currentPrice: 8500, changeWeekPct: -2.7, trend: "down",
    prices: [8800, 8750, 8700, 8650, 8620, 8560, 8500],
    recommendation: "hold", recommendationAr: "انتظر ارتفاع السعر",
  },
  corn: {
    nameAr: "ذرة", currentPrice: 950, changeWeekPct: 1.5, trend: "up",
    prices: [910, 918, 925, 928, 935, 942, 950],
    recommendation: "buy", recommendationAr: "فرصة شراء بذور",
  },
};

function MiniChart({ prices, trend, cropKey }: { prices: number[]; trend: TrendDir; cropKey: string }) {
  const min   = Math.min(...prices);
  const max   = Math.max(...prices);
  const range = (max - min) || 1;
  const W = 200, H = 44, padX = 4, padY = 5;

  const pts = prices.map((p, i) => {
    const x = padX + (i / (prices.length - 1)) * (W - padX * 2);
    const y = H - padY - ((p - min) / range) * (H - padY * 2);
    return [x, y] as [number, number];
  });

  const polylinePoints = pts.map(([x, y]) => `${x},${y}`).join(" ");
  const [lastX, lastY] = pts[pts.length - 1];
  const areaPath = `M ${pts[0][0]},${pts[0][1]} ${pts.map(([x, y]) => `L ${x},${y}`).join(" ")} L ${lastX},${H - padY} L ${pts[0][0]},${H - padY} Z`;
  const color = trend === "up" ? "#34d399" : trend === "down" ? "#f87171" : "#94a3b8";
  const gradId = `mcg-${cropKey}-${trend}`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-11" preserveAspectRatio="none">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={color} stopOpacity="0.20" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#${gradId})`} />
      <polyline
        points={polylinePoints}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={lastX} cy={lastY} r="2.5" fill={color} />
    </svg>
  );
}

const REC_CFG: Record<RecKey, { border: string; bg: string; text: string; icon: React.ElementType }> = {
  sell:  { border: "border-emerald-500/30", bg: "bg-emerald-500/10", text: "text-emerald-400", icon: TrendingUp  },
  hold:  { border: "border-amber-500/30",   bg: "bg-amber-500/10",   text: "text-amber-400",   icon: Clock       },
  buy:   { border: "border-sky-500/30",     bg: "bg-sky-500/10",     text: "text-sky-400",     icon: Sprout      },
};

export function MarketForecastCard({ crop = "wheat" }: { crop?: string }) {
  const key   = CROP_MARKET[crop] ? crop : "wheat";
  const data  = CROP_MARKET[key];
  const isUp  = data.trend === "up";
  const rec   = REC_CFG[data.recommendation];
  const RecIcon = rec.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.4, ease: EASE }}
      className="mt-3 rounded-2xl border border-amber-500/25 bg-amber-500/5 overflow-hidden"
      dir="rtl"
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-4 pt-3.5 pb-2.5 border-b border-amber-500/15">
        <div className="w-6 h-6 rounded-lg bg-amber-500/15 border border-amber-500/25 flex items-center justify-center">
          <TrendingUp className="w-3.5 h-3.5 text-amber-400" />
        </div>
        <p className="text-[11px] font-bold text-amber-400">توقعات السوق — {data.nameAr}</p>
      </div>

      <div className="px-4 py-3">
        {/* Price row */}
        <div className="flex items-baseline gap-2 mb-3">
          <span className="text-2xl font-bold text-foreground font-numeric">
            {data.currentPrice.toLocaleString()}
          </span>
          <span className="text-[11px] text-muted-foreground/60">ل.س/كغ</span>
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className={cn(
              "ms-auto flex items-center gap-0.5",
              isUp ? "text-emerald-400" : "text-red-400",
            )}
          >
            {isUp
              ? <TrendingUp className="w-3.5 h-3.5" />
              : <TrendingDown className="w-3.5 h-3.5" />}
            <span className="text-[12px] font-bold font-numeric">
              {isUp ? "+" : ""}{data.changeWeekPct}%
            </span>
          </motion.div>
        </div>

        {/* Mini chart */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.25 }}
          className="bg-white/[0.03] border border-white/[0.05] rounded-xl px-2 pt-2 pb-1 mb-3"
        >
          <MiniChart prices={data.prices} trend={data.trend} cropKey={key} />
          <p className="text-[9px] text-muted-foreground/35 text-center mt-0.5">آخر 7 أسابيع</p>
        </motion.div>

        {/* Recommendation */}
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className={cn("flex items-center gap-2 rounded-xl px-3 py-2.5 border", rec.border, rec.bg)}
        >
          <RecIcon className={cn("w-3.5 h-3.5 flex-shrink-0", rec.text)} />
          <span className={cn("text-[11px] font-bold", rec.text)}>{data.recommendationAr}</span>
          <span className="text-[9px] text-muted-foreground/45 ms-auto">وكيل السوق</span>
        </motion.div>
      </div>
    </motion.div>
  );
}

// ══════════════════════════════════════════════════════════════════════
// IRRIGATION PLAN CARD
// ══════════════════════════════════════════════════════════════════════

type SoilColor = "emerald" | "amber" | "red" | "slate";

interface IrrigationSlot {
  timeAr:      string;
  volume:      number | null;
  statusAr:    string;
  statusColor: SoilColor;
}

interface IrrigationPlan {
  crop: string;
  area: number;
  totalDailyM3: number;
  slots: IrrigationSlot[];
}

const IRRIGATION_PLANS: Record<string, IrrigationPlan> = {
  wheat: {
    crop: "قمح", area: 45, totalDailyM3: 225,
    slots: [
      { timeAr: "06:00 صباحاً", volume: 135,  statusAr: "مثالي للري",          statusColor: "emerald" },
      { timeAr: "12:00 ظهراً",  volume: null,  statusAr: "توقف — حرارة عالية", statusColor: "red"     },
      { timeAr: "18:00 مساءً",  volume: 90,   statusAr: "موصى به",             statusColor: "emerald" },
    ],
  },
  cotton: {
    crop: "قطن", area: 30, totalDailyM3: 310,
    slots: [
      { timeAr: "05:30 صباحاً", volume: 190,  statusAr: "حيوي للنمو",          statusColor: "emerald" },
      { timeAr: "12:00 ظهراً",  volume: null,  statusAr: "توقف إجباري",        statusColor: "red"     },
      { timeAr: "19:00 مساءً",  volume: 120,  statusAr: "تبريد — مُوصى به",   statusColor: "amber"   },
    ],
  },
  olive: {
    crop: "زيتون", area: 20, totalDailyM3: 70,
    slots: [
      { timeAr: "06:30 صباحاً", volume: 70,   statusAr: "كافٍ للبستان",        statusColor: "emerald" },
      { timeAr: "12:00 ظهراً",  volume: null,  statusAr: "لا ضرورة",           statusColor: "slate"   },
      { timeAr: "18:30 مساءً",  volume: null,  statusAr: "لا ضرورة",           statusColor: "slate"   },
    ],
  },
};

const SOIL_DOT: Record<SoilColor, string> = {
  emerald: "bg-emerald-400",
  amber:   "bg-amber-400",
  red:     "bg-red-400",
  slate:   "bg-slate-500",
};

export function IrrigationPlanCard({ crop = "wheat" }: { crop?: string }) {
  const key  = IRRIGATION_PLANS[crop] ? crop : "wheat";
  const plan = IRRIGATION_PLANS[key];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.4, ease: EASE }}
      className="mt-3 rounded-2xl border border-emerald-500/25 bg-emerald-500/5 overflow-hidden"
      dir="rtl"
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-4 pt-3.5 pb-2.5 border-b border-emerald-500/15">
        <div className="w-6 h-6 rounded-lg bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center">
          <Droplets className="w-3.5 h-3.5 text-emerald-400" />
        </div>
        <p className="text-[11px] font-bold text-emerald-400">خطة الري اليومية — {plan.crop}</p>
        <div className="ms-auto flex items-center gap-2">
          <span className="text-[9px] font-numeric text-muted-foreground/50">{plan.area} دونم</span>
          <span className="text-[9px] font-numeric font-bold text-emerald-400">{plan.totalDailyM3} م³/يوم</span>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden">
        <div className="grid grid-cols-3 bg-white/[0.04] px-4 py-2">
          <span className="text-[9px] font-bold text-muted-foreground/55">الوقت</span>
          <span className="text-[9px] font-bold text-muted-foreground/55 text-center">الكمية (م³)</span>
          <span className="text-[9px] font-bold text-muted-foreground/55 text-end">حالة التربة</span>
        </div>
        {plan.slots.map((slot, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.1 + 0.2 }}
            className={cn(
              "grid grid-cols-3 px-4 py-2.5 items-center",
              i < plan.slots.length - 1 && "border-b border-white/[0.04]",
            )}
          >
            <span className="text-[10px] font-numeric text-foreground/75">{slot.timeAr}</span>
            <span className={cn(
              "text-[11px] font-bold font-numeric text-center",
              slot.volume !== null ? "text-foreground/90" : "text-muted-foreground/35",
            )}>
              {slot.volume !== null ? slot.volume : "—"}
            </span>
            <div className="flex items-center gap-1.5 justify-end">
              <span className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", SOIL_DOT[slot.statusColor])} />
              <span className="text-[9px] text-muted-foreground/60 truncate">{slot.statusAr}</span>
            </div>
          </motion.div>
        ))}
      </div>

      <p className="text-center text-[9px] text-muted-foreground/35 py-2 border-t border-emerald-500/10">
        وكيل التربة · تحسين آلي وفق مستشعرات الحقل
      </p>
    </motion.div>
  );
}

// ══════════════════════════════════════════════════════════════════════
// NATIONAL TREND CARD
// ══════════════════════════════════════════════════════════════════════

interface TrendEntry {
  cropAr: string;
  pct: number;
  yoyChange: number;
  barColor: string;
}

interface RegionTrendData {
  provinceAr: string;
  trends: TrendEntry[];
}

const REGION_TRENDS: Record<string, RegionTrendData> = {
  aleppo: {
    provinceAr: "حلب",
    trends: [
      { cropAr: "قمح",   pct: 42, yoyChange: +3,  barColor: "bg-amber-400"  },
      { cropAr: "قطن",   pct: 28, yoyChange: -2,  barColor: "bg-sky-400"    },
      { cropAr: "شعير",  pct: 18, yoyChange: +1,  barColor: "bg-slate-400"  },
      { cropAr: "ذرة",   pct: 12, yoyChange: +5,  barColor: "bg-violet-400" },
    ],
  },
  homs: {
    provinceAr: "حمص",
    trends: [
      { cropAr: "قطن",   pct: 38, yoyChange: -5,  barColor: "bg-sky-400"    },
      { cropAr: "قمح",   pct: 32, yoyChange: +2,  barColor: "bg-amber-400"  },
      { cropAr: "زيتون", pct: 20, yoyChange: +4,  barColor: "bg-lime-400"   },
      { cropAr: "خضار",  pct: 10, yoyChange: +8,  barColor: "bg-teal-400"   },
    ],
  },
  damascus: {
    provinceAr: "دمشق",
    trends: [
      { cropAr: "خضار",  pct: 45, yoyChange: +6,  barColor: "bg-teal-400"   },
      { cropAr: "قمح",   pct: 25, yoyChange: -1,  barColor: "bg-amber-400"  },
      { cropAr: "زيتون", pct: 18, yoyChange: +2,  barColor: "bg-lime-400"   },
      { cropAr: "عنب",   pct: 12, yoyChange: +3,  barColor: "bg-violet-400" },
    ],
  },
  hasaka: {
    provinceAr: "الحسكة",
    trends: [
      { cropAr: "قمح",   pct: 55, yoyChange: +8,  barColor: "bg-amber-400"  },
      { cropAr: "قطن",   pct: 25, yoyChange: -3,  barColor: "bg-sky-400"    },
      { cropAr: "شعير",  pct: 15, yoyChange: +1,  barColor: "bg-slate-400"  },
      { cropAr: "ذرة",   pct: 5,  yoyChange: +2,  barColor: "bg-violet-400" },
    ],
  },
  default: {
    provinceAr: "سوريا",
    trends: [
      { cropAr: "قمح",   pct: 40, yoyChange: +4,  barColor: "bg-amber-400"  },
      { cropAr: "قطن",   pct: 25, yoyChange: -3,  barColor: "bg-sky-400"    },
      { cropAr: "زيتون", pct: 20, yoyChange: +2,  barColor: "bg-lime-400"   },
      { cropAr: "شعير",  pct: 15, yoyChange: +1,  barColor: "bg-slate-400"  },
    ],
  },
};

export function NationalTrendCard({ province = "default" }: { province?: string }) {
  const key  = REGION_TRENDS[province] ? province : "default";
  const data = REGION_TRENDS[key];
  const maxPct = Math.max(...data.trends.map((t) => t.pct));

  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.4, ease: EASE }}
      className="mt-3 rounded-2xl border border-violet-500/25 bg-violet-500/5 overflow-hidden"
      dir="rtl"
    >
      <div className="flex items-center gap-2 px-4 pt-3.5 pb-2.5 border-b border-violet-500/15">
        <div className="w-6 h-6 rounded-lg bg-violet-500/15 border border-violet-500/25 flex items-center justify-center">
          <TrendingUp className="w-3.5 h-3.5 text-violet-400" />
        </div>
        <p className="text-[11px] font-bold text-violet-400">
          توجهات الزراعة الإقليمية — {data.provinceAr}
        </p>
        <span className="ms-auto text-[9px] text-muted-foreground/50 font-numeric">ربيع 2026</span>
      </div>

      <div className="px-4 pt-2.5 pb-3">
        <p className="text-[10px] text-muted-foreground/60 mb-3 leading-relaxed">
          ما يزرعه مزارعو المنطقة هذا الموسم — تجنّب تشبّع العرض في السوق
        </p>
        <div className="space-y-2.5">
          {data.trends.map((t, i) => (
            <motion.div
              key={t.cropAr}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.08 + 0.15, duration: 0.3, ease: EASE }}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-semibold text-foreground/80">{t.cropAr}</span>
                <div className="flex items-center gap-2">
                  <span className={cn(
                    "text-[9px] font-numeric font-bold",
                    t.yoyChange > 0 ? "text-emerald-400" : "text-red-400",
                  )}>
                    {t.yoyChange > 0 ? "+" : ""}{t.yoyChange}%
                  </span>
                  <span className="text-[11px] font-bold font-numeric text-foreground/90 w-8 text-end">
                    {t.pct}%
                  </span>
                </div>
              </div>
              <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${(t.pct / maxPct) * 100}%` }}
                  transition={{ duration: 0.7, delay: i * 0.08 + 0.2, ease: [0.22, 1, 0.36, 1] }}
                  className={cn("h-full rounded-full", t.barColor)}
                />
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      <p className="text-center text-[9px] text-muted-foreground/35 py-2 border-t border-violet-500/10">
        وكيل السوق · تحليل أنماط الزراعة الإقليمية · موسم ربيع 2026
      </p>
    </motion.div>
  );
}

// ══════════════════════════════════════════════════════════════════════
// MINI SYRIA MAP — exact province paths from SyriaMap.tsx
// ══════════════════════════════════════════════════════════════════════

const HEAT_OVERLAY: Record<string, number> = {
  "الحسكة": 0.9, "دير الزور": 0.85, "الرقة": 0.8,
  "حمص": 0.6,   "حماة": 0.5,       "دمشق": 0.45,
};

const HUMIDITY_OVERLAY: Record<string, number> = {
  "اللاذقية": 0.9, "طرطوس": 0.85, "إدلب": 0.6, "حلب": 0.45,
};

export function MiniSyriaMap({
  highlightedProvince,
  diseaseProvince,
  climateLayer,
  onProvinceClick,
}: {
  highlightedProvince?: string | null;
  diseaseProvince?: string | null;
  climateLayer?: "heat" | "humidity" | null;
  onProvinceClick?: (name: string) => void;
}) {
  const [hoveredProvince, setHoveredProvince] = useState<string | null>(null);

  return (
    <svg viewBox={VIEW_BOX} className="w-full" style={{ maxHeight: 140 }}>
      {PROVINCES.map((p) => {
        const isHighlight = p.name === highlightedProvince;
        const isDisease   = p.name === diseaseProvince;
        const isHovered   = p.name === hoveredProvince;

        const fill   = isDisease   ? "rgba(248,113,113,0.50)"
                     : isHighlight ? "rgba(52,211,153,0.50)"
                     : isHovered   ? "rgba(52,211,153,0.22)"
                     : "oklch(0.14 0.018 152 / 70%)";
        const stroke = isDisease   ? "rgba(248,113,113,0.75)"
                     : isHighlight ? "rgba(52,211,153,0.75)"
                     : isHovered   ? "rgba(52,211,153,0.55)"
                     : "oklch(0.696 0.170 162 / 22%)";
        const sw = (isHighlight || isDisease || isHovered) ? "0.06" : "0.04";

        const heatI     = climateLayer === "heat"     ? (HEAT_OVERLAY[p.name]     ?? 0) : 0;
        const humidityI = climateLayer === "humidity" ? (HUMIDITY_OVERLAY[p.name] ?? 0) : 0;
        const climateFill = heatI     > 0 ? `rgba(239,68,68,${heatI * 0.28})`
                          : humidityI > 0 ? `rgba(56,189,248,${humidityI * 0.28})`
                          : null;

        return (
          <g
            key={p.name}
            style={{ cursor: onProvinceClick ? "pointer" : "default" }}
            onClick={() => onProvinceClick?.(p.name)}
            onMouseEnter={() => setHoveredProvince(p.name)}
            onMouseLeave={() => setHoveredProvince(null)}
          >
            <path d={p.path} fill={fill} stroke={stroke} strokeWidth={sw} strokeLinejoin="round" />
            {climateFill && <path d={p.path} fill={climateFill} stroke="none" />}

            {/* Hover label — shown when not already highlighted/disease */}
            {isHovered && !isHighlight && !isDisease && (
              <text
                x={p.cx}
                y={p.cy - 0.14}
                textAnchor="middle"
                fontSize="0.20"
                fontWeight="600"
                fill="rgba(52,211,153,0.80)"
              >
                {p.name}
              </text>
            )}

            {/* Active province pulse + label */}
            {(isHighlight || isDisease) && (
              <>
                <motion.circle
                  cx={p.cx} cy={p.cy} r={0.12}
                  fill="none"
                  stroke={isDisease ? "rgba(248,113,113,0.45)" : "rgba(52,211,153,0.40)"}
                  strokeWidth="0.04"
                  animate={{ r: [0.12, 0.32, 0.12], opacity: [0.8, 0, 0.8] }}
                  transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                />
                <text
                  x={p.cx}
                  y={p.cy - 0.18}
                  textAnchor="middle"
                  fontSize="0.22"
                  fontWeight="700"
                  fill={isDisease ? "rgba(248,113,113,0.95)" : "rgba(52,211,153,0.95)"}
                >
                  {p.name}
                </text>
              </>
            )}
          </g>
        );
      })}
    </svg>
  );
}
