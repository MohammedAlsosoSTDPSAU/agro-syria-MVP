"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bot, BadgeCheck, Shield, Star, Brain,
  MessageCircle, Share2, Plus, X, ChevronDown,
  MapPin, Search, AlertTriangle, Activity, Users, Zap,
  Wheat, Sprout, Leaf, Tractor, Bug, CloudLightning,
  CheckCircle, TrendingUp, TrendingDown, BarChart3,
  FileText, BookOpen, Flame,
} from "lucide-react";
import { WorkspaceLayout } from "@/components/workspace/WorkspaceLayout";
import { SyriaMap } from "@/components/workspace/SyriaMap";
import { cn } from "@/lib/utils";
import { PageGuide } from "@/components/ui/PageGuide";
import { InfoTip } from "@/components/ui/InfoTip";

// ── Scroll utility ─────────────────────────────────────────────────────────
// Applied to every independently-scrolling pane for a Notion-thin scrollbar.
const SCROLL = "overflow-y-auto [&::-webkit-scrollbar]:w-[3px] [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/10 [&::-webkit-scrollbar-track]:bg-transparent";

// ── Animation presets ──────────────────────────────────────────────────────
type Bezier = [number, number, number, number];
const EASE: Bezier  = [0.22, 1, 0.36, 1];
const cardV          = { hidden: { opacity: 0, y: 14 }, visible: { opacity: 1, y: 0, transition: { duration: 0.36, ease: EASE } } };
const staggerV       = { hidden: {}, visible: { transition: { staggerChildren: 0.07, delayChildren: 0.04 } } };

// ── Types ──────────────────────────────────────────────────────────────────
type CaseCategory = "محاصيل" | "طقس" | "حصاد" | "سوق" | "آفات";
type ReplyType    = "farmer" | "ai" | "engineer" | "researcher";
type PageView     = "cases" | "wiki";

interface Reply {
  id: string; author: string; type: ReplyType;
  text: string; time: string; trustVotes: number;
}
interface FieldCase {
  id: string; author: string; trustScore: number;
  isVerified: boolean; expertType?: "engineer" | "researcher";
  governorate: string; location: string; cropType: string;
  time: string; question: string; category: CaseCategory;
  aiConfidence: number; agentName: string;
  agentAnalysis: string; agentSuggestions: string[];
  aiSummary: string; replies: Reply[]; isUrgent?: boolean;
}
interface KnowledgeCard {
  id: string; title: string; category: CaseCategory;
  solution: string; verifiedBy: string;
  confidence: number; usedBy: number; savedAt: string;
}

// ── Category config ────────────────────────────────────────────────────────
type CatCfg = { color: string; bg: string; border: string; Icon: React.ComponentType<{ className?: string }> };
const CAT_CFG: Record<CaseCategory, CatCfg> = {
  "محاصيل": { color: "text-emerald-400", bg: "bg-emerald-500/15", border: "border-emerald-500/30", Icon: Wheat         },
  "طقس":    { color: "text-amber-400",   bg: "bg-amber-500/15",   border: "border-amber-500/30",   Icon: CloudLightning },
  "حصاد":   { color: "text-lime-400",    bg: "bg-lime-500/15",    border: "border-lime-500/30",    Icon: Leaf           },
  "سوق":    { color: "text-sky-400",     bg: "bg-sky-500/15",     border: "border-sky-500/30",     Icon: TrendingUp     },
  "آفات":   { color: "text-red-400",     bg: "bg-red-500/15",     border: "border-red-500/30",     Icon: Bug            },
};
const CONF_STYLE: Record<string, string> = {
  emerald: "bg-emerald-500/12 border-emerald-500/30 text-emerald-400",
  sky:     "bg-sky-500/12 border-sky-500/30 text-sky-400",
  amber:   "bg-amber-500/12 border-amber-500/30 text-amber-400",
  red:     "bg-red-500/12 border-red-500/30 text-red-400",
};
const ALERT_STYLE: Record<string, string> = {
  high:   "text-red-400 bg-red-500/10 border-red-500/25",
  medium: "text-amber-400 bg-amber-500/10 border-amber-500/25",
  low:    "text-emerald-400 bg-emerald-500/10 border-emerald-500/25",
};
const AGENT_COLOR: Record<string, string> = {
  emerald: "text-emerald-400 bg-emerald-500/10 border-emerald-500/25",
  amber:   "text-amber-400 bg-amber-500/10 border-amber-500/25",
  sky:     "text-sky-400 bg-sky-500/10 border-sky-500/25",
  purple:  "text-purple-400 bg-purple-500/10 border-purple-500/25",
};

// ── Colour helper ──────────────────────────────────────────────────────────
function lerpHex(from: string, to: string, t: number): string {
  const h = (s: string) => parseInt(s.slice(1), 16);
  const [fr, fg, fb] = [h(from) >> 16, (h(from) >> 8) & 255, h(from) & 255];
  const [tr, tg, tb] = [h(to) >> 16,   (h(to)   >> 8) & 255, h(to)   & 255];
  const r = (a: number, b: number) => Math.round(a + (b - a) * t);
  return `rgb(${r(fr,tr)},${r(fg,tg)},${r(fb,tb)})`;
}
function confColor(score: number) {
  return score >= 90 ? "emerald" : score >= 75 ? "sky" : score >= 60 ? "amber" : "red";
}

// ── Static data ────────────────────────────────────────────────────────────
const TICKER = [
  "مخاطر صدأ القمح مرتفعة في حلب وإدلب — وكيل كشف الأمراض يتابع بشكل مستمر",
  "أسعار القمح ترتفع 3% في حلب وحماة — المخزون الاستراتيجي أقل من 60 يومًا",
  "موسم إزهار الزيتون يبدأ في اللاذقية وطرطوس — توصيات العناية المبكرة متاحة",
  "فرصة تصدير: الطلب الأوروبي على الفستق الحلبي 3 أضعاف مستوى 2024",
  "تحذير آفات: حشرة المن في مزارع القطن بالرقة — التبليغ الفوري مطلوب",
];

const SEASONAL_DATA = {
  topCrops: [
    { name: "القمح",        count: 47, trend: "up"   as const },
    { name: "الطماطم",      count: 31, trend: "up"   as const },
    { name: "زيت الزيتون",  count: 28, trend: "down" as const },
  ],
  topThreats: [
    { name: "صدأ القمح",  level: "high"   as const, regions: "حلب · إدلب"  },
    { name: "حشرة المن",  level: "medium" as const, regions: "الرقة"        },
    { name: "موجة حر",    level: "high"   as const, regions: "ريف دمشق"     },
  ],
  mood: "يقظة زراعية مرتفعة في الشمال بسبب صدأ القمح، مع تفاؤل حذر في الساحل نظرًا لأمطار مبكرة تُبشر بموسم زيتون جيد.",
};

const FIELD_CASES: FieldCase[] = [
  {
    id: "c1", author: "أبو محمد الحسن", trustScore: 142, isVerified: false,
    governorate: "حلب", location: "حلب — منطقة الشمال", cropType: "حبوب",
    time: "منذ ساعتين",
    question: "ورق القمح عندي يصفرّ في حقل الشمال — ما السبب وما الحل الأمثل؟",
    category: "محاصيل", isUrgent: true, aiConfidence: 87, agentName: "وكيل الميدان",
    agentAnalysis: "اصفرار القمح في هذه المرحلة يُرجَّح أن يكون نقص نيتروجين أو إصابة بصدأ الأوراق. تحقق من لون الاصفرار: إن ظهر على الأوراق القديمة فقط → نقص نيتروجين، وإن كانت بقع بنية داخل الأصفر → صدأ.",
    agentSuggestions: ["أخذ عينة تربة للتحقق من pH ومستوى النيتروجين", "فحص الأوراق القديمة أولًا للتمييز بين السببين", "رش وقائي بسماد نيتروجيني مخفف إن تأكد النقص"],
    aiSummary: "يتفق الخبراء على أن الاصفرار الزمني هذا يشير لنقص النيتروجين. الأولوية: تحليل تربة قبل أي رش.",
    replies: [
      { id: "r1", author: "وكيل الميدان الذكي", type: "ai",
        text: "يُوصى بأخذ عينة تربة فورًا. المستوى المثالي للنيتروجين في القمح 140-180 كغ/هكتار. النتائج خلال 48 ساعة تُحدد خطة الرش.",
        time: "منذ ساعة", trustVotes: 38 },
      { id: "r2", author: "المهندس فارس الزعبي", type: "engineer",
        text: "في حلب هذا الموسم صدرت تقارير عن صدأ القمح في أكثر من منطقة. أنصح بمتابعة توصيات وزارة الزراعة والرش بالمبيد الموصى به فورًا.",
        time: "منذ 45 دقيقة", trustVotes: 21 },
    ],
  },
  {
    id: "c2", author: "أم خالد العمر", trustScore: 89, isVerified: true, expertType: "researcher",
    governorate: "ريف دمشق", location: "ريف دمشق — داريا", cropType: "خضروات",
    time: "منذ 9 ساعات",
    question: "كيف أحمي شتلات الطماطم من موجة الحر القادمة؟ درجات الحرارة ستتجاوز 40 درجة مئوية.",
    category: "طقس", isUrgent: true, aiConfidence: 92, agentName: "وكيل المناخ",
    agentAnalysis: "درجة حرارة 40°م تضغط على الطماطم في مرحلة الإزهار وتُسبب إسقاط الأزهار. التدخل الوقائي ضروري قبل 24 ساعة من الذروة الحرارية.",
    agentSuggestions: ["شبك تظليل 70-90% خلال ساعات الذروة 11-16", "الري فجرًا قبل الشروق لتبريد التربة", "رش ماء خفيف على الأوراق مساءً بعد الغروب", "تجنب التسميد النيتروجيني خلال موجة الحر"],
    aiSummary: "الإجماع على ضرورة التدخل الفوري: التظليل أولًا، والري المبكر ثانيًا. توصية باحثة موثقة ذات وزن عالٍ.",
    replies: [
      { id: "r3", author: "وكيل المناخ الذكي", type: "ai",
        text: "توقعات الأسبوع: ذروة الحرارة الثلاثاء والأربعاء. الرطوبة منخفضة 18-22% مما يُضاعف الجفاف. انتهز ليلة الاثنين للري العميق.",
        time: "منذ 8 ساعات", trustVotes: 54 },
    ],
  },
  {
    id: "c3", author: "حسين الخطيب", trustScore: 67, isVerified: false,
    governorate: "حماة", location: "حماة — المحردة", cropType: "أشجار مثمرة",
    time: "منذ يوم",
    question: "ما أفضل وقت لقطاف الزيتون في منطقة حماة هذا العام؟ الموسم بدا مبكرًا بسبب الحرارة.",
    category: "حصاد", isUrgent: false, aiConfidence: 78, agentName: "وكيل الميدان",
    agentAnalysis: "بسبب ارتفاع درجات الحرارة المبكر هذا الموسم، يُتوقع نضج الزيتون في حماة أسبوعين قبل الموعد المعتاد. مراقبة لون الحبة هي المؤشر الأدق.",
    agentSuggestions: ["القطاف عند تحول 90-95% من الحبات إلى البنفسجي لأعلى نسبة زيت", "الفحص الميداني الأسبوعي ابتداءً من مطلع أكتوبر", "تجنب التأخير لمنع تراجع جودة الزيت وحموضته"],
    aiSummary: "يتفق الخبراء والوكيل على أن النضج في حماة هذا العام سيكون في الأسبوع الثاني من أكتوبر. معيار اللون هو الأدق.",
    replies: [
      { id: "r4", author: "أبو عمر المزارع", type: "farmer",
        text: "عادةً منتصف أكتوبر في حماة للتحقق من النضج — اضغط الحبة، إذا خرج زيت أصفر فهي جاهزة.", time: "منذ 20 ساعة", trustVotes: 15 },
      { id: "r5", author: "وكيل الميدان الذكي", type: "ai",
        text: "لأفضل نسبة زيت وجودة: القطاف عند تحول 90-95% من الحبات للبنفسجي. في حماة هذا العام توقع النضج في الأسبوع الثاني من أكتوبر.",
        time: "منذ 18 ساعة", trustVotes: 42 },
    ],
  },
  {
    id: "c4", author: "خالد الأحمد", trustScore: 31, isVerified: false,
    governorate: "الرقة", location: "الرقة — المعدان", cropType: "محاصيل صناعية",
    time: "منذ يومين",
    question: "أين تتوفر بذور القطن المحسّن في منطقة الرقة وما السعر التقريبي الحالي؟",
    category: "سوق", isUrgent: false, aiConfidence: 65, agentName: "وكيل السوق",
    agentAnalysis: "بذور القطن المحسّن شحيحة هذا الموسم بسبب ارتفاع الطلب. السعر التقديري 8,500 - 11,000 ل.س/كغ وفق آخر بيانات السوق.",
    agentSuggestions: ["التواصل مع مديرية زراعة الرقة للحصول على بذور مدعومة", "فحص مستودعات حلب ودير الزور كبديل أقرب", "الصنف Coker 310 متوفر بسعر أقل كخيار احتياطي"],
    aiSummary: "الردود تشير إلى شُح في العرض المحلي. التوجه لمديرية الزراعة هو الطريق الأضمن للبذور المعتمدة والمدعومة.",
    replies: [
      { id: "r6", author: "سامر التاجر", type: "farmer",
        text: "عندي كمية محدودة من بذور قطن Acala المحسّن — تواصل عبر الواتساب لمعرفة السعر الحالي.",
        time: "منذ يوم", trustVotes: 4 },
    ],
  },
];

const KNOWLEDGE_CARDS: KnowledgeCard[] = [
  {
    id: "k1", title: "علاج اصفرار القمح — نقص النيتروجين",
    category: "محاصيل",
    solution: "تحليل التربة أولًا، ثم رش نيتروجين 140-180 كغ/هكتار. لتمييز النقص من صدأ الأوراق: نقص النيتروجين يبدأ من الأوراق القديمة، والصدأ يظهر كبقع بنية داخل الأصفر.",
    verifiedBy: "المهندس فارس الزعبي", confidence: 91, usedBy: 34, savedAt: "25 أبريل 2026",
  },
  {
    id: "k2", title: "حماية الطماطم من موجات الحر فوق 38°م",
    category: "طقس",
    solution: "شبك تظليل 70-90% خلال 11-16 · ري فجري قبل الشروق · رش ورقي مساءً · تجنب التسميد النيتروجيني خلال الحر الشديد.",
    verifiedBy: "أم خالد العمر — باحثة زراعية", confidence: 94, usedBy: 58, savedAt: "23 أبريل 2026",
  },
  {
    id: "k3", title: "توقيت قطاف الزيتون — مؤشر اللون",
    category: "حصاد",
    solution: "القطاف عند تحول 90-95% من الحبات إلى البنفسجي يُعطي أعلى نسبة زيت وأفضل جودة. الانتظار أكثر يُخفض الحموضة لكن يُقلل الكمية.",
    verifiedBy: "وكيل الميدان الذكي", confidence: 86, usedBy: 71, savedAt: "22 أبريل 2026",
  },
];

const PROVINCE_ACTIVITY: Record<string, number> = {
  "حلب":       0.92, "ريف دمشق":  0.80, "حماة":      0.65, "الرقة":     0.48,
  "الحسكة":    0.55, "إدلب":      0.42, "دير الزور": 0.35, "دمشق":      0.38,
  "حمص":       0.32, "اللاذقية":  0.28, "طرطوس":    0.22, "درعا":      0.20,
};

const GOVERNORATES = [
  { name: "حلب",       count: 284 }, { name: "ريف دمشق",  count: 201 },
  { name: "حمص",       count: 178 }, { name: "حماة",       count: 156 },
  { name: "الحسكة",    count: 143 }, { name: "إدلب",       count: 132 },
  { name: "دير الزور", count:  98 }, { name: "اللاذقية",   count:  87 },
  { name: "الرقة",     count:  79 }, { name: "طرطوس",      count:  64 },
  { name: "درعا",      count:  58 }, { name: "دمشق",       count:  45 },
  { name: "السويداء",  count:  38 }, { name: "القنيطرة",   count:  22 },
];
const CLIMATE_ZONES  = [
  { name: "شبه جاف", count: 412 }, { name: "متوسطي",  count: 318 },
  { name: "شبه رطب", count: 187 }, { name: "صحراوي",  count:  94 },
];
const CROP_CATS = [
  { name: "حبوب",           Icon: Wheat,   color: "text-amber-400"   },
  { name: "خضروات",         Icon: Sprout,  color: "text-emerald-400" },
  { name: "أشجار مثمرة",    Icon: Leaf,    color: "text-lime-400"    },
  { name: "محاصيل صناعية",  Icon: Tractor, color: "text-sky-400"     },
];
const EXPERT_AGENTS = [
  { name: "وكيل كشف الأمراض",   status: "active",     Icon: Bug,            color: "emerald" },
  { name: "وكيل الطقس الزراعي", status: "active",     Icon: CloudLightning, color: "amber"   },
  { name: "وكيل المجتمع",        status: "active",     Icon: Users,          color: "sky"     },
  { name: "وكيل التوقعات",       status: "processing", Icon: BarChart3,      color: "purple"  },
];
const ALL_CATS: (CaseCategory | "الكل")[] = ["الكل", "محاصيل", "طقس", "حصاد", "سوق", "آفات"];

// ── Sub-components ─────────────────────────────────────────────────────────
function ConfidenceBadge({ score }: { score: number }) {
  return (
    <span className={cn("flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full border", CONF_STYLE[confColor(score)])}>
      <Brain className="w-2.5 h-2.5" />{score}% ثقة
    </span>
  );
}

function TrustScore({ score, onVote }: { score: number; onVote: () => void }) {
  const [voted, setVoted] = useState(false);
  return (
    <button onClick={() => { if (!voted) { setVoted(true); onVote(); } }}
      className={cn("flex items-center gap-1 text-[11px] font-semibold transition-colors",
        voted ? "text-amber-400" : "text-muted-foreground/60 hover:text-amber-400")}>
      <Star className={cn("w-3.5 h-3.5", voted && "fill-current")} />
      {score + (voted ? 1 : 0)}
    </button>
  );
}

function AuthorBadge({ type }: { type: ReplyType }) {
  if (type === "ai")         return <span className="flex items-center gap-0.5 text-[9px] bg-sky-500/10 border border-sky-500/20 text-sky-400 rounded-full px-1.5 py-0.5"><Bot className="w-2.5 h-2.5" /> ذكاء اصطناعي</span>;
  if (type === "engineer")   return <span className="flex items-center gap-0.5 text-[9px] bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-full px-1.5 py-0.5"><BadgeCheck className="w-2.5 h-2.5" /> مهندس زراعي</span>;
  if (type === "researcher") return <span className="flex items-center gap-0.5 text-[9px] bg-purple-500/10 border border-purple-500/20 text-purple-400 rounded-full px-1.5 py-0.5"><Shield className="w-2.5 h-2.5" /> باحث زراعي</span>;
  return null;
}

function AgentAnalysisBlock({ agentName, analysis, suggestions }: { agentName: string; analysis: string; suggestions: string[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl border border-sky-500/20 bg-sky-500/4 overflow-hidden">
      <button onClick={() => setOpen(v => !v)} className="w-full flex items-center gap-2 px-3 py-2 text-right">
        <Bot className="w-3.5 h-3.5 text-sky-400 flex-shrink-0" />
        <span className="flex-1 text-[10px] font-bold text-sky-400">تحليل {agentName}</span>
        <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronDown className="w-3.5 h-3.5 text-sky-400/60" />
        </motion.span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.22 }} className="overflow-hidden border-t border-sky-500/15">
            <div className="px-3 py-2.5 space-y-2" dir="rtl">
              <p className="text-[10px] text-foreground/80 leading-relaxed">{analysis}</p>
              <div className="space-y-1">
                {suggestions.map((s, i) => (
                  <div key={i} className="flex items-start gap-1.5">
                    <span className="w-1 h-1 rounded-full bg-sky-400/60 mt-1.5 flex-shrink-0" />
                    <p className="text-[10px] text-muted-foreground">{s}</p>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ReplyItem({ reply }: { reply: Reply }) {
  const avatarCls =
    reply.type === "ai"         ? "bg-sky-500/15 border-sky-500/25 text-sky-400"       :
    reply.type === "engineer"   ? "bg-amber-500/15 border-amber-500/25 text-amber-400" :
    reply.type === "researcher" ? "bg-purple-500/15 border-purple-500/25 text-purple-400" :
                                  "bg-white/[0.06] border-white/[0.1] text-foreground/70";
  return (
    <div className="flex items-start gap-2.5" dir="rtl">
      <div className={cn("w-7 h-7 rounded-full border flex items-center justify-center flex-shrink-0 text-[11px] font-bold", avatarCls)}>
        {reply.type === "ai" ? <Bot className="w-3.5 h-3.5" /> : reply.author[0]}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
          <span className="text-[11px] font-bold text-foreground">{reply.author}</span>
          <AuthorBadge type={reply.type} />
          <div className="flex items-center gap-1 mr-auto">
            <Star className="w-2.5 h-2.5 text-amber-400/60" />
            <span className="text-[9px] text-amber-400/70 tabular-nums">{reply.trustVotes}</span>
            <span className="text-[9px] text-muted-foreground/30 mr-1 tabular-nums">{reply.time}</span>
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground leading-relaxed">{reply.text}</p>
      </div>
    </div>
  );
}

// ── Field Case Card ────────────────────────────────────────────────────────
function FieldCaseCard({ fc, onTrustVote }: { fc: FieldCase; onTrustVote: (id: string) => void }) {
  const [expanded,    setExpanded]    = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [savedToWiki, setSavedToWiki] = useState(false);
  const cat    = CAT_CFG[fc.category];
  const CatIcon = cat.Icon;
  const hasConsensus = fc.replies.length >= 2;

  return (
    <motion.div variants={cardV} className="glass-card rounded-2xl overflow-hidden border border-white/[0.06]" dir="rtl">
      {fc.isUrgent && <div className="h-[2px] w-full bg-gradient-to-l from-transparent via-red-400/50 to-transparent" />}
      <div className="p-4">
        {/* Author row */}
        <div className="flex items-start gap-3 mb-3">
          <div className="relative flex-shrink-0">
            <div className="w-9 h-9 rounded-full bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center font-bold text-sm text-emerald-400">
              {fc.author[0]}
            </div>
            {fc.isVerified && <CheckCircle className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 text-emerald-400 bg-background rounded-full" />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-0.5">
              <span className="text-[12px] font-bold text-foreground">{fc.author}</span>
              {fc.isVerified && (
                fc.expertType === "researcher"
                  ? <span className="flex items-center gap-0.5 text-[9px] bg-purple-500/10 border border-purple-500/20 text-purple-400 rounded-full px-1.5 py-0.5"><Shield className="w-2.5 h-2.5" /> باحث موثق</span>
                  : <span className="flex items-center gap-0.5 text-[9px] bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-full px-1.5 py-0.5"><CheckCircle className="w-2.5 h-2.5" /> خبير موثق</span>
              )}
              <div className="flex items-center gap-1">
                <Star className="w-2.5 h-2.5 text-amber-400/70" />
                <span className="text-[9px] text-amber-400/70 tabular-nums font-semibold">{fc.trustScore}</span>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1 text-muted-foreground/50">
                <MapPin className="w-2.5 h-2.5" />
                <span className="text-[10px]">{fc.location}</span>
              </div>
              <span className="text-[9px] text-muted-foreground/35 tabular-nums">{fc.time}</span>
            </div>
          </div>
          {/* Category + confidence */}
          <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
            <span className={cn("flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border", cat.bg, cat.border, cat.color)}>
              <CatIcon className="w-3 h-3" />{fc.category}
            </span>
            <ConfidenceBadge score={fc.aiConfidence} />
          </div>
        </div>

        <p className="text-[13px] text-foreground leading-relaxed mb-3">{fc.question}</p>

        <div className="mb-3">
          <AgentAnalysisBlock agentName={fc.agentName} analysis={fc.agentAnalysis} suggestions={fc.agentSuggestions} />
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 flex-wrap">
          <TrustScore score={fc.trustScore} onVote={() => onTrustVote(fc.id)} />
          <button onClick={() => setExpanded(v => !v)}
            className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground/60 hover:text-foreground transition-colors">
            <MessageCircle className="w-3.5 h-3.5" />
            {fc.replies.length} {fc.replies.length === 1 ? "رد" : "ردود"}
          </button>
          <button onClick={() => setShowSummary(v => !v)}
            className={cn("flex items-center gap-1.5 text-[11px] font-medium transition-colors",
              showSummary ? "text-sky-400" : "text-muted-foreground/60 hover:text-sky-400")}>
            <Brain className="w-3.5 h-3.5" />ملخص ذكي
          </button>
          {/* Save to wiki — appears when there's consensus */}
          {hasConsensus && (
            <button onClick={() => setSavedToWiki(true)} disabled={savedToWiki}
              className={cn("flex items-center gap-1 text-[9px] font-medium border rounded-full px-2 py-0.5 transition-all",
                savedToWiki
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400 cursor-default"
                  : "border-emerald-500/20 text-muted-foreground/50 hover:text-emerald-400 hover:border-emerald-500/30")}>
              <BookOpen className="w-2.5 h-2.5" />
              {savedToWiki ? "تم الحفظ في الموسوعة" : "حفظ كحل موثق"}
            </button>
          )}
          <button className="flex items-center gap-1.5 text-[11px] text-muted-foreground/60 hover:text-foreground transition-colors mr-auto">
            <Share2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* AI Consensus Summary */}
        <AnimatePresence>
          {showSummary && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.22 }} className="overflow-hidden mt-3">
              <div className="p-3 rounded-xl border border-sky-500/20 bg-sky-500/5">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Brain className="w-3 h-3 text-sky-400" />
                  <span className="text-[9px] font-bold text-sky-400">تحليل الإجماع — وكيل المجتمع</span>
                </div>
                <p className="text-[10px] text-foreground/80 leading-relaxed">{fc.aiSummary}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Replies */}
      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.28, ease: EASE }} className="overflow-hidden">
            <div className="px-4 pb-4 pt-3 border-t border-white/[0.04] space-y-3 bg-white/[0.01]">
              {fc.replies.map(r => <ReplyItem key={r.id} reply={r} />)}
              <div className="flex items-center gap-2 pt-1" dir="rtl">
                <div className="w-7 h-7 rounded-full bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center text-emerald-400 text-[11px] font-bold flex-shrink-0">أ</div>
                <input placeholder="أضف ردًا أو خبرتك..."
                  className="flex-1 bg-white/[0.02] border border-white/[0.07] rounded-xl px-3 py-1.5 text-[11px] text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-emerald-500/30"
                  dir="rtl" />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── Knowledge Card Item ────────────────────────────────────────────────────
function KnowledgeCardItem({ card }: { card: KnowledgeCard }) {
  const cat    = CAT_CFG[card.category];
  const CatIcon = cat.Icon;
  return (
    <motion.div variants={cardV} className="glass-card rounded-2xl p-4 border border-white/[0.06]" dir="rtl">
      <div className="flex items-start gap-3 mb-3">
        <div className={cn("w-9 h-9 rounded-xl border flex items-center justify-center flex-shrink-0", cat.bg, cat.border)}>
          <CatIcon className={cn("w-4 h-4", cat.color)} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <span className="text-[12px] font-bold text-foreground">{card.title}</span>
            <ConfidenceBadge score={card.confidence} />
          </div>
          <p className="text-[9px] text-muted-foreground/55">
            تحقق: {card.verifiedBy} · {card.savedAt}
          </p>
        </div>
      </div>
      <div className="p-3 rounded-xl border border-white/[0.06] bg-white/[0.02] mb-3">
        <p className="text-[11px] text-foreground/85 leading-relaxed">{card.solution}</p>
      </div>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1 text-[10px] text-emerald-400/70">
          <Users className="w-3 h-3" />
          <span>طُبِّق من <span className="tabular-nums font-semibold">{card.usedBy}</span> مزارع</span>
        </div>
        <button className="mr-auto flex items-center gap-1.5 text-[10px] font-semibold text-emerald-400 hover:text-emerald-300 transition-colors">
          <CheckCircle className="w-3.5 h-3.5" /> حفظ في قائمتي
        </button>
      </div>
    </motion.div>
  );
}

// ── Ask Case Modal ─────────────────────────────────────────────────────────
function AskCaseModal({ onClose, onPublish }: { onClose: () => void; onPublish: (c: FieldCase) => void }) {
  const [text, setText] = useState("");
  const [cat,  setCat]  = useState<CaseCategory>("محاصيل");
  const [gov,  setGov]  = useState("حلب");

  function handlePublish() {
    const q = text.trim();
    if (!q) return;
    onPublish({
      id: `c-user-${Date.now()}`,
      author: "أنت",
      trustScore: 0,
      isVerified: false,
      governorate: gov,
      location: gov,
      cropType: "عام",
      time: "الآن",
      question: q,
      category: cat,
      isUrgent: false,
      aiConfidence: 82,
      agentName: "وكيل الميدان",
      agentAnalysis: "تم استلام قضيتك — وكلاؤنا الأذكياء يحللون التفاصيل الآن وستظهر التوصيات الدقيقة خلال لحظات.",
      agentSuggestions: ["تابع ردود الخبراء والمزارعين على قضيتك", "أرفق صورة واضحة للأعراض للحصول على تحليل أدق"],
      aiSummary: "قضية جديدة قيد التحليل من المجتمع والوكلاء الأذكياء.",
      replies: [],
    });
    onClose();
  }
  return (
    <motion.div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.div className="absolute inset-0 bg-black/65 backdrop-blur-sm" onClick={onClose} />
      <motion.div className="relative z-10 w-full max-w-lg glass-card rounded-3xl overflow-hidden"
        initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 20 }} transition={{ duration: 0.28, ease: EASE }} dir="rtl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-emerald-500/10">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-bold text-foreground">طرح قضية ميدانية</h3>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] flex items-center justify-center transition-colors">
            <X className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="text-[11px] text-muted-foreground block mb-1.5">وصف المشكلة أو السؤال</label>
            <textarea value={text} onChange={e => setText(e.target.value)} rows={4} dir="rtl"
              placeholder="اكتب مشكلتك بدقة — المجتمع والذكاء الاصطناعي جاهزان للمساعدة..."
              className="w-full bg-white/[0.03] border border-white/[0.07] rounded-xl px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-emerald-500/40 resize-none" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[11px] text-muted-foreground block mb-1.5">التصنيف</label>
              <div className="flex flex-wrap gap-1.5">
                {(["محاصيل","طقس","حصاد","سوق","آفات"] as CaseCategory[]).map(c => {
                  const cfg = CAT_CFG[c]; const CIcon = cfg.Icon;
                  return (
                    <button key={c} onClick={() => setCat(c)}
                      className={cn("flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border transition-all",
                        cat === c ? `${cfg.bg} ${cfg.border} ${cfg.color}` : "border-white/[0.07] text-muted-foreground hover:text-foreground")}>
                      <CIcon className="w-2.5 h-2.5" />{c}
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <label className="text-[11px] text-muted-foreground block mb-1.5">المحافظة</label>
              <select value={gov} onChange={e => setGov(e.target.value)} dir="rtl"
                className="w-full bg-white/[0.03] border border-white/[0.07] rounded-xl px-2 py-1.5 text-[11px] text-foreground focus:outline-none focus:border-emerald-500/40">
                {GOVERNORATES.map(g => <option key={g.name} value={g.name}>{g.name}</option>)}
              </select>
            </div>
          </div>
          <div className="p-3 rounded-xl border border-sky-500/15 bg-sky-500/5">
            <div className="flex items-center gap-1.5 mb-1">
              <Bot className="w-3 h-3 text-sky-400" />
              <span className="text-[9px] font-bold text-sky-400">وكيل كشف الأمراض سيحلل قضيتك فور النشر</span>
            </div>
            <p className="text-[9px] text-muted-foreground/60">أرفق وصفًا دقيقًا للأعراض والمنطقة للحصول على أدق تحليل.</p>
          </div>
          <button onClick={handlePublish} disabled={!text.trim()}
            className="w-full py-2.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 text-emerald-400 text-sm font-semibold transition-all disabled:opacity-40">
            نشر القضية الميدانية
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── National Ticker ────────────────────────────────────────────────────────
function NationalTicker() {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setIdx(i => (i + 1) % TICKER.length), 5000);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="flex-shrink-0 flex items-center gap-3 px-5 py-2.5 border-b border-white/[0.05] bg-white/[0.01]">
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
        <span className="text-[10px] font-bold text-emerald-400/80 whitespace-nowrap">الملخص الوطني</span>
      </div>
      <div className="flex-1 overflow-hidden" dir="rtl">
        <AnimatePresence mode="wait">
          <motion.p key={idx} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.3, ease: EASE }}
            className="text-[11px] text-muted-foreground/80 truncate">
            {TICKER[idx]}
          </motion.p>
        </AnimatePresence>
      </div>
      <div className="flex gap-1 flex-shrink-0">
        {TICKER.map((_, i) => (
          <button key={i} onClick={() => setIdx(i)}
            className={cn("h-1 rounded-full transition-all", i === idx ? "bg-emerald-400 w-3" : "bg-white/20 w-1")} />
        ))}
      </div>
    </div>
  );
}

// ── Seasonal Insight Card ──────────────────────────────────────────────────
function SeasonalInsightCard() {
  const [open, setOpen] = useState(true);
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden mb-4">
      <button onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-2.5 px-4 py-3 text-right" dir="rtl">
        <div className="w-7 h-7 rounded-lg bg-emerald-500/12 border border-emerald-500/25 flex items-center justify-center flex-shrink-0">
          <Flame className="w-3.5 h-3.5 text-emerald-400" />
        </div>
        <span className="text-[11px] font-bold text-foreground/90 flex-1">نبض الموسم الزراعي</span>
        <span className="text-[9px] text-muted-foreground/40 tabular-nums mr-2">تحديث منذ 4 دقائق</span>
        <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronDown className="w-3.5 h-3.5 text-muted-foreground/50" />
        </motion.span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.24 }} className="overflow-hidden">
            <div className="px-4 pb-4 border-t border-white/[0.04]" dir="rtl">
              <div className="grid grid-cols-3 gap-3 mt-3">
                {/* Top crops */}
                <div>
                  <p className="text-[9px] font-bold text-muted-foreground/50 uppercase tracking-widest mb-2">الأكثر نقاشًا</p>
                  <div className="space-y-1.5">
                    {SEASONAL_DATA.topCrops.map((c, i) => (
                      <div key={i} className="flex items-center gap-1.5">
                        <span className="text-[9px] text-muted-foreground/40 tabular-nums w-3">{i + 1}</span>
                        <span className="flex-1 text-[10px] text-foreground/80">{c.name}</span>
                        <div className="flex items-center gap-0.5">
                          {c.trend === "up"
                            ? <TrendingUp className="w-2.5 h-2.5 text-emerald-400" />
                            : <TrendingDown className="w-2.5 h-2.5 text-red-400" />}
                          <span className="text-[9px] text-muted-foreground/50 tabular-nums">{c.count}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                {/* Top threats */}
                <div>
                  <p className="text-[9px] font-bold text-muted-foreground/50 uppercase tracking-widest mb-2">أبرز التهديدات</p>
                  <div className="space-y-1.5">
                    {SEASONAL_DATA.topThreats.map((t, i) => (
                      <div key={i} className="flex items-start gap-1.5">
                        <span className={cn("w-1.5 h-1.5 rounded-full mt-1 flex-shrink-0",
                          t.level === "high" ? "bg-red-400" : t.level === "medium" ? "bg-amber-400" : "bg-emerald-400")} />
                        <div className="min-w-0">
                          <p className="text-[10px] text-foreground/80 truncate">{t.name}</p>
                          <p className="text-[9px] text-muted-foreground/40 truncate">{t.regions}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                {/* Mood summary */}
                <div>
                  <p className="text-[9px] font-bold text-muted-foreground/50 uppercase tracking-widest mb-2">حالة المزاج الزراعي</p>
                  <div className="p-2 rounded-xl border border-sky-500/15 bg-sky-500/5">
                    <div className="flex items-center gap-1 mb-1">
                      <Bot className="w-2.5 h-2.5 text-sky-400" />
                      <span className="text-[8px] font-bold text-sky-400">وكيل الذكاء</span>
                    </div>
                    <p className="text-[9px] text-foreground/70 leading-relaxed">{SEASONAL_DATA.mood}</p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Left Navigation ────────────────────────────────────────────────────────
function LeftNav({ govFilter, setGovFilter }: { govFilter: string | null; setGovFilter: (v: string | null) => void }) {
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? GOVERNORATES : GOVERNORATES.slice(0, 7);
  return (
    <div className={cn("hidden lg:block w-56 flex-shrink-0 border-r border-white/[0.05] bg-white/[0.005] px-3 py-4 space-y-5", SCROLL)}>
      {/* Governorates */}
      <div>
        <p className="text-[9px] font-bold text-muted-foreground/45 uppercase tracking-widest mb-2 px-1" dir="rtl">المحافظات</p>
        <div className="space-y-0.5">
          {visible.map(g => (
            <button key={g.name} onClick={() => setGovFilter(govFilter === g.name ? null : g.name)}
              className={cn("w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[11px] transition-colors",
                govFilter === g.name
                  ? "bg-emerald-500/15 text-emerald-400 font-semibold"
                  : "text-muted-foreground/65 hover:text-foreground hover:bg-white/[0.03]")}
              dir="rtl">
              <span className="truncate">{g.name}</span>
              <span className="text-[9px] tabular-nums opacity-55 mr-2 flex-shrink-0">{g.count}</span>
            </button>
          ))}
          <button onClick={() => setShowAll(v => !v)}
            className="w-full flex items-center gap-1 px-2.5 py-1 text-[10px] text-emerald-400/55 hover:text-emerald-400 transition-colors" dir="rtl">
            <ChevronDown className={cn("w-3 h-3 transition-transform", showAll && "rotate-180")} />
            {showAll ? "عرض أقل" : `${GOVERNORATES.length - 7} محافظات أخرى`}
          </button>
        </div>
      </div>
      {/* Climate zones */}
      <div>
        <p className="text-[9px] font-bold text-muted-foreground/45 uppercase tracking-widest mb-2 px-1" dir="rtl">المناطق المناخية</p>
        <div className="space-y-0.5">
          {CLIMATE_ZONES.map(z => (
            <div key={z.name} className="flex items-center justify-between px-2.5 py-1.5 rounded-lg" dir="rtl">
              <span className="text-[11px] text-muted-foreground/55">{z.name}</span>
              <span className="text-[9px] text-muted-foreground/35 tabular-nums">{z.count}</span>
            </div>
          ))}
        </div>
      </div>
      {/* Crop types */}
      <div>
        <p className="text-[9px] font-bold text-muted-foreground/45 uppercase tracking-widest mb-2 px-1" dir="rtl">أنواع المحاصيل</p>
        <div className="space-y-0.5">
          {CROP_CATS.map(c => {
            const CIcon = c.Icon;
            return (
              <div key={c.name} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg" dir="rtl">
                <CIcon className={cn("w-3 h-3 flex-shrink-0", c.color)} />
                <span className="text-[11px] text-muted-foreground/55 truncate">{c.name}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Right Intelligence Panel ───────────────────────────────────────────────
function RightIntel({
  cases, govFilter, setGovFilter,
}: {
  cases: FieldCase[]; govFilter: string | null; setGovFilter: (v: string | null) => void;
}) {
  // Compute alert provinces from urgent field cases
  const alertProvinces = useMemo(
    () => cases.filter(c => c.isUrgent).map(c => c.governorate),
    [cases],
  );
  // Community activity color fn: low=#064e3b → high=#10b981
  const colorFn = (v: number) => lerpHex("#064e3b", "#10b981", Math.max(v, 0.12));

  return (
    <div className={cn("hidden lg:block w-64 flex-shrink-0 border-l border-white/[0.05] bg-white/[0.005] px-3 py-4 space-y-5", SCROLL)}>

      {/* ── Community Activity Radar (SyriaMap) ── */}
      <div>
        <div className="flex items-center gap-1.5 mb-2" dir="rtl">
          <Activity className="w-3.5 h-3.5 text-emerald-400" />
          <p className="text-[11px] font-bold text-foreground/90">رادار النشاط الجغرافي</p>
          {govFilter && (
            <button onClick={() => setGovFilter(null)}
              className="mr-auto flex items-center gap-0.5 text-[8px] text-sky-400 hover:text-sky-300 transition-colors border border-sky-500/25 rounded-full px-1.5 py-0.5">
              <X className="w-2 h-2" />{govFilter}
            </button>
          )}
        </div>
        <div className="aspect-[8/5] rounded-xl overflow-hidden border border-white/[0.06]">
          <SyriaMap
            layerData={PROVINCE_ACTIVITY}
            layerColorFn={colorFn}
            alertProvinces={alertProvinces}
            highlightedProvince={govFilter}
            activeProvinces={govFilter ? [govFilter] : []}
            activeColor="#10b981"
            onProvinceClick={name => setGovFilter(govFilter === name ? null : name)}
            className="w-full h-full"
          />
        </div>
        <p className="text-[8px] text-muted-foreground/30 mt-1 text-center">اضغط على محافظة لتصفية القضايا</p>
      </div>

      {/* ── Trending Alerts ── */}
      <div>
        <div className="flex items-center gap-1.5 mb-2.5" dir="rtl">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
          <p className="text-[11px] font-bold text-foreground/90">تنبيهات نشطة</p>
          <span className="mr-auto w-1.5 h-1.5 rounded-full bg-red-400 animate-ping" />
        </div>
        <div className="space-y-1.5">
          {[
            { text: "صدأ القمح",  region: "حلب · إدلب",  level: "high"   as const, Icon: Bug            },
            { text: "حشرة المن",  region: "الرقة",        level: "medium" as const, Icon: AlertTriangle  },
            { text: "موجة حر",    region: "ريف دمشق",    level: "high"   as const, Icon: CloudLightning },
            { text: "جفاف موسمي", region: "الحسكة",       level: "low"    as const, Icon: AlertTriangle  },
          ].map((a, i) => {
            const AIcon = a.Icon;
            return (
              <motion.div key={i} whileHover={{ x: -2 }}
                className={cn("flex items-center gap-2 p-2 rounded-xl border", ALERT_STYLE[a.level])} dir="rtl">
                <AIcon className="w-3 h-3 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-semibold truncate">{a.text}</p>
                  <p className="text-[9px] opacity-60 truncate">{a.region}</p>
                </div>
                <span className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0",
                  a.level === "high" ? "bg-red-400 animate-pulse" : a.level === "medium" ? "bg-amber-400" : "bg-emerald-400")} />
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* ── Active Expert Agents ── */}
      <div>
        <div className="flex items-center gap-1.5 mb-2.5" dir="rtl">
          <Zap className="w-3.5 h-3.5 text-emerald-400" />
          <p className="text-[11px] font-bold text-foreground/90">وكلاء الخبراء</p>
        </div>
        <div className="space-y-1.5">
          {EXPERT_AGENTS.map(ag => {
            const AIcon = ag.Icon;
            return (
              <div key={ag.name} className={cn("flex items-center gap-2 p-2 rounded-xl border", AGENT_COLOR[ag.color])} dir="rtl">
                <AIcon className="w-3 h-3 flex-shrink-0" />
                <p className="flex-1 text-[10px] font-medium truncate">{ag.name}</p>
                <span className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0",
                  ag.status === "active" ? "bg-emerald-400 animate-pulse" : "bg-sky-400 animate-pulse")} />
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Regional Disease Heatmap ── */}
      <div>
        <div className="flex items-center gap-1.5 mb-2.5" dir="rtl">
          <BarChart3 className="w-3.5 h-3.5 text-purple-400" />
          <p className="text-[11px] font-bold text-foreground/90">خريطة الأمراض</p>
        </div>
        <div className="rounded-xl border border-white/[0.06] overflow-hidden">
          {[
            { gov: "حلب",      risk: "مرتفع", level: 3 }, { gov: "إدلب",     risk: "مرتفع", level: 3 },
            { gov: "الرقة",    risk: "متوسط", level: 2 }, { gov: "حماة",     risk: "منخفض", level: 1 },
            { gov: "اللاذقية", risk: "منخفض", level: 1 },
          ].map((d, i, arr) => (
            <div key={d.gov}
              className={cn("flex items-center justify-between px-2.5 py-1.5 text-[10px]", i !== arr.length - 1 && "border-b border-white/[0.04]")}
              dir="rtl">
              <span className="text-muted-foreground/65">{d.gov}</span>
              <span className={cn("font-semibold", d.level === 3 ? "text-red-400" : d.level === 2 ? "text-amber-400" : "text-emerald-400")}>
                {d.risk}
              </span>
            </div>
          ))}
        </div>
        <p className="text-[8px] text-muted-foreground/25 mt-1.5 text-center">وكيل كشف الأمراض · تحديث مستمر</p>
      </div>

      {/* ── Community stats ── */}
      <div className="p-3 rounded-xl border border-emerald-500/15 bg-emerald-500/4" dir="rtl">
        <div className="flex items-center gap-1.5 mb-2.5">
          <Users className="w-3 h-3 text-emerald-400" />
          <p className="text-[10px] font-bold text-emerald-400">الشبكة الوطنية</p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: "مزارع نشط",   value: "5,847" },
            { label: "قضية اليوم",  value: "34"    },
            { label: "خبير موثق",   value: "128"   },
            { label: "إجماع ذكي",   value: "89%"   },
          ].map(s => (
            <div key={s.label} className="text-center">
              <p className="text-[12px] font-bold text-foreground tabular-nums">{s.value}</p>
              <p className="text-[8px] text-muted-foreground/45">{s.label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Main Community Content ─────────────────────────────────────────────────
function CommunityContent() {
  const [catFilter, setCatFilter] = useState<CaseCategory | "الكل">("الكل");
  const [govFilter, setGovFilter] = useState<string | null>(null);
  const [search,    setSearch]    = useState("");
  const [view,      setView]      = useState<PageView>("cases");
  const [showAsk,   setShowAsk]   = useState(false);
  const [cases, setCases]         = useState(FIELD_CASES);
  const skipCasesWrite = useRef(true);

  // Session-scoped persistence: survives refresh, resets when the tab closes.
  // Hydrate once on mount (client only) so SSR markup matches and we avoid a
  // hydration mismatch (initial render always uses the seed).
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = sessionStorage.getItem("agro_community_cases_v1");
      if (raw) {
        const parsed: unknown = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length) setCases(parsed as FieldCase[]);
      }
    } catch { /* corrupt / unavailable — keep the seed */ }
  }, []);

  // Persist on every change (skip the initial mount write so it can't clobber
  // freshly hydrated data before it lands).
  useEffect(() => {
    if (skipCasesWrite.current) { skipCasesWrite.current = false; return; }
    if (typeof window === "undefined") return;
    try {
      sessionStorage.setItem("agro_community_cases_v1", JSON.stringify(cases));
    } catch { /* quota / SSR — ignore */ }
  }, [cases]);

  const handleTrustVote = (id: string) =>
    setCases(prev => prev.map(c => c.id === id ? { ...c, trustScore: c.trustScore + 1 } : c));

  const filtered = cases.filter(c =>
    (catFilter === "الكل" || c.category === catFilter) &&
    (!govFilter || c.governorate === govFilter) &&
    (!search || c.question.includes(search) || c.author.includes(search)),
  );

  return (
    <div className="flex flex-col min-h-[100dvh] md:min-h-0 md:flex-1 md:overflow-hidden">
      {/* ── Ticker (full-width strip, never scrolls) ── */}
      <NationalTicker />

      {/* ── Body: stacked on mobile (feed only), 3-column on desktop ── */}
      <div className="flex flex-col lg:flex-row md:flex-1 md:min-h-0 md:overflow-hidden">

        {/* LEFT: Regional nav — desktop only */}
        <LeftNav govFilter={govFilter} setGovFilter={setGovFilter} />

        {/* CENTER: Smart feed — the only truly large scroll */}
        <div className={cn("flex-1", SCROLL)}>
          <div className="px-5 py-4 max-w-2xl mx-auto w-full">

            {/* Header */}
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
              className="flex items-start justify-between gap-4 mb-4 flex-wrap" dir="rtl">
              <div>
                <h2 className="text-xl font-bold text-foreground flex items-center gap-1.5">
                  شبكة المعرفة الزراعية الوطنية
                  <InfoTip
                    title="شبكة المعرفة الزراعية"
                    definition="مساحة يجتمع فيها المزارعون السوريون لتبادل الخبرة وحلّ المشكلات الميدانية معاً."
                    services={["طرح قضية ميدانية", "ردود الخبراء والمزارعين", "تصفية القضايا حسب المحافظة", "متابعة نبض الموسم"]}
                  />
                </h2>
                <p className="text-[12px] text-muted-foreground mt-0.5">
                  {govFilter ? `قضايا محافظة ${govFilter}` : "قضايا ميدانية · تحليل ذكي · خبرة جماعية"}
                </p>
                <PageGuide
                  summary="مجتمع المزارعين — اطرح قضيتك، شارك خبرتك، وتعاون مع كل المحافظات."
                  services={["طرح قضية ميدانية", "ردود الخبراء والمزارعين", "تصفية حسب المحافظة", "نبض الموسم", "تعاون وطني"]}
                />
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <InfoTip
                  title="طرح القضايا والتصفية"
                  definition="انشر مشكلتك الميدانية ليراها آلاف المزارعين والخبراء، أو صفّ القضايا حسب الفئة والمحافظة لتجد ما يخصّك بسرعة."
                  services={["طرح قضية جديدة بالتفاصيل والصور", "التبديل بين القضايا وموسوعة الحلول", "البحث في القضايا", "التصفية حسب الفئة والمحافظة"]}
                />
                <button onClick={() => setShowAsk(true)}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 text-emerald-400 text-sm font-semibold transition-all">
                  <Plus className="w-4 h-4" /> قضية جديدة
                </button>
              </div>
            </motion.div>

            {/* Seasonal Insight Card */}
            <SeasonalInsightCard />

            {/* View toggle + search + filters */}
            <div className="space-y-3 mb-4">
              <div className="flex items-center gap-2 flex-wrap" dir="rtl">
                {/* View switcher */}
                <div className="flex gap-1 p-1 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                  {([["cases", "القضايا الميدانية", FileText], ["wiki", "موسوعة الحلول", BookOpen]] as [PageView, string, React.ElementType][]).map(([id, label, Icon]) => (
                    <button key={id} onClick={() => setView(id)}
                      className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all",
                        view === id ? "bg-emerald-500/20 border border-emerald-500/30 text-emerald-400" : "text-muted-foreground hover:text-foreground")}>
                      <Icon className="w-3 h-3" />{label}
                    </button>
                  ))}
                </div>
              </div>

              {view === "cases" && (
                <>
                  <div className="relative" dir="rtl">
                    <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/40" />
                    <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                      placeholder="ابحث في القضايا الميدانية..."
                      className="w-full bg-white/[0.03] border border-white/[0.07] rounded-xl ps-9 pe-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-emerald-500/30" />
                  </div>
                  <div className="flex gap-1.5 flex-wrap" dir="rtl">
                    {ALL_CATS.map(c => {
                      const cfg = c !== "الكل" ? CAT_CFG[c] : null;
                      const CIcon = cfg?.Icon;
                      return (
                        <button key={c} onClick={() => setCatFilter(c)}
                          className={cn("flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-medium border transition-all",
                            catFilter === c
                              ? cfg ? `${cfg.bg} ${cfg.border} ${cfg.color}` : "bg-emerald-500/20 border-emerald-500/40 text-emerald-300"
                              : "border-white/[0.07] text-muted-foreground hover:text-foreground hover:border-white/[0.12]")}>
                          {CIcon && <CIcon className="w-3 h-3" />}{c}
                        </button>
                      );
                    })}
                    {govFilter && (
                      <button onClick={() => setGovFilter(null)}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-medium border border-sky-500/30 bg-sky-500/10 text-sky-400">
                        <MapPin className="w-3 h-3" />{govFilter}<X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Feed */}
            <AnimatePresence mode="wait">
              {view === "cases" ? (
                <motion.div key="cases" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <motion.div variants={staggerV} initial="hidden" animate="visible" className="space-y-4">
                    {filtered.length > 0
                      ? filtered.map(c => <FieldCaseCard key={c.id} fc={c} onTrustVote={handleTrustVote} />)
                      : (
                        <div className="text-center py-20" dir="rtl">
                          <Search className="w-8 h-8 text-muted-foreground/20 mx-auto mb-3" />
                          <p className="text-sm font-semibold text-foreground mb-1">لا توجد قضايا</p>
                          <p className="text-[12px] text-muted-foreground">جرب كلمة بحث مختلفة أو تصنيف آخر</p>
                        </div>
                      )}
                  </motion.div>
                </motion.div>
              ) : (
                <motion.div key="wiki" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <div className="flex items-center gap-2 mb-4 p-3 rounded-xl border border-emerald-500/15 bg-emerald-500/4" dir="rtl">
                    <BookOpen className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    <div>
                      <p className="text-[11px] font-bold text-emerald-400">موسوعة الحلول الزراعية الموثقة</p>
                      <p className="text-[9px] text-muted-foreground/60">حلول مُجمَّعة من الإجماع المجتمعي وتحقق الخبراء والذكاء الاصطناعي</p>
                    </div>
                  </div>
                  <motion.div variants={staggerV} initial="hidden" animate="visible" className="space-y-4">
                    {KNOWLEDGE_CARDS.map(k => <KnowledgeCardItem key={k.id} card={k} />)}
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

            <p className="text-[10px] text-muted-foreground/25 text-center mt-8 mb-2" dir="rtl">
              أغرو-سيريا · شبكة المعرفة الزراعية © 2026
            </p>
          </div>
        </div>

        {/* RIGHT: Intelligence panel — own thin scroll */}
        <RightIntel cases={cases} govFilter={govFilter} setGovFilter={setGovFilter} />
      </div>

      <AnimatePresence>
        {showAsk && (
          <AskCaseModal
            onClose={() => setShowAsk(false)}
            onPublish={(c) => {
              setCases(prev => [c, ...prev]);
              // Reset view + filters so the freshly published case is visible at the top.
              setView("cases");
              setCatFilter("الكل");
              setGovFilter(null);
              setSearch("");
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

export default function CommunityPage() {
  return (
    <WorkspaceLayout activeView="community">
      <CommunityContent />
    </WorkspaceLayout>
  );
}
