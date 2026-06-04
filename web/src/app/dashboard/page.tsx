"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import {
  Bot, Flame, Wind, Droplets, Sprout, MapPin,
  TrendingUp, AlertTriangle, CheckCircle2, Info,
  Activity, Zap, ChevronLeft, Search, Plus,
  BarChart3, LayoutGrid, Leaf, BadgeCheck,
  Clock, ChevronRight, Layers, CloudOff,
  X, Sparkles,
} from "lucide-react";
import { PROVINCES } from "@/lib/weather";
import { PROVINCES as GEO_PROVINCES, VIEW_BOX } from "@/components/workspace/SyriaMap";
import { WorkspaceLayout } from "@/components/workspace/WorkspaceLayout";
import { AgentChat }       from "@/components/workspace/AgentChat";
import {
  buildDashboard, loadFarmContext, getAIIntegratedBriefing, applyRiskScore,
  type DashboardData, type AlertSeverity, type AmbientMood, type AIBriefing,
} from "@/lib/dashboard-engine";
import { buildContextFromStorage } from "@/lib/ai-service";
import { cn } from "@/lib/utils";
import { PageGuide } from "@/components/ui/PageGuide";
import { InfoTip } from "@/components/ui/InfoTip";

type Bezier = [number, number, number, number];
const EASE: Bezier = [0.22, 1, 0.36, 1];

const fadeUp = {
  hidden:  { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { duration: 0.45, ease: EASE, delay: i * 0.09 },
  }),
};

/* ─── Greeting ───────────────────────────────────────────────────────── */
function greeting(): string {
  const h = new Date().getHours();
  if (h >= 4  && h < 9)  return "صباح الخير";
  if (h >= 9  && h < 12) return "أهلاً";
  if (h >= 12 && h < 17) return "مساء الخير";
  if (h >= 17 && h < 21) return "مساء النور";
  return "ليلة طيبة";
}

/* ─── Typewriter hook ────────────────────────────────────────────────── */
function useTypewriter(text: string, speed = 28): string {
  const [shown, setShown] = useState("");
  useEffect(() => {
    setShown("");
    let i = 0;
    const id = setInterval(() => {
      if (i < text.length) { setShown(text.slice(0, ++i)); }
      else clearInterval(id);
    }, speed);
    return () => clearInterval(id);
  }, [text]);
  return shown;
}

/* ─── Ambient background ─────────────────────────────────────────────── */
function AmbientBg({ mood }: { mood: AmbientMood }) {
  const orbs: Record<AmbientMood, [string, string]> = {
    normal:    ["oklch(0.70 0.14 70 / 10%)",  "oklch(0.55 0.17 162 / 9%)"],
    heatwave:  ["oklch(0.65 0.18 45 / 14%)",  "oklch(0.60 0.14 28 / 10%)"],
    sandstorm: ["oklch(0.58 0.12 55 / 14%)",  "oklch(0.50 0.10 40 / 10%)"],
    rainy:     ["oklch(0.28 0.06 230 / 14%)", "oklch(0.25 0.07 210 / 10%)"],
  };
  const [o1, o2] = orbs[mood];
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 0 }}>
      <motion.div key={mood} className="absolute inset-0"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        transition={{ duration: 1.6, ease: EASE }}
        style={{ background: mood === "heatwave"
          ? "radial-gradient(ellipse 120% 70% at 65% 5%, oklch(0.55 0.12 55 / 16%) 0%, transparent 60%)"
          : "radial-gradient(ellipse 100% 60% at 70% 10%, oklch(0.55 0.12 70 / 12%) 0%, transparent 55%)" }}
      />
      <motion.div className="absolute -top-40 -right-40 w-[min(700px,80vw)] h-[min(700px,80vw)] rounded-full blur-3xl"
        style={{ background: o1 }}
        animate={{ scale: [1, 1.07, 1], opacity: [0.7, 1, 0.7] }}
        transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }} />
      <motion.div className="absolute -bottom-40 -left-28 w-[min(500px,70vw)] h-[min(500px,70vw)] rounded-full blur-3xl"
        style={{ background: o2 }}
        animate={{ scale: [1, 1.05, 1], opacity: [0.5, 0.85, 0.5] }}
        transition={{ duration: 9, repeat: Infinity, ease: "easeInOut", delay: 2 }} />
    </div>
  );
}

/* ─── Health Gauge (SVG semi-circle) ────────────────────────────────── */
function HealthGauge({ health }: { health: DashboardData["health"] }) {
  const R  = 72;
  const cx = 100;
  const cy = 92;
  const semiLen = Math.PI * R; // arc length of semi-circle

  const dashOffset = semiLen * (1 - health.total / 100);
  const trackPath  = `M ${cx - R} ${cy} A ${R} ${R} 0 1 0 ${cx + R} ${cy}`;

  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 200 105" className="w-full max-w-[220px]" aria-label={`صحة المزرعة: ${health.total}%`}>
        {/* Glow filter */}
        <defs>
          <filter id="gauge-glow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>
        {/* Track */}
        <path d={trackPath} fill="none"
          stroke="rgba(255,255,255,0.07)" strokeWidth="10" strokeLinecap="round" />
        {/* Fill arc */}
        {health.total > 0 && (
          <motion.path
            d={trackPath}
            fill="none"
            stroke={health.hex}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={`${semiLen} ${semiLen}`}
            initial={{ strokeDashoffset: semiLen }}
            animate={{ strokeDashoffset: dashOffset }}
            transition={{ duration: 1.6, ease: EASE, delay: 0.3 }}
            filter="url(#gauge-glow)"
          />
        )}
        {/* Score text */}
        <text x={cx} y={cy - 12} textAnchor="middle" fontSize="30"
          fontWeight="900" fill="white" fontFamily="var(--font-inter)">{health.total}</text>
        <text x={cx} y={cy + 6} textAnchor="middle" fontSize="11"
          fill="rgba(255,255,255,0.45)" fontFamily="var(--font-cairo)">/ 100</text>
        <text x={cx} y={cy + 22} textAnchor="middle" fontSize="11"
          fontWeight="700" fill={health.hex} fontFamily="var(--font-cairo)">{health.label}</text>
      </svg>

      {/* Sub-score breakdown */}
      <div className="grid grid-cols-3 gap-2 w-full mt-2 max-w-[220px]">
        {[
          { label: "مناخ",  val: health.weather,    max: 40, color: "bg-sky-400"     },
          { label: "محصول", val: health.crop,        max: 30, color: "bg-amber-400"   },
          { label: "ري",    val: health.irrigation,  max: 30, color: "bg-emerald-400" },
        ].map(s => (
          <div key={s.label} className="flex flex-col items-center gap-1">
            <div className="w-full h-1 rounded-full bg-white/[0.07] overflow-hidden">
              <motion.div className={cn("h-full rounded-full", s.color)}
                initial={{ width: "0%" }}
                animate={{ width: `${(s.val / s.max) * 100}%` }}
                transition={{ duration: 1, ease: EASE, delay: 0.5 }} />
            </div>
            <span className="text-[9px] text-muted-foreground/60 font-arabic">{s.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── AI Briefing Card ───────────────────────────────────────────────── */
function BriefingCard({ data, onAskAI, loading = false, offline = false }: { data: DashboardData; onAskAI: () => void; loading?: boolean; offline?: boolean }) {
  const typeText = useTypewriter(loading ? "" : data.briefingLine, 26);

  const sevIcon: Record<AlertSeverity, React.ElementType> = {
    critical: Flame, warning: AlertTriangle, info: Info, opportunity: CheckCircle2,
  };
  const sevColor: Record<AlertSeverity, string> = {
    critical: "text-red-400", warning: "text-amber-400", info: "text-sky-400", opportunity: "text-emerald-400",
  };
  const sevBg: Record<AlertSeverity, string> = {
    critical: "bg-red-500/8 border-red-500/20", warning: "bg-amber-500/8 border-amber-500/20",
    info: "bg-sky-500/8 border-sky-500/20", opportunity: "bg-emerald-500/8 border-emerald-500/20",
  };
  const typeLabel: Record<string, string> = { weather: "مناخ", action: "عمل", market: "سوق" };

  return (
    <div className="glass-card rounded-3xl p-5 md:p-6 flex flex-col gap-4" dir="rtl">
      {/* Agent header */}
      <div className="flex items-center gap-3">
        <div className="relative">
          <div className={cn("w-11 h-11 rounded-2xl border flex items-center justify-center",
            offline ? "bg-amber-500/15 border-amber-500/30" : "bg-emerald-500/15 border-emerald-500/30")}>
            <Bot className={cn("w-5 h-5", offline ? "text-amber-400" : "text-emerald-400")} />
          </div>
          <motion.div className={cn("absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-background",
            offline ? "bg-amber-400" : "bg-emerald-400")}
            animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1.4, repeat: Infinity }} />
        </div>
        <div>
          <p className="text-sm font-bold text-foreground">وكيل الذكاء الزراعي</p>
          <p className="text-[10px] text-muted-foreground font-arabic">إحاطة يومية — 30 مايو 2026</p>
        </div>
        {offline && (
          <span className="flex items-center gap-1.5 rounded-xl bg-amber-500/10 border border-amber-500/25 px-2.5 py-1 text-[10px] font-arabic text-amber-400/90"
            title="تعذّر الوصول إلى محرك الذكاء — يتم عرض إحاطة محلية محسوبة من بيانات الطقس والحقول">
            <CloudOff className="w-3 h-3" />
            إحاطة دون اتصال
          </span>
        )}
        <button onClick={onAskAI}
          className="mr-auto flex items-center gap-1.5 text-[10px] text-emerald-400/70 hover:text-emerald-400 border border-emerald-500/20 hover:border-emerald-500/40 rounded-xl px-3 py-1.5 transition-all">
          <ChevronLeft className="w-3 h-3" />
          اسأل الوكيل
        </button>
      </div>

      {/* Typewriter main line / loading state */}
      <div className="rounded-2xl bg-white/[0.03] border border-white/[0.07] px-4 py-3 min-h-[54px]">
        {loading ? (
          <div className="flex items-center gap-2.5">
            <motion.div className="w-1.5 h-1.5 rounded-full bg-emerald-400"
              animate={{ opacity: [1, 0.2, 1], scale: [1, 1.3, 1] }} transition={{ duration: 1.1, repeat: Infinity }} />
            <span className="text-sm font-semibold text-emerald-400/80 font-arabic">
              جاري تحليل بيانات الحقول والطقس بالذكاء الاصطناعي...
            </span>
          </div>
        ) : (
          <p className="text-sm font-semibold text-foreground/90 leading-relaxed font-arabic">
            {typeText}
            <motion.span className="inline-block w-0.5 h-4 bg-emerald-400 mr-0.5 align-middle"
              animate={{ opacity: [1, 0, 1] }} transition={{ duration: 0.8, repeat: Infinity }} />
          </p>
        )}
      </div>

      {/* 3 insights — skeleton while AI thinks */}
      {loading ? (
        <div className="space-y-2.5">
          {[0, 1, 2].map((i) => (
            <div key={i} className="rounded-2xl p-3.5 border border-white/[0.06] bg-white/[0.02] flex items-start gap-3">
              <motion.div className="w-7 h-7 rounded-xl bg-emerald-500/10 flex-shrink-0"
                animate={{ opacity: [0.4, 0.8, 0.4] }} transition={{ duration: 1.4, repeat: Infinity, delay: i * 0.2 }} />
              <div className="flex-1 space-y-2 pt-0.5">
                <motion.div className="h-2.5 rounded bg-white/[0.06] w-2/5"
                  animate={{ opacity: [0.4, 0.8, 0.4] }} transition={{ duration: 1.4, repeat: Infinity, delay: i * 0.2 }} />
                <motion.div className="h-2 rounded bg-white/[0.05] w-4/5"
                  animate={{ opacity: [0.4, 0.8, 0.4] }} transition={{ duration: 1.4, repeat: Infinity, delay: i * 0.2 + 0.1 }} />
              </div>
            </div>
          ))}
        </div>
      ) : (
      <div className="space-y-2.5">
        {data.insights.map((ins, i) => {
          const Icon = sevIcon[ins.severity];
          return (
            <motion.div key={i} custom={i + 3} variants={fadeUp} initial="hidden" animate="visible"
              className={cn("rounded-2xl p-3.5 border flex items-start gap-3", sevBg[ins.severity])}>
              <div className="flex flex-col items-center gap-1 flex-shrink-0 mt-0.5">
                <motion.div className={cn("w-7 h-7 rounded-xl border flex items-center justify-center",
                  ins.severity === "critical" ? "bg-red-500/15 border-red-500/25"
                  : ins.severity === "warning" ? "bg-amber-500/15 border-amber-500/25"
                  : ins.severity === "opportunity" ? "bg-emerald-500/15 border-emerald-500/25"
                  : "bg-sky-500/15 border-sky-500/25")}
                  animate={ins.severity === "critical" ? { scale: [1, 1.08, 1] } : {}}
                  transition={{ duration: 2, repeat: Infinity }}>
                  <Icon className={cn("w-3.5 h-3.5", sevColor[ins.severity])} />
                </motion.div>
                <span className="text-[8px] text-muted-foreground/50 font-arabic">{typeLabel[ins.type]}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className={cn("text-[11px] font-bold mb-1", sevColor[ins.severity])}>{ins.title}</p>
                <p className="text-[11px] text-foreground/75 leading-relaxed font-arabic">{ins.body}</p>
              </div>
            </motion.div>
          );
        })}
      </div>
      )}
    </div>
  );
}

/* ─── Alerts Ribbon ──────────────────────────────────────────────────── */
function AlertsRibbon({ alerts }: { alerts: DashboardData["alerts"] }) {
  const sevDot: Record<AlertSeverity, string> = {
    critical: "bg-red-400", warning: "bg-amber-400", info: "bg-sky-400", opportunity: "bg-emerald-400",
  };
  const sevText: Record<AlertSeverity, string> = {
    critical: "text-red-400", warning: "text-amber-400", info: "text-sky-400", opportunity: "text-emerald-400",
  };
  const sevBorder: Record<AlertSeverity, string> = {
    critical: "border-red-500/25", warning: "border-amber-500/20", info: "border-sky-500/15", opportunity: "border-emerald-500/15",
  };

  return (
    <motion.div custom={1} variants={fadeUp} initial="hidden" animate="visible" dir="rtl">
      <div className="flex items-center gap-2 mb-2 px-1">
        <motion.div className="w-1.5 h-1.5 rounded-full bg-red-400"
          animate={{ opacity: [1, 0.2, 1] }} transition={{ duration: 1.2, repeat: Infinity }} />
        <span className="text-[11px] font-bold text-muted-foreground/70 tracking-wide">شريط التنبيهات الحية</span>
      </div>
      <div className="flex gap-2.5 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
        {alerts.map((alert, i) => (
          <div key={i}
            className={cn("flex-shrink-0 glass-card rounded-2xl px-3.5 py-2.5 flex items-start gap-2.5 min-w-[240px] max-w-[280px] border", sevBorder[alert.severity])}>
            <motion.div className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5", sevDot[alert.severity])}
              animate={alert.severity === "critical" ? { opacity: [1, 0.2, 1] } : {}}
              transition={{ duration: 1.4, repeat: Infinity }} />
            <div className="min-w-0">
              <p className={cn("text-[9px] font-bold mb-0.5", sevText[alert.severity])}>{alert.agent}</p>
              <p className="text-[11px] text-foreground/80 font-arabic leading-snug">{alert.text}</p>
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

/* ─── Quick Actions ──────────────────────────────────────────────────── */
function QuickActions({ onAskAI }: { onAskAI: () => void }) {
  const actions = [
    { label: "افحص مرض", icon: Search,    href: "/copilot",           onClick: undefined  },
    { label: "اسأل الوكيل", icon: Bot,    href: undefined,            onClick: onAskAI    },
    { label: "أضف محصول", icon: Sprout,   href: "/crops",             onClick: undefined  },
    { label: "سجل حقل",  icon: MapPin,    href: "/fields",            onClick: undefined  },
    { label: "تقرير السوق",icon: BarChart3,href: "/dashboard/market",  onClick: undefined  },
  ];

  return (
    <motion.div custom={2} variants={fadeUp} initial="hidden" animate="visible" dir="rtl">
      <div className="flex gap-2.5 flex-wrap justify-center md:justify-start">
        {actions.map((a, i) => {
          const inner = (
            <motion.div
              whileHover={{ scale: 1.04, y: -2 }}
              whileTap={{ scale: 0.96 }}
              className="flex items-center gap-2 glass-card rounded-2xl px-4 py-2.5 border border-white/[0.08] hover:border-emerald-500/30 hover:bg-emerald-500/6 transition-all cursor-pointer group"
            >
              <a.icon className="w-4 h-4 text-muted-foreground group-hover:text-emerald-400 transition-colors flex-shrink-0" />
              <span className="text-xs font-semibold text-foreground/80 group-hover:text-foreground transition-colors font-arabic whitespace-nowrap">{a.label}</span>
            </motion.div>
          );
          return a.href
            ? <Link key={i} href={a.href}>{inner}</Link>
            : <button key={i} onClick={a.onClick}>{inner}</button>;
        })}
      </div>
    </motion.div>
  );
}

/* ─── Priority Trio ──────────────────────────────────────────────────── */
function PriorityTrio({ insights }: { insights: DashboardData["insights"] }) {
  const icons = [Flame, Activity, TrendingUp];
  const accents = [
    "text-red-400 bg-red-500/10 border-red-500/20",
    "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
    "text-sky-400 bg-sky-500/10 border-sky-500/20",
  ];
  const nums = ["1", "2", "3"];

  return (
    <motion.div custom={3} variants={fadeUp} initial="hidden" animate="visible" dir="rtl">
      <div className="flex items-center gap-2 mb-3">
        <BadgeCheck className="w-4 h-4 text-emerald-400" />
        <span className="text-sm font-bold text-foreground">الأولويات الثلاث لليوم</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {insights.map((ins, i) => {
          const Icon = icons[i];
          return (
            <motion.div key={i}
              className="glass-card rounded-2xl p-4 flex items-start gap-3"
              whileHover={{ y: -3 }}
              transition={{ type:"spring", stiffness:100, damping:20 }}
            >
              <div className={cn("w-8 h-8 rounded-xl border flex items-center justify-center flex-shrink-0", accents[i])}>
                <span className="text-xs font-black font-numeric">{nums[i]}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Icon className={cn("w-3.5 h-3.5 flex-shrink-0", i === 0 ? "text-red-400" : i === 1 ? "text-emerald-400" : "text-sky-400")} />
                  <p className="text-xs font-bold text-foreground truncate font-arabic">{ins.title}</p>
                </div>
                <p className="text-[11px] text-muted-foreground font-arabic leading-relaxed">{ins.priority}</p>
              </div>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}

/* ─── Farm Stats Strip ───────────────────────────────────────────────── */
function FarmStats({ data }: { data: DashboardData }) {
  const p = data.province;
  const stats = [
    { icon: MapPin,    label: "المحافظة",    value: p.nameAr,          color: "text-emerald-400" },
    { icon: Leaf,      label: "المحصول",     value: data.cropNameAr ?? "غير محدد", color: "text-amber-400" },
    { icon: Droplets,  label: "الرطوبة",     value: `${p.humidity}%`,  color: "text-sky-400"     },
    { icon: Wind,      label: "الرياح",      value: `${p.windSpeed} كم/س`, color: "text-cyan-400" },
    { icon: Zap,       label: "UV",          value: String(p.uvIndex), color: "text-yellow-400"  },
    { icon: Activity,  label: "AQI",         value: String(p.airQualityIndex), color: p.airQualityIndex > 100 ? "text-red-400" : "text-emerald-400" },
  ];

  return (
    <motion.div custom={4} variants={fadeUp} initial="hidden" animate="visible" dir="rtl"
      className="glass-card rounded-2xl px-4 py-3 flex items-center gap-4 flex-wrap overflow-x-auto"
      style={{ scrollbarWidth: "none" }}>
      {stats.map((s, i) => (
        <div key={i} className="flex items-center gap-2 flex-shrink-0">
          {i > 0 && <div className="w-px h-6 bg-white/[0.07]" />}
          <s.icon className={cn("w-3.5 h-3.5", s.color)} />
          <div>
            <p className="text-[9px] text-muted-foreground/60 font-arabic leading-none mb-0.5">{s.label}</p>
            <p className={cn("text-xs font-bold font-arabic", s.color)}>{s.value}</p>
          </div>
        </div>
      ))}
    </motion.div>
  );
}

/* ─── Geo dot positions (same coordinate system as weather page) ─────── */
/* ─── Task defaults per crop ─────────────────────────────────────────── */
function getDailyTasks(cropKey: string | null): string[] {
  const base = ["فحص نظام الري والتحقق من الضغط", "مراجعة تقرير الطقس لليوم", "تسجيل ملاحظات الحقل"];
  const extra: Record<string, string[]> = {
    wheat:    ["مراقبة نضج السنابل", "تجهيز آلات الحصاد"],
    barley:   ["فحص رطوبة الحبوب",  "تجهيز خطة الحصاد"],
    olive:    ["فحص ذبابة الزيتون", "مراقبة مرحلة الإزهار"],
    tomato:   ["فحص دعائم المحاصيل","التسميد الأسبوعي"],
    cotton:   ["فحص تقرير الآفات",  "ري مكثف فجراً"],
    potato:   ["فحص رطوبة التربة",  "مراقبة التسميد"],
    grapes:   ["فحص درجة السكر",    "مراقبة حبوب الكرمة"],
    lentils:  ["مراقبة نضج القرون", "تجهيز مخازن الحبوب"],
    chickpeas:["فحص حالة التربة",   "مراقبة الإزهار"],
  };
  return [...base, ...(extra[cropKey ?? ""] ?? ["فحص التربة والرطوبة", "مراجعة أسعار السوق"])];
}

/* ─── Sparkline data per crop ────────────────────────────────────────── */
function getSparkData(cropKey: string | null): number[] {
  const d: Record<string, number[]> = {
    wheat:    [44,45,46,45,47,48,47,49,50,52],
    barley:   [32,33,32,34,35,34,36,35,37,38],
    cotton:   [58,57,59,60,59,61,62,61,63,64],
    olive:    [85,84,86,85,87,86,88,87,89,90],
    tomato:   [18,17,16,17,15,16,14,15,13,12],
    potato:   [22,21,22,23,22,21,22,21,22,21],
    grapes:   [35,36,35,37,36,38,37,39,38,40],
    lentils:  [54,55,54,56,55,57,56,58,57,59],
    chickpeas:[62,63,62,64,63,65,64,66,65,67],
  };
  return d[cropKey ?? ""] ?? [48,47,49,48,50,49,51,50,52,53];
}

/* ─── Live Field Radar ───────────────────────────────────────────────── */
interface StoredField { id?: number|string; name?: string; province?: string; crop?: string; area?: number; }

function LiveFieldRadar({ province }: { province: import("@/lib/weather").ProvinceWeather }) {
  const [fields, setFields] = useState<StoredField[]>([]);
  useEffect(() => {
    try { const r=localStorage.getItem("agro_fields"); if(r) setFields(JSON.parse(r)); } catch {}
  }, []);

  const shown = fields.slice(0, 3);

  function soilMoisture(seed: number): number {
    const base = province.humidity * 0.55;
    const rain  = province.precipitation > 10 ? 16 : province.precipitation > 3 ? 8 : 0;
    const jit   = (seed % 7) * 4 - 12;
    return Math.round(Math.max(14, Math.min(92, base + rain + jit)));
  }
  function fieldHealth(seed: number): number {
    let h = 72;
    if (province.isExtreme) h -= 22;
    else if (province.temp > 32) h -= 10;
    return Math.round(Math.max(18, Math.min(96, h + (seed % 5) * 5)));
  }
  function lastAction(seed: number): string {
    const h = [2,3,4,6,8,12][seed % 6];
    return h === 2 ? "تم الري منذ ساعتين" : `تم الري منذ ${h} ساعات`;
  }
  function cropColor(crop?: string): string {
    if (!crop) return "text-emerald-400";
    const c = crop.toLowerCase();
    if (c.includes("قمح")||c.includes("wheat"))  return "text-amber-400";
    if (c.includes("زيتون")||c.includes("olive")) return "text-green-400";
    if (c.includes("طماطم")||c.includes("tomato"))return "text-red-400";
    if (c.includes("قطن")||c.includes("cotton"))  return "text-sky-400";
    return "text-emerald-400";
  }

  const healthBar = (pct: number) => (
    <div className="h-1.5 rounded-full bg-white/[0.07] overflow-hidden">
      <motion.div
        className={cn("h-full rounded-full", pct >= 70 ? "bg-emerald-400" : pct >= 45 ? "bg-amber-400" : "bg-red-400")}
        initial={{ width: "0%" }} animate={{ width: `${pct}%` }}
        transition={{ duration: 0.9, ease: EASE, delay: 0.2 }} />
    </div>
  );

  return (
    <motion.div className="glass-card rounded-3xl p-5 flex flex-col gap-4"
      custom={6} variants={fadeUp} initial="hidden" animate="visible" dir="rtl">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-xl bg-emerald-500/12 border border-emerald-500/20 flex items-center justify-center">
          <Layers className="w-4 h-4 text-emerald-400" />
        </div>
        <div>
          <p className="text-sm font-bold text-foreground">رادار الحقول النشطة</p>
          <p className="text-[10px] text-muted-foreground font-arabic">مراقبة فورية — {province.nameAr}</p>
        </div>
      </div>

      {shown.length === 0 ? (
        <div className="rounded-2xl bg-white/[0.02] border border-dashed border-white/[0.09] p-6 flex flex-col items-center gap-3">
          <MapPin className="w-8 h-8 text-muted-foreground/25" />
          <p className="text-xs text-muted-foreground/50 font-arabic text-center">لا توجد حقول مسجلة بعد</p>
          <Link href="/fields">
            <motion.div whileHover={{ scale:1.04 }} whileTap={{ scale:0.96 }}
              className="flex items-center gap-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/25 px-3 py-1.5 text-xs text-emerald-400 font-semibold">
              <Plus className="w-3.5 h-3.5" />أضف حقلك الأول
            </motion.div>
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {shown.map((f, i) => {
            const seed   = typeof f.id === "number" ? f.id : i + 1;
            const health = fieldHealth(seed);
            const moist  = soilMoisture(seed);
            return (
              <Link key={i} href="/fields">
                <motion.div whileHover={{ x: -3 }}
                  className="rounded-2xl bg-white/[0.04] border border-white/[0.07] hover:border-emerald-500/25 p-3.5 flex items-start gap-3 transition-colors cursor-pointer group">
                  <div className="w-8 h-8 rounded-xl bg-white/[0.05] flex items-center justify-center flex-shrink-0">
                    <Leaf className={cn("w-4 h-4", cropColor(f.crop))} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1.5">
                      <p className="text-xs font-bold text-foreground font-arabic truncate">{f.name ?? `حقل ${i+1}`}</p>
                      <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/40 group-hover:text-emerald-400 transition-colors flex-shrink-0" />
                    </div>
                    {f.crop && <p className="text-[10px] text-muted-foreground/60 font-arabic mb-2">{f.crop}</p>}
                    {healthBar(health)}
                    <div className="flex items-center justify-between mt-2 text-[9px] text-muted-foreground/50">
                      <span className="flex items-center gap-1">
                        <Droplets className="w-3 h-3 text-sky-400/70" />
                        رطوبة التربة <span className="font-numeric text-sky-400/80 mr-0.5">{moist}%</span>
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />{lastAction(seed)}
                      </span>
                    </div>
                  </div>
                </motion.div>
              </Link>
            );
          })}
          {fields.length > 3 && (
            <Link href="/fields">
              <p className="text-[10px] text-emerald-400/60 hover:text-emerald-400 text-center transition-colors">
                + {fields.length - 3} حقول أخرى — عرض الكل
              </p>
            </Link>
          )}
        </div>
      )}
    </motion.div>
  );
}

/* ─── Workday Planner ────────────────────────────────────────────────── */
function WorkdayPlanner({ cropKey, cropNameAr, aiTasks }: { cropKey: string|null; cropNameAr: string|null; aiTasks?: string[] }) {
  const tasks = aiTasks && aiTasks.length > 0 ? aiTasks : getDailyTasks(cropKey);
  const isAI  = !!(aiTasks && aiTasks.length > 0);
  const [done, setDone] = useState<boolean[]>(() => tasks.map(() => false));
  // Reset checkboxes when the task set changes (e.g. AI tasks arrive)
  useEffect(() => { setDone(tasks.map(() => false)); }, [tasks.join("|")]); // eslint-disable-line react-hooks/exhaustive-deps

  const sparkData = getSparkData(cropKey);
  const min  = Math.min(...sparkData);
  const max  = Math.max(...sparkData);
  const span = max - min || 1;
  const trend = sparkData[sparkData.length - 1] - sparkData[0];
  const trendColor = trend >= 0 ? "#10b981" : "#ef4444";
  const sparkW = 200;
  const sparkH = 55;
  const pts = sparkData.map((v, i) =>
    `${(i / (sparkData.length-1)) * sparkW},${sparkH - ((v-min)/span) * (sparkH-10) - 5}`
  ).join(" ");
  const areaPath = `M 0,${sparkH} L ${pts.replace(/(\d+\.?\d*),(\d+\.?\d*)/g, (_,x,y) => `${x},${y}`)} L ${sparkW},${sparkH} Z`;

  return (
    <motion.div className="glass-card rounded-3xl p-5 flex flex-col gap-4"
      custom={7} variants={fadeUp} initial="hidden" animate="visible" dir="rtl">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-xl bg-amber-500/12 border border-amber-500/20 flex items-center justify-center">
          <CheckCircle2 className="w-4 h-4 text-amber-400" />
        </div>
        <div>
          <p className="text-sm font-bold text-foreground">مخطط العمل اليومي</p>
          <p className="text-[10px] text-muted-foreground font-arabic">
            السبت 30 مايو 2026{isAI && " — مولّد بالذكاء"}
          </p>
        </div>
        {isAI && (
          <span className="text-[8px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-1.5 py-0.5 font-arabic">AI</span>
        )}
        <span className="mr-auto text-[9px] text-muted-foreground/50 font-numeric">
          {done.filter(Boolean).length}/{tasks.length}
        </span>
      </div>

      {/* Task checklist */}
      <div className="space-y-2">
        {tasks.map((task, i) => (
          <motion.button key={i} onClick={() => setDone(prev => { const n=[...prev]; n[i]=!n[i]; return n; })}
            className="w-full flex items-center gap-2.5 text-right group" dir="rtl">
            <motion.div
              className={cn("w-4.5 h-4.5 rounded-md border flex items-center justify-center flex-shrink-0 transition-all",
                done[i] ? "bg-emerald-500/25 border-emerald-500/50" : "border-white/[0.15] group-hover:border-emerald-500/30")}
              whileTap={{ scale: 0.85 }}>
              {done[i] && <CheckCircle2 className="w-3 h-3 text-emerald-400" />}
            </motion.div>
            <span className={cn("text-xs font-arabic leading-relaxed text-right",
              done[i] ? "line-through text-muted-foreground/40" : "text-foreground/80")}>
              {task}
            </span>
          </motion.button>
        ))}
      </div>

      {/* Crop price sparkline */}
      <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] text-muted-foreground font-arabic">
            سعر {cropNameAr ?? "المحصول"} — 10 أيام
          </span>
          <span className={cn("text-[10px] font-bold font-numeric", trend >= 0 ? "text-emerald-400" : "text-red-400")}>
            {trend >= 0 ? "+" : ""}{trend.toFixed(0)} ₺
          </span>
        </div>
        <svg viewBox={`0 0 ${sparkW} ${sparkH}`} className="w-full" preserveAspectRatio="none">
          <defs>
            <linearGradient id="spark-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={trendColor} stopOpacity="0.18" />
              <stop offset="100%" stopColor={trendColor} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={areaPath} fill="url(#spark-fill)" />
          <motion.polyline points={pts} fill="none" stroke={trendColor} strokeWidth="1.5"
            initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
            transition={{ duration: 1.2, ease: EASE }} />
          {/* Last point dot */}
          <circle
            cx={(sparkData.length-1)/(sparkData.length-1)*sparkW}
            cy={sparkH - ((sparkData[sparkData.length-1]-min)/span)*(sparkH-10) - 5}
            r="2.5" fill={trendColor} />
        </svg>
      </div>
    </motion.div>
  );
}

/* ─── Agent Activity Stream ──────────────────────────────────────────── */
interface LogEntry { id: number; agent: string; color: string; msg: string; ago: number; }

function AgentActivityStream({
  province, cropNameAr,
}: { province: import("@/lib/weather").ProvinceWeather; cropNameAr: string|null }) {
  const pool = [
    { agent:"وكيل السوق",  color:"text-purple-400", msg:`يتم تحليل أسعار ${cropNameAr ?? "القمح"} في سوق الهال...`              },
    { agent:"وكيل المناخ", color:"text-sky-400",    msg:`رصد منخفض جوي قادم من المتوسط نحو ${province.region}`                    },
    { agent:"وكيل الآفات", color:"text-orange-400", msg:`تحديث احتمالية الصدأ الأصفر لمنطقة ${province.nameAr}...`               },
    { agent:"وكيل الري",   color:"text-blue-400",   msg:`حساب جدول ري ${province.nameAr} — ET₀ ${province.temp > 32 ? "مرتفع" : "طبيعي"}` },
    { agent:"وكيل الحقول", color:"text-emerald-400",msg:`مراجعة بيانات الحقول في ${province.region}...`                          },
    { agent:"وكيل السوق",  color:"text-purple-400", msg:`أسعار ${cropNameAr ?? "الشعير"} مستقرة — لا إشارة للبيع الفوري`         },
    { agent:"وكيل المناخ", color:"text-sky-400",    msg:`تحليل اتجاهات الحرارة — ${province.temp}°م أعلى من المتوسط`            },
    { agent:"وكيل الآفات", color:"text-orange-400", msg:`فحص العنكبوت الأحمر: ${province.humidity < 40 ? "خطر محتمل" : "ضمن المعدل"}` },
  ];

  const makeEntry = (poolIdx: number, ago: number): LogEntry => ({
    id: Date.now() + Math.random(),
    ...pool[poolIdx % pool.length],
    ago,
  });

  const [log, setLog] = useState<LogEntry[]>(() =>
    [0,1,2].map(i => makeEntry(i, (i+1)*45))
  );
  const poolRef = useRef(3);

  useEffect(() => {
    const id = setInterval(() => {
      setLog(prev => [
        makeEntry(poolRef.current, 0),
        ...prev.map(e => ({ ...e, ago: e.ago + 35 })).slice(0, 5),
      ]);
      poolRef.current++;
    }, 3500);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [province.id]);

  function agoLabel(sec: number): string {
    if (sec < 10) return "الآن";
    if (sec < 60) return `${sec} ث`;
    return `${Math.round(sec/60)} د`;
  }

  return (
    <motion.div className="glass-card rounded-3xl p-5 flex flex-col gap-4"
      custom={8} variants={fadeUp} initial="hidden" animate="visible" dir="rtl">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-xl bg-sky-500/12 border border-sky-500/20 flex items-center justify-center">
          <Activity className="w-4 h-4 text-sky-400" />
        </div>
        <div>
          <p className="text-sm font-bold text-foreground">سجل نشاط الوكلاء</p>
          <p className="text-[10px] text-muted-foreground font-arabic">تحديث مستمر</p>
        </div>
        <motion.div className="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-auto"
          animate={{ opacity:[1,0.2,1] }} transition={{ duration:1.2, repeat:Infinity }} />
      </div>

      <div className="space-y-0 overflow-hidden">
        <AnimatePresence initial={false}>
          {log.map(entry => (
            <motion.div key={entry.id}
              initial={{ opacity:0, height:0, y:-12 }}
              animate={{ opacity:1, height:"auto", y:0 }}
              exit={{ opacity:0, height:0 }}
              transition={{ duration:0.3, ease:EASE }}
              className="flex items-start gap-2.5 py-2.5 border-b border-white/[0.04] last:border-0">
              <motion.div className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0 mt-1.5"
                animate={{ opacity:[1,0.3,1] }} transition={{ duration:1.4, repeat:Infinity, delay:Math.random()*1 }}/>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-0.5">
                  <span className={cn("text-[9px] font-bold", entry.color)}>{entry.agent}</span>
                  <span className="text-[9px] text-muted-foreground/40 font-numeric flex-shrink-0">{agoLabel(entry.ago)}</span>
                </div>
                <p className="text-[10px] text-foreground/65 font-arabic leading-relaxed">{entry.msg}</p>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

/* ─── Geographic Risk Map (calibrated, interactive) ──────────────────── */
// Accurate governorate geometry, keyed by Arabic name → cx/cy/path.
const GEO_BY_NAME = new Map(GEO_PROVINCES.map(g => [g.name, g]));

interface ProvinceAlert { label: string; sev: "high" | "med" }

function provinceAlerts(p: import("@/lib/weather").ProvinceWeather): ProvinceAlert[] {
  const a: ProvinceAlert[] = [];
  if (p.isExtreme) a.push({ label: "طقس متطرف", sev: "high" });
  if (p.uvIndex >= 10) a.push({ label: "أشعة فوق بنفسجية مرتفعة", sev: "med" });
  if (p.airQualityIndex > 100) a.push({ label: "جودة هواء منخفضة", sev: "med" });
  if (p.precipitation === 0 && p.humidity < 25) a.push({ label: "إجهاد جفاف", sev: "med" });
  return a;
}

function GeoRiskMap({ selectedId }: { selectedId: string }) {
  const extremeIds = PROVINCES.filter(p => p.isExtreme).map(p => p.id);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  const active = activeId ? PROVINCES.find(p => p.id === activeId) ?? null : null;
  const alerts = active ? provinceAlerts(active) : [];

  return (
    <motion.div className="glass-card rounded-3xl p-4 flex flex-col gap-3"
      custom={9} variants={fadeUp} initial="hidden" animate="visible" dir="rtl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-purple-500/12 border border-purple-500/20 flex items-center justify-center">
            <MapPin className="w-4 h-4 text-purple-400" />
          </div>
          <div>
            <p className="text-sm font-bold text-foreground flex items-center gap-1">
              مخطط المخاطر الجغرافي
              <InfoTip label="مخطط المخاطر" text="خريطة سوريا بحدود المحافظات الحقيقية، ملوّنة حسب درجة الخطر. اضغط محافظة لرؤية إنذاراتها النشطة وتقييم وكيل المناخ." />
            </p>
            <p className="text-[10px] text-muted-foreground font-arabic">اضغط على أي محافظة لعرض التفاصيل</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-[9px] text-muted-foreground/50">
          <motion.div className="w-1.5 h-1.5 rounded-full bg-emerald-400"
            animate={{ opacity:[1,0.2,1] }} transition={{ duration:1.2, repeat:Infinity }}/>
          مباشر
        </div>
      </div>

      <div className="relative rounded-2xl overflow-hidden bg-white/[0.02] border border-white/[0.06]" style={{ height:"260px" }}>
        <svg viewBox={VIEW_BOX} className="w-full h-full" preserveAspectRatio="xMidYMid meet">
          {/* Governorate regions — real borders, coloured by risk */}
          {PROVINCES.map((p) => {
            const geo = GEO_BY_NAME.get(p.nameAr);
            if (!geo) return null;
            const isSel = p.id === selectedId;
            const isAct = p.id === activeId;
            const isExt = extremeIds.includes(p.id);
            const isHov = p.id === hoverId;
            const fill = isExt
              ? "oklch(0.62 0.22 28)"
              : isSel
                ? "oklch(0.696 0.170 162)"
                : "oklch(0.55 0.09 158)";
            const opacity = isAct ? 0.85 : isHov ? 0.6 : isExt ? 0.42 : isSel ? 0.4 : 0.16;
            return (
              <path
                key={p.id}
                className="geo-region"
                d={geo.path}
                fill={fill}
                fillOpacity={opacity}
                stroke={isAct ? "white" : "oklch(0.696 0.170 162 / 35%)"}
                strokeWidth={isAct ? 0.03 : 0.012}
                onClick={() => setActiveId(p.id)}
                onMouseEnter={() => setHoverId(p.id)}
                onMouseLeave={() => setHoverId(null)}
              >
                <title>{p.nameAr}</title>
              </path>
            );
          })}

          {/* Centroid markers + pulses */}
          {PROVINCES.map((p) => {
            const geo = GEO_BY_NAME.get(p.nameAr);
            if (!geo) return null;
            const isSel = p.id === selectedId;
            const isExt = extremeIds.includes(p.id);
            return (
              <g key={`dot-${p.id}`} className="pointer-events-none">
                {isSel && (
                  <motion.circle cx={geo.cx} cy={geo.cy} r={0.22}
                    fill="none" stroke="oklch(0.696 0.170 162 / 60%)" strokeWidth="0.045"
                    initial={{ r:0.12, opacity:1 }} animate={{ r:0.40, opacity:0 }}
                    transition={{ duration:1.6, repeat:Infinity, ease:"easeOut" }}/>
                )}
                {isExt && (
                  <motion.circle cx={geo.cx} cy={geo.cy} r={0.16}
                    fill="none" stroke="oklch(0.65 0.22 28 / 70%)" strokeWidth="0.04"
                    animate={{ opacity:[0.35,1,0.35] }} transition={{ duration:1.8, repeat:Infinity }}/>
                )}
                <circle className="geo-dot" cx={geo.cx} cy={geo.cy}
                  r={isSel ? 0.10 : 0.07}
                  fill={isSel ? "oklch(0.85 0.16 162)" : isExt ? "oklch(0.72 0.20 28)" : "oklch(0.80 0.05 155 / 80%)"}/>
              </g>
            );
          })}
        </svg>

        {/* Focus badge */}
        <div className="absolute top-3 right-3 flex items-center gap-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/25 px-2.5 py-1.5 pointer-events-none">
          <motion.div className="w-1.5 h-1.5 rounded-full bg-emerald-400"
            animate={{ opacity:[1,0.2,1] }} transition={{ duration:1.2, repeat:Infinity }}/>
          <span className="text-[9px] text-emerald-400 font-bold font-arabic">
            {PROVINCES.find(p => p.id === selectedId)?.nameAr ?? "سوريا"}
          </span>
        </div>

        {/* ── Glassmorphic detail drawer (bottom-sheet, responsive) ── */}
        <AnimatePresence>
          {active && (
            <>
              <motion.button
                aria-label="إغلاق"
                className="absolute inset-0 bg-black/30 backdrop-blur-[1px]"
                initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
                onClick={() => setActiveId(null)}
              />
              <motion.div
                key={active.id}
                className="absolute inset-x-2 bottom-2 glass-card rounded-2xl p-4 emerald-glow-sm"
                initial={{ y:"110%", opacity:0 }} animate={{ y:0, opacity:1 }} exit={{ y:"110%", opacity:0 }}
                transition={{ type:"spring", stiffness:380, damping:34 }}
                dir="rtl"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center border",
                      active.isExtreme ? "bg-red-500/12 border-red-500/25" : "bg-emerald-500/12 border-emerald-500/25")}>
                      <MapPin className={cn("w-4 h-4", active.isExtreme ? "text-red-400" : "text-emerald-400")} />
                    </div>
                    <div>
                      <p className="text-sm font-black text-foreground leading-none">{active.nameAr}</p>
                      <p className="text-[10px] text-muted-foreground font-arabic mt-1">{active.region}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-end">
                      <p className="text-lg font-black font-numeric leading-none text-foreground">{active.temp}°</p>
                      <p className="text-[9px] text-muted-foreground font-arabic mt-0.5">{active.condition}</p>
                    </div>
                    <button onClick={() => setActiveId(null)}
                      className="w-7 h-7 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.08] flex items-center justify-center transition-colors">
                      <ChevronRight className="w-4 h-4 text-muted-foreground rotate-90" />
                    </button>
                  </div>
                </div>

                {/* Active alerts */}
                <div className="flex items-center flex-wrap gap-1.5 mt-3">
                  <span className={cn("inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-bold font-arabic border",
                    alerts.length ? "bg-amber-500/12 border-amber-500/25 text-amber-300" : "bg-emerald-500/12 border-emerald-500/25 text-emerald-300")}>
                    <AlertTriangle className="w-3 h-3" />
                    {alerts.length ? `${alerts.length} إنذار نشط` : "لا إنذارات"}
                  </span>
                  {alerts.map(a => (
                    <span key={a.label}
                      className={cn("rounded-lg px-2 py-1 text-[9px] font-arabic border",
                        a.sev === "high" ? "bg-red-500/10 border-red-500/22 text-red-300" : "bg-amber-500/10 border-amber-500/22 text-amber-300/90")}>
                      {a.label}
                    </span>
                  ))}
                </div>

                {/* Weather agent risk evaluation */}
                <div className="mt-3 rounded-xl bg-emerald-500/[0.06] border border-emerald-500/15 p-2.5">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Bot className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-[10px] font-bold text-emerald-400 font-arabic">تقييم وكيل المناخ</span>
                  </div>
                  <p className="text-[11px] text-foreground/85 leading-relaxed font-arabic">{active.aiSummary}</p>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-[9px] text-muted-foreground/55 px-1">
        <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-400 inline-block"/>محافظتك</div>
        <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-400 inline-block"/>طقس متطرف ({extremeIds.length})</div>
        <div className="flex items-center gap-1.5 mr-auto"><span className="w-2 h-2 rounded-full bg-white/25 inline-block"/>عادي</div>
      </div>
    </motion.div>
  );
}

/* ─── Market Trend Card ──────────────────────────────────────────────── */
function MarketTrendCard({ cropKey, cropNameAr, province }: {
  cropKey: string|null; cropNameAr: string|null;
  province: import("@/lib/weather").ProvinceWeather;
}) {
  const data   = getSparkData(cropKey);
  const min    = Math.min(...data);
  const max    = Math.max(...data);
  const span   = max - min || 1;
  const trend  = data[data.length-1] - data[0];
  const tColor = trend >= 0 ? "#10b981" : "#ef4444";
  const W = 220, H = 60;
  const pts = data.map((v,i) => `${(i/(data.length-1))*W},${H-((v-min)/span)*(H-12)-6}`).join(" ");
  const area = `M 0,${H} ${data.map((v,i) => `L ${(i/(data.length-1))*W},${H-((v-min)/span)*(H-12)-6}`).join(" ")} L ${W},${H} Z`;

  const basePrice = data[data.length-1];
  const prevPrice = data[0];
  const pctChange = (((basePrice - prevPrice) / prevPrice) * 100).toFixed(1);

  return (
    <motion.div className="glass-card rounded-3xl p-5 flex flex-col gap-4"
      custom={11} variants={fadeUp} initial="hidden" animate="visible" dir="rtl">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-xl bg-purple-500/12 border border-purple-500/20 flex items-center justify-center">
          <TrendingUp className="w-4 h-4 text-purple-400" />
        </div>
        <div>
          <p className="text-sm font-bold text-foreground">اتجاه السوق</p>
          <p className="text-[10px] text-muted-foreground font-arabic">{cropNameAr ?? "المحاصيل"} — {province.nameAr}</p>
        </div>
        <span className={cn("mr-auto text-xs font-bold font-numeric", trend >= 0 ? "text-emerald-400" : "text-red-400")}>
          {trend >= 0 ? "+" : ""}{pctChange}%
        </span>
      </div>

      {/* Sparkline */}
      <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-3">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="none" style={{ height: "56px" }}>
          <defs>
            <linearGradient id="mkt-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={tColor} stopOpacity="0.20" />
              <stop offset="100%" stopColor={tColor} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={area} fill="url(#mkt-fill)" />
          <motion.polyline points={pts} fill="none" stroke={tColor} strokeWidth="1.8"
            initial={{ pathLength:0 }} animate={{ pathLength:1 }}
            transition={{ duration:1.2, ease:EASE }} />
          <circle
            cx={(data.length-1)/(data.length-1)*W}
            cy={H - ((data[data.length-1]-min)/span)*(H-12) - 6}
            r="3" fill={tColor}/>
        </svg>
        <div className="flex items-center justify-between mt-1.5 text-[9px] text-muted-foreground/50 font-arabic">
          <span>10 أيام مضت</span><span>اليوم</span>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-2 text-center">
        {[
          { label:"السعر الآن", val:`${basePrice}`, unit:"₺/طن",  color:"text-foreground"   },
          { label:"قبل أسبوع", val:`${prevPrice}`,  unit:"₺/طن",  color:"text-muted-foreground/70" },
          { label:"التغيير",   val:`${trend >= 0 ? "+" : ""}${pctChange}%`, unit:"", color: trend >= 0 ? "text-emerald-400" : "text-red-400" },
        ].map(s => (
          <div key={s.label} className="rounded-xl bg-white/[0.03] border border-white/[0.06] py-2.5 px-2">
            <p className={cn("text-sm font-black font-numeric leading-none", s.color)}>{s.val}</p>
            <p className="text-[8px] text-muted-foreground/50 mt-1 font-arabic">{s.unit || s.label}</p>
          </div>
        ))}
      </div>

      <Link href="/dashboard/market">
        <motion.div whileHover={{ x:-3 }}
          className="flex items-center justify-between rounded-xl bg-purple-500/8 border border-purple-500/18 px-3 py-2 cursor-pointer group">
          <span className="text-[11px] text-purple-400/80 font-arabic group-hover:text-purple-400 transition-colors">تقرير السوق الكامل</span>
          <ChevronRight className="w-3.5 h-3.5 text-purple-400/50 group-hover:text-purple-400 transition-colors" />
        </motion.div>
      </Link>
    </motion.div>
  );
}

/* ─── Quick Actions Card (bento version) ─────────────────────────────── */
function QuickActionsCard({ onAskAI }: { onAskAI: () => void }) {
  const actions = [
    { label:"افحص مرض",    icon:Search,    href:"/copilot",          onClick:undefined as (() => void) | undefined },
    { label:"اسأل الوكيل", icon:Bot,       href:undefined as string|undefined, onClick:onAskAI },
    { label:"أضف محصول",  icon:Sprout,    href:"/crops",            onClick:undefined },
    { label:"سجل حقل",    icon:MapPin,    href:"/fields",           onClick:undefined },
    { label:"تقرير السوق", icon:BarChart3, href:"/dashboard/market", onClick:undefined },
  ];

  return (
    <motion.div className="glass-card rounded-3xl p-5 flex flex-col gap-3"
      custom={12} variants={fadeUp} initial="hidden" animate="visible" dir="rtl">
      <div className="flex items-center gap-2 mb-1">
        <div className="w-8 h-8 rounded-xl bg-emerald-500/12 border border-emerald-500/20 flex items-center justify-center">
          <Zap className="w-4 h-4 text-emerald-400" />
        </div>
        <div>
          <p className="text-sm font-bold text-foreground">إجراءات سريعة</p>
          <p className="text-[10px] text-muted-foreground font-arabic">وصول مباشر</p>
        </div>
      </div>
      <div className="space-y-2">
        {actions.map((a, i) => {
          const inner = (
            <motion.div
              whileHover={{ x:-3 }}
              transition={{ type:"spring", stiffness:100, damping:20 }}
              className="flex items-center gap-3 rounded-2xl px-3 py-2.5 hover:bg-emerald-500/8 hover:border-emerald-500/25 border border-transparent transition-colors group cursor-pointer"
            >
              <div className="w-7 h-7 rounded-xl bg-white/[0.05] flex items-center justify-center flex-shrink-0">
                <a.icon className="w-3.5 h-3.5 text-muted-foreground group-hover:text-emerald-400 transition-colors" />
              </div>
              <span className="text-xs font-semibold text-foreground/75 group-hover:text-foreground transition-colors font-arabic">{a.label}</span>
              <ChevronRight className="w-3 h-3 text-muted-foreground/25 group-hover:text-emerald-400/60 transition-colors mr-auto" />
            </motion.div>
          );
          return a.href
            ? <Link key={i} href={a.href}>{inner}</Link>
            : <button key={i} onClick={a.onClick} className="w-full text-right">{inner}</button>;
        })}
      </div>
    </motion.div>
  );
}

/* ─── Main dashboard content ─────────────────────────────────────────── */
/* ─── Onboarding Welcome Banner (intent clarity) ─────────────────────── */
function OnboardingBanner({ onAskAI }: { onAskAI: () => void }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    try { setShow(localStorage.getItem("agro-onboard-v1") !== "1"); } catch { setShow(true); }
  }, []);
  const dismiss = () => {
    try { localStorage.setItem("agro-onboard-v1", "1"); } catch { /* ignore */ }
    setShow(false);
  };

  const suggestions = ["كيف أروي القمح في درعا؟", "حلّل تربة حمضية", "متى أزرع الشعير؟"];

  return (
    <AnimatePresence initial={false}>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: -8, height: 0 }}
          animate={{ opacity: 1, y: 0, height: "auto" }}
          exit={{ opacity: 0, y: -8, height: 0 }}
          transition={{ duration: 0.4, ease: EASE }}
          className="relative overflow-hidden glass-card rounded-3xl p-5 sm:p-6 emerald-glow-sm"
        >
          <div className="absolute inset-0 bg-forest-mesh opacity-40 pointer-events-none" />
          <button onClick={dismiss} aria-label="إغلاق الترحيب"
            className="absolute top-3 left-3 w-7 h-7 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.08] flex items-center justify-center transition-colors z-10">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>

          <div className="relative flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/12 border border-emerald-500/25 flex items-center justify-center flex-shrink-0">
              <Sparkles className="w-6 h-6 text-emerald-400" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-base sm:text-lg font-black text-foreground leading-tight">
                أهلاً بك في منصّة <span className="text-emerald-gradient">أغرو-سيريا</span> الذكية
              </h2>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1 font-arabic leading-relaxed">
                وكلاؤنا البرمجيون جاهزون لتحليل أرضك — اسأل عن الري أو التربة أو السوق، وسيتعاون فريق
                الوكلاء ليعطيك جواباً واضحاً بلهجتك.
              </p>

              {/* Helper suggestion chips — guide the user's first intent */}
              <div className="flex flex-wrap items-center gap-2 mt-3">
                <span className="text-[10px] text-muted-foreground/60 font-arabic">جرّب أن تسأل:</span>
                {suggestions.map(s => (
                  <button key={s} onClick={onAskAI}
                    className="inline-flex items-center gap-1 rounded-full bg-emerald-500/[0.08] hover:bg-emerald-500/[0.16] border border-emerald-500/20 px-3 py-1.5 text-[11px] text-emerald-200 font-arabic transition-all duration-200">
                    <Bot className="w-3 h-3 text-emerald-400/80" />
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <button onClick={onAskAI}
              className="flex-shrink-0 inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 text-emerald-950 hover:bg-emerald-400 px-4 py-2.5 text-sm font-bold font-arabic transition-all duration-200 emerald-glow-sm">
              <Bot className="w-4 h-4" />
              ابدأ المحادثة
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function IntelligenceDashboard({ onAskAI }: { onAskAI: () => void }) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [cropKey, setCropKey] = useState<string | null>(null);
  const [aiBriefing, setAiBriefing] = useState<AIBriefing | null>(null);
  const [aiLoading, setAiLoading] = useState(true);

  useEffect(() => {
    const ctx = loadFarmContext();
    setData(buildDashboard(ctx));
    setCropKey(ctx.cropKey);

    // Session cache keyed by province+crop: fetch the AI briefing once per session, and
    // refresh automatically only when the province or crop changes (key miss). This satisfies
    // the "once per session / on context change" rule and avoids redundant Gemini calls.
    const aiCtx = buildContextFromStorage();
    const cacheKey = `agro_ai_briefing:${aiCtx.province ?? "-"}|${aiCtx.crop ?? "-"}`;

    let cancelled = false;
    try {
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        setAiBriefing(JSON.parse(cached) as AIBriefing);
        setAiLoading(false);
        return;
      }
    } catch { /* no/blocked sessionStorage → fall through to a fresh fetch */ }

    // Cache miss → ask Gemini; graceful fallback to deterministic logic on any failure
    setAiLoading(true);
    getAIIntegratedBriefing(aiCtx)
      .then((briefing) => {
        if (cancelled) return;
        setAiBriefing(briefing);
        // Only cache real successes — never cache the null/offline fallback
        if (briefing) {
          try { sessionStorage.setItem(cacheKey, JSON.stringify(briefing)); } catch {}
        }
      })
      .catch(() => { if (!cancelled) setAiBriefing(null); })
      .finally(() => { if (!cancelled) setAiLoading(false); });
    return () => { cancelled = true; };
  }, []);

  // Merge AI output over the deterministic baseline (AI wins when present)
  const effective = useMemo<DashboardData | null>(() => {
    if (!data) return null;
    if (!aiBriefing) return data;

    // Insights: keep deterministic type/severity (drive colors), override text from AI
    const mergedInsights = data.insights.map((det, i) => {
      const ai = aiBriefing.insights[i];
      return ai
        ? { ...det, title: ai.title, body: ai.body, priority: ai.priority }
        : det;
    }) as DashboardData["insights"];

    // Alert: prepend the AI's critical alert
    const mergedAlerts = aiBriefing.alert
      ? [{ severity: "critical" as AlertSeverity, agent: "وكيل الذكاء", text: aiBriefing.alert.text }, ...data.alerts].slice(0, 5)
      : data.alerts;

    return {
      ...data,
      briefingLine: aiBriefing.briefingLine || data.briefingLine,
      insights:     mergedInsights,
      alerts:       mergedAlerts,
      health:       aiBriefing.riskScore != null ? applyRiskScore(data.health, aiBriefing.riskScore) : data.health,
    };
  }, [data, aiBriefing]);

  if (!data || !effective) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <motion.div animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 1.5, repeat: Infinity }}>
          <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
            <Bot className="w-4 h-4 text-emerald-400" />
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <>
      <AmbientBg mood={data.ambient} />

      <div className="relative z-10 min-h-[100dvh] h-auto" dir="rtl">
        <div className="max-w-6xl mx-auto px-4 pt-6 pb-40 space-y-5">

          {/* ── Header ── */}
          <motion.div className="flex items-start justify-between gap-3 flex-wrap"
            initial={{ opacity:0, y:-10 }} animate={{ opacity:1, y:0 }}
            transition={{ duration:0.4, ease:EASE }}>
            {/* Left: greeting + sub */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <LayoutGrid className="w-3.5 h-3.5 text-emerald-400/60" />
                <span className="text-[10px] text-muted-foreground/50 uppercase tracking-widest">مركز التحكم الزراعي</span>
              </div>
              <h1 className="text-xl md:text-2xl font-black text-foreground tracking-tight leading-tight">
                {greeting()}،{" "}
                {data.cropNameAr
                  ? <span className="text-emerald-gradient">كيف حال محصول {data.cropNameAr}؟</span>
                  : <span className="text-emerald-gradient">{data.province.nameAr}</span>}
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5 font-arabic">
                السبت 30 مايو 2026 — {data.province.nameAr}
              </p>
              <PageGuide
                summary="مركز قيادتك الزراعي — كل ما يخص مزرعتك في شاشة واحدة."
                services={["إحاطة المناخ الذكية", "خريطة المخاطر", "مؤشر صحة المزرعة", "اتجاه السوق", "إجراءات سريعة"]}
              />
            </div>

            {/* Right: Health badge + Command palette + Extreme alert */}
            <div className="flex items-center gap-2 flex-shrink-0 flex-wrap justify-end">
              {/* Health score mini-badge */}
              <div className={cn("flex items-center gap-2 rounded-2xl px-3 py-2 border glass-card", effective.health.glowClass)}>
                <Activity className="w-3.5 h-3.5 text-muted-foreground/60" />
                <span className="text-xs text-muted-foreground/70 font-arabic">صحة المزرعة</span>
                <span className="text-sm font-black font-numeric" style={{ color: effective.health.hex }}>{effective.health.total}</span>
                <span className="text-[10px] font-bold font-arabic" style={{ color: effective.health.hex }}>{effective.health.label}</span>
              </div>

              {/* Command palette placeholder */}
              <motion.button
                whileHover={{ scale:1.03 }} whileTap={{ scale:0.97 }}
                className="flex items-center gap-2 glass-card rounded-2xl px-3 py-2 border border-white/[0.08] hover:border-emerald-500/25 transition-all group"
                title="البحث السريع"
              >
                <Search className="w-3.5 h-3.5 text-muted-foreground/60 group-hover:text-emerald-400 transition-colors" />
                <span className="text-xs text-muted-foreground/50 font-arabic hidden sm:inline">البحث السريع</span>
                <kbd className="text-[9px] text-muted-foreground/30 border border-white/[0.08] rounded px-1 hidden sm:inline">⌘K</kbd>
              </motion.button>

              {data.province.isExtreme && (
                <motion.div className="flex items-center gap-2 rounded-2xl bg-red-500/10 border border-red-500/25 px-3 py-2"
                  animate={{ opacity:[0.7,1,0.7] }} transition={{ duration:2, repeat:Infinity }}>
                  <Flame className="w-3.5 h-3.5 text-red-400" />
                  <span className="text-xs font-bold text-red-400 hidden sm:inline">إنذار متطرف</span>
                </motion.div>
              )}
            </div>
          </motion.div>

          {/* ── Onboarding Welcome Banner (intent clarity) ── */}
          <OnboardingBanner onAskAI={onAskAI} />

          {/* ── Alerts Ribbon ── */}
          <AlertsRibbon alerts={effective.alerts} />

          {/* ════════════════════════════════════════════════
              MAIN BENTO GRID  —  3 columns on desktop
              Row 1:  Field Radar (1)   |  AI Briefing (2)
              Row 2:  Geo Map (2)       |  Agent Stream (1)
              Row 3:  Workday (1)  |  Market (1)  |  Actions (1)
          ════════════════════════════════════════════════ */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

            {/* ── Row 1: AI Briefing (2) + Field Radar (1) ── */}
            <div className="lg:col-span-2">
              <BriefingCard data={effective} onAskAI={onAskAI} loading={aiLoading} offline={!aiLoading && !aiBriefing} />
            </div>
            <div className="lg:col-span-1">
              <LiveFieldRadar province={data.province} />
            </div>

            {/* ── Row 2: Geo Map + Agent Stream ── */}
            <div className="lg:col-span-2">
              <GeoRiskMap selectedId={data.province.id} />
            </div>
            <div className="lg:col-span-1">
              <AgentActivityStream province={data.province} cropNameAr={data.cropNameAr} />
            </div>

            {/* ── Row 3: Workday + Market + Quick Actions ── */}
            <WorkdayPlanner cropKey={cropKey} cropNameAr={data.cropNameAr} aiTasks={aiBriefing?.tasks} />
            <MarketTrendCard cropKey={cropKey} cropNameAr={data.cropNameAr} province={data.province} />
            <QuickActionsCard onAskAI={onAskAI} />

          </div>

          {/* ── Health Score + Priority Trio ── */}
          <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-4 items-start">
            <motion.div custom={0} variants={fadeUp} initial="hidden" animate="visible"
              className={cn("glass-card rounded-3xl p-5 flex flex-col items-center gap-3", effective.health.glowClass)}>
              <div className="flex items-center gap-2 self-start">
                <Activity className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-[11px] font-bold text-muted-foreground/70">صحة المزرعة</span>
              </div>
              <HealthGauge health={effective.health} />
              <p className="text-[10px] text-muted-foreground/50 text-center font-arabic">
                {data.cropNameAr ? `محصول ${data.cropNameAr} • ${data.province.nameAr}` : data.province.nameAr}
              </p>
            </motion.div>
            <PriorityTrio insights={effective.insights} />
          </div>

          {/* ── Farm Stats ── */}
          <FarmStats data={data} />

          {/* ── Module Navigation ── */}
          <motion.div custom={5} variants={fadeUp} initial="hidden" animate="visible" dir="rtl">
            <div className="flex items-center gap-2 mb-3">
              <LayoutGrid className="w-4 h-4 text-muted-foreground/40" />
              <span className="text-xs font-bold text-muted-foreground/55">الوحدات</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label:"حقولي",   sub:"خريطة الحقول",       icon:MapPin,    href:"/fields",           color:"text-emerald-400", bg:"bg-emerald-500/8 border-emerald-500/18" },
                { label:"محاصيلي", sub:"موسوعة المحاصيل",    icon:Sprout,    href:"/crops",            color:"text-amber-400",   bg:"bg-amber-500/8 border-amber-500/18"   },
                { label:"الطقس",   sub:"ذكاء المناخ الزراعي",icon:Wind,      href:"/weather",          color:"text-sky-400",     bg:"bg-sky-500/8 border-sky-500/18"       },
                { label:"السوق",   sub:"أسعار المحاصيل",     icon:BarChart3, href:"/dashboard/market", color:"text-purple-400",  bg:"bg-purple-500/8 border-purple-500/18" },
              ].map(m => (
                <Link key={m.href} href={m.href}>
                  <motion.div
                    whileHover={{ y:-3 }} whileTap={{ scale:0.97 }}
                    transition={{ type:"spring", stiffness:100, damping:20 }}
                    className={cn("glass-card rounded-2xl p-4 border flex items-center gap-3 cursor-pointer group transition-all hover:border-white/[0.15]", m.bg)}>
                    <div className="w-9 h-9 rounded-xl bg-white/[0.05] flex items-center justify-center flex-shrink-0">
                      <m.icon className={cn("w-4 h-4", m.color)} />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-foreground font-arabic">{m.label}</p>
                      <p className="text-[9px] text-muted-foreground/60 font-arabic">{m.sub}</p>
                    </div>
                  </motion.div>
                </Link>
              ))}
            </div>
          </motion.div>

          <div className="h-8" aria-hidden="true" />
        </div>
      </div>
    </>
  );
}

/* ─── Page root ──────────────────────────────────────────────────────── */
export default function DashboardPage() {
  const [activeView, setActiveView] = useState<"dashboard" | "assistant">("dashboard");

  return (
    <WorkspaceLayout activeView={activeView} onNavigate={v => setActiveView(v as "dashboard" | "assistant")}>
      <AnimatePresence mode="wait">
        {activeView === "assistant" ? (
          <motion.div key="chat" className="flex-1 flex flex-col"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}>
            <AgentChat />
          </motion.div>
        ) : (
          <motion.div key="dashboard" className="flex-1 flex flex-col"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}>
            <IntelligenceDashboard onAskAI={() => setActiveView("assistant")} />
          </motion.div>
        )}
      </AnimatePresence>
    </WorkspaceLayout>
  );
}
