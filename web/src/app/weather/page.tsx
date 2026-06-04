"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Wind, Droplets, Sun, Thermometer, Eye, Zap,
  MapPin, ChevronDown, AlertTriangle, Leaf,
  Activity, CloudSun, Cloud, CloudRain, SunMedium, Wheat,
  Layers, Flame, Navigation, Calendar, Shield,
  Sprout, AlertOctagon, ArrowLeft,
  Bug, Microscope, Gauge, Timer, GlassWater, FlaskConical,
  CheckCircle2, TrendingDown, TrendingUp,
  Share2, Check, Send, Bot, RefreshCw,
  CircleCheck, CircleMinus, CircleX, BarChart3,
} from "lucide-react";
import { WorkspaceLayout } from "@/components/workspace/WorkspaceLayout";
import { PROVINCES as GEO_PROVINCES, VIEW_BOX } from "@/components/workspace/SyriaMap";
import {
  PROVINCES, PROVINCE_FORECASTS,
  getAmbientGradient, getAQILabel, getUVLabel,
  tempToHeatColor, WIND_DIRECTION_ANGLE,
  type ProvinceWeather, type AmbientState, type DayForecast, type RiskType,
} from "@/lib/weather";
import { cn } from "@/lib/utils";

// Accurate governorate geometry (polygon + centroid), keyed by Arabic name —
// the same reliable alignment mechanism used by the main dashboard map.
const GEO_BY_NAME = new Map(GEO_PROVINCES.map(g => [g.name, g]));

type Bezier   = [number, number, number, number];
type MapLayer = "none" | "heat" | "wind" | "rain";

const EASE: Bezier = [0.22, 1, 0.36, 1];
const fadeUp = {
  hidden:  { opacity: 0, y: 18 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { duration: 0.45, ease: EASE, delay: i * 0.08 },
  }),
};

const RISK_ICON: Record<RiskType, React.ElementType> = {
  none: Activity, heatwave: Flame, sandstorm: Wind,
  "strong-wind": Navigation, rain: CloudRain,
};
const RISK_COLOR: Record<RiskType, string> = {
  none: "text-emerald-400", heatwave: "text-red-400", sandstorm: "text-orange-400",
  "strong-wind": "text-amber-400", rain: "text-sky-400",
};

/* ─── ET₀ calculation (simplified FAO-56 Penman-Monteith) ───────────── */
function calcET0(temp: number, humidity: number, windKmh: number, solarWm2: number): number {
  const Rs  = solarWm2 * 0.0864 * (10 / 24);
  const Rn  = (1 - 0.23) * Rs * 0.55;
  const u2  = windKmh / 3.6;
  const es  = 0.6108 * Math.exp(17.27 * temp / (temp + 237.3));
  const ea  = (humidity / 100) * es;
  const vpd = Math.max(0, es - ea);
  const d   = 4098 * es / Math.pow(temp + 237.3, 2);
  const g   = 0.0665;
  const Tk  = temp + 273;
  const num = 0.408 * d * Rn + g * (900 / Tk) * u2 * vpd;
  const den = d + g * (1 + 0.34 * u2);
  return Math.max(1.0, Math.round((num / den) * 10) / 10);
}

/* ─── Disease detection ─────────────────────────────────────────────── */
interface DiseaseRisk {
  nameAr: string; nameEn: string; probability: number;
  crop: string; conditions: string; treatment: string;
  severity: "high" | "medium" | "low";
}
function detectDiseases(temp: number, humidity: number, windSpeed: number, aqi: number): DiseaseRisk[] {
  const risks: DiseaseRisk[] = [];
  // Downy Mildew — humid + mild
  if (humidity > 58 && temp >= 14 && temp <= 29) {
    const p = Math.min(94, Math.round(((humidity - 58) / 22) * 75 + 20));
    risks.push({ nameAr: "البياض الزغبي", nameEn: "Downy Mildew",
      probability: p, crop: "عنب، بطاطا، خيار",
      conditions: `رطوبة ${humidity}% مع ${temp}°م`,
      treatment: "رش مانكوزيب 2غ/ل — كل 7 أيام فجراً",
      severity: p > 65 ? "high" : "medium" });
  }
  // Spider Mites — hot + dry or dusty
  if ((temp > 27 && humidity < 42) || aqi > 100) {
    const p = Math.min(91, Math.round(
      Math.max(0, (temp - 27) / 13 * 45)
      + Math.max(0, (42 - humidity) / 42 * 28)
      + (aqi > 100 ? 22 : 0)
    ));
    risks.push({ nameAr: "العنكبوت الأحمر", nameEn: "Spider Mites",
      probability: Math.max(18, p), crop: "قطن، عنب، خيار",
      conditions: `${temp}°م / رطوبة ${humidity}%${aqi > 100 ? " / غبار" : ""}`,
      treatment: "أبامكتين 0.5مل/ل أو كبريت قابل 3غ/ل",
      severity: p > 55 ? "high" : "medium" });
  }
  // Powdery Mildew — hot days, moderate humidity
  if (temp > 21 && temp < 34 && humidity >= 38 && humidity <= 72) {
    const p = Math.round(((humidity - 38) / 34) * 52 + 18);
    risks.push({ nameAr: "البياض الحقيقي", nameEn: "Powdery Mildew",
      probability: Math.min(88, p), crop: "قمح، شعير، زيتون",
      conditions: `${temp}°م نهاراً مع رطوبة ${humidity}%`,
      treatment: "كبريت رطب 3غ/ل أو تريفلوكسيستروبين صباحاً",
      severity: p > 52 ? "medium" : "low" });
  }
  return risks.sort((a, b) => b.probability - a.probability).slice(0, 3);
}

/* ─── Crop thermal stress ───────────────────────────────────────────── */
const CROP_META: Record<string, {
  nameAr: string; optMin: number; optMax: number;
  stressMax: number; critMax: number;
  stressAdvice: string; goodAdvice: string;
}> = {
  wheat:     { nameAr:"قمح",      optMin:15, optMax:25, stressMax:30, critMax:35, stressAdvice:"الحرارة تسرع النضج — راقب رطوبة السنابل وعجّل الحصاد",          goodAdvice:"درجات الحرارة مثالية لاكتمال نضج القمح" },
  barley:    { nameAr:"شعير",     optMin:12, optMax:22, stressMax:28, critMax:33, stressAdvice:"الإجهاد الحراري يقلل وزن الحبة — عجّل الحصاد فوراً",           goodAdvice:"ظروف مثالية لنضج الشعير وتشكّل الحبة" },
  cotton:    { nameAr:"قطن",      optMin:25, optMax:35, stressMax:39, critMax:43, stressAdvice:"فوق 39°م يتأثر إنبات حبوب اللقاح — ظلّل الصواني",              goodAdvice:"حرارة مثالية لنمو القطن وتشكّل الجوزات" },
  lentils:   { nameAr:"عدس",      optMin:18, optMax:26, stressMax:30, critMax:35, stressAdvice:"الإجهاد الحراري يؤثر على مكونات الحبة — اروِ فوراً",          goodAdvice:"ظروف جيدة لاكتمال نضج العدس" },
  tomato:    { nameAr:"طماطم",    optMin:21, optMax:29, stressMax:33, critMax:38, stressAdvice:"فوق 29°م يتعطل إخصاب الزهرة — ظلّل المحمية وزد الري",         goodAdvice:"درجات مثالية لتلوين الثمرة وزيادة المحصول" },
  potato:    { nameAr:"بطاطا",    optMin:15, optMax:21, stressMax:26, critMax:31, stressAdvice:"الحرارة تضر بتشكّل الدرنات — ري ليلي مكثف ضروري",             goodAdvice:"ظروف مناسبة لنمو الدرنات تحت الأرض" },
  olive:     { nameAr:"زيتون",    optMin:20, optMax:35, stressMax:40, critMax:46, stressAdvice:"راقب ذبابة الزيتون وزد الري — الزيت يتركز بالحرارة",          goodAdvice:"الزيتون يتحمل هذه الحرارة — موسم تكوّن الثمرة" },
  grapes:    { nameAr:"كرمة",     optMin:25, optMax:32, stressMax:37, critMax:42, stressAdvice:"الحرارة تسرع التسكر — راقب درجة بريكس وجنّب مبكراً",         goodAdvice:"حرارة مناسبة لتلوين العنب وتركيز السكر" },
  chickpeas: { nameAr:"حمص",      optMin:18, optMax:27, stressMax:32, critMax:37, stressAdvice:"الإجهاد في طور الإزهار يخفض التعقيد — ري حذر وصباحي",        goodAdvice:"ظروف جيدة لإزهار الحمص وتكوّن القرون" },
  cucumber:  { nameAr:"خيار",     optMin:22, optMax:30, stressMax:34, critMax:39, stressAdvice:"فوق 30°م يتأثر لون الثمار ويقصر العمر — ظلّل وزد الري",       goodAdvice:"حرارة مناسبة لنمو الخيار وإنتاج الثمار" },
  eggplant:  { nameAr:"باذنجان",  optMin:22, optMax:32, stressMax:36, critMax:41, stressAdvice:"راقب التحور الزهري — ري منتظم يعوّض الإجهاد الحراري",         goodAdvice:"الباذنجان يحب هذا الجو — فترة إنتاج ممتازة" },
  onion:     { nameAr:"بصل",      optMin:13, optMax:24, stressMax:28, critMax:33, stressAdvice:"الحرارة تسرع تشكّل البصلة — وقّت الحصاد بعناية",             goodAdvice:"حرارة مقبولة لنضج البصل وتجفيف الأوراق" },
};

function calcThermalStress(crop: string, temp: number): number {
  const m = CROP_META[crop];
  if (!m) return Math.round(Math.max(0, Math.min(100, (temp - 20) / 20 * 60)));
  if (temp <= m.optMax)    return 0;
  if (temp <= m.stressMax) return Math.round(((temp - m.optMax) / (m.stressMax - m.optMax)) * 55);
  if (temp <= m.critMax)   return Math.round(55 + ((temp - m.stressMax) / (m.critMax - m.stressMax)) * 35);
  return Math.min(100, Math.round(90 + (temp - m.critMax) * 2));
}

/* ─── Reusable Agent Insight badge ─────────────────────────────────── */
function AgentInsight({ agent, text }: { agent: string; text: string }) {
  return (
    <div className="flex items-start gap-2 rounded-xl bg-emerald-500/6 border border-emerald-500/14 px-3 py-2.5 mt-3">
      <div className="flex items-center gap-1 flex-shrink-0 mt-0.5">
        <motion.div className="w-1.5 h-1.5 rounded-full bg-emerald-400"
          animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1.2, repeat: Infinity }} />
        <span className="text-[9px] text-emerald-400 font-bold tracking-wide">{agent}</span>
      </div>
      <p className="text-[11px] text-foreground/75 font-arabic leading-relaxed">{text}</p>
    </div>
  );
}

/* ─── Ambient background ─────────────────────────────────────────────── */
function AmbientBackground({ state }: { state: AmbientState }) {
  const orb1: Record<AmbientState, string> = {
    sunny:"oklch(0.70 0.14 70 / 12%)", dusty:"oklch(0.62 0.12 48 / 14%)",
    cloudy:"oklch(0.28 0.05 220 / 14%)", rainy:"oklch(0.30 0.08 240 / 16%)", "clear-night":"oklch(0.18 0.05 270 / 12%)",
  };
  const orb2: Record<AmbientState, string> = {
    sunny:"oklch(0.55 0.17 162 / 10%)", dusty:"oklch(0.50 0.10 38 / 12%)",
    cloudy:"oklch(0.22 0.04 200 / 12%)", rainy:"oklch(0.25 0.06 210 / 14%)", "clear-night":"oklch(0.14 0.04 250 / 10%)",
  };
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 0 }}>
      <motion.div key={state} className="absolute inset-0"
        style={{ background: getAmbientGradient(state) }}
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1.4, ease: EASE }} />
      <motion.div className="absolute -top-32 -right-32 w-[600px] h-[600px] rounded-full blur-3xl"
        style={{ background: orb1[state] }}
        animate={{ scale: [1,1.08,1], opacity:[0.7,1,0.7] }} transition={{ duration: 6, repeat: Infinity, ease:"easeInOut" }} />
      <motion.div className="absolute -bottom-32 -left-24 w-[480px] h-[480px] rounded-full blur-3xl"
        style={{ background: orb2[state] }}
        animate={{ scale:[1,1.06,1], opacity:[0.5,0.8,0.5] }} transition={{ duration: 8, repeat: Infinity, ease:"easeInOut", delay:1.5 }} />
      {state === "dusty" && (
        <motion.div className="absolute inset-0"
          style={{ background:"linear-gradient(180deg, oklch(0.50 0.09 50 / 6%) 0%, transparent 40%)" }}
          animate={{ opacity:[0.6,1,0.6] }} transition={{ duration: 4, repeat: Infinity, ease:"easeInOut" }} />
      )}
    </div>
  );
}

/* ─── Province selector ──────────────────────────────────────────────── */
function ProvinceSelector({ current, onSelect }: { current: ProvinceWeather; onSelect:(id:string)=>void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative" dir="rtl">
      <button onClick={() => setOpen(v=>!v)}
        className="flex items-center gap-2 glass-card rounded-xl px-3 py-2 text-sm font-semibold hover:bg-white/[0.06] transition-colors">
        <MapPin className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
        <span>{current.nameAr}</span>
        {current.isExtreme && <span className="w-2 h-2 rounded-full bg-red-400 flex-shrink-0" />}
        <ChevronDown className={cn("w-3.5 h-3.5 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity:0,y:-6,scale:0.97 }} animate={{ opacity:1,y:0,scale:1 }} exit={{ opacity:0,y:-6,scale:0.97 }}
            transition={{ duration:0.18, ease:EASE }}
            className="absolute top-full mt-1 right-0 z-50 glass-card rounded-xl border border-white/[0.08] shadow-2xl min-w-[180px] py-1.5 max-h-72 overflow-y-auto">
            {PROVINCES.map(p => (
              <button key={p.id} onClick={() => { onSelect(p.id); setOpen(false); }}
                className={cn("w-full flex items-center justify-between gap-2 px-4 py-2 text-sm hover:bg-white/[0.05] transition-colors text-right", p.id===current.id && "text-emerald-400")}>
                <span className="font-medium">{p.nameAr}</span>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <span className="text-xs text-muted-foreground font-numeric">{p.temp}°</span>
                  {p.isExtreme && <span className="w-1.5 h-1.5 rounded-full bg-red-400" />}
                </div>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─── Hero ───────────────────────────────────────────────────────────── */
function HeroPulse({ province, overrideDay, onClearDay }: { province:ProvinceWeather; overrideDay:DayForecast|null; onClearDay:()=>void }) {
  const isLive = overrideDay === null;
  const amb    = overrideDay?.ambientState ?? province.ambientState;
  const temp   = overrideDay?.tempHigh    ?? province.temp;
  const cond   = overrideDay?.condition   ?? province.condition;
  const feels  = overrideDay ? overrideDay.tempLow : province.feelsLike;
  const summary = overrideDay ? (overrideDay.riskAdvice || overrideDay.agroTag) : province.aiSummary;
  const condIcon: Record<AmbientState, React.ElementType> = { sunny:Sun, dusty:SunMedium, cloudy:Cloud, rainy:CloudRain, "clear-night":CloudSun };
  const condColor: Record<AmbientState, string> = { sunny:"text-amber-400", dusty:"text-orange-400", cloudy:"text-slate-300", rainy:"text-sky-400", "clear-night":"text-indigo-300" };
  const CondIcon = condIcon[amb];
  return (
    <motion.div className="glass-card rounded-3xl p-6 md:p-8 relative overflow-hidden"
      initial={{ opacity:0,y:20 }} animate={{ opacity:1,y:0 }} transition={{ duration:0.5,ease:EASE }} dir="rtl">
      <div className="absolute inset-0 rounded-3xl pointer-events-none" style={{ background: amb==="dusty"
        ? "radial-gradient(ellipse 80% 60% at 80% 20%, oklch(0.55 0.10 55 / 8%) 0%, transparent 60%)"
        : "radial-gradient(ellipse 80% 60% at 80% 20%, oklch(0.696 0.170 162 / 6%) 0%, transparent 60%)" }} />
      <div className="flex items-center justify-between mb-5 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <motion.div className={cn("w-2 h-2 rounded-full", isLive ? "bg-emerald-400" : "bg-amber-400")}
            animate={{ opacity:[1,0.3,1] }} transition={{ duration:1.4, repeat:Infinity }} />
          <span className={cn("text-[11px] font-bold uppercase tracking-widest", isLive ? "text-emerald-400" : "text-amber-400")}>
            {isLive ? "النبض الجوي الحي" : `${overrideDay!.dayAr} — ${overrideDay!.dateStr}`}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {!isLive && (
            <button onClick={onClearDay} className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="w-3 h-3" />عودة للحي
            </button>
          )}
          <span className="text-xs text-muted-foreground font-arabic">{province.nameAr}، {province.region}</span>
        </div>
      </div>
      <div className="flex items-end gap-6 mb-5">
        <motion.div animate={{ rotate:[0,3,-3,0] }} transition={{ duration:8, repeat:Infinity, ease:"easeInOut" }}>
          <CondIcon className={cn("w-16 h-16 md:w-20 md:h-20", condColor[amb])} />
        </motion.div>
        <div>
          <div className="flex items-start gap-1">
            <span className="text-6xl md:text-7xl font-black font-numeric leading-none text-foreground">{temp}</span>
            <span className="text-2xl font-bold text-muted-foreground mt-2">°م</span>
          </div>
          <p className="text-base font-semibold text-foreground/80 mt-1 font-arabic">{cond}</p>
          <p className="text-sm text-muted-foreground font-arabic">{isLive ? "تشعر كـ" : "أدنى"} <span className="font-numeric text-foreground/70">{feels}</span>°م</p>
        </div>
      </div>
      <div className="flex items-start gap-2.5 rounded-2xl bg-white/[0.04] border border-white/[0.06] px-4 py-3">
        <div className="w-6 h-6 rounded-lg bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center flex-shrink-0 mt-0.5">
          <Activity className="w-3.5 h-3.5 text-emerald-400" />
        </div>
        <div>
          <span className="text-[10px] text-emerald-500/70 font-bold block mb-0.5">وكيل المناخ</span>
          <p className="text-sm font-semibold text-foreground/90 leading-relaxed font-arabic">{summary}</p>
        </div>
      </div>
      {province.isExtreme && isLive && (
        <motion.div className="mt-3 flex items-center gap-2 rounded-xl bg-red-500/10 border border-red-500/25 px-3 py-2"
          initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:0.3 }}>
          <AlertTriangle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
          <span className="text-xs text-red-400 font-bold">حالة طقس متطرفة — إنذار نشط</span>
        </motion.div>
      )}
      {!isLive && overrideDay!.riskType !== "none" && (
        <motion.div className={cn("mt-3 flex items-center gap-2 rounded-xl px-3 py-2 border",
          ["heatwave","sandstorm"].includes(overrideDay!.riskType) ? "bg-red-500/10 border-red-500/25" : "bg-amber-500/10 border-amber-500/25")}
          initial={{ opacity:0 }} animate={{ opacity:1 }}>
          <AlertTriangle className={cn("w-3.5 h-3.5 flex-shrink-0", ["heatwave","sandstorm"].includes(overrideDay!.riskType) ? "text-red-400" : "text-amber-400")} />
          <span className={cn("text-xs font-bold", ["heatwave","sandstorm"].includes(overrideDay!.riskType) ? "text-red-400" : "text-amber-400")}>
            {overrideDay!.agroTag}
          </span>
        </motion.div>
      )}
    </motion.div>
  );
}

/* ─── Modern minimal climate glyphs (crisp vector, theme-aware colors) ── */
function CloudShape({ fill }: { fill: string }) {
  return (
    <g fill={fill}>
      <circle cx={-0.34} cy={0.06} r={0.30} />
      <circle cx={0.08}  cy={-0.14} r={0.40} />
      <circle cx={0.42}  cy={0.08} r={0.28} />
      <rect x={-0.6} y={0.02} width={1.05} height={0.30} rx={0.15} />
    </g>
  );
}

function ClimateGlyph({ state, cx, cy, scale }: { state: AmbientState; cx: number; cy: number; scale: number }) {
  const t = `translate(${cx} ${cy}) scale(${scale})`;
  switch (state) {
    case "sunny":
      return (
        <g transform={t}>
          {Array.from({ length: 8 }).map((_, i) => {
            const a = (i * Math.PI) / 4;
            return (
              <line key={i}
                x1={Math.cos(a) * 0.64} y1={Math.sin(a) * 0.64}
                x2={Math.cos(a) * 0.94} y2={Math.sin(a) * 0.94}
                stroke="#fbbf24" strokeWidth={0.12} strokeLinecap="round" />
            );
          })}
          <circle r={0.44} fill="#f59e0b" />
          <circle r={0.44} fill="#fde68a" opacity={0.35} />
        </g>
      );
    case "clear-night":
      return (
        <g transform={t}>
          <path d="M0.2 -0.6 A0.62 0.62 0 1 0 0.2 0.6 A0.48 0.48 0 1 1 0.2 -0.6 Z" fill="#a5b4fc" />
        </g>
      );
    case "cloudy":
      return <g transform={t}><CloudShape fill="#cbd5e1" /></g>;
    case "rainy":
      return (
        <g transform={t}>
          <CloudShape fill="#94a3b8" />
          {[-0.28, 0, 0.28].map((x, i) => (
            <line key={i} x1={x} y1={0.42} x2={x - 0.07} y2={0.74}
              stroke="#38bdf8" strokeWidth={0.1} strokeLinecap="round" />
          ))}
        </g>
      );
    case "dusty":
      return (
        <g transform={t}>
          <circle cx={0} cy={-0.28} r={0.32} fill="#fb923c" opacity={0.9} />
          {[0.18, 0.46, 0.74].map((y, i) => (
            <line key={i} x1={-0.58 + (i % 2) * 0.14} y1={y - 0.3} x2={0.58 - (i % 2) * 0.14} y2={y - 0.3}
              stroke="#f59e0b" strokeWidth={0.1} strokeLinecap="round" opacity={0.85} />
          ))}
        </g>
      );
    default:
      return null;
  }
}

function WeatherMapPanel({ province, extremeIds, mapLayer, onLayerChange, onProvinceSelect, forecast }: {
  province:ProvinceWeather; extremeIds:string[]; mapLayer:MapLayer;
  onLayerChange:(l:MapLayer)=>void; onProvinceSelect:(id:string)=>void; forecast:DayForecast[];
}) {
  const [hoverId, setHoverId] = useState<string|null>(null);
  const layers = [
    { id:"none"  as MapLayer, label:"عادي",  icon:MapPin,      color:"text-muted-foreground" },
    { id:"heat"  as MapLayer, label:"حرارة", icon:Thermometer, color:"text-red-400"          },
    { id:"wind"  as MapLayer, label:"رياح",  icon:Navigation,  color:"text-sky-400"          },
    { id:"rain"  as MapLayer, label:"أمطار", icon:CloudRain,   color:"text-blue-400"         },
  ];

  // 7-day high-temp sparkline for the active governorate (real forecast data).
  const temps = forecast.slice(0, 7).map(d => d.tempHigh);
  const sMin = temps.length ? Math.min(...temps) : 0;
  const sMax = temps.length ? Math.max(...temps) : 1;
  const sSpan = sMax - sMin || 1;
  const SW = 120, SH = 30;
  const sparkPts = temps.map((t, i) => `${(i/(Math.max(temps.length-1,1)))*SW},${SH - ((t-sMin)/sSpan)*(SH-6) - 3}`).join(" ");

  return (
    <motion.div className="glass-card rounded-3xl p-4 flex flex-col gap-3"
      initial={{ opacity:0,x:12 }} animate={{ opacity:1,x:0 }} transition={{ duration:0.5,ease:EASE,delay:0.1 }} dir="rtl">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-1.5">
          <Layers className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-[11px] text-muted-foreground font-arabic">خريطة المحافظات</span>
        </div>
        <div className="flex items-center gap-1 flex-wrap">
          {layers.map(l => (
            <button key={l.id} onClick={() => onLayerChange(l.id)}
              className={cn("flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-semibold transition-all border",
                mapLayer===l.id ? "bg-white/[0.08] border-white/[0.15] text-foreground" : "bg-transparent border-transparent text-muted-foreground/60 hover:text-muted-foreground")}>
              <l.icon className={cn("w-3 h-3", mapLayer===l.id ? l.color : "")} />{l.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 min-h-[240px]">
        <svg viewBox={VIEW_BOX} className="w-full h-full" preserveAspectRatio="xMidYMid meet">
          <defs>
            <filter id="blur-heat" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="0.22"/></filter>
            <filter id="blur-rain" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="0.18"/></filter>
          </defs>

          {/* Real governorate polygons — interactive, perfectly aligned */}
          {PROVINCES.map(p => {
            const geo = GEO_BY_NAME.get(p.nameAr); if(!geo) return null;
            const isSel = p.id===province.id; const isExt = extremeIds.includes(p.id); const isHov = p.id===hoverId;
            const base = isExt ? "oklch(0.62 0.22 28)" : isSel ? "oklch(0.696 0.170 162)" : "oklch(0.55 0.09 158)";
            const op = isHov ? 0.62 : isSel ? 0.42 : isExt ? 0.40 : 0.16;
            return (
              <path key={p.id} className="geo-region" d={geo.path} fill={base} fillOpacity={op}
                stroke={isSel ? "white" : "oklch(0.696 0.170 162 / 35%)"} strokeWidth={isSel ? 0.028 : 0.012}
                onClick={() => onProvinceSelect(p.id)}
                onMouseEnter={() => setHoverId(p.id)} onMouseLeave={() => setHoverId(null)}>
                <title>{`${p.nameAr} — ${p.temp}°م`}</title>
              </path>
            );
          })}

          {/* Climate overlays anchored at true centroids */}
          <AnimatePresence>
            {mapLayer==="heat" && (
              <motion.g key="heat" className="pointer-events-none" initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }} transition={{ duration:0.5 }}>
                {PROVINCES.map(p => { const g=GEO_BY_NAME.get(p.nameAr); if(!g) return null;
                  return <circle key={p.id} cx={g.cx} cy={g.cy} r={0.55} fill={tempToHeatColor(p.temp)} opacity={0.30} filter="url(#blur-heat)" />; })}
              </motion.g>
            )}
            {mapLayer==="wind" && (
              <motion.g key="wind" className="pointer-events-none" initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }} transition={{ duration:0.5 }}>
                {PROVINCES.map((p,i) => { const g=GEO_BY_NAME.get(p.nameAr); if(!g) return null;
                  const angle=WIND_DIRECTION_ANGLE[p.windDirection]??0;
                  const col=p.windSpeed>=25?"#ef4444":p.windSpeed>=18?"#f59e0b":"#38bdf8";
                  return (
                    <motion.g key={p.id} transform={`translate(${g.cx},${g.cy}) rotate(${angle})`}
                      animate={{ opacity:[0.5,1,0.5] }} transition={{ duration:1.8+(i%4)*0.4, repeat:Infinity, delay:(i%5)*0.3 }}>
                      <line x1="-0.17" y1="0" x2="0.17" y2="0" stroke={col} strokeWidth="0.04" strokeLinecap="round"/>
                      <path d="M 0.09 -0.07 L 0.17 0 L 0.09 0.07" fill="none" stroke={col} strokeWidth="0.035" strokeLinecap="round" strokeLinejoin="round"/>
                    </motion.g>
                  );
                })}
              </motion.g>
            )}
            {mapLayer==="rain" && (
              <motion.g key="rain" className="pointer-events-none" initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }} transition={{ duration:0.5 }}>
                {PROVINCES.map(p => { const g=GEO_BY_NAME.get(p.nameAr); if(!g||p.precipitation===0) return null;
                  const r=0.15+(p.precipitation/100)*0.55;
                  return <circle key={p.id} cx={g.cx} cy={g.cy} r={r} fill="#38bdf8" opacity={0.12+(p.precipitation/100)*0.22} filter="url(#blur-rain)"/>; })}
              </motion.g>
            )}
          </AnimatePresence>

          {/* Centroid pins: climate icon + temperature (none) / marker (layers) */}
          {PROVINCES.map(p => {
            const g = GEO_BY_NAME.get(p.nameAr); if(!g) return null;
            const isSel = p.id===province.id; const isExt = extremeIds.includes(p.id);
            return (
              <g key={`pin-${p.id}`} className="pointer-events-none">
                {isSel && <motion.circle cx={g.cx} cy={g.cy} r={0.22} fill="none" stroke="oklch(0.696 0.170 162 / 65%)" strokeWidth="0.05"
                  initial={{ r:0.12,opacity:1 }} animate={{ r:0.42,opacity:0 }} transition={{ duration:1.6,repeat:Infinity,ease:"easeOut" }}/>}
                {isExt && <motion.circle cx={g.cx} cy={g.cy} r={0.18} fill="none" stroke="oklch(0.65 0.22 28 / 70%)" strokeWidth="0.04"
                  animate={{ opacity:[0.35,1,0.35] }} transition={{ duration:1.8,repeat:Infinity }}/>}
                {mapLayer==="none" ? (
                  <>
                    <ClimateGlyph state={p.ambientState} cx={g.cx} cy={g.cy - 0.06} scale={isSel ? 0.22 : 0.17} />
                    <text x={g.cx} y={g.cy + 0.34} fontSize="0.22" textAnchor="middle" fill={tempToHeatColor(p.temp)} fontFamily="var(--font-numeric)" fontWeight="700">{p.temp}°</text>
                  </>
                ) : (
                  <circle cx={g.cx} cy={g.cy} r={isSel?0.11:0.07}
                    fill={isSel?"oklch(0.85 0.16 162)":isExt?"oklch(0.72 0.20 28)":"oklch(0.80 0.05 155 / 80%)"}/>
                )}
                {isSel && <text x={g.cx} y={g.cy-0.40} textAnchor="middle" fontSize="0.30" fill="currentColor" className="text-foreground" fontFamily="var(--font-cairo)" fontWeight="700">{p.nameAr}</text>}
              </g>
            );
          })}
        </svg>
      </div>

      {/* Footer: legend + active 7-day temperature sparkline */}
      <div className="flex items-center justify-between gap-3 pt-2 border-t border-white/[0.05]">
        <div className="flex items-center gap-3 text-[10px] text-muted-foreground/60">
          <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-400 inline-block"/>محددة</div>
          <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-400 inline-block"/>متطرف</div>
        </div>
        {temps.length > 1 && (
          <div className="flex items-center gap-2">
            <span className="text-[9px] text-muted-foreground/60 font-arabic whitespace-nowrap">حرارة ٧ أيام</span>
            <svg viewBox={`0 0 ${SW} ${SH}`} className="w-[110px] h-[26px]" preserveAspectRatio="none" style={{ direction:"ltr" }}>
              <defs>
                <linearGradient id="wspark" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="oklch(0.696 0.170 162)" stopOpacity="0.30"/>
                  <stop offset="100%" stopColor="oklch(0.696 0.170 162)" stopOpacity="0"/>
                </linearGradient>
              </defs>
              <polygon points={`0,${SH} ${sparkPts} ${SW},${SH}`} fill="url(#wspark)" />
              <polyline points={sparkPts} fill="none" stroke="oklch(0.72 0.15 162)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"/>
            </svg>
          </div>
        )}
      </div>
    </motion.div>
  );
}

/* ─── 7-Day Forecast Timeline ────────────────────────────────────────── */
function ForecastTimeline({ forecast, selectedIdx, onSelect }: { forecast:DayForecast[]; selectedIdx:number|null; onSelect:(i:number|null)=>void }) {
  const condIcon: Record<AmbientState, React.ElementType> = { sunny:Sun, dusty:SunMedium, cloudy:Cloud, rainy:CloudRain, "clear-night":CloudSun };
  const condColor: Record<AmbientState, string> = { sunny:"text-amber-400", dusty:"text-orange-400", cloudy:"text-slate-400", rainy:"text-sky-400", "clear-night":"text-indigo-300" };
  return (
    <motion.div className="glass-card rounded-3xl p-4 md:p-5" custom={2} variants={fadeUp} initial="hidden" animate="visible" dir="rtl">
      <div className="flex items-center gap-2 mb-4">
        <Calendar className="w-4 h-4 text-emerald-400" />
        <span className="text-sm font-bold text-foreground">شريط التوقعات الزراعي</span>
        <span className="text-[10px] text-muted-foreground/60 mr-auto">7 أيام</span>
        {selectedIdx !== null && (
          <button onClick={() => onSelect(null)} className="text-[10px] text-amber-400 hover:text-amber-300 transition-colors">عرض اليوم الحالي</button>
        )}
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth:"none" }}>
        {forecast.map((day, i) => {
          const Icon=condIcon[day.ambientState]; const RIcon=day.riskType!=="none"?RISK_ICON[day.riskType]:null;
          const isToday=i===0; const isSel=selectedIdx===i;
          return (
            <motion.button key={i} onClick={() => onSelect(isSel?null:i)}
              whileHover={{ scale:1.03 }} whileTap={{ scale:0.97 }}
              className={cn("flex-shrink-0 flex flex-col items-center gap-2 rounded-2xl px-4 py-3 transition-all border min-w-[100px]",
                isSel ? "bg-emerald-500/15 border-emerald-500/35 shadow-[0_0_16px_oklch(0.696_0.170_162_/_15%)]"
                : isToday ? "bg-white/[0.06] border-white/[0.12]"
                : "bg-white/[0.03] border-white/[0.07] hover:bg-white/[0.05]",
                day.riskType==="heatwave"&&!isSel&&"border-red-500/20",
                day.riskType==="sandstorm"&&!isSel&&"border-orange-500/20")}>
              <div className="text-center">
                <p className={cn("text-[10px] font-bold", isToday?"text-emerald-400":"text-muted-foreground")}>{isToday?"اليوم":day.dayAr}</p>
                <p className="text-[9px] text-muted-foreground/50">{day.dateStr}</p>
              </div>
              <Icon className={cn("w-6 h-6", condColor[day.ambientState])} />
              <div className="flex items-center gap-1 text-xs font-numeric">
                <span className="font-black text-foreground">{day.tempHigh}°</span>
                <span className="text-muted-foreground/50">/</span>
                <span className="text-muted-foreground">{day.tempLow}°</span>
              </div>
              <div className="flex flex-col items-center gap-1">
                {RIcon && <RIcon className={cn("w-3 h-3", RISK_COLOR[day.riskType])} />}
                <span className={cn("text-[9px] font-bold text-center leading-tight font-arabic px-1 py-0.5 rounded-md",
                  day.riskType==="heatwave"?"text-red-400 bg-red-500/10":
                  day.riskType==="sandstorm"?"text-orange-400 bg-orange-500/10":
                  day.riskType==="strong-wind"?"text-amber-400 bg-amber-500/10":
                  day.riskType==="rain"?"text-sky-400 bg-sky-500/10":"text-emerald-400/70")}>
                  {day.agroTag}
                </span>
              </div>
            </motion.button>
          );
        })}
      </div>
    </motion.div>
  );
}

/* ─── Intelligence Grid card ─────────────────────────────────────────── */
function MetricCard({ icon:Icon, label, value, unit, sub, color, index }: {
  icon:React.ElementType; label:string; value:string|number; unit:string; sub:string; color:string; index:number;
}) {
  return (
    <motion.div className="glass-card rounded-2xl p-4 flex flex-col gap-3"
      custom={index} variants={fadeUp} initial="hidden" animate="visible" dir="rtl">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-white/[0.05] border border-white/[0.08]">
          <Icon className={cn("w-4 h-4", color)} />
        </div>
        <span className="text-xs text-muted-foreground font-arabic">{label}</span>
      </div>
      <div>
        <div className="flex items-baseline gap-1">
          <span className="text-2xl font-black font-numeric text-foreground">{value}</span>
          <span className="text-sm text-muted-foreground">{unit}</span>
        </div>
        <p className="text-[11px] text-muted-foreground/70 mt-1 font-arabic leading-relaxed">{sub}</p>
      </div>
    </motion.div>
  );
}

/* ─── Field Weather Link ─────────────────────────────────────────────── */
interface StoredField { id?:number|string; name?:string; province?:string; crop?:string; area?:number; }
function FieldWeatherLink({ province, hyperlocalArea }: { province:ProvinceWeather; hyperlocalArea:string|null }) {
  const [fields, setFields] = useState<StoredField[]>([]);
  useEffect(() => { try { const r=localStorage.getItem("agro_fields"); if(r) setFields(JSON.parse(r)); } catch {} }, []);
  const linked=fields.filter(f => f.province?.includes(province.nameAr)||province.nameAr.includes(f.province??"____"));
  return (
    <div className="glass-card rounded-2xl p-4 flex flex-col gap-4" dir="rtl">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-xl bg-emerald-500/12 border border-emerald-500/20 flex items-center justify-center">
          <Leaf className="w-4 h-4 text-emerald-400" />
        </div>
        <div>
          <p className="text-xs font-bold text-foreground">ربط الطقس بالحقل</p>
          <p className="text-[10px] text-muted-foreground font-arabic">مقارنة بيانات المحافظة</p>
        </div>
      </div>
      {hyperlocalArea && (
        <motion.div initial={{ opacity:0,scale:0.95 }} animate={{ opacity:1,scale:1 }}
          className="flex items-center gap-2 rounded-xl bg-emerald-500/10 border border-emerald-500/25 px-3 py-2">
          <motion.div className="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0"
            animate={{ opacity:[1,0.3,1] }} transition={{ duration:1.2,repeat:Infinity }}/>
          <span className="text-[11px] text-emerald-400 font-bold font-arabic">بيانات دقيقة لمنطقة {hyperlocalArea}</span>
        </motion.div>
      )}
      <div className="grid grid-cols-2 gap-2">
        {[
          { label:"الحرارة", value:`${province.temp}°م`,         icon:Thermometer, color:"text-amber-400"  },
          { label:"الرطوبة", value:`${province.humidity}%`,       icon:Droplets,    color:"text-sky-400"    },
          { label:"الرياح",  value:`${province.windSpeed} كم/س`, icon:Wind,        color:"text-cyan-400"   },
          { label:"الأشعة",  value:`${province.uvIndex} UV`,      icon:Sun,         color:"text-yellow-400" },
        ].map(item => (
          <div key={item.label} className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-2.5 flex items-center gap-2">
            <item.icon className={cn("w-3.5 h-3.5 flex-shrink-0", item.color)}/>
            <div>
              <p className="text-[10px] text-muted-foreground font-arabic">{item.label}</p>
              <p className="text-xs font-bold font-numeric text-foreground">{item.value}</p>
            </div>
          </div>
        ))}
      </div>
      {linked.length > 0 ? (
        <div className="space-y-2">
          <p className="text-[10px] text-muted-foreground/60 font-arabic">حقولك في هذه المحافظة</p>
          {linked.map((f,i) => (
            <div key={i} className="flex items-center justify-between rounded-xl bg-white/[0.03] border border-white/[0.05] px-3 py-2">
              <div className="flex items-center gap-2">
                <Wheat className="w-3.5 h-3.5 text-amber-400/70"/>
                <span className="text-xs font-semibold text-foreground/80 font-arabic">{f.name??`حقل ${i+1}`}</span>
              </div>
              {f.area!=null && <span className="text-[10px] text-muted-foreground font-numeric">{f.area} د</span>}
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-xl bg-white/[0.02] border border-dashed border-white/[0.08] px-3 py-4 text-center">
          <p className="text-[11px] text-muted-foreground/50 font-arabic">لا توجد حقول مسجلة في {province.nameAr}</p>
          <p className="text-[10px] text-emerald-500/50 mt-1">أضف حقولك من صفحة الحقول</p>
        </div>
      )}
    </div>
  );
}

/* ─── Risk Center ────────────────────────────────────────────────────── */
function RiskCenter({ forecast, province }: { forecast:DayForecast[]; province:ProvinceWeather }) {
  const riskDays=forecast.slice(0,4).map((d,i)=>({...d,idx:i})).filter(d=>d.riskType!=="none");
  const bgColor: Record<RiskType,string> = { none:"", heatwave:"bg-red-500/8 border-red-500/25", sandstorm:"bg-orange-500/8 border-orange-500/25", "strong-wind":"bg-amber-500/8 border-amber-500/25", rain:"bg-sky-500/8 border-sky-500/25" };
  const titleColor: Record<RiskType,string> = { none:"", heatwave:"text-red-400", sandstorm:"text-orange-400", "strong-wind":"text-amber-400", rain:"text-sky-400" };
  const riskLabel: Record<RiskType,string> = { none:"", heatwave:"موجة حر", sandstorm:"عاصفة رملية", "strong-wind":"رياح قوية", rain:"هطول مطري" };
  return (
    <motion.div className="glass-card rounded-3xl p-5" custom={4} variants={fadeUp} initial="hidden" animate="visible" dir="rtl">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-xl bg-red-500/12 border border-red-500/20 flex items-center justify-center">
          <Shield className="w-4 h-4 text-red-400" />
        </div>
        <div>
          <p className="text-sm font-bold text-foreground">مركز رصد المخاطر</p>
          <p className="text-[10px] text-muted-foreground font-arabic">48-96 ساعة القادمة — {province.nameAr}</p>
        </div>
      </div>
      {riskDays.length===0 ? (
        <div className="rounded-2xl bg-emerald-500/8 border border-emerald-500/20 px-4 py-5 text-center">
          <Sprout className="w-7 h-7 text-emerald-400 mx-auto mb-2"/>
          <p className="text-sm font-bold text-emerald-400">لا مخاطر متوقعة</p>
          <p className="text-[11px] text-muted-foreground mt-1 font-arabic">الأجواء مناسبة للعمليات الزراعية</p>
        </div>
      ) : (
        <div className="space-y-3">
          {riskDays.map(day => {
            const RIcon=RISK_ICON[day.riskType];
            return (
              <motion.div key={day.idx} className={cn("rounded-2xl p-4 border flex items-start gap-3", bgColor[day.riskType])}
                initial={{ opacity:0,x:-8 }} animate={{ opacity:1,x:0 }} transition={{ delay:day.idx*0.1,ease:EASE }}>
                <div className="flex flex-col items-center gap-1 flex-shrink-0">
                  <motion.div className={cn("w-8 h-8 rounded-xl border flex items-center justify-center",
                    day.riskType==="heatwave"?"bg-red-500/15 border-red-500/30":day.riskType==="sandstorm"?"bg-orange-500/15 border-orange-500/30":day.riskType==="rain"?"bg-sky-500/15 border-sky-500/30":"bg-amber-500/15 border-amber-500/30")}
                    animate={{ scale:[1,1.08,1] }} transition={{ duration:2,repeat:Infinity }}>
                    <RIcon className={cn("w-4 h-4", titleColor[day.riskType])}/>
                  </motion.div>
                  <span className={cn("text-[8px] font-bold px-1.5 py-0.5 rounded-full border",
                    day.idx===0?"border-red-500/30 text-red-400 bg-red-500/10":"border-white/[0.12] text-muted-foreground/60")}>
                    {day.idx===0?"اليوم":day.dayAr}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <span className={cn("text-[11px] font-bold", titleColor[day.riskType])}>{riskLabel[day.riskType]}</span>
                    <span className="font-numeric text-xs text-muted-foreground">{day.tempHigh}° / {day.tempLow}°</span>
                  </div>
                  <p className="text-xs text-foreground/80 leading-relaxed font-arabic">{day.riskAdvice}</p>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}

/* ─── Climate Context ────────────────────────────────────────────────── */
function ClimateContext() {
  const daysToSolstice=22; const khamsinDay=47;
  return (
    <motion.div className="glass-card rounded-3xl p-5 flex flex-col gap-4" custom={5} variants={fadeUp} initial="hidden" animate="visible" dir="rtl">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-xl bg-amber-500/12 border border-amber-500/20 flex items-center justify-center">
          <Sprout className="w-4 h-4 text-amber-400" />
        </div>
        <div>
          <p className="text-sm font-bold text-foreground">السياق الموسمي</p>
          <p className="text-[10px] text-muted-foreground font-arabic">الموروث المناخي الزراعي</p>
        </div>
      </div>
      <div className="rounded-2xl bg-orange-500/8 border border-orange-500/18 p-4">
        <div className="flex items-start gap-2.5">
          <SunMedium className="w-5 h-5 text-orange-400 flex-shrink-0 mt-0.5"/>
          <div>
            <p className="text-xs font-bold text-orange-400 mb-1">الخمسينية</p>
            <p className="text-[11px] text-foreground/80 leading-relaxed font-arabic">
              نحن في اليوم <span className="font-numeric font-bold text-orange-400">{khamsinDay}</span> من الخمسينية
              — تبقى <span className="font-numeric font-bold text-amber-400">3</span> أيام على نهاية هذه الحقبة الحارة
            </p>
          </div>
        </div>
      </div>
      <div className="rounded-2xl bg-white/[0.04] border border-white/[0.07] p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] text-muted-foreground font-arabic">الانقلاب الصيفي</span>
          <span className="text-[10px] text-amber-400/70 font-arabic">21 يونيو 2026</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex-1 h-1.5 rounded-full bg-white/[0.08] overflow-hidden">
            <motion.div className="h-full rounded-full bg-gradient-to-l from-amber-400 to-orange-500"
              initial={{ width:"0%" }} animate={{ width:`${((365-daysToSolstice)/365)*100}%` }}
              transition={{ duration:1.2,ease:EASE,delay:0.4 }}/>
          </div>
          <span className="text-xs font-bold font-numeric text-amber-400 flex-shrink-0">{daysToSolstice} يوم</span>
        </div>
      </div>
      <div className="space-y-2">
        {[
          { tip:"موسم حصاد القمح والشعير في ذروته شمال سوريا", color:"text-amber-400/80" },
          { tip:"إزهار الفستق وتلقيح الكرمة — فترة حرجة للتسميد", color:"text-emerald-400/80" },
          { tip:"توقع ارتفاع أسعار الخضار الصيفية خلال أسبوعين", color:"text-sky-400/80" },
        ].map((item,i) => (
          <div key={i} className="flex items-start gap-2">
            <div className={cn("w-1 h-1 rounded-full mt-1.5 flex-shrink-0", item.color.replace("text-","bg-"))}/>
            <p className={cn("text-[10px] font-arabic leading-relaxed", item.color)}>{item.tip}</p>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

/* ─── Irrigation Command ─────────────────────────────────────────────── */
function IrrigationCommand({ province, overrideDay, forecast }: {
  province: ProvinceWeather; overrideDay: DayForecast|null; forecast: DayForecast[];
}) {
  const temp      = overrideDay?.tempHigh    ?? province.temp;
  const windKmh   = overrideDay?.windSpeed   ?? province.windSpeed;
  const humidity  = province.humidity;
  const et        = calcET0(temp, humidity, windKmh, province.solarRadiation);

  const rainSoon  = forecast.slice(1, 3).some(d => d.precipChance >= 35);
  const waterM3   = Math.round(et * 10) / 10;

  const etStatus  = et < 3 ? { label:"منخفض",      color:"text-emerald-400", bar:"bg-emerald-400", pct: 20 }
                  : et < 5 ? { label:"معتدل",       color:"text-yellow-400",  bar:"bg-yellow-400",  pct: 45 }
                  : et < 8 ? { label:"مرتفع",       color:"text-orange-400",  bar:"bg-orange-400",  pct: 68 }
                  :          { label:"مرتفع جداً",  color:"text-red-400",     bar:"bg-red-400",      pct: 90 };

  const decision  = rainSoon
    ? { label:"أجّل الري", sub:"أمطار متوقعة خلال 48 ساعة", icon:CloudRain, accent:"text-sky-400", bg:"bg-sky-500/10 border-sky-500/25" }
    : et >= 8
    ? { label:"اروِ فوراً", sub:"التبخر فوق الحد الحرج",    icon:GlassWater, accent:"text-red-400",   bg:"bg-red-500/10 border-red-500/25" }
    : { label:"اروِ اليوم", sub:"احتياج مائي طبيعي",         icon:Droplets,   accent:"text-emerald-400", bg:"bg-emerald-500/10 border-emerald-500/25" };

  const timing    = temp > 32 ? "3:30 – 6:00 فجراً" : temp > 26 ? "4:00 – 6:30 فجراً" : "5:00 – 7:30 صباحاً";

  const agentText = rainSoon
    ? `أمطار ${forecast[1]?.precipChance ?? 0}% متوقعة غداً — أوقف الري 24 ساعة قبل الهطول لتجنب إهدار المياه`
    : et >= 8
    ? `ET₀ ${et} مم/يوم — مستوى حرج يستلزم الري الفوري؛ كل ساعة تأخير تزيد الإجهاد الحراري للمحصول`
    : `ET₀ ${et} مم/يوم — الاحتياج المائي طبيعي لهذا الموسم؛ الري ${timing} يعطي أفضل كفاءة استيعاب`;

  return (
    <motion.div className="glass-card rounded-3xl p-5 flex flex-col gap-4"
      custom={6} variants={fadeUp} initial="hidden" animate="visible" dir="rtl">
      <div className="flex items-center gap-2">
        <div className="w-9 h-9 rounded-xl bg-sky-500/12 border border-sky-500/22 flex items-center justify-center">
          <GlassWater className="w-4.5 h-4.5 text-sky-400" />
        </div>
        <div>
          <p className="text-sm font-bold text-foreground">مركز التحكم بالري</p>
          <p className="text-[10px] text-muted-foreground font-arabic">محرك التبخر-النتح الزراعي — {province.nameAr}</p>
        </div>
        {overrideDay && (
          <span className="mr-auto text-[9px] text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-full px-2 py-0.5">
            توقع {overrideDay.dayAr}
          </span>
        )}
      </div>

      {/* ET gauge row */}
      <div className="rounded-2xl bg-white/[0.04] border border-white/[0.07] p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-[10px] text-muted-foreground font-arabic mb-0.5">معدل التبخر-النتح (ET₀)</p>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-black font-numeric text-foreground">{et}</span>
              <span className="text-sm text-muted-foreground">مم/يوم</span>
            </div>
          </div>
          <div className="text-left">
            <p className="text-[10px] text-muted-foreground mb-0.5">الاحتياج المائي</p>
            <p className={cn("text-sm font-bold font-arabic", etStatus.color)}>{etStatus.label}</p>
          </div>
        </div>
        <div className="h-2 rounded-full bg-white/[0.07] overflow-hidden">
          <motion.div className={cn("h-full rounded-full", etStatus.bar)}
            initial={{ width:"0%" }} animate={{ width:`${etStatus.pct}%` }}
            transition={{ duration:1.0, ease:EASE, delay:0.2 }} />
        </div>
        <div className="flex justify-between mt-1.5 text-[9px] text-muted-foreground/50">
          <span>0 مم</span><span>5 مم</span><span>10+ مم</span>
        </div>
      </div>

      {/* Decision + details */}
      <div className="grid grid-cols-2 gap-3">
        {/* Decision */}
        <div className={cn("rounded-2xl p-4 border flex flex-col items-center gap-2 col-span-1", decision.bg)}>
          <decision.icon className={cn("w-6 h-6", decision.accent)} />
          <p className={cn("text-sm font-black font-arabic text-center", decision.accent)}>{decision.label}</p>
          <p className="text-[10px] text-muted-foreground/70 text-center font-arabic">{decision.sub}</p>
        </div>
        {/* Metrics */}
        <div className="rounded-2xl bg-white/[0.03] border border-white/[0.07] p-4 flex flex-col gap-3">
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <Droplets className="w-3 h-3 text-sky-400" />
              <p className="text-[10px] text-muted-foreground font-arabic">الكمية المطلوبة</p>
            </div>
            <p className="text-lg font-black font-numeric text-foreground">{waterM3} <span className="text-sm font-normal text-muted-foreground">م³/دونم</span></p>
          </div>
          <div className="h-px bg-white/[0.06]"/>
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <Timer className="w-3 h-3 text-emerald-400" />
              <p className="text-[10px] text-muted-foreground font-arabic">أفضل توقيت</p>
            </div>
            <p className="text-xs font-bold text-emerald-400 font-arabic">{timing}</p>
          </div>
        </div>
      </div>

      <AgentInsight agent="وكيل الري" text={agentText} />
    </motion.div>
  );
}

/* ─── Pathogen Early Warning ─────────────────────────────────────────── */
function PathogenWarning({ province, overrideDay }: { province:ProvinceWeather; overrideDay:DayForecast|null }) {
  const temp     = overrideDay?.tempHigh ?? province.temp;
  const windSpd  = overrideDay?.windSpeed ?? province.windSpeed;
  const diseases = detectDiseases(temp, province.humidity, windSpd, province.airQualityIndex);

  const sevColor = { high:"text-red-400", medium:"text-amber-400", low:"text-yellow-400" } as const;
  const sevBg    = { high:"bg-red-500/8 border-red-500/20", medium:"bg-amber-500/8 border-amber-500/20", low:"bg-yellow-500/8 border-yellow-500/20" } as const;

  const topDisease = diseases[0];
  const agentText  = diseases.length === 0
    ? "ظروف المناخ الحالية لا تهيئ لتفشي أمراض نباتية — واصل المراقبة الوقائية الأسبوعية"
    : topDisease.probability >= 65
    ? `خطر ${topDisease.nameAr} مرتفع (${topDisease.probability}%) — ${topDisease.treatment}`
    : `احتمال ${topDisease.nameAr} متوسط — مراقبة أسبوعية كافية مع رصد مستمر للرطوبة`;

  return (
    <motion.div className="glass-card rounded-3xl p-5"
      custom={7} variants={fadeUp} initial="hidden" animate="visible" dir="rtl">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-9 h-9 rounded-xl bg-purple-500/12 border border-purple-500/22 flex items-center justify-center">
          <Bug className="w-4.5 h-4.5 text-purple-400" />
        </div>
        <div>
          <p className="text-sm font-bold text-foreground">الإنذار المبكر للآفات</p>
          <p className="text-[10px] text-muted-foreground font-arabic">نموذج ربط المناخ بالأمراض — {province.nameAr}</p>
        </div>
      </div>

      {diseases.length === 0 ? (
        <div className="rounded-2xl bg-emerald-500/8 border border-emerald-500/20 px-4 py-5 text-center">
          <Microscope className="w-7 h-7 text-emerald-400 mx-auto mb-2" />
          <p className="text-sm font-bold text-emerald-400">لا مخاطر آفات</p>
          <p className="text-[11px] text-muted-foreground mt-1 font-arabic">الظروف المناخية غير مواتية للأمراض حالياً</p>
        </div>
      ) : (
        <div className="space-y-3">
          {diseases.map((d, i) => (
            <motion.div key={i} className={cn("rounded-2xl p-4 border", sevBg[d.severity])}
              initial={{ opacity:0,y:10 }} animate={{ opacity:1,y:0 }} transition={{ delay:i*0.1,ease:EASE }}>
              <div className="flex items-start justify-between gap-3 mb-2">
                <div>
                  <p className={cn("text-sm font-bold", sevColor[d.severity])}>{d.nameAr}</p>
                  <p className="text-[9px] text-muted-foreground/60 italic">{d.nameEn}</p>
                </div>
                <div className="flex flex-col items-end flex-shrink-0">
                  <span className={cn("text-lg font-black font-numeric", sevColor[d.severity])}>{d.probability}%</span>
                  <span className="text-[9px] text-muted-foreground/50">احتمالية</span>
                </div>
              </div>
              {/* Probability bar */}
              <div className="h-1.5 rounded-full bg-white/[0.07] overflow-hidden mb-3">
                <motion.div className={cn("h-full rounded-full", d.severity==="high"?"bg-red-400":d.severity==="medium"?"bg-amber-400":"bg-yellow-400")}
                  initial={{ width:"0%" }} animate={{ width:`${d.probability}%` }}
                  transition={{ duration:0.9,ease:EASE,delay:0.2+i*0.1 }}/>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[10px]">
                <div>
                  <p className="text-muted-foreground/50 mb-0.5">المحاصيل المعرضة</p>
                  <p className="text-foreground/75 font-arabic">{d.crop}</p>
                </div>
                <div>
                  <p className="text-muted-foreground/50 mb-0.5">الظروف المحفزة</p>
                  <p className="text-foreground/75 font-numeric">{d.conditions}</p>
                </div>
              </div>
              <div className="mt-2.5 flex items-start gap-1.5">
                <FlaskConical className="w-3 h-3 text-emerald-400 flex-shrink-0 mt-0.5" />
                <p className="text-[10px] text-emerald-400/80 font-arabic leading-relaxed">{d.treatment}</p>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <AgentInsight agent="وكيل الآفات" text={agentText} />
    </motion.div>
  );
}

/* ─── Crop Impact Analyzer ───────────────────────────────────────────── */
interface CropCtx { cropId?:string; crop?:string; id?:string; name?:string; cropName?:string; region?:string; area?:number; }

function CropImpactAnalyzer({ province, overrideDay }: { province:ProvinceWeather; overrideDay:DayForecast|null }) {
  const [ctx, setCtx] = useState<CropCtx|null>(null);
  useEffect(() => {
    try { const r=localStorage.getItem("agro_crop_context"); if(r) setCtx(JSON.parse(r)); } catch {}
  }, []);

  const temp       = overrideDay?.tempHigh ?? province.temp;
  const rawCropKey = ctx?.cropId ?? ctx?.crop ?? ctx?.id ?? "";
  const cropKey    = rawCropKey.toLowerCase().replace(/\s/g,"");
  const meta       = CROP_META[cropKey] ?? null;
  const cropNameAr = meta?.nameAr ?? ctx?.cropName ?? ctx?.name ?? rawCropKey;
  const stress     = meta ? calcThermalStress(cropKey, temp) : Math.round(Math.max(0,Math.min(100,(temp-22)/18*70)));
  const advice     = meta ? (stress > 50 ? meta.stressAdvice : meta.goodAdvice) : "ابدأ بتحديد المحصول لتحليل دقيق";

  const stressColor = stress < 25 ? "bg-emerald-400" : stress < 55 ? "bg-yellow-400" : stress < 80 ? "bg-orange-400" : "bg-red-400";
  const stressLabel = stress < 25 ? "إجهاد منعدم" : stress < 55 ? "إجهاد خفيف" : stress < 80 ? "إجهاد متوسط" : "إجهاد حراري شديد";
  const stressTextColor = stress < 25 ? "text-emerald-400" : stress < 55 ? "text-yellow-400" : stress < 80 ? "text-orange-400" : "text-red-400";

  return (
    <motion.div className="glass-card rounded-3xl p-5 flex flex-col gap-4"
      custom={8} variants={fadeUp} initial="hidden" animate="visible" dir="rtl">
      <div className="flex items-center gap-2">
        <div className="w-9 h-9 rounded-xl bg-emerald-500/12 border border-emerald-500/22 flex items-center justify-center">
          <Sprout className="w-4.5 h-4.5 text-emerald-400" />
        </div>
        <div>
          <p className="text-sm font-bold text-foreground">محلل تأثير المناخ على المحصول</p>
          <p className="text-[10px] text-muted-foreground font-arabic">من سياق صفحة المحاصيل</p>
        </div>
      </div>

      {!ctx || !rawCropKey ? (
        <div className="rounded-2xl bg-white/[0.03] border border-dashed border-white/[0.10] p-5 text-center">
          <Wheat className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
          <p className="text-xs font-semibold text-muted-foreground/60 font-arabic">لا يوجد محصول محدد</p>
          <p className="text-[10px] text-emerald-500/50 mt-1.5 font-arabic">اختر محصولاً من صفحة المحاصيل لتفعيل التحليل</p>
        </div>
      ) : (
        <>
          {/* Crop header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-amber-500/12 border border-amber-500/20 flex items-center justify-center">
                <Wheat className="w-4 h-4 text-amber-400" />
              </div>
              <div>
                <p className="text-sm font-bold text-foreground font-arabic">{cropNameAr}</p>
                {ctx.region && <p className="text-[10px] text-muted-foreground">{ctx.region}</p>}
              </div>
            </div>
            <div className="text-left">
              <p className="text-[10px] text-muted-foreground mb-0.5">درجة الحرارة الفعلية</p>
              <span className="text-xl font-black font-numeric text-foreground">{temp}°</span>
              {meta && <p className="text-[9px] text-muted-foreground/60">مثالي: {meta.optMin}–{meta.optMax}°</p>}
            </div>
          </div>

          {/* Thermal stress gauge */}
          <div className="rounded-2xl bg-white/[0.04] border border-white/[0.07] p-4">
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-1.5">
                <Gauge className="w-3.5 h-3.5 text-muted-foreground" />
                <p className="text-[11px] text-muted-foreground font-arabic">مستوى الإجهاد الحراري</p>
              </div>
              <span className={cn("text-sm font-black font-arabic", stressTextColor)}>{stressLabel}</span>
            </div>
            <div className="h-2.5 rounded-full bg-white/[0.07] overflow-hidden">
              <motion.div className={cn("h-full rounded-full transition-colors", stressColor)}
                initial={{ width:"0%" }} animate={{ width:`${stress}%` }}
                transition={{ duration:1.1, ease:EASE, delay:0.3 }} />
            </div>
            <div className="flex justify-between mt-1.5 text-[9px] text-muted-foreground/40">
              <span>0%</span><span>50%</span><span>100%</span>
            </div>
          </div>

          {/* Impact advice */}
          <div className="rounded-2xl bg-emerald-500/6 border border-emerald-500/14 p-4">
            <div className="flex items-center gap-1.5 mb-2">
              {stress < 50 ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />}
              <span className={cn("text-[10px] font-bold", stress < 50 ? "text-emerald-400" : "text-amber-400")}>
                {stress < 50 ? "تأثير إيجابي" : "تأثير سلبي"}
              </span>
            </div>
            <p className="text-xs text-foreground/80 leading-relaxed font-arabic">{advice}</p>
          </div>

          {/* Optimal range indicators */}
          {meta && (
            <div className="grid grid-cols-3 gap-2 text-center">
              {[
                { label:"أدنى مثالي", val:`${meta.optMin}°`, color:"text-sky-400" },
                { label:"أعلى مثالي", val:`${meta.optMax}°`, color:"text-emerald-400" },
                { label:"حد الإجهاد",  val:`${meta.stressMax}°`, color:"text-orange-400" },
              ].map(item => (
                <div key={item.label} className="rounded-xl bg-white/[0.03] border border-white/[0.06] py-2 px-1">
                  <p className={cn("text-sm font-black font-numeric", item.color)}>{item.val}</p>
                  <p className="text-[9px] text-muted-foreground/60 mt-0.5 font-arabic">{item.label}</p>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <AgentInsight agent="وكيل المحاصيل"
        text={!rawCropKey ? "اختر محصولك من صفحة المحاصيل وسيظهر تحليل تأثير درجات الحرارة تلقائياً هنا"
          : stress >= 70 ? `إجهاد حراري ${stress}% على محصول ${cropNameAr} — تدخل فوري مطلوب`
          : `تأثير الحرارة على ${cropNameAr} ضمن المعدل المقبول لهذا الموسم`} />
    </motion.div>
  );
}

/* ─── Field Activity Planner (traffic-light) ────────────────────────── */
type TrafficStatus = "green" | "yellow" | "red";
interface Activity { labelAr: string; status: TrafficStatus; reason: string; icon: React.ElementType; }

function FieldActivityPlanner({ province, forecast }: { province: ProvinceWeather; forecast: DayForecast[] }) {
  const rainTmr   = forecast[1]?.precipChance ?? 0;
  const wind      = province.windSpeed;
  const humidity  = province.humidity;

  const activities: Activity[] = [
    {
      labelAr: "رش المبيدات",
      icon: Droplets,
      status: wind > 22 ? "red" : wind > 15 ? "yellow" : "green",
      reason:  wind > 22 ? `رياح ${wind} كم/س — ممنوع`
             : wind > 15 ? `رياح ${wind} كم/س — فجراً فقط`
             : `رياح ${wind} كم/س — مناسب`,
    },
    {
      labelAr: "التسميد السائل",
      icon: Sprout,
      status: rainTmr > 40 ? "red" : rainTmr > 20 ? "yellow" : "green",
      reason:  rainTmr > 40 ? `هطول ${rainTmr}% غداً — أجّل`
             : rainTmr > 20 ? `هطول ${rainTmr}% محتمل — تحذير`
             : `لا هطول متوقع — مناسب`,
    },
    {
      labelAr: "الحصاد الآلي",
      icon: Wheat,
      status: humidity > 70 ? "red" : humidity > 58 ? "yellow" : "green",
      reason:  humidity > 70 ? `رطوبة ${humidity}% — رطوبة الحبوب عالية`
             : humidity > 58 ? `رطوبة ${humidity}% — حذر`
             : `رطوبة ${humidity}% — مثالي`,
    },
    {
      labelAr: "العمل الميداني",
      icon: Activity,
      status: province.isExtreme ? "red" : province.temp > 34 ? "yellow" : "green",
      reason:  province.isExtreme ? `${province.temp}°م — توقف 12-4م`
             : province.temp > 34 ? `${province.temp}°م — صباحاً فقط`
             : `${province.temp}°م — مناسب`,
    },
  ];

  const dot: Record<TrafficStatus, string> = {
    green: "bg-emerald-400", yellow: "bg-amber-400", red: "bg-red-400",
  };
  const card: Record<TrafficStatus, string> = {
    green: "bg-emerald-500/8 border-emerald-500/20",
    yellow:"bg-amber-500/8  border-amber-500/20",
    red:   "bg-red-500/8    border-red-500/20",
  };
  const label: Record<TrafficStatus, string> = {
    green: "text-emerald-400", yellow: "text-amber-400", red: "text-red-400",
  };
  const statusAr: Record<TrafficStatus, string> = {
    green: "مناسب", yellow: "تحذير", red: "ممنوع",
  };

  return (
    <motion.div
      className="glass-card rounded-3xl p-5"
      custom={10} variants={fadeUp} initial="hidden" animate="visible" dir="rtl"
    >
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-xl bg-emerald-500/12 border border-emerald-500/20 flex items-center justify-center">
          <Activity className="w-4 h-4 text-emerald-400" />
        </div>
        <div>
          <p className="text-sm font-bold text-foreground">نوافذ العمل الحقلية</p>
          <p className="text-[10px] text-muted-foreground font-arabic">مرشد القرار الزراعي — {province.nameAr}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {activities.map(act => (
          <div key={act.labelAr} className={cn("rounded-2xl p-3.5 border flex flex-col gap-2", card[act.status])}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <act.icon className={cn("w-3.5 h-3.5", label[act.status])} />
                <span className="text-[11px] font-bold font-arabic text-foreground">{act.labelAr}</span>
              </div>
              <motion.div className={cn("w-2 h-2 rounded-full flex-shrink-0", dot[act.status])}
                animate={act.status !== "green" ? { opacity:[1,0.3,1] } : {}}
                transition={{ duration:1.4, repeat:Infinity }} />
            </div>
            <p className={cn("text-xs font-bold font-arabic", label[act.status])}>{statusAr[act.status]}</p>
            <p className="text-[9px] text-muted-foreground/70 font-arabic leading-snug">{act.reason}</p>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

/* ─── Seasonal Climate Insights ─────────────────────────────────────── */
function SeasonalInsights({ province }: { province: ProvinceWeather }) {
  // June 2026 weekly projected vs 10-yr average
  const base10yr: Record<string, number> = {
    latakia:34, tartus:27, aleppo:30, idlib:28, hama:32, homs:33, damascus:34,
    "rif-dimashq":33, quneitra:32, daraa:34, suwayda:30,
    raqqa:39, hasakah:38, "deir-ez-zur":41,
  };
  const b = base10yr[province.id] ?? 34;
  const weeks = [
    { week:"أسبوع 1", avg: b,     proj: b+2,   label:"1-7 يونيو"  },
    { week:"أسبوع 2", avg: b+1,   proj: b+4,   label:"8-14 يونيو" },
    { week:"أسبوع 3", avg: b+2,   proj: b+5,   label:"15-21 يونيو"},
    { week:"أسبوع 4", avg: b+1.5, proj: b+3.5, label:"22-30 يونيو"},
  ];
  const maxT = Math.max(...weeks.flatMap(w=>[w.avg, w.proj]));
  const minT = Math.min(...weeks.map(w=>w.avg)) - 2;
  const range = maxT - minT;
  const H = 80;

  const barH  = (t: number) => Math.round(((t - minT) / range) * H);
  const yPos  = (t: number) => H - barH(t);

  return (
    <motion.div
      className="glass-card rounded-3xl p-5 flex flex-col gap-4"
      custom={11} variants={fadeUp} initial="hidden" animate="visible" dir="rtl"
    >
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-xl bg-sky-500/12 border border-sky-500/20 flex items-center justify-center">
          <BarChart3 className="w-4 h-4 text-sky-400" />
        </div>
        <div>
          <p className="text-sm font-bold text-foreground">الاستراتيجية الموسمية</p>
          <p className="text-[10px] text-muted-foreground font-arabic">حرارة يونيو 2026 مقابل المتوسط العشري — {province.nameAr}</p>
        </div>
      </div>

      <svg viewBox="0 0 300 110" className="w-full" style={{ direction:"ltr" }}>
        {/* Grid lines */}
        {[0,27,54,80].map(y => (
          <line key={y} x1="0" y1={y+5} x2="300" y2={y+5}
            stroke="rgba(255,255,255,0.05)" strokeWidth="1"/>
        ))}
        {/* Bars — each week = 70px wide slot */}
        {weeks.map((w, i) => {
          const x = i * 73 + 4;
          const avgH  = barH(w.avg);
          const projH = barH(w.proj);
          return (
            <g key={i}>
              {/* Avg bar */}
              <motion.rect x={x} y={5 + yPos(w.avg)} width={28} height={avgH}
                rx="3" fill="rgba(148,163,184,0.25)"
                initial={{ scaleY:0, originY:"bottom" }}
                animate={{ scaleY:1 }}
                transition={{ duration:0.7, delay:i*0.1, ease:EASE }}/>
              {/* Proj bar */}
              <motion.rect x={x+32} y={5 + yPos(w.proj)} width={28} height={projH}
                rx="3" fill="oklch(0.696 0.170 162 / 65%)"
                initial={{ scaleY:0 }}
                animate={{ scaleY:1 }}
                transition={{ duration:0.7, delay:i*0.12, ease:EASE }}/>
              {/* Temp labels */}
              <text x={x+14} y={5 + yPos(w.avg) - 2} textAnchor="middle"
                fontSize="7" fill="rgba(255,255,255,0.45)">{Math.round(w.avg)}°</text>
              <text x={x+46} y={5 + yPos(w.proj) - 2} textAnchor="middle"
                fontSize="7" fill="oklch(0.696 0.170 162 / 90%)">{Math.round(w.proj)}°</text>
              {/* Week label */}
              <text x={x+30} y={100} textAnchor="middle" fontSize="7"
                fill="rgba(255,255,255,0.35)" fontFamily="var(--font-cairo)">{w.week}</text>
            </g>
          );
        })}
      </svg>

      <div className="flex items-center gap-4 text-[10px] text-muted-foreground/60 pt-1 border-t border-white/[0.05]">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded bg-white/25 inline-block"/>
          <span className="font-arabic">متوسط 10 سنوات</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded bg-emerald-500/65 inline-block"/>
          <span className="font-arabic">توقعات 2026</span>
        </div>
        <span className={cn("mr-auto font-arabic", weeks[2].proj - weeks[2].avg > 3 ? "text-red-400/80" : "text-amber-400/80")}>
          {weeks[2].proj > weeks[2].avg ? `+${Math.round(weeks[2].proj-weeks[2].avg)}° فوق المتوسط` : "ضمن المتوسط"}
        </span>
      </div>
    </motion.div>
  );
}

/* ─── Agent Activity Hub ─────────────────────────────────────────────── */
function AgentActivityHub({ province }: { province: ProvinceWeather }) {
  const et = calcET0(province.temp, province.humidity, province.windSpeed, province.solarRadiation);
  const diseases = detectDiseases(province.temp, province.humidity, province.windSpeed, province.airQualityIndex);

  const streams = [
    {
      agent: "وكيل الري",
      color: "text-sky-400",
      bg:    "bg-sky-500/10 border-sky-500/20",
      dot:   "bg-sky-400",
      messages: [
        `احتساب ET₀ في ${province.nameAr}: ${et} مم/يوم`,
        `الاحتياج الأسبوعي: ${(et * 7).toFixed(1)} مم/دونم`,
        `أفضل نافذة ري: ${province.temp > 32 ? "3:30 فجراً" : "4:30 فجراً"}`,
      ],
    },
    {
      agent: "وكيل المخاطر",
      color: "text-red-400",
      bg:    "bg-red-500/10 border-red-500/20",
      dot:   "bg-red-400",
      messages: [
        `رصد الغبار القادم من ${province.region}...`,
        `تحليل موجة الحرارة: ${province.isExtreme ? "إنذار نشط" : "ضمن المعدل"}`,
        `رياح ${province.windSpeed} كم/س — ${province.windSpeed > 20 ? "تحذير للرش" : "آمن"}`,
      ],
    },
    {
      agent: "وكيل الآفات",
      color: "text-purple-400",
      bg:    "bg-purple-500/10 border-purple-500/20",
      dot:   "bg-purple-400",
      messages: [
        `تحليل الرطوبة ${province.humidity}% للأمراض الفطرية...`,
        diseases.length > 0 ? `تحذير: ${diseases[0].nameAr} ${diseases[0].probability}%` : "لا أمراض مرتفعة حالياً",
        `مراقبة ${province.humidity > 60 ? "البياض الزغبي" : "العنكبوت الأحمر"} في ${province.region}`,
      ],
    },
  ];

  const [indices, setIndices] = useState([0, 0, 0]);
  useEffect(() => {
    const id = setInterval(() => {
      setIndices(prev => prev.map((idx, i) => (idx + 1) % streams[i].messages.length));
    }, 3200);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [province.id]);

  return (
    <motion.div
      className="glass-card rounded-2xl p-4"
      custom={9} variants={fadeUp} initial="hidden" animate="visible" dir="rtl"
    >
      <div className="flex items-center gap-2 mb-3">
        <motion.div className="w-2 h-2 rounded-full bg-emerald-400"
          animate={{ opacity:[1,0.2,1] }} transition={{ duration:1.2, repeat:Infinity }}/>
        <span className="text-[11px] font-bold text-emerald-400 tracking-wide">شريط النشاط المناخي</span>
        <span className="text-[10px] text-muted-foreground/50 mr-auto">تحديث مستمر</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        {streams.map((stream, si) => (
          <div key={si} className={cn("rounded-xl border p-3 flex items-start gap-2", stream.bg)}>
            <div className="flex flex-col items-center gap-1 flex-shrink-0 pt-0.5">
              <motion.div className={cn("w-1.5 h-1.5 rounded-full", stream.dot)}
                animate={{ opacity:[1,0.3,1] }} transition={{ duration:1.4+(si*0.3), repeat:Infinity }}/>
              <div className="w-px flex-1 bg-white/[0.07]"/>
            </div>
            <div className="flex-1 min-w-0">
              <p className={cn("text-[9px] font-bold mb-1", stream.color)}>{stream.agent}</p>
              <AnimatePresence mode="wait">
                <motion.p
                  key={indices[si]}
                  className="text-[10px] text-foreground/70 font-arabic leading-relaxed"
                  initial={{ opacity:0, y:4 }}
                  animate={{ opacity:1, y:0 }}
                  exit={{ opacity:0, y:-4 }}
                  transition={{ duration:0.3 }}
                >
                  {stream.messages[indices[si]]}
                </motion.p>
              </AnimatePresence>
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

/* ─── Weather Copilot ────────────────────────────────────────────────── */
interface ChatMsg { role: "agent" | "user"; text: string; }

function generateCopilotReply(q: string, province: ProvinceWeather): string {
  const lower = q;
  const et    = calcET0(province.temp, province.humidity, province.windSpeed, province.solarRadiation);
  const d     = detectDiseases(province.temp, province.humidity, province.windSpeed, province.airQualityIndex);

  if (lower.includes("رش") || lower.includes("مبيد")) {
    if (province.windSpeed > 22)
      return `لا، الرياح ${province.windSpeed} كم/س تتجاوز حد الأمان. انتظر الفجر أو المساء عندما تهدأ.`;
    if (province.humidity > 72)
      return `غير مثالي — الرطوبة ${province.humidity}% تقلل كفاءة الرش. أفضل وقت: فجر الغد.`;
    return `نعم، ظروف مناسبة — رياح ${province.windSpeed} كم/س. أفضل نافذة: قبل 7 صباحاً.`;
  }
  if (lower.includes("ري") || lower.includes("سقي") || lower.includes("ماء")) {
    if (province.precipitation > 38)
      return `أجّل الري — احتمال هطول ${province.precipitation}%. وفّر المياه وانتظر.`;
    return `اروِ ${et >= 8 ? "فوراً" : "اليوم"} — ET₀ ${et} مم/يوم، الكمية ${et} م³/دونم. أفضل وقت: ${province.temp > 32 ? "3:30" : "4:30"} فجراً.`;
  }
  if (lower.includes("حصاد")) {
    if (province.humidity > 68)
      return `أجّل الحصاد — الرطوبة ${province.humidity}% ترفع نسبة رطوبة الحبوب. انتظر يوماً صافياً.`;
    return `الظروف مناسبة للحصاد — رطوبة ${province.humidity}%، رياح ${province.windSpeed} كم/س.`;
  }
  if (lower.includes("مرض") || lower.includes("آفة") || lower.includes("حشر")) {
    if (d.length > 0)
      return `أعلى خطر الآن: ${d[0].nameAr} (${d[0].probability}%). التوصية: ${d[0].treatment}.`;
    return `لا مخاطر آفات مرتفعة — الظروف غير مواتية للأمراض الرئيسية حالياً.`;
  }
  if (lower.includes("غد") || lower.includes("بكر") || lower.includes("توقع")) {
    const tmr = PROVINCE_FORECASTS[province.id]?.[1];
    if (tmr)
      return `غداً في ${province.nameAr}: ${tmr.condition}، ${tmr.tempHigh}°/${tmr.tempLow}°م. ${tmr.riskType !== "none" ? tmr.riskAdvice : "ظروف مناسبة."}`;
  }
  if (lower.includes("حرار") || lower.includes("درج"))
    return `الحرارة الآن: ${province.temp}°م (تشعر كـ ${province.feelsLike}°م). ${province.isExtreme ? "إنذار حر — تجنب العمل 12-4م." : "ضمن المعدل الطبيعي."}`;
  return `${province.nameAr}: ${province.temp}°م، رطوبة ${province.humidity}%، رياح ${province.windSpeed} كم/س. ${province.aiSummary}`;
}

function WeatherCopilot({ province }: { province: ProvinceWeather }) {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input,    setInput]    = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  // Seed greeting whenever province changes
  useEffect(() => {
    setMessages([{
      role: "agent",
      text: `مرحباً! أنا وكيل الطقس لـ ${province.nameAr}. اسألني عن الري، الرش، الحصاد، أو الآفات.`,
    }]);
  }, [province.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = useCallback((text: string) => {
    if (!text.trim()) return;
    const q = text.trim();
    setMessages(prev => [...prev, { role:"user", text:q }]);
    setInput("");
    setTimeout(() => {
      setMessages(prev => [...prev, { role:"agent", text: generateCopilotReply(q, province) }]);
    }, 600);
  }, [province]);

  const chips = [
    "هل أرش المبيدات اليوم؟",
    "متى أروي؟",
    "هل الجو مناسب للحصاد؟",
    "خطر الآفات اليوم؟",
  ];

  return (
    <motion.div
      className="glass-card rounded-3xl p-5 flex flex-col gap-3"
      custom={12} variants={fadeUp} initial="hidden" animate="visible" dir="rtl"
    >
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center">
          <Bot className="w-4.5 h-4.5 text-emerald-400" />
        </div>
        <div>
          <p className="text-sm font-bold text-foreground">المساعد المناخي الذكي</p>
          <p className="text-[10px] text-muted-foreground font-arabic">سياق: {province.nameAr} — يجيب بناءً على البيانات الفعلية</p>
        </div>
        <motion.div className="w-2 h-2 rounded-full bg-emerald-400 mr-auto"
          animate={{ opacity:[1,0.2,1] }} transition={{ duration:1.2, repeat:Infinity }} />
      </div>

      {/* Messages */}
      <div className="rounded-2xl bg-white/[0.03] border border-white/[0.07] p-3 flex flex-col gap-2 max-h-48 overflow-y-auto"
           style={{ scrollbarWidth:"none" }}>
        {messages.map((msg, i) => (
          <motion.div key={i}
            initial={{ opacity:0, y:6 }} animate={{ opacity:1, y:0 }}
            transition={{ duration:0.25 }}
            className={cn("flex gap-2 items-start", msg.role==="user" ? "flex-row-reverse" : "")}>
            {msg.role === "agent" && (
              <div className="w-6 h-6 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Bot className="w-3 h-3 text-emerald-400" />
              </div>
            )}
            <div className={cn(
              "rounded-2xl px-3 py-2 text-xs font-arabic leading-relaxed max-w-[80%]",
              msg.role === "agent"
                ? "bg-white/[0.05] border border-white/[0.08] text-foreground/85"
                : "bg-emerald-500/15 border border-emerald-500/25 text-emerald-300"
            )}>
              {msg.text}
            </div>
          </motion.div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Quick chips */}
      <div className="flex gap-1.5 flex-wrap">
        {chips.map(c => (
          <button key={c} onClick={() => send(c)}
            className="text-[9px] font-arabic text-muted-foreground/70 border border-white/[0.08] rounded-full px-2.5 py-1 hover:bg-white/[0.05] hover:text-foreground transition-colors">
            {c}
          </button>
        ))}
      </div>

      {/* Input */}
      <div className="flex gap-2 items-center">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && send(input)}
          placeholder="اسألني عن الطقس الزراعي..."
          className="flex-1 rounded-xl bg-white/[0.05] border border-white/[0.10] px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-emerald-500/40 font-arabic text-right"
        />
        <button onClick={() => send(input)}
          className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center flex-shrink-0 hover:bg-emerald-500/30 transition-colors">
          <Send className="w-3.5 h-3.5 text-emerald-400" />
        </button>
      </div>
    </motion.div>
  );
}

/* ─── Main page ──────────────────────────────────────────────────────── */
export default function WeatherPage() {
  const [province,      setProvince]       = useState<ProvinceWeather>(() => PROVINCES.find(p=>p.id==="damascus")!);
  const [selectedDayIdx,setSelectedDayIdx] = useState<number|null>(null);
  const [mapLayer,      setMapLayer]       = useState<MapLayer>("none");
  const [hyperlocalArea,setHyperlocalArea] = useState<string|null>(null);
  const [copied,        setCopied]         = useState(false);

  useEffect(() => {
    try {
      const settings=localStorage.getItem("agro_settings");
      if(settings) {
        const parsed=JSON.parse(settings) as { province?:string; region?:string };
        const saved=parsed.province??parsed.region;
        if(saved) { const m=PROVINCES.find(p=>p.nameAr===saved||p.id===saved||p.region.includes(saved)); if(m) setProvince(m); }
      }
      const ctx=localStorage.getItem("agro_crop_context");
      if(ctx) { const p=JSON.parse(ctx) as { region?:string; area?:string }; if(p.region) setHyperlocalArea(p.region); else if(p.area) setHyperlocalArea(p.area as string); }
    } catch {}
  }, []);

  const handleSelect=useCallback((id:string) => {
    const p=PROVINCES.find(x=>x.id===id); if(p) { setProvince(p); setSelectedDayIdx(null); }
  }, []);

  const handleShare = useCallback(() => {
    const et = calcET0(province.temp, province.humidity, province.windSpeed, province.solarRadiation);
    const report = [
      `📊 تقرير الطقس الزراعي — ${province.nameAr}`,
      `📅 30 مايو 2026`,
      `🌡️ الحرارة: ${province.temp}°م (تشعر كـ ${province.feelsLike}°م)`,
      `💧 الرطوبة: ${province.humidity}% | الرياح: ${province.windSpeed} كم/س`,
      `☀️ الإشعاع: ${province.solarRadiation} W/m² | UV: ${province.uvIndex}`,
      `🌿 ET₀: ${et} مم/يوم`,
      `🤖 ${province.aiSummary}`,
      ``,
      `أغرو-سيريا — منصة الزراعة الذكية`,
    ].join("\n");
    navigator.clipboard.writeText(report).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  }, [province]);

  const provinceForecast = PROVINCE_FORECASTS[province.id] ?? [];
  const activeForecast   = selectedDayIdx !== null ? (provinceForecast[selectedDayIdx]??null) : null;
  const activeAmbient    = activeForecast?.ambientState ?? province.ambientState;
  const extremeIds       = PROVINCES.filter(p=>p.isExtreme).map(p=>p.id);
  const aqiInfo          = getAQILabel(province.airQualityIndex);

  const metricCards = [
    { icon:Wind,     label:"سرعة الرياح",     value:province.windSpeed,      unit:"كم/س",  color:"text-sky-400",   sub:`اتجاه ${province.windDirection}` },
    { icon:Droplets, label:"الرطوبة النسبية",  value:province.humidity,       unit:"%",     color:"text-cyan-400",  sub:`احتمال هطول ${province.precipitation}%` },
    { icon:Zap,      label:"الإشعاع الشمسي",   value:province.solarRadiation, unit:"W/m²",  color:"text-amber-400", sub:`مؤشر UV: ${province.uvIndex} — ${getUVLabel(province.uvIndex)}` },
    { icon:Eye,      label:"جودة الهواء",       value:province.airQualityIndex,unit:"AQI",   color:aqiInfo.color,    sub:`التقييم: ${aqiInfo.label}` },
  ];

  return (
    <WorkspaceLayout>
      <AmbientBackground state={activeAmbient} />

      <div className="relative z-10 min-h-screen h-auto" dir="rtl">
        <div className="max-w-6xl mx-auto px-4 py-6 pb-40 space-y-5">

          {/* Header */}
          <motion.div className="flex items-start justify-between gap-4 flex-wrap"
            initial={{ opacity:0,y:-10 }} animate={{ opacity:1,y:0 }} transition={{ duration:0.4,ease:EASE }}>
            <div>
              <h1 className="text-xl font-black text-foreground tracking-tight">ذكاء الطقس الزراعي</h1>
              <p className="text-xs text-muted-foreground font-arabic mt-0.5">30 مايو 2026 — بيانات لحظية لجميع محافظات سوريا</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleShare}
                className={cn(
                  "flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold border transition-all",
                  copied
                    ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-400"
                    : "glass-card border-white/[0.10] text-muted-foreground hover:text-foreground hover:bg-white/[0.06]"
                )}
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Share2 className="w-3.5 h-3.5" />}
                {copied ? "تم النسخ" : "مشاركة التقرير"}
              </button>
              <ProvinceSelector current={province} onSelect={handleSelect} />
            </div>
          </motion.div>

          {/* Row 1: Active governorate detail + calibrated map */}
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-4">
            <AnimatePresence mode="wait">
              <motion.div
                key={`${province.id}-${selectedDayIdx ?? "live"}`}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.35, ease: EASE }}
              >
                <HeroPulse province={province} overrideDay={activeForecast} onClearDay={() => setSelectedDayIdx(null)} />
              </motion.div>
            </AnimatePresence>
            <WeatherMapPanel province={province} extremeIds={extremeIds} mapLayer={mapLayer}
              onLayerChange={setMapLayer} onProvinceSelect={handleSelect} forecast={provinceForecast} />
          </div>

          {/* Row 2: 7-Day Forecast */}
          <ForecastTimeline forecast={provinceForecast} selectedIdx={selectedDayIdx} onSelect={setSelectedDayIdx} />

          {/* Row 3: Intelligence Grid + Field Link */}
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-4">
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-emerald-400" />
                <span className="text-sm font-bold text-foreground">شبكة المؤشرات الجوية</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {metricCards.map((card,i) => <MetricCard key={card.label} {...card} index={i} />)}
              </div>
              <motion.div className="glass-card rounded-2xl px-5 py-4 flex items-center justify-between flex-wrap gap-3"
                custom={5} variants={fadeUp} initial="hidden" animate="visible">
                <div className="text-xs text-muted-foreground font-arabic">
                  <span className="text-emerald-400 font-bold">{province.nameAr}</span> — {province.region}
                </div>
                <div className="flex items-center gap-4 text-xs">
                  {[
                    { label:"إشعاع", val:province.solarRadiation,          unit:"W/m²",                         color:"text-amber-400" },
                    { label:"هطول",  val:`${province.precipitation}%`,     unit:"احتمال",                        color:"text-sky-400"   },
                    { label:"UV",    val:province.uvIndex,                  unit:getUVLabel(province.uvIndex),    color:"text-yellow-400"},
                  ].map((item,i) => (
                    <div key={i} className="flex items-center gap-2">
                      {i>0 && <div className="w-px h-8 bg-white/[0.07]"/>}
                      <div className="text-center">
                        <p className="text-muted-foreground text-[10px]">{item.label}</p>
                        <p className={cn("font-bold font-numeric", item.color)}>{item.val}</p>
                        <p className="text-[9px] text-muted-foreground/50">{item.unit}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            </div>
            <motion.div initial={{ opacity:0,x:12 }} animate={{ opacity:1,x:0 }} transition={{ duration:0.5,ease:EASE,delay:0.25 }}>
              <FieldWeatherLink province={province} hyperlocalArea={hyperlocalArea} />
            </motion.div>
          </div>

          {/* Row 4: Risk Center + Climate Context */}
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-4">
            <RiskCenter forecast={provinceForecast} province={province} />
            <ClimateContext />
          </div>

          {/* Row 5: Irrigation Command + Crop Impact */}
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-4">
            <IrrigationCommand province={province} overrideDay={activeForecast} forecast={provinceForecast} />
            <CropImpactAnalyzer province={province} overrideDay={activeForecast} />
          </div>

          {/* Row 6: Pathogen Warning (full width) */}
          <PathogenWarning province={province} overrideDay={activeForecast} />

          {/* Row 7: Agent Activity Hub */}
          <AgentActivityHub province={province} />

          {/* Row 8: Field Activity Planner + Seasonal Insights */}
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-4">
            <FieldActivityPlanner province={province} forecast={provinceForecast} />
            <SeasonalInsights province={province} />
          </div>

          {/* Row 9: Weather Copilot */}
          <WeatherCopilot province={province} />

          {/* Row 10: Province quick-scan */}
          <motion.div className="glass-card rounded-2xl p-4" custom={9} variants={fadeUp} initial="hidden" animate="visible" dir="rtl">
            <p className="text-xs font-bold text-foreground mb-3 flex items-center gap-2">
              <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
              مسح سريع — كل المحافظات
            </p>
            <div className="flex gap-2 flex-wrap">
              {PROVINCES.map(p => (
                <button key={p.id} onClick={() => { setProvince(p); setSelectedDayIdx(null); }}
                  className={cn("flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs transition-colors border",
                    p.id===province.id ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400 font-bold"
                    : p.isExtreme ? "bg-red-500/8 border-red-500/20 text-red-400/80 hover:bg-red-500/12"
                    : "bg-white/[0.03] border-white/[0.07] text-muted-foreground hover:bg-white/[0.06] hover:text-foreground")}>
                  <span className="font-arabic">{p.nameAr}</span>
                  <span className="font-numeric">{p.temp}°</span>
                  {p.isExtreme && <AlertTriangle className="w-2.5 h-2.5" />}
                </button>
              ))}
            </div>
          </motion.div>

          {/* Spacer — last card always fully visible */}
          <div className="h-20" aria-hidden="true" />

        </div>
      </div>
    </WorkspaceLayout>
  );
}
