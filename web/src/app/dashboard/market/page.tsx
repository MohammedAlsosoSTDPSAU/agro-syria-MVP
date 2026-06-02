"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import useSWR from "swr";
import {
  TrendingUp, TrendingDown, BarChart3, Newspaper, RefreshCw,
  Bot, Truck, Warehouse, Sprout, Globe, Zap,
  ChevronRight, Activity, Map as MapIcon,
  Package, Users, Factory, Handshake, Navigation,
  BadgeCheck, TriangleAlert, Wheat, Leaf, X,
  FileText, CloudLightning, Bug,
} from "lucide-react";
import { WorkspaceLayout } from "@/components/workspace/WorkspaceLayout";
import { SyriaMap } from "@/components/workspace/SyriaMap";
import { RelativeTime } from "@/components/market/RelativeTime";
import { SourceBadge } from "@/components/market/SourceBadge";
import { cn } from "@/lib/utils";
import type { MarketResponse, CropPrice } from "@/app/api/market/route";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip as ReTooltip,
  ResponsiveContainer,
} from "recharts";


// ── Animation ──────────────────────────────────────────────────────────────
type Bezier = [number, number, number, number];
const EASE: Bezier = [0.22, 1, 0.36, 1];
const cardV = {
  hidden:  { opacity: 0, y: 18 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.44, ease: EASE } },
};
const staggerV = {
  hidden:  {},
  visible: { transition: { staggerChildren: 0.07, delayChildren: 0.05 } },
};

// ── SWR ────────────────────────────────────────────────────────────────────
const fetcher = (url: string) => fetch(url).then((r) => r.json());
function useMarket(region: string | null) {
  const url = region ? `/api/market?region=${encodeURIComponent(region)}` : "/api/market";
  return useSWR<MarketResponse>(url, fetcher, { refreshInterval: 30_000, revalidateOnFocus: false });
}

// ── Map overlay ────────────────────────────────────────────────────────────
type MapOverlay = "production" | "demand" | "risk" | "activity";
const OVERLAY_CFG: Record<MapOverlay, { label_ar: string; icon: React.ElementType; from: string; to: string }> = {
  production: { label_ar: "مناطق الإنتاج", icon: Wheat,         from: "#064e3b", to: "#10b981" },
  demand:     { label_ar: "مراكز الطلب",   icon: Package,       from: "#1e1b4b", to: "#818cf8" },
  risk:       { label_ar: "مخاطر الآفات",  icon: TriangleAlert, from: "#3f1000", to: "#ef4444" },
  activity:   { label_ar: "نشاط السوق",    icon: Activity,      from: "#172554", to: "#60a5fa" },
};
const OVERLAY_DATA: Record<MapOverlay, Record<string, number>> = {
  production: { "الحسكة": 0.92, "حلب": 0.78, "حماة": 0.65, "حمص": 0.55, "دير الزور": 0.60, "الرقة": 0.48, "اللاذقية": 0.40, "طرطوس": 0.38, "درعا": 0.50, "إدلب": 0.62, "السويداء": 0.35, "دمشق": 0.30, "ريف دمشق": 0.45, "القنيطرة": 0.28 },
  demand:     { "دمشق": 0.95, "حلب": 0.88, "حمص": 0.65, "اللاذقية": 0.58, "حماة": 0.52, "ريف دمشق": 0.75, "درعا": 0.40, "الحسكة": 0.35, "طرطوس": 0.42, "إدلب": 0.30, "السويداء": 0.38, "الرقة": 0.25, "دير الزور": 0.28, "القنيطرة": 0.20 },
  risk:       { "الرقة": 0.85, "دير الزور": 0.78, "الحسكة": 0.72, "حلب": 0.45, "حماة": 0.38, "إدلب": 0.55, "حمص": 0.30, "اللاذقية": 0.22, "طرطوس": 0.18, "درعا": 0.40, "السويداء": 0.20, "دمشق": 0.15, "ريف دمشق": 0.25, "القنيطرة": 0.15 },
  activity:   { "حلب": 0.90, "دمشق": 0.85, "حمص": 0.70, "الحسكة": 0.65, "حماة": 0.60, "اللاذقية": 0.55, "ريف دمشق": 0.68, "درعا": 0.48, "طرطوس": 0.45, "إدلب": 0.40, "دير الزور": 0.35, "السويداء": 0.32, "الرقة": 0.28, "القنيطرة": 0.22 },
};
function lerpHex(from: string, to: string, t: number): string {
  const h = (s: string) => parseInt(s.slice(1), 16);
  const r = (x: number) => Math.round(x);
  const [fr, fg, fb] = [h(from) >> 16, (h(from) >> 8) & 255, h(from) & 255];
  const [tr, tg, tb] = [h(to) >> 16, (h(to) >> 8) & 255, h(to) & 255];
  return `rgb(${r(fr+(tr-fr)*t)},${r(fg+(tg-fg)*t)},${r(fb+(tb-fb)*t)})`;
}

// ── Intelligence feed ──────────────────────────────────────────────────────
const INTEL_FEED = [
  { id:"i1", agent:"وكيل السوق",          icon: BarChart3,  color:"emerald", text:"أسعار القمح ارتفعت 3% في حلب — مخزون أقل من 60 يوم",        time:"منذ 2 دقيقة",  urgent:true  },
  { id:"i2", agent:"وكيل التوريد",        icon: Truck,      color:"sky",     text:"احتقان في طريق M4 — تأخر شحنات الحسكة 18 ساعة",             time:"منذ 8 دقائق",  urgent:true  },
  { id:"i3", agent:"وكيل التوقعات",       icon: Globe,      color:"purple",  text:"توقع فائض قمح 12% هذا الموسم في الجزيرة السورية",           time:"منذ 15 دقيقة", urgent:false },
  { id:"i4", agent:"وكيل السمعة",         icon: BadgeCheck, color:"amber",   text:"تاجر جديد في حمص — تقييم 4.8/5 من 23 صفقة موثقة",          time:"منذ 31 دقيقة", urgent:false },
  { id:"i5", agent:"وكيل السوق",          icon: BarChart3,  color:"emerald", text:"زيت الزيتون يسجل 9,600 ل.س/كغ بسبب ضعف المحصول الإيطالي", time:"منذ 44 دقيقة", urgent:false },
  { id:"i6", agent:"وكيل التوريد",        icon: Truck,      color:"sky",     text:"مستودع طرطوس 87% — يُنصح بالتوزيع نحو حماة",               time:"منذ 58 دقيقة", urgent:false },
  { id:"i7", agent:"وكيل التوقعات",       icon: Globe,      color:"purple",  text:"فرصة تصدير: الطلب الأوروبي على الفستق 3× مستوى 2024",       time:"منذ ساعة",     urgent:false },
  { id:"i8", agent:"وكيل السمعة",         icon: BadgeCheck, color:"amber",   text:"تحذير: مورد بذور في الرقة سجّل 3 شكاوى هذا الشهر",         time:"منذ ساعتين",   urgent:true  },
];

// ── Agents ─────────────────────────────────────────────────────────────────
const AGENTS = [
  { id:"market",     name_ar:"وكيل السوق",              icon: BarChart3,  color:"emerald", status:"active" as const,
    role_ar:"تحليل العرض والطلب وتقلبات الأسعار",
    insight_ar:"العرض الكلي للقمح أقل 8% عن المتوسط — ضغط سعري متوقع في يونيو.",
    metrics:[{ label:"تقلب الأسعار", value:"+5.2%"},{ label:"ضغط الطلب",value:"عالٍ"}] },
  { id:"supply",     name_ar:"وكيل سلسلة التوريد",      icon: Truck,      color:"sky",     status:"active" as const,
    role_ar:"رصد اللوجستيات والاحتقانات ومستويات التخزين",
    insight_ar:"طاقة التخزين الوطنية 73% — فرصة لبناء احتياطي موسمي قبل الحصاد.",
    metrics:[{ label:"احتقانات الطرق",value:"2 نشطة"},{ label:"المستودعات",value:"73%"}] },
  { id:"forecast",   name_ar:"وكيل التوقعات الوطنية",   icon: Globe,      color:"purple",  status:"processing" as const,
    role_ar:"التنبؤ بالأمن الغذائي وفوائض المحاصيل والأزمات",
    insight_ar:"سيناريو 2026: ✓ قمح · ✓ شعير · ⚠ عدس (نقص محتمل 15%)",
    metrics:[{ label:"الأمن الغذائي",value:"82%"},{ label:"فوائض",value:"3 محاصيل"}] },
  { id:"reputation", name_ar:"وكيل السمعة",             icon: BadgeCheck, color:"amber",   status:"active" as const,
    role_ar:"نظام ثقة للتجار والموردين — منع الاحتيال",
    insight_ar:"1,247 تاجر موثق · 98.3% معدل إتمام الصفقات · 4 بلاغات قيد المراجعة.",
    metrics:[{ label:"تجار موثقون",value:"1,247"},{ label:"معدل الثقة",value:"98.3%"}] },
];

// ── Category hub ───────────────────────────────────────────────────────────
const CATEGORIES = [
  { id:"suppliers",   label_ar:"الموردون",        icon: Factory,   color:"emerald", desc_ar:"بذور · أسمدة · معدات", count:348  },
  { id:"traders",     label_ar:"التجار",          icon: Handshake, color:"sky",     desc_ar:"شراء · بيع · مقايضة",  count:1247 },
  { id:"logistics",   label_ar:"اللوجستيات",      icon: Truck,     color:"amber",   desc_ar:"شحن · نقل · توصيل",    count:89   },
  { id:"warehousing", label_ar:"التخزين",         icon: Warehouse, color:"purple",  desc_ar:"مستودعات · تبريد",      count:124  },
  { id:"seeds",       label_ar:"البذور والأسمدة", icon: Sprout,    color:"lime",    desc_ar:"بذار معتمد · مغذيات",  count:203  },
];

// ── Negotiations ────────────────────────────────────────────────────────────
const NEGOTIATIONS = [
  { id:"n1", status:"جارٍ",    crop_ar:"قمح",       buyer_ar:"مطاحن حلب",    seller_ar:"مزارع الحسكة",  pct:"+12%", progress:68,  color:"emerald" },
  { id:"n2", status:"مكتمل",  crop_ar:"زيت زيتون", buyer_ar:"مصدّر أوروبي", seller_ar:"تعاونية إدلب",  pct:"+19%", progress:100, color:"sky"     },
  { id:"n3", status:"جارٍ",    crop_ar:"فستق",      buyer_ar:"مستورد خليجي", seller_ar:"موردو حلب",     pct:"+8%",  progress:42,  color:"amber"   },
];

// ── Copilot ────────────────────────────────────────────────────────────────
const COPILOT_QUERIES = [
  { q:"أفضل محصول الآن؟",         icon: Leaf,       ans:"الفستق الحلبي: عائد +34% هذا الموسم. التربة المثلى: كلسية جيدة. مناطق: إدلب وحلب. ريح 9,200 ل.س/كغ." },
  { q:"بيع أم احتفاظ بالقمح؟",    icon: TrendingUp, ans:"احتفظ حتى يونيو. نموذج الوكيل يتوقع سعر 450+ ل.س/كغ (+7%) بسبب انخفاض المخزون العالمي." },
  { q:"أفضل مسار شحن؟",          icon: Navigation, ans:"المسار الأمثل: الحسكة ← دير الزور ← حمص ← دمشق. تجنب M4 (احتقان). توفير 18 ساعة." },
];

// ── Color system ────────────────────────────────────────────────────────────
const CC: Record<string, { icon:string; badge:string; border:string }> = {
  emerald:{ icon:"text-emerald-400 bg-emerald-500/12 border-emerald-500/25", badge:"text-emerald-400 bg-emerald-500/12", border:"border-emerald-500/20" },
  sky:    { icon:"text-sky-400 bg-sky-500/12 border-sky-500/25",             badge:"text-sky-400 bg-sky-500/12",         border:"border-sky-500/20"     },
  amber:  { icon:"text-amber-400 bg-amber-500/12 border-amber-500/25",       badge:"text-amber-400 bg-amber-500/12",     border:"border-amber-500/20"   },
  purple: { icon:"text-purple-400 bg-purple-500/12 border-purple-500/25",    badge:"text-purple-400 bg-purple-500/12",   border:"border-purple-500/20"  },
  lime:   { icon:"text-lime-400 bg-lime-500/12 border-lime-500/25",          badge:"text-lime-400 bg-lime-500/12",       border:"border-lime-500/20"    },
  red:    { icon:"text-red-400 bg-red-500/12 border-red-500/25",             badge:"text-red-400 bg-red-500/12",         border:"border-red-500/20"     },
};

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-white/[0.04] ${className}`} />;
}

// ── Sparkline ───────────────────────────────────────────────────────────────
function Sparkline({ data, color }: { data: number[]; color: string }) {
  if (data.length < 2) return null;
  const max = Math.max(...data), min = Math.min(...data), range = max - min || 1;
  const W = 60, H = 28;
  const pts = data.map((v, i) => `${(i/(data.length-1))*W},${H-((v-min)/range)*H}`).join(" ");
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="opacity-75 flex-shrink-0">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

// ── Price tile ──────────────────────────────────────────────────────────────
const HIGHLIGHT_CROPS = ["wheat","cotton","olive_oil","pistachios"];
const CROP_COLOR: Record<string,string> = { wheat:"emerald", cotton:"amber", olive_oil:"purple", pistachios:"lime" };
const SPARK_COLOR: Record<string,string> = { emerald:"#10b981", amber:"#f59e0b", purple:"#a78bfa", lime:"#a3e635" };

function PriceTile({ crop }: { crop: CropPrice }) {
  const col = CROP_COLOR[crop.key] ?? "emerald";
  const cc  = CC[col];
  const up  = crop.change_pct >= 0;
  return (
    <motion.div variants={cardV}
      className={`rounded-2xl p-4 border transition-colors ${cc.border} bg-white/[0.03] hover:bg-white/[0.05]`}
      dir="rtl">
      {/* Trend arrow + sparkline */}
      <div className="flex items-center justify-between mb-2">
        <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full ${cc.badge} border ${cc.border}`}>
          {up ? <TrendingUp className="w-3 h-3"/> : <TrendingDown className="w-3 h-3"/>}
          <span className="text-[9px] font-bold tabular-nums">
            {up?"+":"-"}{Math.abs(crop.change_pct).toFixed(1)}%
          </span>
        </div>
        <Sparkline data={crop.history?.map(h=>h.price)??[]} color={SPARK_COLOR[col]}/>
      </div>
      {/* Crop name */}
      <p className="text-[9px] text-muted-foreground mb-0.5">{crop.name_ar}</p>
      {/* Price */}
      <p className="text-lg font-bold text-foreground tabular-nums leading-none" dir="ltr">
        {crop.price_syp.toLocaleString("en")}
      </p>
      <p className="text-[8px] text-muted-foreground/50 mt-0.5">{crop.unit}</p>
      {/* Region badge */}
      <div className="mt-2.5">
        <span className={`text-[8px] px-1.5 py-0.5 rounded-full border ${cc.border} ${cc.badge}`}>
          {crop.top_gov_ar}
        </span>
      </div>
    </motion.div>
  );
}

// ── Intelligence feed ───────────────────────────────────────────────────────
function IntelFeed() {
  const [items, setItems] = useState(INTEL_FEED);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => setItems(p => { const [h,...t]=p; return [...t,h]; }), 3500);
    return () => clearInterval(id);
  }, [paused]);
  return (
    <div className="flex flex-col h-full" dir="rtl">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"/>
          <span className="text-[11px] font-bold text-foreground">نشرة الذكاء المباشرة</span>
        </div>
        <button onClick={()=>setPaused(v=>!v)} className="text-[9px] text-muted-foreground/60 hover:text-foreground transition-colors">
          {paused?"▶":"⏸"}
        </button>
      </div>
      <div className="flex-1 space-y-1.5 overflow-hidden">
        <AnimatePresence mode="popLayout">
          {items.slice(0,6).map((item, idx)=>{
            const cc=CC[item.color]??CC.emerald;
            const Icon=item.icon;
            const isLatest = idx === 0;
            return (
              <motion.div key={item.id} layout
                initial={{opacity:0,x:10}} animate={{opacity:1,x:0}} exit={{opacity:0,x:-10}}
                transition={{duration:0.25,ease:EASE}}
                className={`flex items-center gap-2.5 px-2.5 py-2 rounded-xl border ${item.urgent?"border-red-500/20 bg-red-500/4":"border-white/[0.05] bg-white/[0.01]"}`}>
                {/* Agent icon badge with optional live ring */}
                <div className="relative flex-shrink-0">
                  <div className={`w-5 h-5 rounded-md border flex items-center justify-center ${cc.icon}`}>
                    <Icon className="w-2.5 h-2.5"/>
                  </div>
                  {isLatest && (
                    <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 flex items-center justify-center">
                      <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping"/>
                      <span className="relative inline-flex w-1 h-1 rounded-full bg-emerald-400"/>
                    </span>
                  )}
                </div>
                {/* Title — single line */}
                <p className="flex-1 text-[10px] text-foreground/85 font-arabic truncate">{item.text}</p>
                {/* Agent badge + time */}
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {item.urgent && <TriangleAlert className="w-3 h-3 text-red-400"/>}
                  <span className={`text-[8px] font-semibold px-1.5 py-0.5 rounded-full ${cc.badge}`}>{item.agent}</span>
                  <span className="text-[8px] text-muted-foreground/40 tabular-nums">{item.time}</span>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ── Category tile ────────────────────────────────────────────────────────────
function CatTile({ cat }: { cat: typeof CATEGORIES[0] }) {
  const cc = CC[cat.color]??CC.emerald;
  const Icon = cat.icon;
  return (
    <motion.button variants={cardV} whileHover={{scale:1.02}} whileTap={{scale:0.98}}
      className="glass-card rounded-xl p-3 text-right w-full border border-white/[0.05] hover:border-white/10 transition-colors"
      dir="rtl">
      <div className="flex items-center justify-between mb-2">
        <div className={`w-6 h-6 rounded-lg border flex items-center justify-center ${cc.icon}`}>
          <Icon className="w-3 h-3"/>
        </div>
        <span className="text-[7px] border border-amber-500/30 text-amber-400/80 bg-amber-500/8 rounded-full px-1.5 py-0.5">قادم</span>
      </div>
      <p className="text-[11px] font-bold text-foreground mb-0.5">{cat.label_ar}</p>
      <p className="text-[9px] text-muted-foreground">{cat.desc_ar}</p>
      <p className={`text-[9px] font-semibold mt-1.5 ${cc.badge.split(" ")[0]}`}>{cat.count.toLocaleString("en")} مسجل</p>
    </motion.button>
  );
}

// ── Agent card ───────────────────────────────────────────────────────────────
function AgentCard({ agent }: { agent: typeof AGENTS[0] }) {
  const cc = CC[agent.color];
  const Icon = agent.icon;
  return (
    <motion.div variants={cardV}
      className="glass-card rounded-2xl p-4 border border-white/[0.06] flex flex-col min-h-[188px]"
      dir="rtl">
      {/* Header row */}
      <div className="flex items-center gap-2.5 mb-3">
        <div className={`w-8 h-8 rounded-xl border flex items-center justify-center flex-shrink-0 ${cc.icon}`}>
          <Icon className="w-4 h-4"/>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-[12px] font-bold text-foreground truncate">{agent.name_ar}</span>
            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${agent.status==="active"?"bg-emerald-400":"bg-amber-400 animate-pulse"}`}/>
          </div>
          <p className="text-[9px] text-muted-foreground truncate">{agent.role_ar}</p>
        </div>
      </div>
      {/* Insight block */}
      <div className={`flex-1 rounded-xl border px-3 py-2 mb-3 ${cc.border} bg-white/[0.025]`}>
        <p className="text-[10px] text-foreground/80 leading-relaxed font-arabic line-clamp-3">{agent.insight_ar}</p>
      </div>
      {/* Metrics */}
      <div className="flex gap-2">
        {agent.metrics.map(m=>(
          <div key={m.label} className={`flex-1 rounded-lg border py-1.5 text-center ${cc.border} bg-white/[0.02]`}>
            <p className={`text-[11px] font-bold tabular-nums ${cc.badge.split(" ")[0]}`}>{m.value}</p>
            <p className="text-[8px] text-muted-foreground/60 mt-0.5">{m.label}</p>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

// ── Negotiation card ─────────────────────────────────────────────────────────
function NegotiationCard() {
  const [idx, setIdx] = useState(0);
  useEffect(() => { const id = setInterval(()=>setIdx(v=>(v+1)%NEGOTIATIONS.length),4000); return ()=>clearInterval(id); },[]);
  const neg = NEGOTIATIONS[idx];
  const cc  = CC[neg.color];
  return (
    <motion.div className="glass-card rounded-2xl p-5 h-full border border-white/[0.05]" dir="rtl">
      <div className="flex items-center gap-2 mb-4">
        <Handshake className="w-4 h-4 text-emerald-400/70"/>
        <span className="text-sm font-bold text-foreground">تفاوض الوكيل الذكي</span>
        <span className="mr-auto text-[8px] border border-emerald-500/30 text-emerald-400 bg-emerald-500/8 rounded-full px-2 py-0.5 animate-pulse">LIVE</span>
      </div>
      <AnimatePresence mode="wait">
        <motion.div key={neg.id} initial={{opacity:0,y:6}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-6}} transition={{duration:0.28,ease:EASE}}>
          <div className="flex items-center gap-2 mb-4">
            <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${cc.badge} ${cc.border}`}>{neg.status}</span>
            <span className="text-[11px] font-bold text-foreground">{neg.crop_ar}</span>
            <span className={`mr-auto text-base font-bold ${cc.badge.split(" ")[0]}`}>{neg.pct}</span>
          </div>
          <div className="grid grid-cols-2 gap-2 mb-4">
            {[{l:"المشتري",v:neg.buyer_ar},{l:"البائع",v:neg.seller_ar}].map(p=>(
              <div key={p.l} className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-2.5 text-center">
                <p className="text-[9px] text-muted-foreground mb-0.5">{p.l}</p>
                <p className="text-[11px] font-semibold text-foreground font-arabic">{p.v}</p>
              </div>
            ))}
          </div>
          <div className="mb-3">
            <div className="flex justify-between mb-1">
              <span className="text-[9px] text-muted-foreground">تقدم التفاوض</span>
              <span className="text-[10px] font-bold">{neg.progress}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-white/[0.08] overflow-hidden">
              <motion.div className="h-full rounded-full" style={{background:neg.color==="emerald"?"#10b981":neg.color==="sky"?"#38bdf8":"#f59e0b"}}
                initial={{width:0}} animate={{width:`${neg.progress}%`}} transition={{duration:0.8,ease:EASE}}/>
            </div>
          </div>
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-2.5">
            <p className="text-[8px] text-emerald-400 font-bold mb-1">الوكيل الذكي يقول:</p>
            <p className="text-[10px] text-foreground/80 font-arabic leading-relaxed">
              {neg.progress<100
                ? `جارٍ التفاوض على تحسين سعر ${neg.crop_ar} بـ ${neg.pct} استناداً لمؤشرات السوق الحالية.`
                : `تمت الصفقة بنجاح — وفّر الوكيل هامش ربح إضافي ${neg.pct} مقارنةً بالعرض الأولي.`}
            </p>
          </div>
        </motion.div>
      </AnimatePresence>
      <div className="flex justify-center gap-1.5 mt-4">
        {NEGOTIATIONS.map((_,i)=>(
          <button key={i} onClick={()=>setIdx(i)} className={`w-1.5 h-1.5 rounded-full transition-all ${i===idx?"bg-emerald-400 scale-125":"bg-white/20"}`}/>
        ))}
      </div>
    </motion.div>
  );
}

// ── AI Copilot ───────────────────────────────────────────────────────────────
function MarketCopilot() {
  const [open, setOpen]     = useState(false);
  const [qi, setQi]         = useState<number|null>(null);
  const [shown, setShown]   = useState("");
  const [typing, setTyping] = useState(false);

  const ask = useCallback((i:number) => {
    setQi(i); setShown(""); setTyping(true);
    const ans = COPILOT_QUERIES[i].ans;
    let pos = 0;
    const id = setInterval(()=>{ pos++; setShown(ans.slice(0,pos)); if(pos>=ans.length){clearInterval(id);setTyping(false);} }, 18);
    return ()=>clearInterval(id);
  },[]);

  return (
    <>
      <motion.button whileHover={{scale:1.06}} whileTap={{scale:0.95}} onClick={()=>setOpen(v=>!v)}
        className="fixed bottom-6 left-6 z-50 w-12 h-12 rounded-2xl bg-emerald-500 shadow-lg shadow-emerald-500/40 flex items-center justify-center text-white"
        aria-label="مساعد السوق">
        <AnimatePresence mode="wait">
          {open
            ? <motion.span key="x" initial={{rotate:-90,opacity:0}} animate={{rotate:0,opacity:1}} exit={{rotate:90,opacity:0}}><X className="w-5 h-5"/></motion.span>
            : <motion.span key="b" initial={{rotate:90,opacity:0}} animate={{rotate:0,opacity:1}} exit={{rotate:-90,opacity:0}}><Bot className="w-5 h-5"/></motion.span>}
        </AnimatePresence>
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div initial={{opacity:0,x:-28,scale:0.94}} animate={{opacity:1,x:0,scale:1}} exit={{opacity:0,x:-28,scale:0.94}}
            transition={{duration:0.26,ease:EASE}}
            className="fixed bottom-[88px] left-6 z-50 w-76 glass-card rounded-2xl border border-emerald-500/20 overflow-hidden shadow-2xl"
            dir="rtl">
            <div className="flex items-center gap-2 p-4 border-b border-white/[0.06]">
              <div className="w-7 h-7 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
                <Bot className="w-3.5 h-3.5 text-emerald-400"/>
              </div>
              <div>
                <p className="text-[12px] font-bold text-foreground">مساعد السوق الذكي</p>
                <p className="text-[9px] text-emerald-400">4 وكلاء متخصصون</p>
              </div>
              <span className="mr-auto w-2 h-2 rounded-full bg-emerald-400 animate-pulse"/>
            </div>
            <div className="p-4 space-y-2">
              {COPILOT_QUERIES.map((cq,i)=>{
                const Icon=cq.icon;
                return (
                  <button key={i} onClick={()=>ask(i)}
                    className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-xl border text-right transition-all ${qi===i?"border-emerald-500/40 bg-emerald-500/10 text-emerald-300":"border-white/[0.07] text-muted-foreground hover:text-foreground hover:border-white/12"}`}>
                    <Icon className="w-3.5 h-3.5 flex-shrink-0"/>
                    <span className="text-[11px] font-medium font-arabic flex-1">{cq.q}</span>
                    <ChevronRight className="w-3 h-3 flex-shrink-0"/>
                  </button>
                );
              })}
              <AnimatePresence>
                {qi!==null && (
                  <motion.div initial={{opacity:0,height:0}} animate={{opacity:1,height:"auto"}} exit={{opacity:0,height:0}} transition={{duration:0.22}} className="overflow-hidden">
                    <div className="p-3 rounded-xl border border-emerald-500/20 bg-emerald-500/6">
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <Bot className="w-3 h-3 text-emerald-400"/>
                        <span className="text-[8px] font-bold text-emerald-400">الوكيل يجيب</span>
                        {typing&&<span className="text-emerald-400 text-[8px] animate-pulse">●</span>}
                      </div>
                      <p className="text-[10px] text-foreground/85 leading-relaxed font-arabic">{shown}</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

// ── Price trend ──────────────────────────────────────────────────────────────
const CHART_CROPS = [
  {key:"wheat",name_ar:"قمح",color:"#10b981"},
  {key:"cotton",name_ar:"قطن",color:"#f59e0b"},
  {key:"olive_oil",name_ar:"زيت زيتون",color:"#a78bfa"},
];
function PriceTrend({ crops }: { crops: CropPrice[] }) {
  const [active, setActive] = useState(new Set(["wheat"]));
  const base = crops.find(c=>c.key==="wheat");
  if (!base?.history?.length) return <Skeleton className="h-40"/>;
  const toggle = (k:string) => setActive(p=>{ const n=new Set(p); if(n.has(k)&&n.size>1) n.delete(k); else n.add(k); return n; });
  const chartData = base.history.map((h,i)=>{
    const row: Record<string,string|number> = {month:h.month_ar};
    CHART_CROPS.forEach(cc=>{ if(!active.has(cc.key)) return; const c=crops.find(x=>x.key===cc.key); row[cc.name_ar]=c?.history[i]?.price??0; });
    return row;
  });
  return (
    <div>
      <div className="flex gap-2 mb-3 flex-wrap" dir="rtl">
        {CHART_CROPS.map(cc=>(
          <button key={cc.key} onClick={()=>toggle(cc.key)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium border transition-all ${active.has(cc.key)?"border-transparent text-background":"border-white/10 text-muted-foreground hover:text-foreground"}`}
            style={active.has(cc.key)?{background:cc.color}:undefined}>
            <span className="w-1.5 h-1.5 rounded-full" style={{background:cc.color}}/>{cc.name_ar}
          </button>
        ))}
      </div>
      <ResponsiveContainer width="100%" height={170}>
        <AreaChart data={chartData} margin={{top:4,right:-10,left:4,bottom:0}}>
          <defs>{CHART_CROPS.filter(cc=>active.has(cc.key)).map(cc=>(
            <linearGradient key={cc.key} id={`g-${cc.key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={cc.color} stopOpacity={0.25}/>
              <stop offset="95%" stopColor={cc.color} stopOpacity={0}/>
            </linearGradient>
          ))}</defs>
          <XAxis dataKey="month" tick={{fill:"oklch(0.58 0.045 158)",fontSize:9}} axisLine={false} tickLine={false}/>
          <YAxis orientation="right" tick={{fill:"oklch(0.58 0.045 158)",fontSize:9}} axisLine={false} tickLine={false} tickFormatter={v=>v.toLocaleString("en")} width={48}/>
          <ReTooltip contentStyle={{background:"oklch(0.14 0.02 158/0.9)",border:"1px solid oklch(0.696 0.170 162/0.2)",borderRadius:10,fontSize:11,direction:"rtl"}}
            formatter={(v:unknown)=>[`${(v as number).toLocaleString("en")} ل.س/كغ`,""]}/>
          {CHART_CROPS.filter(cc=>active.has(cc.key)).map(cc=>(
            <Area key={cc.key} type="monotone" dataKey={cc.name_ar} stroke={cc.color} strokeWidth={2} fill={`url(#g-${cc.key})`} dot={false} activeDot={{r:3}}/>
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Agent insight tooltip ──────────────────────────────────────────────────
function Insight({ text }: { text: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative inline-flex">
      <button onMouseEnter={()=>setShow(true)} onMouseLeave={()=>setShow(false)} className="w-3.5 h-3.5 text-muted-foreground/40 hover:text-sky-400 transition-colors">
        <Bot className="w-3.5 h-3.5"/>
      </button>
      <AnimatePresence>
        {show && (
          <motion.div initial={{opacity:0,scale:0.92,y:-4}} animate={{opacity:1,scale:1,y:0}} exit={{opacity:0,scale:0.92,y:-4}}
            transition={{duration:0.15,ease:EASE}}
            className="absolute right-0 top-5 z-50 w-52 rounded-xl border border-sky-500/25 bg-[oklch(0.08_0.02_155)] p-3 shadow-2xl text-[10px] text-foreground/80 leading-relaxed font-arabic"
            dir="rtl">
            {text}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Main page content ─────────────────────────────────────────────────────────
function MarketContent() {
  const [selectedRegion, setSelectedRegion] = useState<string|null>(null);
  const [overlay, setOverlay]               = useState<MapOverlay>("production");
  const { data, isLoading, mutate }         = useMarket(selectedRegion);

  const crops     = data?.crops     ?? [];
  const lastUpd   = data?.lastUpdated ?? null;
  const highlights = HIGHLIGHT_CROPS.map(k=>crops.find(c=>c.key===k)).filter(Boolean) as CropPrice[];

  const cfg          = OVERLAY_CFG[overlay];
  const layerColorFn = (v:number) => lerpHex(cfg.from, cfg.to, v);

  return (
    <div className="flex-1 overflow-y-auto overflow-x-hidden">
      <div className="p-7 max-w-[1440px] mx-auto w-full">

        {/* Header */}
        <motion.div initial={{opacity:0,y:-10}} animate={{opacity:1,y:0}} transition={{duration:0.4}}
          className="mb-6 flex items-start justify-between gap-4 flex-wrap" dir="rtl">
          <div>
            <h2 className="text-2xl font-bold text-foreground">المركز الاستراتيجي للسوق</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              {selectedRegion?`البيانات مصفاة لمحافظة: ${selectedRegion}`:"36 محصولاً · تحليل مباشر بـ 4 وكلاء · موسم 2026"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {selectedRegion&&<button onClick={()=>setSelectedRegion(null)} className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-white/10 text-[11px] text-muted-foreground hover:text-foreground transition-colors"><X className="w-3 h-3"/>مسح</button>}
            {lastUpd&&<span className="text-[10px] text-muted-foreground/50"><RelativeTime isoDate={lastUpd}/></span>}
            <button onClick={()=>mutate()} className="w-8 h-8 rounded-xl glass-card flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading?"animate-spin":""}`}/>
            </button>
          </div>
        </motion.div>

        {/* ── ROW 1: Bento top strip ───────────────────────────────────── */}
        <motion.div variants={staggerV} initial="hidden" animate="visible" className="grid grid-cols-12 gap-5 mb-5">

          {/* Daily prices — 5 cols */}
          <div className="col-span-12 lg:col-span-5">
            <div className="glass-card rounded-2xl p-4 h-full border border-white/[0.05]">
              <div className="flex items-center gap-2 mb-4" dir="rtl">
                <div className="w-7 h-7 rounded-xl bg-emerald-500/12 border border-emerald-500/25 flex items-center justify-center"><TrendingUp className="w-3.5 h-3.5 text-emerald-400"/></div>
                <div className="flex-1"><div className="flex items-center gap-1.5"><span className="text-sm font-bold text-foreground">أسعار اليوم</span><Insight text="يراقب وكيل السوق تحركات الأسعار كل 30 ثانية مقارنةً بالشهر السابق والمتوسط السنوي."/></div><p className="text-[10px] text-muted-foreground">محاصيل استراتيجية · ل.س/كغ</p></div>
                <SourceBadge source="وزارة الزراعة · غرف التجارة السورية"/>
              </div>
              {isLoading
                ? <div className="grid grid-cols-2 gap-2">{[0,1,2,3].map(i=><Skeleton key={i} className="h-28"/>)}</div>
                : <motion.div variants={staggerV} className="grid grid-cols-2 gap-2">
                    {highlights.map(c=><PriceTile key={c.key} crop={c}/>)}
                  </motion.div>}
            </div>
          </div>

          {/* Intelligence feed — 4 cols */}
          <motion.div variants={cardV} className="col-span-12 lg:col-span-4">
            <div className="glass-card rounded-2xl p-4 h-full border border-white/[0.05] min-h-[320px]">
              <IntelFeed/>
            </div>
          </motion.div>

          {/* Category hub — 3 cols */}
          <div className="col-span-12 lg:col-span-3">
            <div className="glass-card rounded-2xl p-4 h-full border border-white/[0.05]">
              <div className="flex items-center gap-2 mb-3" dir="rtl">
                <div className="w-6 h-6 rounded-lg bg-emerald-500/12 border border-emerald-500/25 flex items-center justify-center"><Factory className="w-3 h-3 text-emerald-400"/></div>
                <span className="text-[12px] font-bold text-foreground">قطاعات السوق</span>
                <Insight text="استكشف الموردين والتجار والخدمات اللوجستية — كل القطاعات ستُطلق قريباً."/>
              </div>
              <motion.div variants={staggerV} className="grid grid-cols-1 gap-2">
                {CATEGORIES.slice(0,4).map(cat=><CatTile key={cat.id} cat={cat}/>)}
              </motion.div>
            </div>
          </div>
        </motion.div>

        {/* ── ROW 2: Map + Agents ────────────────────────────────────────── */}
        <motion.div variants={staggerV} initial="hidden" animate="visible" className="grid grid-cols-12 gap-5 mb-5">

          {/* Strategic Map — 7 cols */}
          <motion.div variants={cardV} className="col-span-12 lg:col-span-7">
            <div className="glass-card rounded-2xl p-5 h-full border border-white/[0.05]" dir="rtl">
              <div className="flex items-center gap-3 mb-4 flex-wrap">
                <div className="w-7 h-7 rounded-xl bg-emerald-500/12 border border-emerald-500/25 flex items-center justify-center flex-shrink-0"><MapIcon className="w-3.5 h-3.5 text-emerald-400"/></div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5"><span className="text-sm font-bold text-foreground">خريطة سوريا الاستراتيجية</span><Insight text="تُظهر الخريطة الإنتاج والطلب ومخاطر الآفات ونشاط السوق — اختر الطبقة وانقر على المحافظة."/></div>
                  <p className="text-[10px] text-muted-foreground">طبقة: {cfg.label_ar} · انقر على محافظة لتصفية البيانات</p>
                </div>
                {/* Overlay toggles */}
                <div className="flex gap-1.5 flex-wrap">
                  {(Object.entries(OVERLAY_CFG) as [MapOverlay, typeof OVERLAY_CFG[MapOverlay]][]).map(([key,oc])=>{
                    const OIcon=oc.icon;
                    return (
                      <button key={key} onClick={()=>setOverlay(key)}
                        className={`flex items-center gap-1 px-2 py-1 rounded-full text-[9px] font-medium border transition-all ${overlay===key?"bg-emerald-500/20 border-emerald-500/40 text-emerald-300":"border-white/[0.07] text-muted-foreground hover:text-foreground"}`}>
                        <OIcon className="w-2.5 h-2.5"/>{oc.label_ar}
                      </button>
                    );
                  })}
                </div>
              </div>
              {selectedRegion&&(
                <div className="flex items-center gap-2 mb-2 text-[11px] text-emerald-400">
                  <span>تصفية نشطة:</span><span className="font-bold">{selectedRegion}</span>
                  <button onClick={()=>setSelectedRegion(null)}><X className="w-3 h-3"/></button>
                </div>
              )}
              <div className="aspect-[8/5] min-h-[220px]">
                <SyriaMap
                  layerData={OVERLAY_DATA[overlay]}
                  layerColorFn={layerColorFn}
                  onProvinceClick={name=>setSelectedRegion(p=>p===name?null:name)}
                  activeProvinces={selectedRegion?[selectedRegion]:undefined}
                  activeColor="#10b981"
                  className="w-full h-full"
                />
              </div>
              <div className="flex items-center gap-2 mt-2" dir="rtl">
                <span className="text-[8px] text-muted-foreground/50">منخفض</span>
                <div className="flex-1 h-1 rounded-full" style={{background:`linear-gradient(to left,${cfg.to},${cfg.from})`}}/>
                <span className="text-[8px] text-muted-foreground/50">مرتفع</span>
              </div>
            </div>
          </motion.div>

          {/* Agent engine — 5 cols */}
          <div className="col-span-12 lg:col-span-5">
            <div dir="rtl">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 rounded-xl bg-emerald-500/12 border border-emerald-500/25 flex items-center justify-center"><Zap className="w-3.5 h-3.5 text-emerald-400"/></div>
                <div>
                  <p className="text-sm font-bold text-foreground">محرك الذكاء متعدد الوكلاء</p>
                  <p className="text-[9px] text-muted-foreground">4 وكلاء متخصصون · تحليل مباشر</p>
                </div>
              </div>
              <motion.div variants={staggerV} initial="hidden" animate="visible" className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {AGENTS.map(ag=><AgentCard key={ag.id} agent={ag}/>)}
              </motion.div>
            </div>
          </div>
        </motion.div>

        {/* ── ROW 3: Price chart + Negotiation ─────────────────────────── */}
        <motion.div variants={staggerV} initial="hidden" animate="visible" className="grid grid-cols-12 gap-5 mb-5">
          <motion.div variants={cardV} className="col-span-12 lg:col-span-8">
            <div className="glass-card rounded-2xl p-5 border border-white/[0.05]">
              <div className="flex items-center gap-2 mb-4" dir="rtl">

                <div className="w-7 h-7 rounded-xl bg-emerald-500/12 border border-emerald-500/25 flex items-center justify-center"><BarChart3 className="w-3.5 h-3.5 text-emerald-400"/></div>
                <div className="flex-1"><div className="flex items-center gap-1.5"><span className="text-sm font-bold text-foreground">تطور أسعار المحاصيل</span><Insight text="يحلل وكيل السوق الاتجاه السعري مع تقاطعات العرض والطلب الإقليمي."/></div><p className="text-[10px] text-muted-foreground">آخر 6 أشهر · ل.س/كغ</p></div>
                <SourceBadge source="وزارة الزراعة · مؤشر الحبوب العالمي"/>
              </div>
              {isLoading?<Skeleton className="h-44"/>:<PriceTrend crops={crops}/>}
            </div>
          </motion.div>
          <motion.div variants={cardV} className="col-span-12 lg:col-span-4">
            <NegotiationCard/>
          </motion.div>
        </motion.div>

        {/* ── ROW 4: News + last category ────────────────────────────────── */}
        <motion.div variants={staggerV} initial="hidden" animate="visible" className="grid grid-cols-12 gap-5 mb-6">
          <motion.div variants={cardV} className="col-span-12 lg:col-span-8">
            <div className="glass-card rounded-2xl p-5 border border-white/[0.05]">
              <div className="flex items-center gap-2 mb-4" dir="rtl">
                <div className="w-7 h-7 rounded-xl bg-emerald-500/12 border border-emerald-500/25 flex items-center justify-center"><Newspaper className="w-3.5 h-3.5 text-emerald-400"/></div>
                <div className="flex-1"><div className="flex items-center gap-1.5"><span className="text-sm font-bold text-foreground">النشرة الزراعية</span><Insight text="يصنّف وكيل الموثق الأخبار تلقائياً حسب الأهمية والتأثير على اتخاذ القرار."/></div><p className="text-[10px] text-muted-foreground">وزارة الزراعة والإصلاح الزراعي</p></div>
                <SourceBadge source="وزارة الزراعة السورية"/>
              </div>
              <div dir="rtl" className="space-y-2">
                {([
                  { Icon:FileText,       title:"وزارة الزراعة: دعم إضافي لمزارعي القمح في الحسكة",              badge:"سياسات", color:"sky",     date:"24 أبريل 2026" },
                  { Icon:CloudLightning, title:"تحذير: موجة صقيع متوقعة في شمال سوريا هذا الأسبوع",             badge:"طقس",     color:"amber",   date:"23 أبريل 2026", urgent:true },
                  { Icon:TrendingUp,     title:"ارتفاع أسعار القمح 3% في أسواق حلب وحماة",                      badge:"أسعار",   color:"emerald", date:"22 أبريل 2026" },
                  { Icon:Bug,            title:"انتشار آفة حشرة المن في مزارع القطن بالرقة",                     badge:"آفات",    color:"red",     date:"21 أبريل 2026", urgent:true },
                  { Icon:Globe,          title:"اتفاقية تصدير زيت الزيتون السوري إلى الأسواق الأوروبية",         badge:"تصدير",   color:"purple",  date:"20 أبريل 2026" },
                ] as const).map((item, i)=>{
                  const cc  = CC[item.color] ?? CC.emerald;
                  const Icon = item.Icon;
                  const isLatest = i === 0;
                  return (
                    <motion.div key={i} variants={cardV}
                      className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer hover:bg-white/[0.02] transition-colors ${"urgent" in item && item.urgent ? "border-red-500/20 bg-red-500/4" : "border-white/[0.05]"}`}>
                      {/* Icon badge */}
                      <div className="relative flex-shrink-0">
                        <div className={`w-7 h-7 rounded-lg border flex items-center justify-center ${cc.icon}`}>
                          <Icon className="w-3.5 h-3.5"/>
                        </div>
                        {isLatest && (
                          <span className="absolute -top-0.5 -right-0.5 w-2 h-2 flex items-center justify-center">
                            <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping"/>
                            <span className="relative inline-flex w-1.5 h-1.5 rounded-full bg-emerald-400"/>
                          </span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${cc.badge} border ${cc.border}`}>{item.badge}</span>
                          <span className="text-[9px] text-muted-foreground/40 tabular-nums">{item.date}</span>
                        </div>
                        <p className="text-[11px] font-medium text-foreground/90 font-arabic leading-snug truncate">{item.title}</p>
                      </div>
                      {"urgent" in item && item.urgent && <TriangleAlert className="w-3.5 h-3.5 text-amber-400 flex-shrink-0"/>}
                    </motion.div>
                  );
                })}
              </div>
            </div>
          </motion.div>
          <motion.div variants={cardV} className="col-span-12 lg:col-span-4">
            <div className="glass-card rounded-2xl p-4 border border-white/[0.05]">
              <div className="flex items-center gap-2 mb-3" dir="rtl">
                <div className="w-6 h-6 rounded-lg bg-emerald-500/12 border border-emerald-500/25 flex items-center justify-center"><Users className="w-3 h-3 text-emerald-400"/></div>
                <span className="text-[12px] font-bold text-foreground">القطاع الخامس</span>
              </div>
              <CatTile cat={CATEGORIES[4]}/>
              <div className="mt-3 p-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5" dir="rtl">
                <p className="text-[9px] font-bold text-emerald-400 mb-1">وكيل السمعة</p>
                <p className="text-[10px] text-foreground/80 font-arabic leading-relaxed">203 مورد بذور موثق على المنصة · متوسط تقييم 4.6/5 · تغطية 11 محافظة.</p>
              </div>
            </div>
          </motion.div>
        </motion.div>

        <p className="text-[10px] text-muted-foreground/40 text-center" dir="rtl">
          البيانات تقديرية للأغراض التوضيحية · أغرو-سيريا © 2026
        </p>
      </div>
      <MarketCopilot/>
    </div>
  );
}

export default function MarketPage() {
  const [activeView, setActiveView] = useState("market");
  return (
    <WorkspaceLayout activeView={activeView} onNavigate={setActiveView}>
      <MarketContent/>
    </WorkspaceLayout>
  );
}
