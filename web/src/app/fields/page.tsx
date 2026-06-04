"use client";

import { useState, useEffect, useRef, useCallback, useId } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import {
  Droplets, AlertTriangle, CheckCircle, Bot, Shield,
  TrendingUp, TrendingDown, Minus, Thermometer, Leaf,
  ArrowLeft, Activity, MessageSquare,
  Wheat, Sprout, Apple, Grape, Flower2,
  Layers, Zap, MapPin, BarChart3, CalendarDays,
  FlaskConical, Camera, Upload, Clock, Scissors, Scan,
  ShieldAlert, Info, Bug,
  Target, Wind, Snowflake, Sun, Sparkles, ChevronDown, ChevronUp, Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SyriaMap, PROVINCES, VIEW_BOX } from "@/components/workspace/SyriaMap";
import {
  FIELDS, Field, PROVINCE_BBOX,
  healthColor, healthLabel, totalHa, avgHealth, criticalCount,
  syncFieldsToContext,
} from "@/lib/fields";
import { loadFields, saveField, persistCache } from "@/lib/fieldsRepo";
import { AddFieldModal } from "@/components/fields/AddFieldModal";
import { PageGuide } from "@/components/ui/PageGuide";
import { InfoTip } from "@/components/ui/InfoTip";

/* ─── Types & Constants ──────────────────────────────────────────────── */
type Overlay  = "health" | "heat" | "moisture" | null;
type PanelView = "overview" | "forecast" | "analytics" | "timeline" | "irrigation";
const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];
const VBW = 7.5574, VBH = 5.6276;

const CROP_ICONS: Record<string, React.ElementType> = {
  القمح: Wheat, القطن: Sprout, الزيتون: Leaf,
  الطماطم: Apple, الشعير: Wheat, العنب: Grape,
};
function CropIcon({ crop, ...rest }: { crop: string } & React.SVGProps<SVGSVGElement>) {
  const Icon = (CROP_ICONS[crop] ?? Flower2) as React.ElementType;
  return <Icon {...rest} />;
}

/* ─── Intelligence Data ──────────────────────────────────────────────── */
const SOIL_PH: Record<string, number> = {
  "طمية": 7.2, "رملية طينية": 7.4, "كلسية": 7.9,
  "طمية خفيفة": 7.0, "صخرية جيرية": 8.1, "طينية": 6.8,
};
const BASE_YIELD: Record<string, number> = {
  القمح: 320, القطن: 230, الزيتون: 195, الطماطم: 1100, الشعير: 280, العنب: 410,
};
const DAY_LABELS = ["اليوم", "غداً", "بعد غد", "+3", "+4", "+5", "+6"];

function getAnalysisData(f: Field) {
  const h = f.healthScore / 100, w = f.waterStress / 100;
  const nitrogen   = Math.max(25, Math.round(38 + h * 50 - w * 18));
  const phosphorus = Math.max(25, Math.round(42 + h * 34 - w * 10));
  const potassium  = Math.max(28, Math.round(46 + h * 34 - w * 14));
  const ph         = SOIL_PH[f.soilType] ?? 7.2;
  const organic    = (h * 2.8 + 1.2).toFixed(1);
  const yieldEst   = Math.round((BASE_YIELD[f.crop] ?? 300) * (0.55 + h * 0.50));
  const risks: string[] = [];
  if (w > 0.65) risks.push(`إجهاد مائي حرج ${f.waterStress}%`);
  if (f.irrigDaysAgo >= 4) risks.push(`تأخر الري ${f.irrigDaysAgo} أيام`);
  if (nitrogen < 48) risks.push(`نقص النيتروجين ${nitrogen}%`);
  if (f.healthScore < 55) risks.push("ضعف عام في صحة المحصول");
  const recs: string[] = [];
  if (w > 0.50) recs.push("زيادة جرعة الري 20–30%");
  if (nitrogen < 55) recs.push("إضافة سماد نيتروجيني خلال أسبوع");
  if (f.stageProgress > 85) recs.push("التحضير لبدء موسم الحصاد");
  if (recs.length === 0) recs.push("الحفاظ على الروتين الحالي");
  recs.push("فحص دوري للآفات والأمراض");
  return { nitrogen, phosphorus, potassium, ph, organic, yieldEst, risks, recs };
}

function getIrrigationPlan(f: Field) {
  const base = Math.round(220 + f.areaHa * 48 + f.waterStress * 2.2);
  const intv = f.waterStress > 65 ? 2 : f.waterStress > 38 ? 3 : 5;
  const days = DAY_LABELS.map((label, i) => {
    const due    = i === 0 ? f.irrigDaysAgo >= intv : i % intv === 0;
    const jitter = ((f.id * (i + 3) * 7) % 41) - 20;
    const urgency = (i === 0 && f.irrigDaysAgo >= 4) ? "critical"
      : (due && i <= 1) ? "high" : due ? "normal" : "none";
    return { label, due, amount: due ? base + jitter : 0, urgency };
  });
  const total = days.reduce((s, d) => s + d.amount, 0);
  return { days, total, interval: intv };
}

/* ─── Phase 2 scoring helpers ────────────────────────────────────────── */
function getDiseaseRisk(f: Field): number {
  let r = 15;
  if (f.waterStress > 70) r += 30; else if (f.waterStress > 50) r += 15;
  if (f.irrigDaysAgo >= 5) r += 25; else if (f.irrigDaysAgo >= 3) r += 10;
  if (f.guardianAlert) r += 20;
  if (f.healthScore < 50) r += 15;
  return Math.min(r, 97);
}

function getSoilCondition(f: Field): { label: string; color: string; score: number; detail: string } {
  const ph  = SOIL_PH[f.soilType] ?? 7.2;
  const raw = Math.round(55 + (f.healthScore / 100) * 38 - Math.abs(ph - 7.0) * 4 - (f.waterStress / 100) * 10);
  const s   = Math.min(Math.max(raw, 20), 98);
  if (s >= 75) return { label: "ممتازة",      color: "#10b981", score: s, detail: "معادن كافية · pH مثالي" };
  if (s >= 55) return { label: "جيدة",        color: "#f59e0b", score: s, detail: "تحتاج متابعة معدنية" };
  return       { label: "تحتاج تدخل",  color: "#ef4444", score: s, detail: "نقص في المغذيات الأساسية" };
}

function getProductivity(f: Field): { score: number; weekDelta: number } {
  const weekDelta = f.history[f.history.length - 1] - f.history[0];
  const raw = Math.round(40 + (f.healthScore / 100) * 55 - (f.waterStress / 100) * 18);
  return { score: Math.min(Math.max(raw, 12), 97), weekDelta };
}

function getCriticalAlerts(f: Field): { level: "critical" | "warning" | "info"; msg: string }[] {
  const alerts: { level: "critical" | "warning" | "info"; msg: string }[] = [];
  if (f.guardianAlert) alerts.push({ level: "critical", msg: f.guardianAlert });
  if (!f.guardianAlert && f.healthScore < 50) alerts.push({ level: "critical", msg: `صحة حرجة ${f.healthScore}% — تدخل فوري مطلوب` });
  if (f.irrigDaysAgo >= 4) alerts.push({ level: "warning", msg: `تأخر الري ${f.irrigDaysAgo} أيام — إجهاد متصاعد` });
  else if (f.waterStress > 65 && !f.guardianAlert) alerts.push({ level: "warning", msg: `إجهاد مائي ${f.waterStress}% — زيادة الجرعة مطلوبة` });
  if (alerts.length === 0) alerts.push({ level: "info", msg: f.aiInsight });
  return alerts;
}

/* ─── Timeline ───────────────────────────────────────────────────────── */
interface TimelineEvent {
  type: "irrigation" | "fertilization" | "ai" | "alert" | "harvest";
  daysAgo: number;
  title: string;
  insight: string;
}

function getTimeline(f: Field): TimelineEvent[] {
  const evs: TimelineEvent[] = [];
  if (f.guardianAlert) evs.push({ type: "alert", daysAgo: 0, title: "تنبيه عاجل", insight: f.guardianAlert });
  if (f.stageProgress >= 85) evs.push({ type: "harvest", daysAgo: 0, title: "جاهز للحصاد", insight: `${f.crop} بلغ ${f.stageProgress}% من دورة النضج` });
  evs.push({
    type: "irrigation",
    daysAgo: f.irrigDaysAgo,
    title: f.irrigDaysAgo === 0 ? "ري — اليوم" : `آخر ري — منذ ${f.irrigDaysAgo} ${f.irrigDaysAgo === 1 ? "يوم" : "أيام"}`,
    insight: `${Math.round(220 + f.areaHa * 48)} لتر · تربة ${f.soilType}`,
  });
  evs.push({ type: "ai", daysAgo: 1, title: "تحليل ذكاء اصطناعي", insight: f.aiInsight });
  for (let i = 1; i < f.history.length; i++) {
    const delta   = f.history[i] - f.history[i - 1];
    const daysAgo = f.history.length - 1 - i;
    if (delta <= -5)
      evs.push({ type: "alert", daysAgo, title: "تراجع صحة المحصول", insight: `انخفاض ${Math.abs(delta)} نقطة — مراقبة الإجهاد المائي` });
    else if (delta >= 4 && daysAgo > 0)
      evs.push({ type: "ai", daysAgo, title: "تحسن ملحوظ", insight: `ارتفاع ${delta} نقطة — استجابة إيجابية للري` });
  }
  evs.push({ type: "fertilization", daysAgo: 5, title: "تسميد منتظم", insight: `نيتروجين + فوسفور · ${f.soilType}` });
  return evs.sort((a, b) => a.daysAgo - b.daysAgo).slice(0, 8);
}

/* ─── Phase 3A: Predictive Data Helpers ──────────────────────────────── */
const MONTHS_AR = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];

function getForecastData(f: Field) {
  const base = BASE_YIELD[f.crop] ?? 300;
  const h = f.healthScore / 100, w = f.waterStress / 100;
  const targetKg    = Math.round(base * 0.92);
  const predictedKg = Math.round(base * (0.55 + h * 0.50) * (1 - w * 0.28));
  const curMonth    = new Date().getMonth();

  const yieldMonths = Array.from({ length: 6 }, (_, i) => {
    const growth = Math.min(1, (f.stageProgress / 100) * (0.55 + i * 0.09));
    return {
      month:     MONTHS_AR[(curMonth + i) % 12].slice(0, 3),
      predicted: Math.round(predictedKg * (0.11 + growth * 0.89)),
      target:    Math.round(targetKg    * (0.11 + Math.min(1, i / 4.5) * 0.89)),
    };
  });

  const baseRisk = getDiseaseRisk(f);
  const diseases = [
    { name: "صدأ الأوراق",    prob: Math.min(88, Math.round(baseRisk * 0.65 + (f.id * 7  % 14))) },
    { name: "البياض الدقيقي", prob: Math.min(88, Math.round(baseRisk * 0.45 + (f.id * 11 % 12))) },
    { name: "لفحة التبقع",    prob: Math.min(88, Math.round(baseRisk * 0.30 + (f.id * 5  % 10))) },
  ];

  const weatherEvents = [
    {
      icon: "cold" as const, event: "موجة برد متوقعة", days: 3,
      impact: f.stageProgress > 65
        ? `قد تؤثر على ${f.stage} — خطر تجمد الثمار`
        : "تأثير محدود على المرحلة الحالية",
      severity: (f.stageProgress > 65 ? "warning" : "info") as "warning" | "info" | "critical",
    },
    {
      icon: "wind" as const, event: "رياح قوية", days: 1,
      impact: "احتمال فقدان 15% من رطوبة التربة — يُوصى بري وقائي",
      severity: "info" as const,
    },
    {
      icon: "sun" as const, event: "موجة حرارة", days: 5,
      impact: f.waterStress > 50
        ? `الإجهاد (${f.waterStress}%) سيتفاقم — تدخل عاجل مطلوب`
        : "ضغط اعتيادي — زيادة جرعة الري 10%",
      severity: (f.waterStress > 50 ? "critical" : "info") as "critical" | "info",
    },
  ];

  return { predictedKg, targetKg, yieldMonths, diseases, weatherEvents };
}

interface SmartRec {
  title: string; reason: string;
  dataPoints: string[];
  urgency: "critical" | "warning" | "info";
  action: string;
}

function getSmartRecs(f: Field): SmartRec[] {
  const recs: SmartRec[] = [];
  const analysis = getAnalysisData(f);
  const risk = getDiseaseRisk(f);

  if (f.waterStress > 60 || f.irrigDaysAgo >= 3) {
    recs.push({
      title:  `بدء الري خلال ${f.irrigDaysAgo >= 4 ? "ساعتين" : "4 ساعات"}`,
      reason: `الإجهاد المائي ${f.waterStress}% — مضى ${f.irrigDaysAgo} يوم على آخر ري`,
      dataPoints: [`إجهاد مائي: ${f.waterStress}%`, `آخر ري: ${f.irrigDaysAgo} أيام`, `حرارة متوقعة: 34°م`, `رطوبة: 22%`],
      urgency: f.irrigDaysAgo >= 4 ? "critical" : "warning",
      action: "جدولة الري",
    });
  }

  if (analysis.nitrogen < 52) {
    recs.push({
      title:  "إضافة تسميد نيتروجيني",
      reason: `النيتروجين ${analysis.nitrogen}% — أقل من الحد المثالي 60%`,
      dataPoints: [`نيتروجين: ${analysis.nitrogen}%`, `فوسفور: ${analysis.phosphorus}%`, `pH: ${SOIL_PH[f.soilType] ?? 7.2}`, `المرحلة: ${f.stage}`],
      urgency: analysis.nitrogen < 40 ? "critical" : "warning",
      action: "طلب سماد",
    });
  }

  if (risk > 38) {
    recs.push({
      title:  "رش وقائي ضد الأمراض",
      reason: `احتمالية إصابة ${risk}% — نافذة الوقاية الفعّالة مفتوحة`,
      dataPoints: [`خطر الأمراض: ${risk}%`, `رطوبة الهواء: 68%`, `الحرارة: 28°م`, `بؤرة مجاورة: 5 كم`],
      urgency: risk > 65 ? "critical" : "info",
      action: "طلب مبيد",
    });
  }

  if (f.stageProgress >= 82) {
    recs.push({
      title:  "التحضير للحصاد",
      reason: `${f.crop} بلغ ${f.stageProgress}% من النضج — نافذة الحصاد تقترب`,
      dataPoints: [`تقدم: ${f.stageProgress}%`, `المحصول: ${f.crop}`, `المساحة: ${f.areaHa} هـ`, `إنتاج متوقع: ${analysis.yieldEst} كغ/دونم`],
      urgency: "info",
      action: "تخطيط الحصاد",
    });
  }

  if (recs.length === 0) {
    recs.push({
      title:  "الحفاظ على الروتين الحالي",
      reason: "المحصول في حالة ممتازة — لا تدخل فوري مطلوب",
      dataPoints: [`صحة: ${f.healthScore}%`, `إجهاد: ${f.waterStress}%`, `مرحلة: ${f.stage}`, `تقدم: ${f.stageProgress}%`],
      urgency: "info",
      action: "متابعة",
    });
  }

  return recs.slice(0, 3);
}

/* ─── Phase 3B: Analytics Data Helpers ──────────────────────────────── */
function getSeasonalData(f: Field) {
  const base = BASE_YIELD[f.crop] ?? 300;
  const h = f.healthScore / 100;
  const curMonth = new Date().getMonth();
  return Array.from({ length: 6 }, (_, i) => {
    const noise = ((f.id * (i + 1) * 13) % 18) - 9;
    const current  = Math.round(base * (0.52 + h * 0.48 + noise / 100));
    const previous = Math.round(base * (0.44 + ((f.id * (i + 2) * 7) % 22) / 100));
    return {
      month: MONTHS_AR[(curMonth - 5 + i + 12) % 12].slice(0, 3),
      current,
      previous,
    };
  });
}

function getResourceData(f: Field) {
  const w = f.waterStress / 100;
  const water       = Math.min(55, Math.round(30 + w * 18 + ((f.id * 7) % 6)));
  const fertilizers = Math.round(20 + ((f.id * 3) % 8));
  const pesticides  = Math.round(12 + Math.round(getDiseaseRisk(f) * 0.08) + ((f.id * 5) % 5));
  const energy      = Math.max(5, 100 - water - fertilizers - pesticides);
  return [
    { label: "المياه",    value: water,       color: "#38bdf8" },
    { label: "الأسمدة",  value: fertilizers, color: "#10b981" },
    { label: "المبيدات", value: pesticides,  color: "#f59e0b" },
    { label: "الطاقة",   value: energy,      color: "#a78bfa" },
  ];
}

function getHealthStressHistory(f: Field) {
  return Array.from({ length: 30 }, (_, i) => {
    const t      = i / 29;
    const baseH  = f.history[0] + (f.history[6] - f.history[0]) * t;
    const noise  = ((f.id * (i + 1) * 17) % 13) - 6;
    const health = Math.min(100, Math.max(0, Math.round(baseH + noise)));
    const wNoise = ((f.id * (i + 3) * 11) % 14) - 7;
    const stress = Math.min(100, Math.max(0, Math.round(f.waterStress + wNoise)));
    return { health, stress };
  });
}

/* ─── GlowDot ────────────────────────────────────────────────────────── */
function GlowDot({ color, pulse = false, size = 8 }: { color: string; pulse?: boolean; size?: number }) {
  return (
    <span className="relative flex-shrink-0" style={{ width: size, height: size }}>
      {pulse && (
        <motion.span className="absolute inset-0 rounded-full" style={{ background: color }}
          animate={{ scale: [1, 2.6, 1], opacity: [0.55, 0, 0.55] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }} />
      )}
      <span className="absolute inset-0 rounded-full"
        style={{ background: color, boxShadow: `0 0 ${size}px ${color}BB` }} />
    </span>
  );
}

/* ─── Gradient Sparkline ─────────────────────────────────────────────── */
function GradientSparkline({ data, color, uid, width = 120, height = 36 }: {
  data: number[]; color: string; uid: string; width?: number; height?: number;
}) {
  const P = 4;
  const min = Math.min(...data), range = Math.max(...data) - min || 1;
  const pts = data.map((v, i): [number, number] => [
    P + (i / (data.length - 1)) * (width - P * 2),
    height - P - ((v - min) / range) * (height - P * 2),
  ]);
  const line = pts.reduce((a, [x, y], i) => {
    if (i === 0) return `M${x},${y}`;
    const [px, py] = pts[i - 1];
    return `${a} C${px + (x - px) * 0.5},${py} ${x - (x - px) * 0.5},${y} ${x},${y}`;
  }, "");
  const area = `${line} L${pts[pts.length - 1][0]},${height} L${pts[0][0]},${height} Z`;
  const [lx, ly] = pts[pts.length - 1];
  const d = data[data.length - 1] - data[data.length - 2];
  return (
    <div className="flex flex-col gap-1.5">
      <svg width={width} height={height} className="overflow-visible">
        <defs>
          <linearGradient id={`sg-${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.40" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill={`url(#sg-${uid})`} />
        <path d={line} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx={lx} cy={ly} r="3.5" fill={color}
          style={{ filter: `drop-shadow(0 0 4px ${color}99)` }} />
      </svg>
      <div className="flex items-center justify-between text-[9px]">
        <span className="text-muted-foreground">آخر 7 أيام</span>
        <span className={cn("flex items-center gap-0.5 font-semibold",
          d > 0 ? "text-emerald-400" : d < 0 ? "text-red-400" : "text-muted-foreground")}>
          {d > 0 ? <TrendingUp className="w-2.5 h-2.5" /> : d < 0 ? <TrendingDown className="w-2.5 h-2.5" /> : <Minus className="w-2.5 h-2.5" />}
          {d > 0 ? "+" : ""}{d}%
        </span>
      </div>
    </div>
  );
}

/* ─── Health Ring ────────────────────────────────────────────────────── */
function HealthRing({ score, color, size = 120 }: { score: number; color: string; size?: number }) {
  const uid = useId().replace(/:/g, "");
  const r = size * 0.38, c = size / 2, circ = 2 * Math.PI * r, sw = size * 0.082;
  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <defs>
          <linearGradient id={`rg-${uid}`} gradientUnits="userSpaceOnUse"
            x1={c - r} y1={c} x2={c + r} y2={c}>
            <stop stopColor={color} stopOpacity="0.55" />
            <stop offset="1" stopColor={color} />
          </linearGradient>
        </defs>
        <circle cx={c} cy={c} r={r} fill="none" stroke="rgba(255,255,255,0.055)" strokeWidth={sw} />
        <motion.circle cx={c} cy={c} r={r} fill="none"
          stroke={`url(#rg-${uid})`} strokeWidth={sw} strokeLinecap="round"
          strokeDasharray={circ}
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: circ * (1 - score / 100) }}
          transition={{ duration: 1.6, ease: EASE, delay: 0.15 }}
          style={{ filter: `drop-shadow(0 0 ${size * 0.05}px ${color}88)` }} />
        <motion.circle cx={c} cy={c} r={r} fill="none"
          stroke={color} strokeWidth={sw * 0.28} strokeLinecap="round"
          strokeDasharray={circ}
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: circ * (1 - score / 100) }}
          transition={{ duration: 1.6, ease: EASE, delay: 0.15 }}
          opacity={0.38} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-bold tabular-nums leading-none" style={{ color, fontSize: size * 0.22 }}>{score}</span>
        <span style={{ fontSize: size * 0.085, color: "rgba(255,255,255,0.40)", marginTop: 2 }}>%</span>
      </div>
    </div>
  );
}

/* ─── Mini Bar Chart ─────────────────────────────────────────────────── */
function MiniBarChart({ bars }: {
  bars: { label: string; value: number; color: string; unit?: string }[];
}) {
  return (
    <div className="flex items-end gap-2 h-20">
      {bars.map(({ label, value, color, unit = "%" }) => (
        <div key={label} className="flex-1 flex flex-col items-center gap-1.5">
          <span className="text-[9px] font-bold tabular-nums leading-none" style={{ color }}>
            {value}{unit === "pH" ? "" : unit}
          </span>
          <div className="w-full rounded-t-md overflow-hidden flex-1 flex flex-col justify-end"
            style={{ background: "rgba(255,255,255,0.04)", maxHeight: 56 }}>
            <motion.div className="w-full rounded-t-sm"
              style={{ background: `linear-gradient(to top, ${color}CC, ${color}66)` }}
              initial={{ height: 0 }}
              animate={{ height: `${Math.min(value, 100)}%` }}
              transition={{ duration: 1.0, ease: EASE, delay: 0.1 }} />
          </div>
          <span className="text-[8px] text-muted-foreground text-center leading-tight">{label}</span>
        </div>
      ))}
    </div>
  );
}

/* ─── Why Tooltip (portal-based, no clipping) ────────────────────────── */
function WhyTip({ text }: { text: string }) {
  const [rect, setRect] = useState<DOMRect | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button ref={btnRef}
        onMouseEnter={() => btnRef.current && setRect(btnRef.current.getBoundingClientRect())}
        onMouseLeave={() => setRect(null)}
        className="w-4 h-4 rounded-full border border-white/20 bg-white/[0.06] text-[8px] text-white/50 hover:text-white/80 flex items-center justify-center transition-all cursor-help flex-shrink-0">
        ؟
      </button>
      {rect && typeof document !== "undefined" && createPortal(
        <div className="fixed z-[9999] w-52 rounded-xl border px-3 py-2.5 text-[9.5px] leading-relaxed pointer-events-none"
          style={{
            top: rect.top - 8,
            left: rect.left + rect.width / 2,
            transform: "translate(-50%, -100%)",
            background: "oklch(0.10 0.018 152 / 97%)",
            borderColor: "rgba(52,211,153,0.25)",
            backdropFilter: "blur(18px)",
            color: "rgba(255,255,255,0.78)",
            boxShadow: "0 8px 32px rgba(0,0,0,0.55)",
          }}>
          {text}
        </div>,
        document.body,
      )}
    </>
  );
}

/* ─── Score Bar ──────────────────────────────────────────────────────── */
function ScoreBar({ label, value, color, why, delay = 0 }: {
  label: string; value: number; color: string; why: string; delay?: number;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-muted-foreground">{label}</span>
          <WhyTip text={why} />
        </div>
        <span className="text-[11px] font-bold tabular-nums" style={{ color }}>{value}%</span>
      </div>
      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.05)" }}>
        <motion.div className="h-full rounded-full"
          style={{ background: `linear-gradient(to left, ${color}, ${color}77)`, filter: `drop-shadow(0 0 3px ${color}55)` }}
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ duration: 1.1, ease: EASE, delay }} />
      </div>
    </div>
  );
}

/* ─── Five-Fold Scoring Overview ─────────────────────────────────────── */
function FiveFoldOverview({ field }: { field: Field }) {
  const color    = healthColor(field.healthScore);
  const uid      = useId().replace(/:/g, "");
  const risk     = getDiseaseRisk(field);
  const soil     = getSoilCondition(field);
  const prod     = getProductivity(field);
  const riskColor = risk >= 65 ? "#ef4444" : risk >= 40 ? "#f59e0b" : "#10b981";
  const riskLabel = risk >= 65 ? "خطر عالٍ" : risk >= 40 ? "متوسط" : "منخفض";
  const wsColor   = field.waterStress > 65 ? "#ef4444" : field.waterStress > 38 ? "#f59e0b" : "#38bdf8";

  return (
    <motion.div key={`ov-${field.id}`}
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.28, ease: EASE }}
      className="flex flex-col gap-3">

      {/* 1. Crop Health — circular gauge */}
      <div className="rounded-2xl border p-4 flex flex-col items-center gap-3"
        style={{ background: "oklch(0.095 0.016 152 / 80%)", borderColor: "rgba(255,255,255,0.06)" }}>
        <div className="flex items-center justify-between w-full">
          <p className="text-[10px] font-semibold text-muted-foreground">صحة المحصول</p>
          <WhyTip text={`الصحة ${field.healthScore}% — ${field.waterStress > 50 ? "الإجهاد المائي والنقص المعدني يضغطان على النمو" : "النيتروجين مثالي والري منتظم يدعمان الصحة"}`} />
        </div>
        <HealthRing score={field.healthScore} color={color} size={116} />
        <div className="w-full">
          <div className="flex justify-between text-[9px] text-muted-foreground mb-1.5">
            <span>{field.stage}</span>
            <span>{field.stageProgress}%</span>
          </div>
          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.05)" }}>
            <motion.div className="h-full rounded-full"
              style={{ background: `linear-gradient(to left, ${color}, ${color}77)` }}
              initial={{ width: 0 }}
              animate={{ width: `${field.stageProgress}%` }}
              transition={{ duration: 1.2, ease: EASE, delay: 0.3 }} />
          </div>
        </div>
      </div>

      {/* 2–5: remaining four scores in one card */}
      <div className="rounded-2xl border p-4 flex flex-col gap-3.5"
        style={{ background: "oklch(0.095 0.016 152 / 80%)", borderColor: "rgba(255,255,255,0.06)" }}>

        {/* 2. Water Stress */}
        <ScoreBar label="الإجهاد المائي" value={field.waterStress} color={wsColor} delay={0.10}
          why={`الإجهاد ${field.waterStress}% — آخر ري قبل ${field.irrigDaysAgo} ${field.irrigDaysAgo === 1 ? "يوم" : "أيام"}. ${field.waterStress > 65 ? "الوضع حرج يستدعي ريًّا فوريًّا." : "المستوى في النطاق المقبول."}`} />

        {/* 3. Disease Risk */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-muted-foreground">خطر الأمراض</span>
              <WhyTip text={`الخطر ${risk}% — ${field.guardianAlert ? "رُصدت بؤرة مرضية قريبة من الحقل" : field.waterStress > 65 ? "الإجهاد المائي يُضعف مناعة المحصول" : "الحقل في حالة وقائية جيدة"}`} />
            </div>
            <span className="text-[9px] font-bold px-2 py-0.5 rounded-full border"
              style={{ color: riskColor, background: riskColor + "18", borderColor: riskColor + "38" }}>
              {riskLabel}
            </span>
          </div>
          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.05)" }}>
            <motion.div className="h-full rounded-full"
              style={{ background: `linear-gradient(to left, ${riskColor}, ${riskColor}77)` }}
              initial={{ width: 0 }}
              animate={{ width: `${risk}%` }}
              transition={{ duration: 1.1, ease: EASE, delay: 0.20 }}
            />
          </div>
        </div>

        {/* 4. Soil Condition */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-muted-foreground">حالة التربة</span>
            <WhyTip text={`التربة ${soil.label} (${soil.score}%) — ${soil.detail} · نوع: ${field.soilType}`} />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[8.5px]" style={{ color: soil.color + "99" }}>{soil.detail}</span>
            <span className="text-[9px] font-bold px-2 py-0.5 rounded-full border"
              style={{ color: soil.color, background: soil.color + "18", borderColor: soil.color + "38" }}>
              {soil.label}
            </span>
          </div>
        </div>

        <div className="h-px" style={{ background: "rgba(255,255,255,0.05)" }} />

        {/* 5. Productivity */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-muted-foreground">الإنتاجية</span>
            <WhyTip text={`الإنتاجية ${prod.score}% — ${prod.weekDelta >= 0 ? `تحسن ${prod.weekDelta} نقطة هذا الأسبوع` : `تراجع ${Math.abs(prod.weekDelta)} نقطة — يحتاج تدخلًا`}`} />
          </div>
          <div className="flex items-center gap-2">
            {prod.weekDelta > 0
              ? <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
              : prod.weekDelta < 0
              ? <TrendingDown className="w-3.5 h-3.5 text-red-400" />
              : <Minus className="w-3.5 h-3.5 text-muted-foreground" />}
            <span className="text-[13px] font-bold tabular-nums"
              style={{ color: prod.weekDelta > 0 ? "#10b981" : prod.weekDelta < 0 ? "#ef4444" : "#6b7280" }}>
              {prod.score}%
            </span>
            <span className={cn("text-[9px] font-semibold",
              prod.weekDelta > 0 ? "text-emerald-400" : prod.weekDelta < 0 ? "text-red-400" : "text-muted-foreground")}>
              {prod.weekDelta > 0 ? "+" : ""}{prod.weekDelta}
            </span>
          </div>
        </div>
      </div>

      {/* Sparkline history */}
      <div className="rounded-2xl border p-4"
        style={{ background: "oklch(0.095 0.016 152 / 80%)", borderColor: "rgba(255,255,255,0.06)" }}>
        <GradientSparkline data={field.history} color={color} uid={uid} width={230} height={52} />
      </div>

      {/* AI insight */}
      <div className="rounded-2xl border p-4" style={{
        background: "linear-gradient(135deg,rgba(16,185,129,0.08),rgba(16,185,129,0.02))",
        borderColor: "rgba(52,211,153,0.18)",
      }}>
        <div className="flex items-center gap-2 mb-2">
          <div className="w-6 h-6 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
            <Bot className="w-3 h-3 text-emerald-400" />
          </div>
          <span className="text-[10px] font-bold text-emerald-400/90">توصية الوكيل الذكي</span>
        </div>
        <p className="text-[10.5px] text-foreground/75 leading-relaxed">{field.aiInsight}</p>
      </div>

      {/* Guardian alert */}
      {field.guardianAlert && (
        <div className="rounded-2xl border p-4" style={{
          background: "linear-gradient(135deg,rgba(251,146,60,0.09),rgba(251,146,60,0.02))",
          borderColor: "rgba(251,146,60,0.24)",
        }}>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-6 h-6 rounded-lg bg-orange-500/20 border border-orange-500/30 flex items-center justify-center">
              <Shield className="w-3 h-3 text-orange-400" />
            </div>
            <span className="text-[10px] font-bold text-orange-400/90">تنبيه الحارس</span>
          </div>
          <p className="text-[10.5px] text-foreground/75 leading-relaxed">{field.guardianAlert}</p>
        </div>
      )}
    </motion.div>
  );
}

/* ─── Field Timeline ─────────────────────────────────────────────────── */
const TL_CONFIG: Record<TimelineEvent["type"], { Icon: React.ElementType; color: string }> = {
  irrigation:    { Icon: Droplets,      color: "#38bdf8" },
  fertilization: { Icon: FlaskConical,  color: "#a78bfa" },
  ai:            { Icon: Bot,           color: "#10b981" },
  alert:         { Icon: AlertTriangle, color: "#ef4444" },
  harvest:       { Icon: Scissors,      color: "#f59e0b" },
};

function FieldTimeline({ field }: { field: Field }) {
  const events = getTimeline(field);
  return (
    <motion.div key={`tl-${field.id}`}
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.28, ease: EASE }}
      className="flex flex-col gap-0">
      <p className="text-[10px] text-muted-foreground/70 mb-4 flex items-center gap-1.5">
        <Clock style={{ width: 11, height: 11 }} /> ذاكرة الحقل — آخر 7 أيام
      </p>
      <div className="relative">
        {/* Vertical timeline spine */}
        <div className="absolute top-5 bottom-5 w-px"
          style={{ right: 17, background: "linear-gradient(to bottom, rgba(52,211,153,0.30), rgba(52,211,153,0.03))" }} />
        <div className="flex flex-col gap-2">
          {events.map((ev, i) => {
            const cfg = TL_CONFIG[ev.type];
            const timeLabel = ev.daysAgo === 0 ? "الآن" : ev.daysAgo === 1 ? "أمس" : `منذ ${ev.daysAgo} أيام`;
            return (
              <motion.div key={i}
                initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.065, duration: 0.22, ease: EASE }}
                className="flex items-start gap-3 pr-1">
                <div className="flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center border z-10"
                  style={{ background: cfg.color + "14", borderColor: cfg.color + "30" }}>
                  <cfg.Icon style={{ width: 14, height: 14, color: cfg.color }} />
                </div>
                <div className="flex-1 rounded-xl border px-3 py-2.5 min-w-0"
                  style={{ background: "oklch(0.09 0.015 152 / 75%)", borderColor: "rgba(255,255,255,0.055)" }}>
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <span className="text-[10.5px] font-bold text-foreground/85 leading-tight">{ev.title}</span>
                    <span className="text-[8.5px] text-muted-foreground/55 flex-shrink-0">{timeLabel}</span>
                  </div>
                  <p className="text-[9.5px] text-muted-foreground leading-relaxed">{ev.insight}</p>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}

/* ─── Image Intelligence Hub ─────────────────────────────────────────── */
type ScanState = "idle" | "scanning" | "done";

function ImageIntelligenceHub({ fieldId }: { fieldId: number }) {
  const [scanState, setScanState]   = useState<ScanState>("idle");
  const [imageUrl,  setImageUrl]    = useState<string | null>(null);
  const [dragging,  setDragging]    = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => () => { if (imageUrl) URL.revokeObjectURL(imageUrl); }, [imageUrl]);

  // Reset on field change
  useEffect(() => { setScanState("idle"); setImageUrl(null); }, [fieldId]);

  const processFile = (file: File) => {
    if (!file.type.startsWith("image/")) return;
    setImageUrl(URL.createObjectURL(file));
    setScanState("scanning");
    setTimeout(() => setScanState("done"), 3600);
  };

  return (
    <div className="rounded-2xl border overflow-hidden"
      style={{ background: "oklch(0.095 0.016 152 / 80%)", borderColor: "rgba(255,255,255,0.06)" }}>
      <div className="px-4 py-2.5 border-b flex items-center gap-2"
        style={{ borderColor: "rgba(255,255,255,0.05)" }}>
        <Scan style={{ width: 12, height: 12, color: "#10b981" }} />
        <p className="text-[10px] font-bold text-foreground/80">مركز استخبارات الصور</p>
      </div>
      <div className="p-4">
        {scanState === "idle" && (
          <div
            onDrop={e => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) processFile(f); }}
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onClick={() => fileRef.current?.click()}
            className={cn(
              "border-2 border-dashed rounded-xl p-6 flex flex-col items-center gap-3 cursor-pointer transition-all duration-200",
              dragging ? "border-emerald-400/60 bg-emerald-500/10" : "border-white/[0.10] hover:border-emerald-400/28 hover:bg-white/[0.03]",
            )}>
            <input ref={fileRef} type="file" accept="image/*" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) processFile(f); }} />
            <div className="w-12 h-12 rounded-2xl border flex items-center justify-center"
              style={{ background: "rgba(52,211,153,0.08)", borderColor: "rgba(52,211,153,0.20)" }}>
              <Camera style={{ width: 22, height: 22, color: "rgba(52,211,153,0.55)" }} />
            </div>
            <div className="text-center">
              <p className="text-[10.5px] font-semibold text-foreground/60 mb-1">اسحب صورة المحصول هنا</p>
              <p className="text-[9px] text-muted-foreground/45">JPG · PNG · HEIC · حتى 25 MB</p>
            </div>
            <div className="flex items-center gap-1.5">
              <Upload style={{ width: 10, height: 10, color: "rgba(52,211,153,0.50)" }} />
              <span className="text-[9px] text-emerald-400/55">رفع للفحص بالذكاء الاصطناعي</span>
            </div>
          </div>
        )}

        {(scanState === "scanning" || scanState === "done") && imageUrl && (
          <div className="flex flex-col gap-3">
            <div className="relative rounded-xl overflow-hidden bg-black" style={{ aspectRatio: "4/3" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imageUrl} alt="crop" className="w-full h-full object-cover" />

              {/* Scanning line */}
              {scanState === "scanning" && (
                <>
                  <div className="absolute inset-0 bg-black/25" />
                  <motion.div className="absolute inset-x-0 h-0.5 z-10 pointer-events-none"
                    style={{ background: "linear-gradient(to right,transparent,#10b981,transparent)" }}
                    animate={{ top: ["0%", "100%", "0%"] }}
                    transition={{ duration: 2.0, repeat: Infinity, ease: "easeInOut" }} />
                  <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
                    <div className="rounded-xl border px-4 py-2.5 flex items-center gap-2"
                      style={{ background: "oklch(0.08 0.020 152 / 92%)", borderColor: "rgba(52,211,153,0.28)", backdropFilter: "blur(14px)" }}>
                      <motion.div className="w-2 h-2 rounded-full bg-emerald-400"
                        animate={{ scale: [1, 1.6, 1], opacity: [1, 0.35, 1] }}
                        transition={{ duration: 0.85, repeat: Infinity }} />
                      <p className="text-[9.5px] font-semibold text-emerald-400">جارٍ الفحص بالذكاء الاصطناعي...</p>
                    </div>
                  </div>
                </>
              )}

              {/* Bounding box result */}
              {scanState === "done" && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}
                  className="absolute border-2 border-red-400 z-10 pointer-events-none"
                  style={{ top: "18%", left: "22%", width: "52%", height: "46%" }}>
                  <div className="absolute -top-[20px] right-0 bg-red-500 text-white text-[8px] font-bold px-2 py-0.5 rounded-t">
                    صدأ الأوراق — 73%
                  </div>
                  {/* Corner ticks */}
                  <span className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-red-300" />
                  <span className="absolute top-0 left-0  w-3 h-3 border-t-2 border-l-2 border-red-300" />
                  <span className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-red-300" />
                  <span className="absolute bottom-0 left-0  w-3 h-3 border-b-2 border-l-2 border-red-300" />
                </motion.div>
              )}
            </div>

            {scanState === "done" && (
              <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, ease: EASE }}
                className="flex flex-col gap-2">
                <div className="rounded-xl border p-3"
                  style={{ background: "rgba(239,68,68,0.09)", borderColor: "rgba(239,68,68,0.26)" }}>
                  <div className="flex items-center gap-2 mb-1.5">
                    <Bug style={{ width: 12, height: 12, color: "#ef4444" }} />
                    <p className="text-[10.5px] font-bold text-red-400">تم اكتشاف: صدأ الأوراق</p>
                    <span className="text-[8.5px] bg-red-500/20 text-red-400 border border-red-500/25 px-1.5 py-0.5 rounded-full mr-auto flex-shrink-0">
                      73% احتمالية
                    </span>
                  </div>
                  <p className="text-[9.5px] text-foreground/70 leading-relaxed">
                    رش بمبيد فطري (ميتاكونازول أو بروبيكونازول) خلال 24 ساعة — أزل الأوراق المصابة فوراً لوقف الانتشار.
                  </p>
                </div>
                <button onClick={() => { setScanState("idle"); setImageUrl(null); }}
                  className="text-[9px] text-muted-foreground/55 hover:text-muted-foreground/90 text-center transition-colors py-1">
                  تحليل صورة أخرى
                </button>
              </motion.div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Phase 3A: Yield Projection Chart ───────────────────────────────── */
function YieldProjectionChart({ field }: { field: Field }) {
  const { yieldMonths, targetKg, predictedKg } = getForecastData(field);
  const maxVal = Math.max(...yieldMonths.flatMap(m => [m.predicted, m.target]));
  const W = 268, H = 96, PL = 28, PB = 18, PT = 6;
  const cW = W - PL - 8, cH = H - PB - PT;
  const grpW = cW / yieldMonths.length;
  const bw = (grpW - 5) / 2;

  return (
    <div className="flex flex-col gap-2">
      {/* Legend */}
      <div className="flex items-center gap-4 justify-end">
        {[{ color: "#10b981", label: "المتوقع" }, { color: "rgba(255,255,255,0.18)", label: "الهدف" }].map(l => (
          <div key={l.label} className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-sm" style={{ background: l.color }} />
            <span className="text-[8.5px] text-muted-foreground">{l.label}</span>
          </div>
        ))}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full overflow-visible">
        {/* Grid lines */}
        {[0, 0.5, 1].map(frac => {
          const y = PT + cH * (1 - frac);
          return (
            <g key={frac}>
              <line x1={PL} y1={y} x2={W - 6} y2={y} stroke="rgba(255,255,255,0.045)" strokeWidth="0.6" />
              {frac > 0 && (
                <text x={PL - 3} y={y + 3} textAnchor="end" fontSize="6" fill="rgba(255,255,255,0.28)">
                  {Math.round(maxVal * frac)}
                </text>
              )}
            </g>
          );
        })}
        {yieldMonths.map((m, i) => {
          const gx   = PL + i * grpW;
          const predH = (m.predicted / maxVal) * cH;
          const tgtH  = (m.target / maxVal) * cH;
          return (
            <g key={i}>
              {/* Target bar */}
              <rect x={gx + 2} y={PT + cH - tgtH} width={bw} height={tgtH}
                fill="rgba(255,255,255,0.10)" rx="1.5" />
              {/* Predicted bar — animated */}
              <motion.rect
                x={gx + 3 + bw} y={PT + cH} width={bw} height={0}
                fill="#10b981" rx="1.5"
                style={{ filter: "drop-shadow(0 0 3px #10b98155)" }}
                animate={{ y: PT + cH - predH, height: predH }}
                transition={{ duration: 0.95, ease: EASE, delay: i * 0.09 }}
              />
              {/* Month label */}
              <text x={gx + grpW / 2} y={H - 3} textAnchor="middle" fontSize="5.8"
                fill="rgba(255,255,255,0.30)">{m.month}</text>
            </g>
          );
        })}
      </svg>
      {/* KG summary pills */}
      <div className="grid grid-cols-2 gap-2">
        {[
          { label: "الإنتاج المتوقع", value: `${predictedKg.toLocaleString()} كغ/د`, color: "#10b981" },
          { label: "الهدف الموسمي",   value: `${targetKg.toLocaleString()} كغ/د`,   color: "rgba(255,255,255,0.40)" },
        ].map(p => (
          <div key={p.label} className="rounded-xl border px-3 py-2 text-center"
            style={{ background: "rgba(255,255,255,0.03)", borderColor: "rgba(255,255,255,0.07)" }}>
            <p className="text-[8px] text-muted-foreground mb-0.5">{p.label}</p>
            <p className="text-[11px] font-bold tabular-nums" style={{ color: p.color }}>{p.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Phase 3A: Disease Outbreak Gauge ───────────────────────────────── */
function DiseaseOutbreakGauge({ field }: { field: Field }) {
  const { diseases } = getForecastData(field);
  const overall  = getDiseaseRisk(field);
  const oc = overall >= 65 ? "#ef4444" : overall >= 40 ? "#f59e0b" : "#10b981";
  const ol = overall >= 65 ? "خطر عالٍ" : overall >= 40 ? "متوسط" : "منخفض";
  return (
    <div className="flex flex-col gap-3">
      {/* Overall risk header */}
      <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl border"
        style={{ background: oc + "0D", borderColor: oc + "30" }}>
        <HealthRing score={overall} color={oc} size={56} />
        <div>
          <p className="text-[10px] font-bold" style={{ color: oc }}>{ol}</p>
          <p className="text-[9px] text-muted-foreground mt-0.5 leading-relaxed">
            احتمالية الإصابة خلال 7 أيام
          </p>
        </div>
      </div>
      {/* Individual disease bars */}
      <div className="flex flex-col gap-2">
        {diseases.map((d, i) => {
          const dc = d.prob >= 55 ? "#ef4444" : d.prob >= 35 ? "#f59e0b" : "#10b981";
          return (
            <div key={i} className="flex items-center gap-2">
              <span className="text-[9.5px] text-muted-foreground flex-shrink-0 w-24 text-right">{d.name}</span>
              <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                <motion.div className="h-full rounded-full" style={{ background: dc }}
                  initial={{ width: 0 }}
                  animate={{ width: `${d.prob}%` }}
                  transition={{ duration: 0.9, ease: EASE, delay: 0.2 + i * 0.15 }} />
              </div>
              <span className="text-[9.5px] font-bold tabular-nums w-7 flex-shrink-0"
                style={{ color: dc }}>{d.prob}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Phase 3A: Weather Impact Cards ─────────────────────────────────── */
const WEATHER_ICON_MAP = { cold: Snowflake, wind: Wind, sun: Sun } as const;
const SEV_CFG = {
  critical: { color: "#ef4444", bg: "rgba(239,68,68,0.09)", border: "rgba(239,68,68,0.28)" },
  warning:  { color: "#f59e0b", bg: "rgba(245,158,11,0.08)", border: "rgba(245,158,11,0.24)" },
  info:     { color: "#38bdf8", bg: "rgba(56,189,248,0.07)", border: "rgba(56,189,248,0.22)" },
};

function WeatherImpactCards({ field }: { field: Field }) {
  const { weatherEvents } = getForecastData(field);
  return (
    <div className="flex flex-col gap-1.5">
      {weatherEvents.map((ev, i) => {
        const cfg  = SEV_CFG[ev.severity];
        const Icon = WEATHER_ICON_MAP[ev.icon];
        return (
          <motion.div key={i}
            initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.08 }}
            className="flex items-start gap-2.5 px-3 py-2.5 rounded-xl border"
            style={{ background: cfg.bg, borderColor: cfg.border }}>
            <Icon style={{ width: 13, height: 13, color: cfg.color, flexShrink: 0, marginTop: 1 }} />
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <p className="text-[10px] font-bold" style={{ color: cfg.color }}>{ev.event}</p>
                <span className="text-[8.5px] text-muted-foreground/55 flex-shrink-0">بعد {ev.days} أيام</span>
              </div>
              <p className="text-[9.5px] text-foreground/65 leading-relaxed">{ev.impact}</p>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

/* ─── Phase 3A: Forecast View (assembles the three above) ────────────── */
function ForecastView({ field }: { field: Field }) {
  return (
    <motion.div key={`fc-${field.id}`}
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.28, ease: EASE }}
      className="flex flex-col gap-4">

      {/* Section 1 — Yield Projection */}
      <div className="rounded-2xl border p-4" style={{
        background: "oklch(0.095 0.016 152 / 80%)", borderColor: "rgba(255,255,255,0.06)",
      }}>
        <div className="flex items-center gap-2 mb-3">
          <Target style={{ width: 12, height: 12, color: "#10b981" }} />
          <p className="text-[10px] font-bold text-foreground/80">توقعات الإنتاج</p>
          <span className="mr-auto text-[8.5px] text-muted-foreground/55">كغ / دونم · 6 أشهر</span>
        </div>
        <YieldProjectionChart field={field} />
      </div>

      {/* Section 2 — Disease Outbreak */}
      <div className="rounded-2xl border p-4" style={{
        background: "oklch(0.095 0.016 152 / 80%)", borderColor: "rgba(255,255,255,0.06)",
      }}>
        <div className="flex items-center gap-2 mb-3">
          <Bug style={{ width: 12, height: 12, color: "#ef4444" }} />
          <p className="text-[10px] font-bold text-foreground/80">احتمال تفشي الأمراض</p>
          <span className="mr-auto text-[8.5px] text-muted-foreground/55">7 أيام القادمة</span>
        </div>
        <DiseaseOutbreakGauge field={field} />
      </div>

      {/* Section 3 — Weather Impact */}
      <div className="rounded-2xl border p-4" style={{
        background: "oklch(0.095 0.016 152 / 80%)", borderColor: "rgba(255,255,255,0.06)",
      }}>
        <div className="flex items-center gap-2 mb-3">
          <Sun style={{ width: 12, height: 12, color: "#f59e0b" }} />
          <p className="text-[10px] font-bold text-foreground/80">تأثير الطقس على المحصول</p>
        </div>
        <WeatherImpactCards field={field} />
      </div>
    </motion.div>
  );
}

/* ─── Phase 3A: Smart Recommendations Card ───────────────────────────── */
const REC_CFG = {
  critical: { color: "#ef4444", bg: "rgba(239,68,68,0.08)", border: "rgba(239,68,68,0.26)" },
  warning:  { color: "#f59e0b", bg: "rgba(245,158,11,0.08)", border: "rgba(245,158,11,0.24)" },
  info:     { color: "#38bdf8", bg: "rgba(56,189,248,0.07)", border: "rgba(56,189,248,0.22)" },
};

function SmartRecsCard({ field }: { field: Field }) {
  const recs = getSmartRecs(field);
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  useEffect(() => { setOpenIdx(null); }, [field.id]);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Sparkles style={{ width: 12, height: 12, color: "#f59e0b" }} />
        <p className="text-[10.5px] font-bold text-foreground/80">إجراءات ذكية</p>
        <span className="mr-auto text-[8.5px] text-muted-foreground/50">{recs.length} توصيات</span>
      </div>

      {recs.map((rec, i) => {
        const cfg    = REC_CFG[rec.urgency];
        const isOpen = openIdx === i;
        return (
          <div key={i} className="rounded-xl border overflow-hidden"
            style={{ background: cfg.bg, borderColor: cfg.border,
              boxShadow: rec.urgency === "critical" ? `0 0 12px ${cfg.color}18` : "none" }}>
            <div className="px-3 py-2.5">
              <div className="flex items-start gap-2 mb-2">
                {rec.urgency === "critical"
                  ? <motion.span animate={{ opacity: [1, 0.25, 1] }} transition={{ duration: 1.3, repeat: Infinity }}>
                      <AlertTriangle style={{ width: 11, height: 11, color: cfg.color, marginTop: 1, flexShrink: 0 }} />
                    </motion.span>
                  : <div className="w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5" style={{ background: cfg.color }} />
                }
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-bold leading-snug" style={{ color: cfg.color }}>{rec.title}</p>
                  <p className="text-[9px] text-muted-foreground mt-0.5 leading-relaxed">{rec.reason}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button className="flex-1 py-1.5 rounded-lg text-[9px] font-bold border text-center transition-all hover:opacity-90"
                  style={{ background: cfg.color + "22", borderColor: cfg.color + "38", color: cfg.color }}>
                  {rec.action}
                </button>
                <button onClick={() => setOpenIdx(isOpen ? null : i)}
                  className="flex items-center gap-0.5 px-2 py-1.5 rounded-lg text-[8.5px] border transition-all hover:bg-white/[0.04]"
                  style={{ borderColor: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.45)" }}>
                  لماذا؟
                  {isOpen
                    ? <ChevronUp style={{ width: 9, height: 9 }} />
                    : <ChevronDown style={{ width: 9, height: 9 }} />}
                </button>
              </div>
            </div>

            {/* Explainability section */}
            <AnimatePresence>
              {isOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.22 }}
                  className="overflow-hidden border-t"
                  style={{ borderColor: cfg.border }}>
                  <div className="px-3 py-2.5">
                    <p className="text-[8.5px] text-muted-foreground/60 mb-2">البيانات المستخدمة في التوصية:</p>
                    <div className="flex flex-wrap gap-1.5">
                      {rec.dataPoints.map((dp, j) => (
                        <span key={j} className="text-[8px] px-2 py-0.5 rounded-md border"
                          style={{ background: cfg.color + "12", borderColor: cfg.color + "28", color: cfg.color + "CC" }}>
                          {dp}
                        </span>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}

/* ─── Phase 3A: Agent Hub Strip (panel-level, field-specific) ────────── */
const PANEL_AGENTS: { name: string; initial: string; color: string; getMsg: (f: Field) => string }[] = [
  {
    name: "وكيل الطقس", initial: "ط", color: "#38bdf8",
    getMsg: (f) => `يحلل توقعات الحرارة في ${f.province} — نافذة تنبؤ 48 ساعة`,
  },
  {
    name: "وكيل التربة", initial: "ت", color: "#10b981",
    getMsg: (f) => `يراجع مستويات النيتروجين في ${f.name} — آخر قياس قبل ساعتين`,
  },
  {
    name: "كاشف الأمراض", initial: "م", color: "#ef4444",
    getMsg: (f) => `يفحص مؤشرات الصدأ والآفات في ${f.name} — المخاطر تُقيَّم آنيًّا`,
  },
];

function AgentHubStrip({ field }: { field: Field }) {
  const [active, setActive] = useState(0);

  useEffect(() => {
    setActive(0);
    const id = setInterval(() => setActive(i => (i + 1) % PANEL_AGENTS.length), 3400);
    return () => clearInterval(id);
  }, [field.id]);

  return (
    <div className="flex-shrink-0 border-t"
      style={{ background: "oklch(0.065 0.011 152 / 93%)", borderColor: "rgba(52,211,153,0.08)" }}>
      <div className="px-4 pt-2.5 pb-1.5">
        <div className="flex items-center gap-1.5 mb-2.5">
          <motion.div className="w-1.5 h-1.5 rounded-full bg-emerald-400"
            animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1.2, repeat: Infinity }} />
          <p className="text-[8.5px] font-bold text-muted-foreground/60 uppercase tracking-wide">
            وكلاء نشطون · {field.name}
          </p>
        </div>

        {/* Agent avatars row */}
        <div className="flex items-center gap-2.5 mb-2">
          {PANEL_AGENTS.map((ag, i) => {
            const isAct = i === active;
            return (
              <div key={i} className="relative flex flex-col items-center gap-1">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold border-2 transition-all duration-300"
                  style={{
                    background: isAct ? ag.color + "25" : ag.color + "0E",
                    borderColor: isAct ? ag.color + "80" : ag.color + "25",
                    color: ag.color,
                    boxShadow: isAct ? `0 0 12px ${ag.color}40` : "none",
                  }}>
                  {ag.initial}
                </div>
                {isAct && (
                  <motion.div
                    className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2"
                    style={{ background: ag.color, borderColor: "oklch(0.065 0.011 152)" }}
                    animate={{ scale: [1, 1.45, 1] }}
                    transition={{ duration: 1.1, repeat: Infinity }} />
                )}
                <span className="text-[7.5px] text-muted-foreground/55 text-center leading-tight w-10">
                  {ag.name.replace("وكيل ", "")}
                </span>
              </div>
            );
          })}
        </div>

        {/* Live message ticker */}
        <div className="rounded-lg border px-2.5 py-1.5 min-h-[28px]"
          style={{ background: "rgba(255,255,255,0.025)", borderColor: "rgba(255,255,255,0.06)" }}>
          <AnimatePresence mode="wait">
            <motion.p key={active}
              initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.2 }}
              className="text-[9px] leading-relaxed"
              style={{ color: PANEL_AGENTS[active].color + "BB" }}>
              {PANEL_AGENTS[active].getMsg(field)}
            </motion.p>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

/* ─── Phase 3B: Seasonal Bar Chart ──────────────────────────────────── */
function SeasonalBarChart({ field }: { field: Field }) {
  const data   = getSeasonalData(field);
  const maxVal = Math.max(...data.flatMap(d => [d.current, d.previous]));
  const W = 268, H = 92, PL = 26, PB = 16, PT = 4;
  const cW = W - PL - 6, cH = H - PB - PT;
  const grpW = cW / data.length;
  const bw   = (grpW - 6) / 2;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-4 justify-end">
        {[{ color: "#10b981", label: "الموسم الحالي" }, { color: "rgba(255,255,255,0.20)", label: "الموسم السابق" }].map(l => (
          <div key={l.label} className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-sm" style={{ background: l.color }} />
            <span className="text-[8px] text-muted-foreground">{l.label}</span>
          </div>
        ))}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full overflow-visible">
        {[0, 0.5, 1].map(frac => {
          const y = PT + cH * (1 - frac);
          return (
            <g key={frac}>
              <line x1={PL} y1={y} x2={W - 4} y2={y} stroke="rgba(255,255,255,0.04)" strokeWidth="0.5" />
              {frac > 0 && (
                <text x={PL - 3} y={y + 3} textAnchor="end" fontSize="5.5" fill="rgba(255,255,255,0.25)">
                  {Math.round(maxVal * frac)}
                </text>
              )}
            </g>
          );
        })}
        {data.map((d, i) => {
          const gx   = PL + i * grpW;
          const prevH = maxVal > 0 ? (d.previous / maxVal) * cH : 0;
          const curH  = maxVal > 0 ? (d.current  / maxVal) * cH : 0;
          return (
            <g key={i}>
              <rect x={gx + 2} y={PT + cH - prevH} width={bw} height={prevH}
                fill="rgba(255,255,255,0.12)" rx="1.5" />
              <motion.rect
                x={gx + 3 + bw} y={PT + cH} width={bw} height={0}
                fill="#10b981" rx="1.5"
                style={{ filter: "drop-shadow(0 0 3px #10b98155)" }}
                animate={{ y: PT + cH - curH, height: curH }}
                transition={{ duration: 0.9, ease: EASE, delay: i * 0.08 }}
              />
              <text x={gx + grpW / 2} y={H - 2} textAnchor="middle" fontSize="5.5"
                fill="rgba(255,255,255,0.28)">{d.month}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/* ─── Phase 3B: Resource Donut Chart ─────────────────────────────────── */
function ResourceDonutChart({ field }: { field: Field }) {
  const segments = getResourceData(field);
  const r = 36, cx = 52, cy = 52;
  const circ = 2 * Math.PI * r;
  const GAP  = 2;

  let accPct = 0;
  const arcs = segments.map(seg => {
    const startFrac = accPct / 100;
    const frac      = seg.value / 100;
    accPct += seg.value;
    return {
      ...seg,
      dashArray:  `${frac * circ - GAP} ${(1 - frac) * circ + GAP}`,
      dashOffset: circ * (1 - startFrac),
    };
  });

  return (
    <div className="flex items-center gap-4">
      <div className="relative flex-shrink-0" style={{ width: 104, height: 104 }}>
        <svg width={104} height={104} style={{ transform: "rotate(-90deg)" }}>
          <circle cx={cx} cy={cy} r={r} fill="none"
            stroke="rgba(255,255,255,0.05)" strokeWidth="12" />
          {arcs.map((arc, i) => (
            <motion.circle key={i}
              cx={cx} cy={cy} r={r} fill="none"
              stroke={arc.color} strokeWidth="12" strokeLinecap="butt"
              strokeDasharray={arc.dashArray}
              strokeDashoffset={arc.dashOffset}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: i * 0.14, duration: 0.40 }}
              style={{ filter: `drop-shadow(0 0 3px ${arc.color}55)` }}
            />
          ))}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[14px] font-bold tabular-nums" style={{ color: segments[0].color }}>
            {segments[0].value}%
          </span>
          <span className="text-[7.5px] text-muted-foreground">{segments[0].label}</span>
        </div>
      </div>
      <div className="flex flex-col gap-2.5 flex-1">
        {segments.map((seg, i) => (
          <motion.div key={i}
            initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.12 + i * 0.10 }}
            className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: seg.color }} />
            <span className="text-[9px] text-muted-foreground flex-1">{seg.label}</span>
            <span className="text-[10px] font-bold tabular-nums" style={{ color: seg.color }}>{seg.value}%</span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

/* ─── Phase 3B: Health vs Stress Trend Chart ─────────────────────────── */
function HealthStressTrendChart({ field }: { field: Field }) {
  const data = getHealthStressHistory(field);
  const W = 268, H = 88, PL = 24, PB = 16, PT = 6;
  const cW = W - PL - 6, cH = H - PB - PT;
  const uid = useId().replace(/:/g, "");

  const ptH = data.map((d, i): [number, number] => [
    PL + (i / (data.length - 1)) * cW,
    PT + cH * (1 - d.health / 100),
  ]);
  const ptS = data.map((d, i): [number, number] => [
    PL + (i / (data.length - 1)) * cW,
    PT + cH * (1 - d.stress / 100),
  ]);

  const makePath = (pts: [number, number][]) =>
    pts.reduce((acc, [x, y], i) => {
      if (i === 0) return `M${x},${y}`;
      const [px, py] = pts[i - 1];
      return `${acc} C${px + (x - px) * 0.5},${py} ${x - (x - px) * 0.5},${y} ${x},${y}`;
    }, "");

  const makeArea = (pts: [number, number][], baseline: number) =>
    `${makePath(pts)} L${pts[pts.length - 1][0]},${baseline} L${pts[0][0]},${baseline} Z`;

  const hLine = makePath(ptH);
  const sLine = makePath(ptS);
  const hArea = makeArea(ptH, PT + cH);
  const sArea = makeArea(ptS, PT + cH);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-4 justify-end">
        {[{ color: "#10b981", label: "الصحة" }, { color: "#38bdf8", label: "الإجهاد" }].map(l => (
          <div key={l.label} className="flex items-center gap-1.5">
            <div className="w-5 h-0.5 rounded-full" style={{ background: l.color }} />
            <span className="text-[8px] text-muted-foreground">{l.label}</span>
          </div>
        ))}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full overflow-visible">
        <defs>
          <linearGradient id={`hst-hg-${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#10b981" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
          </linearGradient>
          <linearGradient id={`hst-sg-${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.16" />
            <stop offset="100%" stopColor="#38bdf8" stopOpacity="0" />
          </linearGradient>
          <clipPath id={`hst-clip-${uid}`}>
            <rect x={PL} y={PT} width={cW} height={cH + 2} />
          </clipPath>
        </defs>
        {[0, 0.5, 1].map(frac => {
          const y = PT + cH * (1 - frac);
          return (
            <g key={frac}>
              <line x1={PL} y1={y} x2={W - 4} y2={y} stroke="rgba(255,255,255,0.04)" strokeWidth="0.5" />
              <text x={PL - 3} y={y + 3} textAnchor="end" fontSize="5.5" fill="rgba(255,255,255,0.25)">
                {Math.round(frac * 100)}
              </text>
            </g>
          );
        })}
        <path d={hArea} fill={`url(#hst-hg-${uid})`} clipPath={`url(#hst-clip-${uid})`} />
        <path d={sArea} fill={`url(#hst-sg-${uid})`} clipPath={`url(#hst-clip-${uid})`} />
        <motion.path d={hLine} fill="none" stroke="#10b981" strokeWidth="1.6" strokeLinecap="round"
          initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
          transition={{ duration: 1.6, ease: EASE, delay: 0.1 }} />
        <motion.path d={sLine} fill="none" stroke="#38bdf8" strokeWidth="1.6" strokeLinecap="round"
          initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
          transition={{ duration: 1.6, ease: EASE, delay: 0.25 }} />
        {([0, 10, 20, 29] as const).map(i => (
          <text key={i} x={PL + (i / 29) * cW} y={H - 2}
            textAnchor="middle" fontSize="5.5" fill="rgba(255,255,255,0.25)">
            -{29 - i}
          </text>
        ))}
      </svg>
    </div>
  );
}

/* ─── Phase 3B: Analytics View ───────────────────────────────────────── */
function AnalyticsView({ field }: { field: Field }) {
  const data  = getAnalysisData(field);
  const nutrientColor = (v: number) => v >= 65 ? "#10b981" : v >= 45 ? "#f59e0b" : "#ef4444";

  return (
    <motion.div key={`at-${field.id}`}
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.28, ease: EASE }}
      className="flex flex-col gap-4">

      {/* Seasonal Comparison */}
      <div className="rounded-2xl border p-4"
        style={{ background: "oklch(0.095 0.016 152 / 80%)", borderColor: "rgba(255,255,255,0.06)" }}>
        <div className="flex items-center gap-2 mb-3">
          <BarChart3 style={{ width: 12, height: 12, color: "#10b981" }} />
          <p className="text-[10px] font-bold text-foreground/80">مقارنة الإنتاجية الموسمية</p>
          <span className="mr-auto text-[8.5px] text-muted-foreground/55">كغ / دونم</span>
        </div>
        <SeasonalBarChart field={field} />
      </div>

      {/* Resource Allocation */}
      <div className="rounded-2xl border p-4"
        style={{ background: "oklch(0.095 0.016 152 / 80%)", borderColor: "rgba(255,255,255,0.06)" }}>
        <div className="flex items-center gap-2 mb-3">
          <Layers style={{ width: 12, height: 12, color: "#a78bfa" }} />
          <p className="text-[10px] font-bold text-foreground/80">توزيع الموارد</p>
          <span className="mr-auto text-[8.5px] text-muted-foreground/55">% من الإجمالي</span>
        </div>
        <ResourceDonutChart field={field} />
      </div>

      {/* Health vs Stress Trend */}
      <div className="rounded-2xl border p-4"
        style={{ background: "oklch(0.095 0.016 152 / 80%)", borderColor: "rgba(255,255,255,0.06)" }}>
        <div className="flex items-center gap-2 mb-3">
          <Activity style={{ width: 12, height: 12, color: "#38bdf8" }} />
          <p className="text-[10px] font-bold text-foreground/80">الصحة مقابل الإجهاد — 30 يوماً</p>
        </div>
        <HealthStressTrendChart field={field} />
      </div>

      {/* Soil Mini Bar */}
      <div className="rounded-2xl border p-4"
        style={{ background: "oklch(0.095 0.016 152 / 80%)", borderColor: "rgba(255,255,255,0.06)" }}>
        <p className="text-[10px] font-bold text-foreground/70 mb-3 flex items-center gap-1.5">
          <Layers style={{ width: 12, height: 12, color: "#10b981" }} /> تحليل التربة
        </p>
        <MiniBarChart bars={[
          { label: "نيتروجين",    value: data.nitrogen,                 color: nutrientColor(data.nitrogen)   },
          { label: "فوسفور",     value: data.phosphorus,               color: nutrientColor(data.phosphorus) },
          { label: "بوتاسيوم",   value: data.potassium,                color: nutrientColor(data.potassium)  },
          { label: "مادة عضوية", value: parseFloat(data.organic) * 25, color: "#a78bfa"                      },
          { label: "pH",         value: (data.ph / 9) * 100,           color: "#38bdf8", unit: "pH"           },
        ]} />
      </div>

      {/* Image Intelligence Hub */}
      <ImageIntelligenceHub fieldId={field.id} />
    </motion.div>
  );
}

/* ─── Deep Analysis View ─────────────────────────────────────────────── */
function DeepAnalysisView({ field }: { field: Field }) {
  const data  = getAnalysisData(field);
  const color = healthColor(field.healthScore);
  const uid   = useId().replace(/:/g, "");
  const nutrientColor = (v: number) => v >= 65 ? "#10b981" : v >= 45 ? "#f59e0b" : "#ef4444";
  return (
    <motion.div key={`an-${field.id}`}
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.28, ease: EASE }}
      className="flex flex-col gap-4">
      <div className="rounded-2xl border p-4"
        style={{ background: "oklch(0.095 0.016 152 / 80%)", borderColor: "rgba(255,255,255,0.06)" }}>
        <p className="text-[10px] font-bold text-foreground/70 mb-3 flex items-center gap-1.5">
          <Layers style={{ width: 12, height: 12, color: "#10b981" }} /> تحليل التربة
        </p>
        <MiniBarChart bars={[
          { label: "نيتروجين",    value: data.nitrogen,                        color: nutrientColor(data.nitrogen)   },
          { label: "فوسفور",     value: data.phosphorus,                      color: nutrientColor(data.phosphorus) },
          { label: "بوتاسيوم",   value: data.potassium,                       color: nutrientColor(data.potassium)  },
          { label: "مادة عضوية", value: parseFloat(data.organic) * 25,        color: "#a78bfa", unit: "%" },
          { label: "pH",         value: (data.ph / 9) * 100,                  color: "#38bdf8", unit: "pH" },
        ]} />
        <div className="grid grid-cols-3 gap-2 mt-3">
          {[
            { label: "مادة عضوية",   value: data.organic + "%",      color: "#a78bfa" },
            { label: "درجة الحموضة", value: `pH ${data.ph}`,         color: "#38bdf8" },
            { label: "إنتاج متوقع",  value: `${data.yieldEst} كغ/د`, color },
          ].map(({ label, value, color: c }) => (
            <div key={label} className="rounded-xl bg-white/[0.03] border border-white/[0.05] px-2 py-2 text-center">
              <p className="text-[8px] text-muted-foreground mb-0.5">{label}</p>
              <p className="text-[11px] font-bold tabular-nums" style={{ color: c }}>{value}</p>
            </div>
          ))}
        </div>
      </div>
      {data.risks.length > 0 && (
        <div className="rounded-2xl border p-4" style={{
          background: "linear-gradient(135deg,rgba(239,68,68,0.07),rgba(239,68,68,0.02))",
          borderColor: "rgba(239,68,68,0.18)",
        }}>
          <p className="text-[10px] font-bold text-red-400/90 mb-2.5 flex items-center gap-1.5">
            <AlertTriangle style={{ width: 11, height: 11 }} /> عوامل الخطر
          </p>
          <ul className="space-y-1.5">
            {data.risks.map(r => (
              <li key={r} className="flex items-start gap-2 text-[10px] text-foreground/70">
                <span className="w-1 h-1 rounded-full bg-red-400 mt-1.5 flex-shrink-0" />{r}
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="rounded-2xl border p-4" style={{
        background: "linear-gradient(135deg,rgba(16,185,129,0.08),rgba(16,185,129,0.02))",
        borderColor: "rgba(52,211,153,0.18)",
      }}>
        <p className="text-[10px] font-bold text-emerald-400/90 mb-2.5 flex items-center gap-1.5">
          <CheckCircle style={{ width: 11, height: 11 }} /> التوصيات
        </p>
        <ul className="space-y-1.5">
          {data.recs.map(r => (
            <li key={r} className="flex items-start gap-2 text-[10px] text-foreground/70">
              <span className="w-1 h-1 rounded-full bg-emerald-400 mt-1.5 flex-shrink-0" />{r}
            </li>
          ))}
        </ul>
      </div>
      <div className="rounded-2xl border p-4"
        style={{ background: "oklch(0.095 0.016 152 / 80%)", borderColor: "rgba(255,255,255,0.06)" }}>
        <GradientSparkline data={field.history} color={color} uid={uid} width={232} height={52} />
      </div>
    </motion.div>
  );
}

/* ─── Irrigation Calendar View ───────────────────────────────────────── */
function IrrigationCalendarView({ field }: { field: Field }) {
  const plan    = getIrrigationPlan(field);
  const urgColor = { critical: "#ef4444", high: "#f59e0b", normal: "#38bdf8", none: "transparent" };
  const urgBg   = { critical: "rgba(239,68,68,0.10)", high: "rgba(245,158,11,0.08)", normal: "rgba(56,189,248,0.08)", none: "rgba(255,255,255,0.03)" };
  return (
    <motion.div key={`ir-${field.id}`}
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.28, ease: EASE }}
      className="flex flex-col gap-4">
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: "دورة الري",        value: `كل ${plan.interval} أيام`,               Icon: CalendarDays, color: "#38bdf8" },
          { label: "مرات هذا الأسبوع", value: `${plan.days.filter(d => d.due).length}`, Icon: Droplets,     color: "#10b981" },
          { label: "إجمالي المياه",    value: `${(plan.total / 1000).toFixed(1)}م³`,    Icon: Zap,          color: "#f59e0b" },
        ].map(({ label, value, Icon, color }) => (
          <div key={label} className="rounded-xl border p-3 text-center"
            style={{ background: color + "0F", borderColor: color + "28" }}>
            <Icon style={{ width: 14, height: 14, color, margin: "0 auto 4px" }} />
            <p className="text-[11px] font-bold tabular-nums" style={{ color }}>{value}</p>
            <p className="text-[8px] text-muted-foreground mt-0.5">{label}</p>
          </div>
        ))}
      </div>
      <div className="rounded-2xl border overflow-hidden"
        style={{ background: "oklch(0.095 0.016 152 / 80%)", borderColor: "rgba(255,255,255,0.06)" }}>
        <div className="px-4 py-2.5 border-b border-white/[0.05]">
          <p className="text-[10px] font-bold text-foreground/70 flex items-center gap-1.5">
            <CalendarDays style={{ width: 11, height: 11, color: "#38bdf8" }} /> جدول الري — 7 أيام
          </p>
        </div>
        <div className="grid grid-cols-7 divide-x divide-x-reverse divide-white/[0.04]">
          {plan.days.map(({ label, due, amount, urgency }) => (
            <div key={label} className="flex flex-col items-center gap-2 py-3 px-1.5 text-center"
              style={{
                background: urgBg[urgency as keyof typeof urgBg],
                borderBottom: `2px solid ${urgColor[urgency as keyof typeof urgColor]}`,
              }}>
              <p className="text-[8px] text-muted-foreground leading-tight">{label}</p>
              {due ? (
                <>
                  <motion.div animate={{ y: [0, -2, 0] }} transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}>
                    <Droplets style={{ width: 14, height: 14, color: urgColor[urgency as keyof typeof urgColor], filter: `drop-shadow(0 0 4px ${urgColor[urgency as keyof typeof urgColor]}AA)` }} />
                  </motion.div>
                  <p className="text-[8.5px] font-bold tabular-nums leading-none"
                    style={{ color: urgColor[urgency as keyof typeof urgColor] }}>
                    {amount}<span className="text-[7px] text-muted-foreground"> ل</span>
                  </p>
                </>
              ) : (
                <div className="flex flex-col items-center gap-1.5">
                  <Minus style={{ width: 12, height: 12, color: "rgba(255,255,255,0.18)" }} />
                  <p className="text-[8px] text-muted-foreground/40">—</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-2xl border px-4 py-3" style={{
        background: "linear-gradient(135deg,rgba(56,189,248,0.07),rgba(56,189,248,0.02))",
        borderColor: "rgba(56,189,248,0.18)",
      }}>
        <div className="flex items-start gap-2">
          <Bot style={{ width: 13, height: 13, color: "#38bdf8", flexShrink: 0, marginTop: 1 }} />
          <p className="text-[10px] text-foreground/70 leading-relaxed">
            {field.waterStress > 65
              ? `الإجهاد المائي الحالي (${field.waterStress}%) يستدعي زيادة الكميات — راقب التربة يومياً.`
              : field.waterStress > 35
              ? `الرطوبة في مستوى مقبول — اتبع الجدول بانتظام لتجنب الإجهاد.`
              : `الإجهاد المائي منخفض (${field.waterStress}%) — تجنب الإفراط في الري لحماية الجذور.`}
          </p>
        </div>
      </div>
    </motion.div>
  );
}

/* ─── Agent Activity Log ─────────────────────────────────────────────── */
const ALL_AGENTS = [
  { name: "وكيل الطقس",   Icon: Thermometer,  color: "#38bdf8" },
  { name: "وكيل التربة",  Icon: Layers,       color: "#10b981" },
  { name: "وكيل السوق",   Icon: TrendingUp,   color: "#f59e0b" },
  { name: "كاشف الأمراض", Icon: AlertTriangle, color: "#ef4444" },
];
function AgentActivityLog({ field }: { field: Field | null }) {
  const [idx, setIdx] = useState(0);
  const logs = field ? [
    { ...ALL_AGENTS[0], msg: `يرصد درجات الحرارة في محافظة ${field.province}` },
    { ...ALL_AGENTS[1], msg: `يقيس رطوبة تربة ${field.name} — النتائج خلال دقيقتين` },
    { ...ALL_AGENTS[2], msg: `يتابع أسعار ${field.crop} في أسواق المنطقة` },
    { ...ALL_AGENTS[3], msg: `يفحص مؤشرات الآفات الموسمية في ${field.name}` },
  ] : [
    { ...ALL_AGENTS[0], msg: "يرصد الطقس الزراعي في 14 محافظة سورية" },
    { ...ALL_AGENTS[1], msg: "يحلل بيانات التربة والرطوبة للموسم الحالي" },
    { ...ALL_AGENTS[2], msg: "يتابع تحركات أسعار المحاصيل الرئيسية" },
    { ...ALL_AGENTS[3], msg: "يراقب تقارير الآفات والأمراض في المزارع" },
  ];
  useEffect(() => {
    setIdx(0);
    const id = setInterval(() => setIdx(i => (i + 1) % logs.length), 3000);
    return () => clearInterval(id);
  }, [field?.id, logs.length]);
  const cur = logs[idx];
  return (
    <div className="flex-shrink-0 flex items-center gap-3 px-4 py-2.5 border-t"
      style={{ background: "oklch(0.068 0.012 152 / 94%)", backdropFilter: "blur(12px)", borderColor: "rgba(52,211,153,0.09)" }}>
      <div className="flex items-center gap-2 flex-shrink-0">
        <motion.div className="w-1.5 h-1.5 rounded-full" style={{ background: cur.color }}
          animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1.5, repeat: Infinity }} />
        <span className="text-[9px] font-bold flex-shrink-0" style={{ color: cur.color }}>{cur.name}</span>
      </div>
      <div className="flex-1 overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.p key={idx}
            initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }} transition={{ duration: 0.22 }}
            className="text-[9.5px] text-muted-foreground truncate">
            {cur.msg}
          </motion.p>
        </AnimatePresence>
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        {ALL_AGENTS.map((a, i) => (
          <motion.div key={i} className="w-1 h-1 rounded-full" style={{ background: a.color }}
            animate={{ opacity: i === idx ? 1 : 0.2 }} transition={{ duration: 0.2 }} />
        ))}
      </div>
    </div>
  );
}

/* ─── Compact Field List Card ────────────────────────────────────────── */
function FieldListCard({ field: f, selected, onClick }: {
  field: Field; selected: boolean; onClick: () => void;
}) {
  const color   = healthColor(f.healthScore);
  const hasCrit = f.healthScore < 50 || f.waterStress > 70;
  return (
    <motion.div id={`fc-${f.id}`} onClick={onClick}
      whileHover={{ x: -2 }} transition={{ duration: 0.14 }}
      className={cn("flex items-center gap-2.5 px-3 py-2.5 rounded-xl cursor-pointer transition-all duration-200 border",
        selected ? "border shadow-lg" : "border-transparent hover:border-white/[0.06] hover:bg-white/[0.03]")}
      style={selected ? {
        background: `linear-gradient(135deg, ${color}0F 0%, oklch(0.11 0.020 152 / 92%) 100%)`,
        borderColor: color + "45", boxShadow: `0 4px 22px ${color}18`,
      } : undefined}>
      <GlowDot color={color} pulse={hasCrit} size={7} />
      <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: color + "1A", border: `1px solid ${color}35` }}>
        <CropIcon crop={f.crop} className="w-4 h-4" style={{ color }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[12px] font-bold text-foreground truncate leading-tight">{f.name}</p>
        <p className="text-[9px] text-muted-foreground truncate mt-0.5">{f.crop} · {f.province}</p>
      </div>
      <div className="flex flex-col items-end flex-shrink-0 gap-0.5">
        <span className="text-[12px] font-bold tabular-nums leading-tight" style={{ color }}>{f.healthScore}%</span>
        {hasCrit && <AlertTriangle className="w-2.5 h-2.5 text-red-400" />}
      </div>
    </motion.div>
  );
}

/* ─── Overlay Toggle Bar ─────────────────────────────────────────────── */
const OVERLAYS: { val: Overlay; label: string; Icon: React.ElementType; color: string }[] = [
  { val: "health",   label: "الصحة",   Icon: Activity,    color: "#10b981" },
  { val: "heat",     label: "الحرارة", Icon: Thermometer, color: "#f87171" },
  { val: "moisture", label: "الرطوبة", Icon: Droplets,    color: "#38bdf8" },
];
function OverlayBar({ active, onToggle }: { active: Overlay; onToggle: (v: Overlay) => void }) {
  return (
    <div className="absolute top-3 right-3 z-10 flex flex-col gap-1.5" dir="rtl">
      {OVERLAYS.map(({ val, label, Icon, color }) => {
        const on = active === val;
        return (
          <button key={val!} onClick={() => onToggle(on ? null : val)}
            className={cn("flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[9.5px] font-semibold border transition-all duration-200",
              !on && "bg-black/30 border-white/[0.10] text-white/50 hover:text-white/75")}
            style={on ? {
              background: color + "22", backdropFilter: "blur(12px)",
              borderColor: color + "50", color,
            } : { backdropFilter: "blur(10px)" }}>
            <Icon style={{ width: 10, height: 10 }} /> {label}
          </button>
        );
      })}
    </div>
  );
}

/* ─── Field Map ──────────────────────────────────────────────────────── */
function FieldMap({ fields, selectedId, overlay, onSelect }: {
  fields: Field[]; selectedId: number | null; overlay: Overlay; onSelect: (id: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [cssTransform, setCssTransform] = useState("scale(1) translate(0px,0px)");
  const [hoveredId, setHoveredId]       = useState<number | null>(null);
  const selectedField = fields.find(f => f.id === selectedId) ?? null;

  useEffect(() => {
    const el = containerRef.current;
    if (!el || !selectedField) { setCssTransform("scale(1) translate(0px,0px)"); return; }
    const bbox = PROVINCE_BBOX[selectedField.province];
    if (!bbox) { setCssTransform("scale(1) translate(0px,0px)"); return; }
    const W = el.offsetWidth, H = el.offsetHeight;
    if (!W || !H) return;
    const [bx, by, bw, bh] = bbox;
    const svgAspect = VBW / VBH, cAspect = W / H;
    let svgW: number, svgH: number, offX: number, offY: number;
    if (cAspect > svgAspect) {
      svgH = H; svgW = H * svgAspect; offX = (W - svgW) / 2; offY = 0;
    } else {
      svgW = W; svgH = W / svgAspect; offX = 0; offY = (H - svgH) / 2;
    }
    const pcx = bx + bw / 2, pcy = by + bh / 2;
    const ppx = offX + pcx / VBW * svgW, ppy = offY + pcy / VBH * svgH;
    const sx = (W * 0.70) / (bw / VBW * svgW);
    const sy = (H * 0.70) / (bh / VBH * svgH);
    const scale = Math.min(Math.max(Math.min(sx, sy), 1.6), 5.5);
    setCssTransform(`scale(${scale}) translate(${W / 2 - ppx}px,${H / 2 - ppy}px)`);
  }, [selectedField?.province]);

  const layerData: Record<string, number> = {};
  PROVINCES.forEach(p => {
    const pf = fields.filter(f => f.province === p.name);
    if (!pf.length) return;
    layerData[p.name] = overlay === "heat"
      ? pf.reduce((s, f) => s + f.waterStress, 0) / pf.length / 100
      : overlay === "moisture"
      ? pf.reduce((s, f) => s + (100 - f.waterStress), 0) / pf.length / 100
      : pf.reduce((s, f) => s + f.healthScore, 0) / pf.length / 100;
  });

  const layerColorFn = (v: number): string => {
    if (overlay === "heat")     return `rgba(239,68,68,${+(0.08 + v * 0.55).toFixed(3)})`;
    if (overlay === "moisture") return `rgba(56,189,248,${+(0.08 + v * 0.52).toFixed(3)})`;
    if (v >= 0.75) return `rgba(16,185,129,${+(0.10 + v * 0.52).toFixed(3)})`;
    if (v >= 0.50) return `rgba(245,158,11,${+(0.10 + v * 0.45).toFixed(3)})`;
    return `rgba(239,68,68,${+(0.12 + (1 - v) * 0.52).toFixed(3)})`;
  };

  const alertProvs = [...new Set(fields.filter(f => f.healthScore < 50 || f.waterStress > 70).map(f => f.province))];

  return (
    <div ref={containerRef} className="relative w-full h-full overflow-hidden">
      <div className="absolute inset-0 opacity-[0.012] pointer-events-none"
        style={{ backgroundImage: "radial-gradient(circle,rgba(52,211,153,1) 1px,transparent 1px)", backgroundSize: "18px 18px" }} />
      <div className="absolute inset-0"
        style={{ transformOrigin: "50% 50%", transform: cssTransform, transition: "transform 0.88s cubic-bezier(0.22,1,0.36,1)" }}>
        <SyriaMap className="w-full h-full"
          layerData={Object.keys(layerData).length ? layerData : undefined}
          layerColorFn={Object.keys(layerData).length ? layerColorFn : undefined}
          activeProvinces={selectedField ? [selectedField.province] : []}
          activeColor={selectedField ? healthColor(selectedField.healthScore) : "#10b981"}
          alertProvinces={alertProvs} />
        <svg className="absolute inset-0 w-full h-full" viewBox={VIEW_BOX} preserveAspectRatio="xMidYMid meet">
          {fields.map(f => {
            const color  = healthColor(f.healthScore);
            const isSel  = f.id === selectedId;
            const isHov  = f.id === hoveredId && !isSel;
            const isCrit = f.healthScore < 50 || f.waterStress > 70;
            const [gpx, gpy] = f.geoPin;
            const pDur = isCrit ? 1.6 : 2.8;
            return (
              <g key={f.id} style={{ cursor: "pointer" }}
                onClick={() => onSelect(f.id)}
                onMouseEnter={() => setHoveredId(f.id)}
                onMouseLeave={() => setHoveredId(null)}>
                {!isSel && (
                  <motion.circle cx={gpx} cy={gpy} r={0.036}
                    fill="none" stroke={color + "80"} strokeWidth="0.010"
                    animate={{ r: [0.036, 0.15, 0.036], opacity: [0.75, 0, 0.75] }}
                    transition={{ duration: pDur, repeat: Infinity, ease: "easeInOut", delay: f.id * 0.44 }} />
                )}
                {isCrit && !isSel && (
                  <motion.circle cx={gpx} cy={gpy} r={0.050}
                    fill="none" stroke="#ef444478" strokeWidth="0.008"
                    animate={{ r: [0.050, 0.20, 0.050], opacity: [0.55, 0, 0.55] }}
                    transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut", delay: f.id * 0.44 + 0.8 }} />
                )}
                <circle cx={gpx} cy={gpy}
                  r={isSel ? 0.019 : isHov ? 0.030 : 0.025}
                  fill={color}
                  style={{ filter: `drop-shadow(0 0 ${isSel ? "0.06" : "0.03"}px ${color}EE)` }} />
                {isSel && (
                  <motion.circle cx={gpx} cy={gpy} r={0.048}
                    fill="none" stroke={color} strokeWidth="0.008"
                    strokeDasharray="0.035 0.020"
                    animate={{ strokeDashoffset: [0, -0.22] }}
                    transition={{ duration: 3.2, repeat: Infinity, ease: "linear" }} />
                )}
                {(isSel || isHov) && (
                  <g style={{ pointerEvents: "none" }}>
                    <rect x={gpx - 0.28} y={isSel ? gpy - 0.32 : gpy - 0.24}
                      width={0.56} height={isSel ? 0.18 : 0.13} rx={0.030}
                      fill="oklch(0.08 0.022 152 / 0.93)" stroke={color + "55"} strokeWidth="0.007" />
                    <text x={gpx} y={isSel ? gpy - 0.245 : gpy - 0.165}
                      textAnchor="middle" dominantBaseline="middle"
                      fontSize="0.075" fontWeight="700" fill={color}
                      style={{ fontFamily: "system-ui" }}>
                      {f.name}
                    </text>
                    {isSel && (
                      <text x={gpx} y={gpy - 0.175}
                        textAnchor="middle" dominantBaseline="middle"
                        fontSize="0.050" fill={color + "AA"}
                        style={{ fontFamily: "system-ui" }}>
                        {f.areaHa} هـ · {f.crop}
                      </text>
                    )}
                  </g>
                )}
                <circle cx={gpx} cy={gpy} r={0.09} fill="transparent" />
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

/* ─── Field Intelligence Panel ───────────────────────────────────────── */
const PANEL_TABS: { view: PanelView; label: string; Icon: React.ElementType }[] = [
  { view: "overview",   label: "الأداء",   Icon: Activity    },
  { view: "forecast",   label: "التوقعات", Icon: TrendingUp  },
  { view: "timeline",   label: "الذاكرة",  Icon: Clock       },
  { view: "analytics",  label: "تحليلات",  Icon: BarChart3   },
  { view: "irrigation", label: "الري",     Icon: CalendarDays },
];

const ALERT_CONFIG = {
  critical: { color: "#ef4444", bg: "rgba(239,68,68,0.08)", border: "rgba(239,68,68,0.30)", Icon: ShieldAlert },
  warning:  { color: "#f59e0b", bg: "rgba(245,158,11,0.08)", border: "rgba(245,158,11,0.26)", Icon: AlertTriangle },
  info:     { color: "#38bdf8", bg: "rgba(56,189,248,0.07)", border: "rgba(56,189,248,0.22)", Icon: Info },
};

function FieldIntelligencePanel({ field, panelView, onPanelView, onClose }: {
  field: Field | null; panelView: PanelView; onPanelView: (v: PanelView) => void; onClose: () => void;
}) {
  if (!field) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 gap-4 relative" dir="rtl">
        <div className="relative">
          <motion.div className="absolute inset-0 rounded-full"
            style={{ background: "rgba(52,211,153,0.12)", filter: "blur(24px)" }}
            animate={{ scale: [1, 1.14, 1], opacity: [0.6, 1, 0.6] }}
            transition={{ duration: 3.8, repeat: Infinity, ease: "easeInOut" }} />
          <div className="relative w-20 h-20 rounded-full border flex items-center justify-center"
            style={{ background: "rgba(52,211,153,0.07)", borderColor: "rgba(52,211,153,0.18)" }}>
            <MapPin className="w-8 h-8 text-emerald-400/50" />
          </div>
        </div>
        <div className="text-center">
          <p className="text-[13px] font-bold text-foreground/55 mb-1">حدد حقلاً</p>
          <p className="text-[10px] text-muted-foreground/50 leading-relaxed">
            انقر على حقل في الخريطة<br />أو اختر من القائمة على اليسار
          </p>
        </div>
        {[...Array(3)].map((_, i) => (
          <motion.div key={i} className="absolute rounded-full opacity-[0.05]"
            style={{ width: 170 - i * 38, height: 170 - i * 38, border: "1px solid rgba(52,211,153,0.5)", top: "50%", left: "50%", transform: "translate(-50%,-50%)" }}
            animate={{ scale: [1, 1.05, 1], opacity: [0.03, 0.07, 0.03] }}
            transition={{ duration: 3 + i * 0.9, repeat: Infinity, ease: "easeInOut", delay: i * 0.7 }} />
        ))}
      </div>
    );
  }

  const color    = healthColor(field.healthScore);
  const label    = healthLabel(field.healthScore);
  const hasCrit  = field.healthScore < 50 || field.waterStress > 70;
  const alerts   = getCriticalAlerts(field);

  return (
    <div className="h-full flex flex-col" dir="rtl">

      {/* Sticky header */}
      <div className="flex-shrink-0 px-4 pt-4 pb-3 space-y-3" style={{ background: "inherit" }}>
        {/* Field title row */}
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0"
            style={{ background: color + "1E", border: `1px solid ${color}45` }}>
            <CropIcon crop={field.crop} className="w-5 h-5" style={{ color }} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-[13px] font-bold text-foreground leading-tight">{field.name}</h3>
              <span className={cn("flex items-center gap-1 text-[9px] font-bold rounded-full px-2 py-0.5 border flex-shrink-0",
                field.healthScore < 50 ? "text-red-400 bg-red-500/10 border-red-500/20"
                  : field.healthScore < 75 ? "text-amber-400 bg-amber-500/10 border-amber-500/20"
                  : "text-emerald-400 bg-emerald-500/10 border-emerald-500/15")}>
                {hasCrit ? <AlertTriangle className="w-2 h-2" /> : <CheckCircle className="w-2 h-2" />}
                {label}
              </span>
            </div>
            <p className="text-[9.5px] text-muted-foreground mt-0.5">{field.crop} · {field.province} · {field.soilType}</p>
          </div>
          <button onClick={onClose}
            className="w-6 h-6 rounded-lg bg-white/[0.05] hover:bg-white/[0.10] border border-white/[0.07] flex items-center justify-center flex-shrink-0 transition-all">
            <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
              <path d="M1 1L7 7M7 1L1 7" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* View tabs */}
        <div className="flex gap-1 p-1 rounded-xl bg-white/[0.03] border border-white/[0.05]">
          {PANEL_TABS.map(({ view, label: lbl, Icon }) => (
            <button key={view} onClick={() => onPanelView(view)}
              className={cn("flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[9px] font-semibold transition-all",
                panelView === view ? "bg-emerald-500/20 text-emerald-400 shadow-sm" : "text-muted-foreground hover:text-foreground")}>
              <Icon style={{ width: 9, height: 9 }} />{lbl}
            </button>
          ))}
        </div>
      </div>

      {/* Priority Alerts strip (non-scrollable) */}
      <AnimatePresence>
        {alerts.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.22 }}
            className="flex-shrink-0 px-4 pb-2 flex flex-col gap-1.5 overflow-hidden">
            {alerts.slice(0, 2).map((a, i) => {
              const cfg = ALERT_CONFIG[a.level];
              return (
                <motion.div key={i}
                  initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.07 }}
                  className="flex items-start gap-2 px-3 py-2 rounded-xl border"
                  style={{ background: cfg.bg, borderColor: cfg.border,
                    boxShadow: a.level === "critical" ? `0 0 14px ${cfg.color}1A` : "none" }}>
                  {a.level === "critical" ? (
                    <motion.span animate={{ opacity: [1, 0.25, 1] }} transition={{ duration: 1.3, repeat: Infinity }}>
                      <cfg.Icon style={{ width: 11, height: 11, color: cfg.color, marginTop: 1, flexShrink: 0 }} />
                    </motion.span>
                  ) : (
                    <cfg.Icon style={{ width: 11, height: 11, color: cfg.color, marginTop: 1, flexShrink: 0 }} />
                  )}
                  <p className="text-[9.5px] leading-relaxed" style={{ color: cfg.color + "DD" }}>{a.msg}</p>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Scrollable content */}
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 pb-4
        [scrollbar-width:thin] [scrollbar-color:rgba(52,211,153,0.12)_transparent]"
        style={{ touchAction: "pan-y" }}>
        <AnimatePresence mode="wait">
          {panelView === "overview"   && <FiveFoldOverview key="ov" field={field} />}
          {panelView === "forecast"   && <ForecastView key="fc" field={field} />}
          {panelView === "analytics"  && <AnalyticsView key="at" field={field} />}
          {panelView === "timeline"   && <FieldTimeline key="tl" field={field} />}
          {panelView === "irrigation" && <IrrigationCalendarView key="ir" field={field} />}
        </AnimatePresence>
        {/* Smart recs below overview */}
        {panelView === "overview" && (
          <div className="mt-4">
            <SmartRecsCard field={field} />
          </div>
        )}
      </div>

      {/* Live agent strip */}
      <AgentHubStrip field={field} />

      {/* Sticky footer */}
      <div className="flex-shrink-0 px-4 pb-4 pt-2 border-t" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
        <Link
          href={`/copilot?q=${encodeURIComponent(`أخبرني عن وضع ${field.name} · ${field.crop} في ${field.province}`)}`}
          className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl border transition-all hover:scale-[1.02] active:scale-[0.98]"
          style={{
            background: "linear-gradient(135deg,rgba(52,211,153,0.12),rgba(52,211,153,0.06))",
            borderColor: "rgba(52,211,153,0.28)", color: "rgba(52,211,153,0.90)",
          }}>
          <MessageSquare className="w-3.5 h-3.5" />
          <span className="text-[11px] font-bold">استشارة المساعد الذكي</span>
        </Link>
      </div>
    </div>
  );
}

/* ─── Glass Stat Strip ───────────────────────────────────────────────── */
function GlassStatStrip({ fields }: { fields: Field[] }) {
  const total  = totalHa(fields).toFixed(1);
  const health = avgHealth(fields);
  const crits  = criticalCount(fields);
  const ready  = fields.filter(f => f.stageProgress >= 88).length;
  const cards = [
    { label: "إجمالي المساحة", value: total,      unit: "هـ",  color: "#10b981",             Icon: Leaf,          pulse: false },
    { label: "صحة المزرعة",    value: `${health}`, unit: "%",   color: healthColor(health),   Icon: Activity,      pulse: false },
    { label: "تنبيهات حرجة",  value: `${crits}`,  unit: "حقل", color: crits > 0 ? "#ef4444" : "#10b981", Icon: AlertTriangle, pulse: crits > 0 },
    { label: "جاهز للحصاد",   value: `${ready}`,  unit: "حقل", color: "#a78bfa",             Icon: CheckCircle,   pulse: false },
  ];
  return (
    <div className="grid grid-cols-4 gap-3" dir="rtl">
      {cards.map(({ label, value, unit, color, Icon, pulse }, i) => (
        <motion.div key={label}
          initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.06, duration: 0.4, ease: EASE }}
          className="relative rounded-2xl px-4 py-3 border overflow-hidden"
          style={{
            background: `linear-gradient(135deg, ${color}0E 0%, oklch(0.09 0.016 152 / 88%) 100%)`,
            borderColor: color + "28", backdropFilter: "blur(16px)",
          }}>
          <div className="absolute -top-5 -left-5 w-16 h-16 rounded-full pointer-events-none"
            style={{ background: color, opacity: 0.07, filter: "blur(14px)" }} />
          <div className="relative flex items-center gap-3">
            <motion.div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: color + "1C", border: `1px solid ${color}30` }}
              animate={pulse ? { scale: [1, 1.12, 1] } : {}}
              transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}>
              <Icon style={{ width: 18, height: 18, color }} />
            </motion.div>
            <div>
              <p className="text-[8.5px] text-muted-foreground leading-tight mb-0.5">{label}</p>
              <div className="flex items-baseline gap-1">
                <span className="text-lg font-bold tabular-nums leading-none" style={{ color }}>{value}</span>
                <span className="text-[9px] text-muted-foreground">{unit}</span>
              </div>
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

/* ─── Main Page ──────────────────────────────────────────────────────── */
export default function FieldsPage() {
  const [fields,     setFields]     = useState<Field[]>(FIELDS);
  const [showAdd,    setShowAdd]    = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [overlay,    setOverlay]    = useState<Overlay>("health");
  const [panelView,  setPanelView]  = useState<PanelView>("overview");
  const firstPersist = useRef(true);

  // ── Load persisted fields on mount via the repo (Supabase when configured +
  //    signed in, else offline cache); seed + persist on first ever visit. ──
  useEffect(() => {
    let cancelled = false;
    (async () => {
      let initial: Field[] = FIELDS;
      try {
        const loaded = await loadFields();
        if (loaded && loaded.length) initial = loaded;
      } catch { /* fall back to seed defaults */ }
      if (cancelled) return;
      setFields(initial);
      persistCache(initial);
      syncFieldsToContext(initial);
    })();
    return () => { cancelled = true; };
  }, []);

  // ── Mirror the working set into the offline cache + agent context on change ──
  useEffect(() => {
    if (firstPersist.current) { firstPersist.current = false; return; }
    persistCache(fields);
    syncFieldsToContext(fields);
  }, [fields]);

  useEffect(() => { setPanelView("overview"); }, [selectedId]);

  const handleSelect = useCallback((id: number) => {
    setSelectedId(prev => {
      const next = prev === id ? null : id;
      if (next) setTimeout(() => document.getElementById(`fc-${next}`)?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 80);
      return next;
    });
  }, []);

  const handleAddField = useCallback((f: Field) => {
    setFields(prev => [f, ...prev]);
    setSelectedId(f.id);
    // Persist to the DB (no-op when Supabase isn't configured) and reconcile remoteId.
    saveField(f)
      .then(saved => {
        if (saved.remoteId && saved.remoteId !== f.remoteId) {
          setFields(prev => prev.map(x => (x.id === f.id ? saved : x)));
          setSelectedId(saved.id);
        }
      })
      .catch(() => { /* remains in offline cache */ });
  }, []);

  const selectedField = fields.find(f => f.id === selectedId) ?? null;

  return (
    <div className="min-h-[100dvh] bg-forest-mesh flex flex-col overflow-x-hidden" dir="rtl">

      {/* Header */}
      <header className="flex-shrink-0 min-h-11 flex items-center justify-between gap-2 px-3 sm:px-5 py-2 z-30 border-b flex-wrap"
        style={{ background: "oklch(0.075 0.015 152 / 88%)", backdropFilter: "blur(22px)", borderColor: "rgba(52,211,153,0.09)" }}>
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="w-6 h-6 rounded-lg flex items-center justify-center border flex-shrink-0"
            style={{ background: "rgba(52,211,153,0.13)", borderColor: "rgba(52,211,153,0.26)" }}>
            <Leaf className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <span className="text-sm font-bold text-foreground flex-shrink-0">حقولي</span>
          <InfoTip
            title="حقولي"
            definition="سجلّ حقولك الرقمي — يحوّل كل حقل إلى كيان ذكي يراقبه وكلاؤنا على مدار الساعة."
            services={["إضافة حقل بإحداثيات دقيقة", "متابعة صحة المحصول والإجهاد المائي", "إنذارات الآفات والأمراض", "لوحة استخبارات لكل حقل"]}
          />
          <span className="text-white/20 text-xs mx-0.5 hidden sm:inline">·</span>
          <span className="text-[10.5px] text-muted-foreground truncate hidden sm:inline">
            {fields.length} حقول نشطة · {totalHa(fields).toFixed(1)} هـ إجمالاً
          </span>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
          {/* ── Add Field (إضافة حقل) ── */}
          <button onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10.5px] font-bold bg-emerald-500 text-emerald-950 hover:bg-emerald-400 transition-all">
            <Plus className="w-3 h-3" /> إضافة حقل
          </button>
          <Link href="/copilot"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[10.5px] font-medium text-muted-foreground hover:text-foreground transition-all"
            style={{ background: "rgba(255,255,255,0.04)", borderColor: "rgba(255,255,255,0.07)" }}>
            <Bot className="w-3 h-3" /> <span className="hidden sm:inline">المساعد</span>
          </Link>
          <Link href="/dashboard"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[10.5px] text-muted-foreground hover:text-foreground transition-all"
            style={{ background: "rgba(255,255,255,0.03)", borderColor: "rgba(255,255,255,0.06)" }}>
            <ArrowLeft className="w-3 h-3" /> <span className="hidden sm:inline">الرئيسية</span>
          </Link>
        </div>
      </header>

      {/* Stats strip + page guide */}
      <div className="flex-shrink-0 px-3 sm:px-5 py-3 border-b"
        style={{ borderColor: "rgba(255,255,255,0.04)", background: "rgba(0,0,0,0.14)" }}>
        <div className="overflow-x-auto"><GlassStatStrip fields={fields} /></div>
        <PageGuide
          summary="سجلّ حقولك الجغرافي — راقب صحة كل حقل وأضف حقولاً بإحداثيات دقيقة."
          services={["خريطة الحقول التفاعلية", "إضافة حقل بإحداثيات", "صحة المحصول والإجهاد المائي", "إنذارات الآفات", "لوحة استخبارات الحقل"]}
        />
      </div>

      {/* Body — desktop: 3-column app; mobile: stacked (map + list), RTL */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden min-h-0">

        {/* col 1 (visual RIGHT): Field Intelligence Panel — desktop only */}
        <aside className="hidden lg:flex w-96 flex-shrink-0 border-l flex-col"
          style={{ borderColor: "rgba(255,255,255,0.055)", background: "oklch(0.075 0.013 152 / 76%)", backdropFilter: "blur(10px)" }}>
          <div className="px-4 py-2.5 border-b flex items-center justify-between"
            style={{ borderColor: "rgba(255,255,255,0.05)" }}>
            <span className="text-[11px] font-bold text-foreground/80">لوحة الاستخبارات</span>
            {selectedId && (
              <button onClick={() => setSelectedId(null)}
                className="text-[9px] text-muted-foreground/60 hover:text-muted-foreground transition-colors">
                إلغاء التحديد
              </button>
            )}
          </div>
          <div className="flex-1 overflow-hidden">
            <FieldIntelligencePanel
              field={selectedField}
              panelView={panelView}
              onPanelView={setPanelView}
              onClose={() => setSelectedId(null)} />
          </div>
        </aside>

        {/* col 2 (visual CENTER): Hero Map + Agent Log */}
        <main className="relative overflow-hidden min-w-0 h-[44vh] flex-shrink-0 lg:h-auto lg:flex-1">
          <div className="absolute inset-3 rounded-2xl overflow-hidden border flex flex-col"
            style={{ borderColor: "rgba(52,211,153,0.10)" }}>
            <div className="flex-1 relative overflow-hidden">
              <FieldMap fields={fields} selectedId={selectedId} overlay={overlay} onSelect={handleSelect} />
              <OverlayBar active={overlay} onToggle={setOverlay} />
              <AnimatePresence>
                {selectedField && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 8 }} transition={{ duration: 0.25 }}
                    className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-2 px-3.5 py-1.5 rounded-full border text-[10px] font-semibold z-10"
                    style={{ background: "oklch(0.10 0.018 152 / 92%)", backdropFilter: "blur(14px)", borderColor: "rgba(52,211,153,0.26)", color: "rgba(52,211,153,0.90)" }}>
                    <motion.span className="w-1.5 h-1.5 rounded-full bg-emerald-400"
                      animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1.8, repeat: Infinity }} />
                    محافظة {selectedField.province}
                    <button className="opacity-50 hover:opacity-100 transition-opacity mr-1"
                      onClick={() => setSelectedId(null)}>✕</button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <AgentActivityLog field={selectedField} />
          </div>
        </main>

        {/* col 3 (visual LEFT): Field List */}
        <aside className="w-full lg:w-80 flex-1 lg:flex-none min-h-0 border-t lg:border-t-0 lg:border-r flex flex-col"
          style={{ borderColor: "rgba(255,255,255,0.055)", background: "oklch(0.075 0.013 152 / 76%)", backdropFilter: "blur(10px)" }}>
          <div className="px-4 py-2.5 border-b flex items-center justify-between"
            style={{ borderColor: "rgba(255,255,255,0.05)" }}>
            <span className="text-[11px] font-bold text-foreground/80">الحقول النشطة</span>
            <div className="flex items-center gap-2">
              {criticalCount(fields) > 0 && (
                <motion.span animate={{ opacity: [1, 0.5, 1] }} transition={{ duration: 2, repeat: Infinity }}
                  className="flex items-center gap-1 text-[9px] font-bold text-red-400 bg-red-500/10 border border-red-500/20 rounded-full px-2 py-0.5">
                  <AlertTriangle className="w-2 h-2" /> {criticalCount(fields)}
                </motion.span>
              )}
              <span className="text-[9.5px] text-muted-foreground bg-white/[0.05] rounded-full px-2 py-0.5">
                {fields.length}
              </span>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-1.5
            [scrollbar-width:thin] [scrollbar-color:rgba(52,211,153,0.12)_transparent]">
            {fields.map(f => (
              <FieldListCard key={f.id} field={f}
                selected={selectedId === f.id}
                onClick={() => handleSelect(f.id)} />
            ))}
            <div className="h-2 flex-shrink-0" />
          </div>
        </aside>
      </div>

      {/* Mobile: field-details bottom-drawer (swipe down / tap backdrop to close) */}
      <AnimatePresence>
        {selectedField && (
          <div className="lg:hidden fixed inset-0 z-[60] flex items-end" dir="rtl">
            <motion.button
              aria-label="إغلاق"
              className="absolute inset-0 bg-black/55 backdrop-blur-sm"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setSelectedId(null)}
            />
            <motion.div
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 360, damping: 36 }}
              className="relative w-full glass-sidebar rounded-t-3xl border-t border-emerald-500/20 h-[85dvh] flex flex-col overflow-hidden"
              style={{ background: "oklch(0.085 0.014 152 / 96%)", backdropFilter: "blur(22px)" }}
            >
              {/* Handle + header (tap the bar or ✕ — or the backdrop — to close) */}
              <div className="flex-shrink-0 pt-2.5 px-4 pb-2 border-b select-none" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
                <button onClick={() => setSelectedId(null)} aria-label="إغلاق"
                  className="block mx-auto mb-2.5 h-1.5 w-12 rounded-full bg-white/25 hover:bg-white/40 transition-colors" />
                <div className="flex items-center justify-between">
                  <span className="text-[12px] font-bold text-foreground/85">
                    {selectedField.name} <span className="text-muted-foreground/50 font-normal">· {selectedField.province}</span>
                  </span>
                  <button onClick={() => setSelectedId(null)} aria-label="إغلاق"
                    className="w-7 h-7 rounded-lg bg-white/[0.06] border border-white/[0.08] flex items-center justify-center text-muted-foreground">
                    <ArrowLeft className="w-3.5 h-3.5 -rotate-90" />
                  </button>
                </div>
              </div>
              {/* Content host — scroll fallback so the dashboard can never freeze (panel also scrolls internally) */}
              <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain" style={{ touchAction: "pan-y" }}>
                <FieldIntelligencePanel
                  field={selectedField}
                  panelView={panelView}
                  onPanelView={setPanelView}
                  onClose={() => setSelectedId(null)} />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add Field modal */}
      <AnimatePresence>
        {showAdd && <AddFieldModal onClose={() => setShowAdd(false)} onAdd={handleAddField} />}
      </AnimatePresence>
    </div>
  );
}
