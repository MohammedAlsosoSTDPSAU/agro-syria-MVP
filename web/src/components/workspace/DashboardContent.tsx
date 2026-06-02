"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence, LayoutGroup } from "framer-motion";
import Link from "next/link";
import {
  CloudSun, Wind, Droplets, TrendingUp, MessageSquare, Gauge,
  AlertTriangle, Sprout, Plus, Bot, BarChart3, ChevronDown,
  Check, Sun, Moon, Bug, Flame,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { fetchSoilData } from "@/lib/api";
import { MarketTicker } from "./MarketTicker";
import { AgroBrainCalc } from "./AgroBrainCalc";
import { ExpertMeeting, type CityKey } from "./ExpertMeeting";
import { GreenReportModal } from "./GreenReportModal";

/* ─── Types & animation constants ─────────────────────────────────── */
type Bezier = [number, number, number, number];
const EASE: Bezier = [0.22, 1, 0.36, 1];

const gridVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.12, delayChildren: 0.2 } },
};
const cardVariants = {
  hidden:   { opacity: 0, y: 28 },
  visible:  { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE } },
};

/* ─── City data ────────────────────────────────────────────────────── */
const CITIES: Record<CityKey, { name: string; temp: number; condition: string; wind: number; humidity: number; insight: string }> = {
  damascus: { name: "دمشق",       temp: 29, condition: "مشمس",        wind: 14, humidity: 42, insight: "نافذة رش مثالية: 6ص-9ص بسبب رياح هادئة وجو معتدل." },
  aleppo:   { name: "حلب",        temp: 27, condition: "غيام جزئياً", wind: 18, humidity: 55, insight: "رياح متوسطة — أجّل الرش حتى المساء لتجنب الانجراف." },
  latakia:  { name: "اللاذقية",   temp: 24, condition: "ضبابي",        wind: 8,  humidity: 76, insight: "رطوبة ساحلية عالية — قلل الري 20٪ لتوفير المياه." },
  homs:     { name: "حمص",        temp: 31, condition: "مشمس حار",    wind: 12, humidity: 35, insight: "درجات مرتفعة — زد معدل الري 30٪ في الساعات الأولى." },
  deir:     { name: "دير الزور", temp: 38, condition: "حار جداً",     wind: 22, humidity: 18, insight: "تحذير حرارة — تجنب العمل الحقلي بين 11ص-4م فوراً." },
};
const CITY_KEYS = Object.keys(CITIES) as CityKey[];

/* ─── Time-of-day theming ──────────────────────────────────────────── */
function getTimePeriod(): "dawn" | "day" | "dusk" | "night" {
  const h = new Date().getHours();
  if (h >= 5  && h < 7)  return "dawn";
  if (h >= 7  && h < 18) return "day";
  if (h >= 18 && h < 21) return "dusk";
  return "night";
}

const TIME_CFG = {
  dawn:  { label: "فجر",  Icon: Sun,  grd: "from-purple-900/35 via-orange-900/15 to-transparent", clr: "text-orange-300" },
  day:   { label: "نهار", Icon: Sun,  grd: "from-sky-900/35    via-sky-800/15    to-transparent", clr: "text-sky-300"    },
  dusk:  { label: "غروب", Icon: Sun,  grd: "from-orange-900/35 via-red-900/15    to-transparent", clr: "text-orange-400" },
  night: { label: "ليل",  Icon: Moon, grd: "from-indigo-900/35 via-slate-900/15  to-transparent", clr: "text-indigo-300" },
} as const;

/* ─── Alert Ticker (multi-agent) ──────────────────────────────────── */
const TICKER_ALERTS = [
  { agent: "وكيل الطقس",  agentCls: "text-sky-400",     text: "موجة حر في حلب الأربعاء — تجنب الرش فوق 37°م" },
  { agent: "وكيل الآفات", agentCls: "text-orange-400",  text: "دودة القطن رُصدت في الرقة — راجع التوصيات فوراً" },
  { agent: "وكيل الطقس",  agentCls: "text-sky-400",     text: "برودة ليلية في حماة دون 10°م — احمِ الشتلات" },
  { agent: "وكيل السوق",  agentCls: "text-emerald-400", text: "ارتفاع سعر القمح 7٪ هذا الأسبوع — فرصة تسويق جيدة" },
  { agent: "وكيل الطقس",  agentCls: "text-sky-400",     text: "جفاف: منسوب المياه الجوفية في دير الزور انخفض 35٪" },
];

function AlertTicker() {
  const doubled = [...TICKER_ALERTS, ...TICKER_ALERTS];
  return (
    <div className="flex-shrink-0 overflow-hidden h-8 bg-amber-500/6 border-b border-amber-500/12 flex items-center" dir="rtl">
      <span className="text-[10px] font-bold text-amber-400 bg-amber-500/15 px-3 h-full flex items-center flex-shrink-0 border-s border-amber-500/20 whitespace-nowrap">
        تنبيهات
      </span>
      <div className="overflow-hidden flex-1">
        <motion.div
          className="flex gap-8 whitespace-nowrap ps-4"
          animate={{ x: ["0%", "-50%"] }}
          transition={{ duration: 42, repeat: Infinity, ease: "linear" }}
        >
          {doubled.map((a, i) => (
            <span key={i} className="text-[11px] text-amber-300/80 py-1.5 inline-flex items-center gap-1.5">
              <span className={`text-[9px] font-bold ${a.agentCls} opacity-90`}>[{a.agent}]</span>
              {a.text}
            </span>
          ))}
        </motion.div>
      </div>
    </div>
  );
}

/* ─── City Switcher ────────────────────────────────────────────────── */
function CitySwitcher({ city, onChange }: { city: CityKey; onChange: (c: CityKey) => void }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl glass-card border border-white/[0.08] text-sm font-semibold text-foreground hover:border-emerald-500/30 transition-all"
      >
        <span>{CITIES[city].name}</span>
        <ChevronDown className={cn("w-3.5 h-3.5 text-muted-foreground transition-transform duration-200", open && "rotate-180")} />
      </button>
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              className="fixed inset-0 z-10"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
            />
            <motion.div
              className="absolute start-0 top-full mt-1.5 z-20 glass-card rounded-xl border border-white/[0.08] overflow-hidden shadow-lg"
              style={{ minWidth: 140 }}
              initial={{ opacity: 0, y: -6, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -6, scale: 0.96 }}
              transition={{ duration: 0.14 }}
            >
              {CITY_KEYS.map((key) => (
                <button
                  key={key}
                  onClick={() => { onChange(key); setOpen(false); }}
                  className={cn(
                    "w-full flex items-center justify-between gap-3 px-3 py-2 text-sm transition-colors",
                    city === key ? "text-emerald-400 bg-emerald-500/10" : "text-foreground hover:bg-white/[0.05]"
                  )}
                  dir="rtl"
                >
                  <span>{CITIES[key].name}</span>
                  {city === key && <Check className="w-3.5 h-3.5" />}
                </button>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─── Quick Actions ────────────────────────────────────────────────── */
function QuickActions({ onAskAI, onReport }: { onAskAI?: () => void; onReport?: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5, duration: 0.35 }}
      className="flex gap-2 mb-5 flex-wrap" dir="rtl"
    >
      <Link href="/fields?add=1" className="flex items-center gap-2 px-4 py-2 rounded-xl glass-card text-[12px] font-semibold text-emerald-400 border border-emerald-500/25 hover:border-emerald-500/50 hover:bg-emerald-500/8 transition-all">
        <Plus className="w-3.5 h-3.5" /> إضافة حقل
      </Link>
      <button onClick={onAskAI} className="flex items-center gap-2 px-4 py-2 rounded-xl glass-card text-[12px] font-semibold text-sky-400 border border-sky-500/20 hover:border-sky-500/40 hover:bg-sky-500/8 transition-all">
        <Bot className="w-3.5 h-3.5" /> اسأل المساعد
      </button>
      <Link href="/dashboard/market" className="flex items-center gap-2 px-4 py-2 rounded-xl glass-card text-[12px] font-semibold text-amber-400 border border-amber-500/20 hover:border-amber-500/40 hover:bg-amber-500/8 transition-all">
        <BarChart3 className="w-3.5 h-3.5" /> أسعار السوق
      </Link>
      <button onClick={onReport} className="flex items-center gap-2 px-4 py-2 rounded-xl glass-card text-[12px] font-semibold text-red-400 border border-red-500/20 hover:border-red-500/40 hover:bg-red-500/8 transition-all">
        <AlertTriangle className="w-3.5 h-3.5" /> تقرير طارئ
      </button>
    </motion.div>
  );
}

/* ─── Weather Card ─────────────────────────────────────────────────── */
function WeatherCard({ cityKey }: { cityKey: CityKey }) {
  const city   = CITIES[cityKey];
  const period = getTimePeriod();
  const tpc    = TIME_CFG[period];

  return (
    <motion.div
      variants={cardVariants}
      className="glass-card rounded-2xl p-5 flex flex-col gap-4 hover:border-sky-400/30 transition-colors duration-300 overflow-hidden relative"
    >
      <div className={cn("absolute inset-0 bg-gradient-to-b pointer-events-none opacity-50", tpc.grd)} />

      <div className="relative flex items-center justify-between">
        <div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-widest">الطقس الميداني</p>
          <h3 className="text-sm font-semibold text-foreground mt-0.5">{city.name}</h3>
        </div>
        <div className="flex flex-col items-center gap-0.5">
          <div className="w-10 h-10 rounded-xl bg-sky-400/10 border border-sky-400/20 flex items-center justify-center">
            <CloudSun className="w-5 h-5 text-sky-400" />
          </div>
          <span className={cn("text-[9px] font-semibold", tpc.clr)}>{tpc.label}</span>
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={cityKey}
          initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="relative flex items-end gap-2"
        >
          <span className="text-5xl font-bold text-foreground tabular-nums leading-none" dir="ltr">{city.temp}</span>
          <span className="text-lg text-muted-foreground mb-1">°م</span>
          <span className="text-xs text-sky-400 mb-1.5 me-auto">{city.condition}</span>
        </motion.div>
      </AnimatePresence>

      <div className="relative flex gap-4">
        <div className="flex items-center gap-1.5">
          <Wind className="w-3.5 h-3.5 text-muted-foreground/60 flex-shrink-0" />
          <span className="text-xs text-muted-foreground" dir="ltr">{city.wind} كم/س</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Droplets className="w-3.5 h-3.5 text-muted-foreground/60 flex-shrink-0" />
          <span className="text-xs text-muted-foreground">رطوبة {city.humidity}٪</span>
        </div>
      </div>

      <div className="relative border-t border-emerald-500/10 pt-3">
        <div className="flex items-start gap-2.5">
          <div className="w-6 h-6 rounded-full bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center flex-shrink-0 mt-0.5">
            <MessageSquare className="w-3 h-3 text-emerald-400" />
          </div>
          <div>
            <p className="text-[10px] text-emerald-400/80 font-semibold mb-1">وكيل المناخ</p>
            <AnimatePresence mode="wait">
              <motion.p
                key={cityKey}
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="text-xs text-muted-foreground leading-relaxed"
              >
                {city.insight}
              </motion.p>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

/* ─── Soil Card ────────────────────────────────────────────────────── */
const GAUGE_R = 36, GAUGE_CX = 44, GAUGE_CY = 44;
const CIRCUMFERENCE = 2 * Math.PI * GAUGE_R;

function useSoilData() {
  const [moisture, setMoisture] = useState<number | null>(null);
  const [loading, setLoading]   = useState(true);
  useEffect(() => {
    let mounted = true;
    fetchSoilData()
      .then((d) => { if (mounted) setMoisture(d.average_moisture); })
      .catch(()  => { if (mounted) setMoisture(65); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, []);
  return { moisture: moisture ?? 65, loading };
}

function SoilCard() {
  const { moisture, loading } = useSoilData();
  const dashOffset = CIRCUMFERENCE * (1 - moisture / 100);

  return (
    <motion.div variants={cardVariants} className="glass-card rounded-2xl p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-widest">ذكاء التربة</p>
          <h3 className="text-sm font-semibold text-foreground mt-0.5">رطوبة التربة</h3>
        </div>
        <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
          <Gauge className="w-5 h-5 text-emerald-400" />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-1">
          <div className="relative w-24 h-24">
            <svg width="96" height="96" viewBox="0 0 88 88">
              <circle r={GAUGE_R} cx={GAUGE_CX} cy={GAUGE_CY} fill="none" stroke="oklch(0.696 0.170 162 / 10%)" strokeWidth={7} />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div className="h-6 w-10 rounded bg-emerald-500/10 animate-pulse" />
            </div>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-center py-1">
          <div className="relative">
            <svg width="96" height="96" viewBox="0 0 88 88">
              <circle r={GAUGE_R} cx={GAUGE_CX} cy={GAUGE_CY} fill="none" stroke="oklch(0.696 0.170 162 / 10%)" strokeWidth={7} />
              <g transform={`rotate(-90 ${GAUGE_CX} ${GAUGE_CY})`}>
                <motion.circle r={GAUGE_R} cx={GAUGE_CX} cy={GAUGE_CY} fill="none" stroke="oklch(0.696 0.170 162)" strokeWidth={7} strokeLinecap="round" strokeDasharray={CIRCUMFERENCE} initial={{ strokeDashoffset: CIRCUMFERENCE }} animate={{ strokeDashoffset: dashOffset }} transition={{ duration: 1.4, ease: "easeOut", delay: 0.3 }} />
              </g>
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <motion.span className="text-2xl font-bold text-foreground tabular-nums leading-none" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }} dir="ltr">
                {Math.round(moisture)}٪
              </motion.span>
              <span className="text-[9px] text-muted-foreground mt-0.5">
                {moisture >= 60 ? "مثالي" : moisture >= 40 ? "متوسط" : "منخفض"}
              </span>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        {[
          { label: "درجة الحموضة", value: "7.2", ltr: true  },
          { label: "النيتروجين",   value: "متوسط", ltr: false },
          { label: "الفوسفور",     value: "كافٍ",  ltr: false },
          { label: "العمق",        value: "30 سم", ltr: true  },
        ].map((item) => (
          <div key={item.label} className={cn("bg-emerald-500/5 border border-emerald-500/10 rounded-lg px-2.5 py-2", loading && "animate-pulse")}>
            <p className="text-[9px] text-muted-foreground mb-0.5">{item.label}</p>
            <p className="text-xs font-semibold text-foreground" dir={item.ltr ? "ltr" : undefined}>
              {loading ? "—" : item.value}
            </p>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

/* ─── Agent Alerts ─────────────────────────────────────────────────── */
const AGENT_ALERTS = [
  { agent: "وكيل الطقس",  icon: CloudSun,   cls: "sky",     city: "حلب",       msg: "موجة حر متوقعة الأربعاء — تجنب الرش فوق 37°م وادّخر المياه." },
  { agent: "وكيل الآفات", icon: Bug,         cls: "orange",  city: "الرقة",     msg: "دودة القطن رُصدت في 7 حقول — راجع التوصيات وطبّق الرش الموضعي." },
  { agent: "وكيل الطقس",  icon: Flame,       cls: "red",     city: "دير الزور", msg: "حرارة مفرطة 38°م — أوقف العمل الحقلي في منتصف النهار." },
  { agent: "وكيل السوق",  icon: TrendingUp,  cls: "emerald", city: "عام",       msg: "ارتفاع القمح 7٪ هذا الأسبوع — نافذة تسويق مفتوحة." },
];

const ALERT_CLS: Record<string, string> = {
  sky:     "border-sky-500/25     bg-sky-500/6     text-sky-400",
  orange:  "border-orange-500/25  bg-orange-500/6  text-orange-400",
  red:     "border-red-500/25     bg-red-500/6     text-red-400",
  emerald: "border-emerald-500/25 bg-emerald-500/6 text-emerald-400",
};

function AgentAlerts() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.45 }}
      className="mb-4"
    >
      <div className="flex items-center gap-2 mb-3" dir="rtl">
        <AlertTriangle className="w-4 h-4 text-amber-400" />
        <span className="text-sm font-bold text-foreground">تنبيهات الوكلاء</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {AGENT_ALERTS.map(({ agent, icon: Icon, cls, city, msg }) => (
          <div
            key={agent + city}
            className={cn("flex items-start gap-2.5 p-3 rounded-xl border", ALERT_CLS[cls])}
            dir="rtl"
          >
            <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 border", ALERT_CLS[cls])}>
              <Icon className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className="text-[10px] font-bold">{agent}</span>
                <span className="text-[9px] text-muted-foreground">— {city}</span>
              </div>
              <p className="text-[11px] text-foreground/75 leading-relaxed">{msg}</p>
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

/* ─── Quick Stats ──────────────────────────────────────────────────── */
function QuickStats({ temp }: { temp: number }) {
  const stats = [
    { label: "الحقول",        value: "4",           icon: Sprout     },
    { label: "استهلاك الري",  value: "35.7م³",      icon: Droplets   },
    { label: "درجة الحرارة",  value: `${temp}°م`,   icon: CloudSun   },
    { label: "سعر القمح",     value: "1400 ل.س",   icon: TrendingUp },
  ];
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.12, duration: 0.4 }}
      className="flex gap-2 mb-6 overflow-x-auto pb-1 scrollbar-none"
    >
      {stats.map(({ label, value, icon: Icon }) => (
        <div
          key={label}
          className="flex-shrink-0 flex items-center gap-2 rounded-full px-3 py-1.5 bg-white/[0.03] border border-emerald-500/12"
        >
          <Icon className="w-3.5 h-3.5 text-emerald-400/70" />
          <span className="text-xs text-muted-foreground">{label}</span>
          <span className="text-xs font-bold text-foreground tabular-nums" dir="ltr">{value}</span>
        </div>
      ))}
    </motion.div>
  );
}

/* ─── Main export ──────────────────────────────────────────────────── */
export function DashboardContent({ onAskAI }: { onAskAI?: () => void }) {
  const [city, setCity]         = useState<CityKey>("damascus");
  const [reportOpen, setReport] = useState(false);

  return (
    <div className="flex-1 flex flex-col overflow-hidden min-h-0">
      <AlertTicker />
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        <div className="p-6 max-w-5xl mx-auto w-full">

          <QuickActions onAskAI={onAskAI} onReport={() => setReport(true)} />

          {/* Heading + City Switcher */}
          <motion.div
            initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="mb-5 flex items-start justify-between" dir="rtl"
          >
            <div>
              <h2 className="text-xl font-bold text-foreground">لوحة التحكم</h2>
              <p className="text-sm text-muted-foreground mt-0.5">مرحباً بك — إليك ما يجري في مزرعتك اليوم.</p>
            </div>
            <div className="flex items-center gap-2">
              <CitySwitcher city={city} onChange={setCity} />
              <div className="flex items-center gap-1.5 bg-emerald-500/8 border border-emerald-500/20 rounded-full px-2.5 py-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[10px] text-emerald-400 font-medium">مباشر</span>
              </div>
            </div>
          </motion.div>

          <QuickStats temp={CITIES[city].temp} />

          {/* 2-col cards */}
          <LayoutGroup id="dashboard-cards">
            <motion.div
              variants={gridVariants} initial="hidden" animate="visible"
              className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4"
            >
              <WeatherCard cityKey={city} />
              <SoilCard />
            </motion.div>
          </LayoutGroup>

          <MarketTicker />
          <AgentAlerts />
          <AgroBrainCalc />
          <ExpertMeeting city={city} />

        </div>
      </div>

      <GreenReportModal open={reportOpen} onClose={() => setReport(false)} />
    </div>
  );
}
