"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Bot, Send, Paperclip, Mic, ShieldAlert, ChevronDown,
  AlertCircle, Trash2, FileDown, AlertTriangle, X,
  Archive, MessageSquare, Map, FileText, Plus, Activity,
  CloudSun, TrendingUp, Droplets, Bug, Search, ArrowLeft,
  Clock, Zap, MicOff, Brain, Sprout,
  BookmarkPlus, MapPin, Thermometer,
  RotateCcw, Pencil, Copy, Check, Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { sendChatMessage, type AgentThought, type VisualizationData } from "@/lib/api";
import { VisualWorkspace } from "@/components/workspace/VisualWorkspace";
import { AgroLogo } from "@/components/icons/AgroLogo";
import {
  // SmartCards temporarily disabled (content is hardcoded) — re-enable with real data:
  // WeatherInsightCard, MarketForecastCard, IrrigationPlanCard, NationalTrendCard,
  MiniSyriaMap,
} from "@/components/copilot/SmartCards";

// ── Types ─────────────────────────────────────────────────────────────

interface Message {
  id: string;
  role: "user" | "assistant" | "error";
  text: string;
  thoughts?: AgentThought[];
  imagePreview?: string;
  visualization?: VisualizationData;
  time?: string;
  emergency?: boolean;
  smartCard?: "weather" | "market" | "irrigation" | "disease" | "trends";
  smartCardMeta?: Record<string, string>;
}

// ── Constants ─────────────────────────────────────────────────────────

type Bezier = [number, number, number, number];
const EASE: Bezier = [0.22, 1, 0.36, 1];

const STORAGE_MESSAGES  = "agro_copilot_v3_messages";
const STORAGE_SESSION   = "agro_copilot_v3_session";
const STORAGE_KNOWLEDGE = "agro_copilot_v3_knowledge";
const MAX_IMAGE_BYTES   = 5 * 1024 * 1024;

// ── Mock library data ─────────────────────────────────────────────────

const SAVED_SESSIONS = [
  { id: "s1", title: "تحليل إصابة القمح",      preview: "شخّصت وجود صدأ أصفر في الحقل...", time: "منذ ساعتين", count: 8  },
  { id: "s2", title: "توصيات ري حلب",          preview: "الري الفجري بين 5–7 صباحاً...",    time: "أمس",        count: 14 },
  { id: "s3", title: "أسعار السوق الأسبوعية", preview: "القمح ارتفع 7% هذا الأسبوع...",    time: "3 أيام",     count: 6  },
  { id: "s4", title: "خطة موسم الزيتون",       preview: "التوقعات تشير إلى موسم ممتاز...", time: "أسبوع",      count: 22 },
];

const SAVED_MAPS = [
  { id: "m1", title: "رطوبة التربة",   province: "حلب",   date: "26 مايو" },
  { id: "m2", title: "توزيع الآفات",   province: "حمص",   date: "24 مايو" },
  { id: "m3", title: "خريطة الحرارة", province: "الرقة", date: "22 مايو" },
];

const SAVED_REPORTS = [
  { id: "r1", title: "تقرير الموسم الربيعي",  date: "مايو 2026"   },
  { id: "r2", title: "توصيات التسميد — حمص", date: "أبريل 2026" },
];

// ── Agent data ────────────────────────────────────────────────────────

type AgentStatusKey = "active" | "processing" | "alert" | "idle";

interface CopilotAgent {
  id: string;
  nameAr: string;
  descAr: string;
  status: AgentStatusKey;
  lastActionAr: string;
  metric: string;
  icon: React.ElementType;
  accent: "emerald" | "sky" | "amber" | "red";
}

const COPILOT_AGENTS: CopilotAgent[] = [
  {
    id: "weather", nameAr: "وكيل الطقس",    descAr: "تحليل البيانات المناخية والإنذار المبكر",
    status: "active",     lastActionAr: "يرصد موجة حر في الرقة",   metric: "38°م",
    icon: CloudSun, accent: "sky",
  },
  {
    id: "market",  nameAr: "وكيل السوق",    descAr: "رصد أسعار المحاصيل وتحليل اتجاهات السوق",
    status: "idle",       lastActionAr: "آخر تحديث منذ 15 دقيقة",  metric: "951 ل.س",
    icon: TrendingUp, accent: "amber",
  },
  {
    id: "soil",    nameAr: "وكيل التربة",   descAr: "قياس رطوبة التربة ووضع خطط الري المثلى",
    status: "processing", lastActionAr: "يحلل عينات حقل حلب",      metric: "pH 7.2",
    icon: Droplets, accent: "emerald",
  },
  {
    id: "disease", nameAr: "كاشف الأمراض", descAr: "رصد الآفات والأمراض بتقنية الرؤية الحاسوبية",
    status: "alert",      lastActionAr: "تحذير: صدأ أصفر شمالاً", metric: "تنبيه",
    icon: Bug, accent: "red",
  },
];

const STATUS_CFG: Record<AgentStatusKey, { dot: string; label: string; pulse: boolean; border: string; bg: string }> = {
  active:     { dot: "bg-emerald-400", label: "نشط",   pulse: true,  border: "border-emerald-500/25", bg: "bg-emerald-500/8" },
  processing: { dot: "bg-sky-400",     label: "يعمل",  pulse: true,  border: "border-sky-500/25",     bg: "bg-sky-500/5"     },
  alert:      { dot: "bg-red-400",     label: "تنبيه", pulse: true,  border: "border-red-500/25",     bg: "bg-red-500/5"     },
  idle:       { dot: "bg-slate-500",   label: "موقف",  pulse: false, border: "border-white/[0.06]",   bg: "bg-white/[0.02]"  },
};

const ACCENT_CFG: Record<CopilotAgent["accent"], { icon: string; iconBg: string }> = {
  emerald: { icon: "text-emerald-400", iconBg: "bg-emerald-500/15 ring-1 ring-emerald-500/25" },
  sky:     { icon: "text-sky-400",     iconBg: "bg-sky-500/15     ring-1 ring-sky-500/25"     },
  amber:   { icon: "text-amber-400",   iconBg: "bg-amber-500/15   ring-1 ring-amber-500/25"   },
  red:     { icon: "text-red-400",     iconBg: "bg-red-500/15     ring-1 ring-red-500/25"     },
};

const LIVE_METRICS = [
  { label: "الحرارة (دمشق)",         value: "29°م", color: "text-amber-400"   },
  { label: "القمح (ل.س/كغ)",          value: "951",  color: "text-emerald-400" },
  { label: "رطوبة التربة (متوسط)", value: "68%",  color: "text-sky-400"     },
];

const LIVE_LOG = [
  { agent: "وكيل الطقس",    action: "يحلل البيانات المناخية للرقة..." },
  { agent: "وكيل السوق",    action: "يحدّث أسعار الحبوب الأسبوعية..." },
  { agent: "وكيل التربة",   action: "يعالج بيانات رطوبة حقول حلب..."  },
  { agent: "كاشف الأمراض", action: "رصد إصابة محتملة في محافظة إدلب..." },
];

const REASONING_STREAM_BASE = [
  { agentAr: "وكيل التواصل",       actionAr: "جلب سياق المحادثة وتحديد النية..." },
  { agentAr: "وكيل البحث العلمي",  actionAr: "تمشيط المكتبة الزراعية السورية..." },
  { agentAr: "وكيل الطقس",         actionAr: "جلب بيانات الطقس والمناخ المحلي..." },
  { agentAr: "وكيل السوق",         actionAr: "مقارنة أسعار السوق في المحافظات..." },
  { agentAr: "وكيل التربة",        actionAr: "جلب بيانات رطوبة التربة والحقول..." },
  { agentAr: "المخطط الاستراتيجي", actionAr: "تجميع النتائج وصياغة التوصية النهائية..." },
];

const REASONING_STREAM_EMERGENCY = [
  { agentAr: "وكيل الطوارئ",       actionAr: "تحليل البلاغ الطارئ وتحديد الأولوية..." },
  { agentAr: "وكيل الطقس",         actionAr: "جلب بيانات الطقس الحرجة الفورية..." },
  { agentAr: "كاشف الأمراض",       actionAr: "فحص سريع لقاعدة بيانات الآفات الخطرة..." },
  { agentAr: "المستجيب الأول",      actionAr: "إعداد بروتوكول الاستجابة الطارئة..." },
];

const USER_FIELDS = [
  { id: "f1", nameAr: "حقل القمح الرئيسي",  area: 45, province: "حلب",  crop: "قمح",   health: 82 },
  { id: "f2", nameAr: "بستان الزيتون",       area: 20, province: "إدلب", crop: "زيتون", health: 91 },
  { id: "f3", nameAr: "حقل القطن الجنوبي",  area: 30, province: "حمص",  crop: "قطن",   health: 68 },
];

interface ContextMemory {
  id: string;
  refAr: string;
  timeAr: string;
  icon: React.ElementType;
}

interface KnowledgeCard {
  id: string;
  titleAr: string;
  summaryAr: string;
  time: string;
  tag: NonNullable<Message["smartCard"]> | "general";
}

const CONTEXT_MEMORIES: ContextMemory[] = [
  { id: "c1", refAr: "صدأ القمح — حقل حلب",   timeAr: "منذ ساعتين", icon: Bug        },
  { id: "c2", refAr: "خطة ري موسم الحر",      timeAr: "أمس",        icon: Droplets   },
  { id: "c3", refAr: "أسعار القمح الأسبوعية", timeAr: "3 أيام",     icon: TrendingUp },
];

const PROACTIVE_ALERTS = [
  "وكيل الطقس يُنبّه: موجة حر متوقعة — يُنصح بتفقد قنوات الري وتعجيل جدول الحصاد.",
  "وكيل السوق يلاحظ ارتفاعاً في أسعار القمح بنسبة 7% — نافذة بيع مثالية هذا الأسبوع.",
  "كاشف الأمراض يُحذّر: ارتفاع الرطوبة الجوية يهيئ بيئة مناسبة للبياض الدقيقي.",
  "وكيل التربة يُشير: انخفاض رطوبة التربة دون 40% في حقول حلب — يُوصى بري فجري فوري.",
];

// ── Thinking steps ────────────────────────────────────────────────────

const THINKING_STEPS = {
  base: [
    { agentAr: "وكيل التواصل",       actionAr: "جارٍ استقبال رسالتك وتجهيز الرد..." },
    { agentAr: "وكيل البحث العلمي",  actionAr: "جارٍ البحث في المكتبة الزراعية السورية..." },
    { agentAr: "المخطط الاستراتيجي", actionAr: "جارٍ تحليل المعطيات الزراعية..." },
  ],
  vision: [
    { agentAr: "وكيل التواصل",          actionAr: "جارٍ استقبال رسالتك وتجهيز الرد..." },
    { agentAr: "خبير المعاينة البصرية",  actionAr: "وكيل الرؤية يحلل الصورة المرفقة..." },
    { agentAr: "وكيل البحث العلمي",     actionAr: "رصد إصابة محتملة — جارٍ البحث عن التفاصيل..." },
    { agentAr: "المخطط الاستراتيجي",    actionAr: "جارٍ تحليل المعطيات الزراعية..." },
  ],
} as const;

// ── Welcome ───────────────────────────────────────────────────────────

function makeWelcome(): Message {
  return {
    id: "welcome",
    role: "assistant",
    time: nowHHMM(),
    text:
      "أهلاً وسهلاً! أنا المساعد الزراعي الوطني الذكي.\n\n" +
      "أقدر أساعدك في تحليل أحوال التربة والطقس، نصائح المحاصيل والري، " +
      "أسعار الأسواق الزراعية، والكشف المبكر عن الآفات والأمراض.\n\n" +
      "راسلني أو ارفع صورة مباشرة من حقلك — الوكلاء الذكيون جاهزون.\n\n" +
      "بم يمكنني مساعدتك اليوم؟",
  };
}

// ── Province detection ────────────────────────────────────────────────

function detectProvince(text: string): string | null {
  const MAP: [RegExp, string][] = [
    [/الحسكة|hasakah|hasaka/i,             "الحسكة"   ],
    [/حلب|aleppo/i,                        "حلب"      ],
    [/دمشق|damascus/i,                     "دمشق"     ],
    [/حمص|homs/i,                          "حمص"      ],
    [/حماة|hama/i,                         "حماة"     ],
    [/إدلب|idlib/i,                        "إدلب"     ],
    [/الرقة|raqqa/i,                       "الرقة"    ],
    [/دير الزور|deir ez-zor|deir/i,        "دير الزور"],
    [/اللاذقية|latakia/i,                  "اللاذقية" ],
    [/درعا|daraa/i,                        "درعا"     ],
    [/طرطوس|tartus/i,                      "طرطوس"    ],
    [/السويداء|suwayda/i,                  "السويداء" ],
    [/القنيطرة|quneitra/i,                 "القنيطرة" ],
  ];
  for (const [regex, name] of MAP) {
    if (regex.test(text)) return name;
  }
  return null;
}

// ── Smart card detection ──────────────────────────────────────────────

function detectSmartCard(
  userMsg: string,
  aiReply: string,
): { type: NonNullable<Message["smartCard"]>; meta: Record<string, string> } | null {
  const text = userMsg + " " + aiReply;

  // Disease card — only when the user is actually consulting about a specific
  // disease/pest, NOT when the AI merely mentions "الأمراض/الوقاية" in general
  // advice (that incidental mention used to surface the rust card on every
  // reply). Require a SPECIFIC disease term in the user's question, or a
  // specific diagnosis in the reply paired with a disease-context question.
  const specificDisease = /صدأ|بياض دقيقي|لفح|أفيد|rust|blight|powdery|aphid/i;
  const diseaseContext  = /مرض|آفة|إصابة|أعراض|عدوى|disease|pest|infection|symptom/i;
  if (specificDisease.test(userMsg) || (diseaseContext.test(userMsg) && specificDisease.test(aiReply))) {
    const key = /بياض دقيقي|powdery/i.test(text) ? "powdery"
              : /لفح|blight/i.test(text)           ? "blight"
              : /أفيد|aphid|حشر/i.test(text)       ? "aphids"
              : "rust";
    return { type: "disease", meta: { diseaseKey: key } };
  }
  if (/\bري\b|مياه|رطوبة التربة|irrigation|soil moisture/i.test(text)) {
    const crop = /قطن/i.test(text) ? "cotton" : /زيتون/i.test(text) ? "olive" : "wheat";
    return { type: "irrigation", meta: { crop } };
  }
  if (/سعر|سوق|بيع|شراء|ليرة|ل\.س|price|market/i.test(text)) {
    const crop = /قطن/i.test(text) ? "cotton" : /زيتون/i.test(text) ? "olive" : /ذرة|corn/i.test(text) ? "corn" : "wheat";
    return { type: "market", meta: { crop } };
  }
  if (/طقس|حرارة|مطر|رياح|درجة حرارة|weather|temperature|rain/i.test(text)) {
    const city = /حلب/i.test(text) ? "aleppo" : /حمص/i.test(text) ? "homs" : /لاذقية/i.test(text) ? "latakia" : /دير/i.test(text) ? "deir" : "damascus";
    return { type: "weather", meta: { city } };
  }
  if (/يزرع|توجه.*موسم|ما يزرع|المزارعون|تشبّع السوق|planting trend|regional farming/i.test(text)) {
    const province = /حلب/i.test(text) ? "aleppo" : /حمص/i.test(text) ? "homs" : /دمشق/i.test(text) ? "damascus" : /الحسكة/i.test(text) ? "hasaka" : "default";
    return { type: "trends", meta: { province } };
  }
  return null;
}

// ── localStorage helpers ──────────────────────────────────────────────

function storageGet<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch { return null; }
}

function storageSet(key: string, value: unknown): void {
  try {
    if (key === STORAGE_MESSAGES && Array.isArray(value)) {
      const stripped = (value as Message[]).map(({ imagePreview: _, ...rest }) => rest);
      localStorage.setItem(key, JSON.stringify(stripped));
    } else {
      localStorage.setItem(key, JSON.stringify(value));
    }
  } catch {}
}

function storageRemove(key: string): void {
  try { localStorage.removeItem(key); } catch {}
}

function nowHHMM(): string {
  return new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
}

// ════════════════════════════════════════════════════════════════════
// SHARED CHAT COMPONENTS
// ════════════════════════════════════════════════════════════════════

function ThinkingDots() {
  return (
    <span className="flex gap-1 items-center" dir="ltr">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="w-1.5 h-1.5 rounded-full bg-emerald-400/60"
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.22, ease: "easeInOut" }}
        />
      ))}
    </span>
  );
}

function ThinkingBubble({ hasImage }: { hasImage: boolean }) {
  const steps = hasImage ? THINKING_STEPS.vision : THINKING_STEPS.base;
  const [stepIdx, setStepIdx] = useState(0);

  useEffect(() => { setStepIdx(0); }, [hasImage]);

  useEffect(() => {
    if (stepIdx >= steps.length - 1) return;
    const delay = stepIdx === 0 ? 1800 : 2400;
    const id = setTimeout(() => setStepIdx((i) => Math.min(i + 1, steps.length - 1)), delay);
    return () => clearTimeout(id);
  }, [stepIdx, steps.length]);

  const { agentAr, actionAr } = steps[stepIdx];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8, transition: { duration: 0.2 } }}
      transition={{ duration: 0.35, ease: EASE }}
      className="flex gap-3 items-start"
    >
      <div className="w-8 h-8 rounded-full bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center flex-shrink-0 mt-0.5">
        <Bot className="w-4 h-4 text-emerald-400" />
      </div>
      <div className="glass-card rounded-2xl rounded-tl-sm px-4 py-3 max-w-[75%]">
        <AnimatePresence mode="wait">
          <motion.div
            key={stepIdx}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
          >
            <p className="text-[10px] text-emerald-400/80 font-semibold mb-1.5">{agentAr}</p>
            <div className="flex items-center gap-2.5">
              <span className="text-xs text-muted-foreground/70">{actionAr}</span>
              <ThinkingDots />
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

function CoTDrawer({ thoughts }: { thoughts: AgentThought[] }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="mt-2.5 border-t border-emerald-500/10 pt-2.5">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 text-[10px] text-emerald-400/55 hover:text-emerald-400 transition-colors"
      >
        <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.25 }}>
          <ChevronDown className="w-3 h-3" />
        </motion.span>
        تفاصيل تسلسل التفكير
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <div className="pt-2.5 space-y-2">
              {thoughts.map((t, i) => (
                <motion.div
                  key={t.agent + i}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.09, duration: 0.28, ease: EASE }}
                  className={cn(
                    "rounded-xl p-2.5 border",
                    t.is_status ? "bg-sky-500/5 border-sky-500/12" : "bg-emerald-500/5 border-emerald-500/12",
                  )}
                >
                  <p className={cn("text-[9px] font-bold mb-1", t.is_status ? "text-sky-400/75" : "text-emerald-400/75")}>
                    {t.role_ar}
                  </p>
                  <p className="text-[10px] text-muted-foreground/65 leading-relaxed whitespace-pre-wrap" dir="rtl">
                    {t.thought}
                  </p>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Per-message action toolbar — always visible, RTL, touch-friendly.
// user → Edit only · assistant → Retry + Copy · error → Retry only.
function MessageActions({
  role,
  isRetrying,
  onRetry,
  onEdit,
  text,
}: {
  role: "user" | "assistant" | "error";
  isRetrying: boolean;
  onRetry?: () => void;
  onEdit?: () => void;
  text: string;
}) {
  const [copied, setCopied] = useState(false);
  const isUser = role === "user";

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable (insecure context / denied) — no-op */
    }
  };

  const base =
    "flex items-center justify-center gap-1.5 min-w-[44px] min-h-[44px] px-2.5 " +
    "rounded-xl border text-[10px] font-medium transition-colors";
  const resting = "bg-white/[0.04] border-white/[0.08] text-muted-foreground/45";

  return (
    <div dir="rtl" className={cn("flex gap-1.5 mt-1.5", isUser ? "justify-end" : "justify-start")}>
      {isUser ? (
        <motion.button
          type="button"
          whileTap={{ scale: 0.92 }}
          onClick={onEdit}
          aria-label="تعديل"
          className={cn(base, resting, "hover:bg-emerald-500/10 hover:border-emerald-500/30 hover:text-emerald-400")}
        >
          <Pencil className="w-3 h-3" />
          تعديل
        </motion.button>
      ) : (
        <>
          <motion.button
            type="button"
            whileTap={{ scale: 0.92 }}
            onClick={onRetry}
            disabled={isRetrying}
            aria-label="إعادة"
            className={cn(
              base,
              isRetrying
                ? "bg-sky-500/10 border-sky-500/30 text-sky-400 opacity-40 cursor-not-allowed"
                : cn(resting, "hover:bg-sky-500/10 hover:border-sky-500/30 hover:text-sky-400"),
            )}
          >
            {isRetrying ? (
              <>
                <Loader2 className="w-3 h-3 animate-spin" />
                جارٍ الإعادة...
              </>
            ) : (
              <>
                <RotateCcw className="w-3 h-3" />
                إعادة
              </>
            )}
          </motion.button>
          {role === "assistant" && (
            <motion.button
              type="button"
              whileTap={{ scale: 0.92 }}
              onClick={handleCopy}
              aria-label="نسخ"
              className={cn(
                base,
                copied
                  ? "bg-emerald-500/15 border-emerald-500/35 text-emerald-400"
                  : cn(resting, "hover:bg-emerald-500/10 hover:border-emerald-500/30 hover:text-emerald-400"),
              )}
            >
              {copied ? (
                <>
                  <Check className="w-3 h-3" />
                  تم النسخ
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3" />
                  نسخ
                </>
              )}
            </motion.button>
          )}
        </>
      )}
    </div>
  );
}

function MessageBubble({
  message,
  onArchive,
  onRetry,
  onEdit,
  isRetrying,
}: {
  message: Message;
  onArchive?: (msg: Message) => void;
  onRetry?: (msg: Message) => void;
  onEdit?: (msg: Message) => void;
  isRetrying?: boolean;
}) {
  const isUser  = message.role === "user";
  const isError = message.role === "error";

  if (isUser) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.32, ease: EASE }}
        className="flex flex-col items-end gap-1 group"
      >
        {message.emergency && (
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-red-500/15 border border-red-500/30 mb-1">
            <ShieldAlert className="w-3 h-3 text-red-400" />
            <span className="text-[10px] font-bold text-red-400">بلاغ طارئ</span>
          </div>
        )}
        <div className={cn(
          "max-w-[78%] rounded-2xl rounded-tr-sm px-4 py-3",
          message.emergency
            ? "bg-red-500/15 border border-red-500/35"
            : "bg-emerald-500/15 border border-emerald-500/30",
        )}>
          {message.imagePreview && (
            <img src={message.imagePreview} alt="صورة المحصول"
              className="rounded-xl mb-2.5 max-h-48 w-auto object-cover" />
          )}
          {message.text && (
            <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap" dir="rtl">
              {message.text}
            </p>
          )}
        </div>
        {message.time && (
          <span className="text-[10px] text-muted-foreground/40 font-numeric pe-1">{message.time}</span>
        )}
        {message.id !== "welcome" && (
          <MessageActions
            role="user"
            isRetrying={false}
            text={message.text}
            onEdit={onEdit ? () => onEdit(message) : undefined}
          />
        )}
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, ease: EASE }}
      className="flex gap-3 items-start"
    >
      <div className={cn(
        "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5",
        isError ? "bg-red-500/10 border border-red-500/25" : "bg-emerald-500/15 border border-emerald-500/25",
      )}>
        {isError
          ? <AlertCircle className="w-4 h-4 text-red-400" />
          : <Bot className="w-4 h-4 text-emerald-400" />}
      </div>
      <div className="flex flex-col gap-1 max-w-[78%] group">
        <div className={cn(
          "rounded-2xl rounded-tl-sm px-4 py-3",
          isError ? "bg-red-500/5 border border-red-500/20" : "glass-card",
        )}>
          <p className={cn(
            "text-sm leading-relaxed whitespace-pre-wrap",
            isError ? "text-red-300/90" : "text-foreground",
          )} dir="rtl">
            {message.text}
          </p>
          {message.visualization && <VisualWorkspace data={message.visualization} />}
          {message.thoughts && message.thoughts.length > 0 && <CoTDrawer thoughts={message.thoughts} />}
          {/* Archive button — visible on hover */}
          {!isError && message.id !== "welcome" && onArchive && (
            <div className="mt-2.5 pt-2.5 border-t border-emerald-500/8 flex justify-end">
              <motion.button
                whileTap={{ scale: 0.88 }}
                onClick={() => onArchive(message)}
                className="flex items-center gap-1.5 text-[10px] text-muted-foreground/35 hover:text-emerald-400 transition-colors"
              >
                <BookmarkPlus className="w-3 h-3" />
                حفظ في المكتبة
              </motion.button>
            </div>
          )}
        </div>
        {/* SmartCards disabled — their content is 100% hardcoded, which made
            Groq's real answers look templated. detectSmartCard() still runs
            (it drives the map province highlight); re-enable these once they
            render from real data.
        {message.smartCard === "weather" && (
          <WeatherInsightCard city={message.smartCardMeta?.city} />
        )}
        {message.smartCard === "market" && (
          <MarketForecastCard crop={message.smartCardMeta?.crop} />
        )}
        {message.smartCard === "irrigation" && (
          <IrrigationPlanCard crop={message.smartCardMeta?.crop} />
        )}
        {message.smartCard === "trends" && (
          <NationalTrendCard province={message.smartCardMeta?.province} />
        )}
        */}
        {message.time && (
          <span className="text-[10px] text-muted-foreground/40 font-numeric ps-1">{message.time}</span>
        )}
        {message.id !== "welcome" && (
          <MessageActions
            role={isError ? "error" : "assistant"}
            isRetrying={!!isRetrying}
            text={message.text}
            onRetry={onRetry ? () => onRetry(message) : undefined}
          />
        )}
      </div>
    </motion.div>
  );
}

// ════════════════════════════════════════════════════════════════════
// LEFT PANEL — Intelligence Library
// ════════════════════════════════════════════════════════════════════

const TAG_CFG: Record<NonNullable<KnowledgeCard["tag"]>, { label: string; color: string }> = {
  weather:   { label: "طقس",   color: "text-sky-400    bg-sky-500/15    border-sky-500/25"    },
  market:    { label: "سوق",   color: "text-amber-400  bg-amber-500/15  border-amber-500/25"  },
  irrigation:{ label: "ري",    color: "text-emerald-400 bg-emerald-500/15 border-emerald-500/25" },
  disease:   { label: "آفة",   color: "text-red-400    bg-red-500/15    border-red-500/25"    },
  trends:    { label: "توجه",  color: "text-violet-400 bg-violet-500/15 border-violet-500/25" },
  general:   { label: "عام",   color: "text-slate-400  bg-slate-500/15  border-slate-500/25"  },
};

function IntelligenceLibrary({
  onNewSession,
  knowledgeCards,
  onRemoveKnowledge,
}: {
  onNewSession: () => void;
  knowledgeCards: KnowledgeCard[];
  onRemoveKnowledge: (id: string) => void;
}) {
  const [search, setSearch]               = useState("");
  const [activeSession, setActiveSession] = useState("s1");

  const q = search.trim();
  const filtered = q
    ? SAVED_SESSIONS.filter((s) => s.title.includes(q) || s.preview.includes(q))
    : SAVED_SESSIONS;
  const filteredKnowledge = q
    ? knowledgeCards.filter((k) => k.titleAr.includes(q) || k.summaryAr.includes(q))
    : knowledgeCards;

  return (
    <div className="w-64 flex-shrink-0 h-full hidden lg:flex flex-col glass-sidebar border-e border-emerald-500/10 overflow-hidden">

      {/* Panel header */}
      <div className="px-4 pt-4 pb-3 border-b border-emerald-500/10 flex-shrink-0">
        <div className="flex items-center gap-2.5 mb-3" dir="rtl">
          <div className="w-7 h-7 rounded-lg bg-emerald-500/15 border border-emerald-500/20 flex items-center justify-center flex-shrink-0">
            <Archive className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <p className="text-xs font-bold text-foreground flex-1">الذاكرة الذكية</p>
          <button
            onClick={onNewSession}
            title="محادثة جديدة"
            className="w-6 h-6 rounded-lg bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center hover:bg-emerald-500/25 transition-all"
          >
            <Plus className="w-3 h-3 text-emerald-400" />
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute start-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground/40 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="بحث في المحادثات..."
            dir="rtl"
            className="w-full bg-white/[0.04] border border-emerald-500/15 rounded-lg ps-8 pe-3 py-1.5 text-[11px] text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-emerald-500/35 transition-colors"
          />
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-2 py-3 space-y-5 scrollbar-none">

        {/* Saved Sessions */}
        <section>
          <p className="px-2 mb-2 text-[9px] font-bold text-muted-foreground/50 uppercase tracking-wider" dir="rtl">
            المحادثات المحفوظة
          </p>
          <div className="space-y-0.5">
            {filtered.map((s) => (
              <button
                key={s.id}
                onClick={() => setActiveSession(s.id)}
                dir="rtl"
                className={cn(
                  "w-full text-start px-3 py-2.5 rounded-xl transition-all duration-200 border",
                  activeSession === s.id
                    ? "bg-emerald-500/12 border-emerald-500/25 emerald-glow-sm"
                    : "border-transparent hover:bg-white/[0.04]",
                )}
              >
                <div className="flex items-start gap-2">
                  <MessageSquare className={cn(
                    "w-3 h-3 flex-shrink-0 mt-0.5 transition-colors",
                    activeSession === s.id ? "text-emerald-400" : "text-muted-foreground/35",
                  )} />
                  <div className="flex-1 min-w-0">
                    <p className={cn(
                      "text-[11px] font-semibold leading-tight truncate",
                      activeSession === s.id ? "text-emerald-300" : "text-foreground/75",
                    )}>
                      {s.title}
                    </p>
                    <p className="text-[10px] text-muted-foreground/45 truncate mt-0.5">{s.preview}</p>
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <Clock className="w-2.5 h-2.5 text-muted-foreground/30" />
                      <span className="text-[9px] text-muted-foreground/40">{s.time}</span>
                      <span className="text-[9px] text-muted-foreground/30 ms-auto font-numeric">{s.count} رسالة</span>
                    </div>
                  </div>
                </div>
              </button>
            ))}
            {filtered.length === 0 && (
              <p className="text-center text-[11px] text-muted-foreground/40 py-4" dir="rtl">
                لا توجد نتائج
              </p>
            )}
          </div>
        </section>

        {/* Saved Maps */}
        <section>
          <p className="px-2 mb-2 text-[9px] font-bold text-muted-foreground/50 uppercase tracking-wider" dir="rtl">
            الخرائط المحفوظة
          </p>
          <div className="space-y-0.5">
            {SAVED_MAPS.map((m) => (
              <button
                key={m.id}
                dir="rtl"
                className="w-full text-start px-3 py-2 rounded-xl hover:bg-white/[0.04] border border-transparent transition-all"
              >
                <div className="flex items-center gap-2">
                  <Map className="w-3 h-3 text-sky-400/55 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] text-foreground/65 truncate">{m.title}</p>
                    <p className="text-[9px] text-muted-foreground/40">{m.province} · {m.date}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </section>

        {/* Reports */}
        <section>
          <p className="px-2 mb-2 text-[9px] font-bold text-muted-foreground/50 uppercase tracking-wider" dir="rtl">
            التقارير
          </p>
          <div className="space-y-0.5">
            {SAVED_REPORTS.map((r) => (
              <button
                key={r.id}
                dir="rtl"
                className="w-full text-start px-3 py-2 rounded-xl hover:bg-white/[0.04] border border-transparent transition-all"
              >
                <div className="flex items-center gap-2">
                  <FileText className="w-3 h-3 text-amber-400/55 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] text-foreground/65 truncate">{r.title}</p>
                    <p className="text-[9px] text-muted-foreground/40">{r.date}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </section>

        {/* My Fields — Digital Twin */}
        <section>
          <p className="px-2 mb-2 text-[9px] font-bold text-muted-foreground/50 uppercase tracking-wider" dir="rtl">
            حقولي
          </p>
          <div className="space-y-0.5">
            {USER_FIELDS.map((f) => (
              <div
                key={f.id}
                dir="rtl"
                className="px-3 py-2.5 rounded-xl border border-transparent hover:bg-white/[0.04] transition-all"
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <Sprout className="w-3 h-3 text-emerald-400/55 flex-shrink-0" />
                  <p className="text-[11px] text-foreground/70 flex-1 truncate">{f.nameAr}</p>
                  <span className="text-[9px] font-numeric text-muted-foreground/40">{f.area} دونم</span>
                </div>
                <div className="flex items-center gap-2 mb-1">
                  <div className="flex-1 h-1 rounded-full bg-white/[0.06] overflow-hidden">
                    <div
                      className={cn(
                        "h-full rounded-full",
                        f.health >= 80 ? "bg-emerald-400" : f.health >= 60 ? "bg-amber-400" : "bg-red-400",
                      )}
                      style={{ width: `${f.health}%` }}
                    />
                  </div>
                  <span className={cn(
                    "text-[9px] font-numeric font-bold flex-shrink-0",
                    f.health >= 80 ? "text-emerald-400" : f.health >= 60 ? "text-amber-400" : "text-red-400",
                  )}>
                    {f.health}%
                  </span>
                </div>
                <p className="text-[9px] text-muted-foreground/35">{f.province} · {f.crop}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Smart Context */}
        <section>
          <p className="px-2 mb-2 text-[9px] font-bold text-muted-foreground/50 uppercase tracking-wider" dir="rtl">
            سياق ذكي
          </p>
          <div className="space-y-0.5">
            {CONTEXT_MEMORIES.map((c) => {
              const CIcon = c.icon;
              return (
                <div
                  key={c.id}
                  dir="rtl"
                  className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-white/[0.04] transition-all border border-transparent"
                >
                  <CIcon className="w-3 h-3 text-emerald-400/45 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] text-foreground/60 truncate">{c.refAr}</p>
                    <p className="text-[9px] text-muted-foreground/35">{c.timeAr}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Knowledge Cards */}
        {filteredKnowledge.length > 0 && (
          <section>
            <p className="px-2 mb-2 text-[9px] font-bold text-muted-foreground/50 uppercase tracking-wider" dir="rtl">
              بطاقات المعرفة
            </p>
            <div className="space-y-1">
              {filteredKnowledge.map((k) => {
                const tag = TAG_CFG[k.tag];
                return (
                  <motion.div
                    key={k.id}
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 6 }}
                    transition={{ duration: 0.25 }}
                    dir="rtl"
                    className="px-3 py-2.5 rounded-xl border border-emerald-500/15 bg-emerald-500/5 hover:bg-emerald-500/8 transition-all"
                  >
                    <div className="flex items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-semibold text-foreground/80 truncate leading-tight mb-1">{k.titleAr}</p>
                        <p className="text-[10px] text-muted-foreground/50 line-clamp-2 leading-relaxed">{k.summaryAr}</p>
                        <div className="flex items-center gap-2 mt-1.5">
                          <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded-full border", tag.color)}>{tag.label}</span>
                          <span className="text-[9px] text-muted-foreground/35 font-numeric">{k.time}</span>
                        </div>
                      </div>
                      <button
                        onClick={() => onRemoveKnowledge(k.id)}
                        className="text-muted-foreground/25 hover:text-red-400 transition-colors flex-shrink-0 mt-0.5"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// RIGHT PANEL — Agent Operating Center
// ════════════════════════════════════════════════════════════════════

function agentProvinceFrom(msg: string, province: string | null): string {
  if (province) return province;
  const MAP: [RegExp, string][] = [
    [/الحسكة|hasakah/i, "الحسكة"], [/حلب|aleppo/i, "حلب"],
    [/دمشق|damascus/i, "دمشق"],   [/حمص|homs/i, "حمص"],
    [/حماة|hama/i, "حماة"],       [/إدلب|idlib/i, "إدلب"],
    [/الرقة|raqqa/i, "الرقة"],    [/دير الزور/i, "دير الزور"],
    [/اللاذقية|latakia/i, "اللاذقية"], [/درعا|daraa/i, "درعا"],
    [/طرطوس|tartus/i, "طرطوس"],   [/السويداء/i, "السويداء"],
    [/القنيطرة/i, "القنيطرة"],
  ];
  for (const [rx, name] of MAP) if (rx.test(msg)) return name;
  return "المنطقة";
}

function buildContextLog(msg: string, province: string | null) {
  const p = agentProvinceFrom(msg, province);
  const crop = /قمح/.test(msg) ? "القمح" : /قطن/.test(msg) ? "القطن"
             : /زيتون/.test(msg) ? "الزيتون" : /شعير/.test(msg) ? "الشعير"
             : /ذرة/.test(msg) ? "الذرة" : null;
  const cropStr = crop ? ` لمحصول ${crop}` : "";
  return [
    { agent: "وكيل الطقس",    action: `يحلل بيانات السحب والرطوبة في ${p}...` },
    { agent: "وكيل التربة",   action: `يحسب الاحتياجات المائية${cropStr} في ${p}...` },
    { agent: "وكيل السوق",    action: `يرصد أسعار السوق الإقليمية في ${p}...` },
    { agent: "كاشف الأمراض", action: `يفحص سجلات الآفات الموسمية${cropStr} في ${p}...` },
  ];
}

function AgentOperatingCenter({
  thinking,
  isEmergency,
  highlightedProvince,
  diseaseProvince,
  climateLayer,
  lastMessage,
  onToggleClimate,
  onProvinceClick,
}: {
  thinking: boolean;
  isEmergency: boolean;
  highlightedProvince: string | null;
  diseaseProvince: string | null;
  climateLayer: "heat" | "humidity" | null;
  lastMessage: string;
  onToggleClimate: (layer: "heat" | "humidity") => void;
  onProvinceClick: (name: string) => void;
}) {
  const [logIdx, setLogIdx]       = useState(0);
  const [streamIdx, setStreamIdx] = useState(0);
  const stream = isEmergency ? REASONING_STREAM_EMERGENCY : REASONING_STREAM_BASE;

  // Derive context-aware log — recompute when message changes
  const contextLog = useMemo(
    () => lastMessage ? buildContextLog(lastMessage, highlightedProvince) : LIVE_LOG,
    [lastMessage, highlightedProvince],
  );

  // When thinking starts, reset log index so it cycles through context log from top
  useEffect(() => {
    if (thinking) setLogIdx(0);
  }, [thinking, lastMessage]);

  useEffect(() => {
    const entries = thinking ? contextLog : LIVE_LOG;
    const id = setInterval(() => setLogIdx((i) => (i + 1) % entries.length), thinking ? 2200 : 3500);
    return () => clearInterval(id);
  }, [thinking, contextLog]);

  useEffect(() => {
    if (!thinking) { setStreamIdx(0); return; }
    const id = setInterval(() => setStreamIdx((i) => (i + 1) % stream.length), 1800);
    return () => clearInterval(id);
  }, [thinking, stream.length]);

  // Compute live agent statuses — all agents activate when thinking
  const runtimeAgents = useMemo((): CopilotAgent[] => {
    if (!thinking) return COPILOT_AGENTS;
    const p = agentProvinceFrom(lastMessage, highlightedProvince);
    const hasDisease = /مرض|آفة|صدأ|بياض|لفح|حشر/.test(lastMessage);
    return COPILOT_AGENTS.map((a): CopilotAgent => {
      switch (a.id) {
        case "weather":
          return { ...a, status: "active",     lastActionAr: `يحلل بيانات الطقس الزراعي في ${p}...` };
        case "soil":
          return { ...a, status: "processing", lastActionAr: `يفحص رطوبة التربة في ${p}...` };
        case "market":
          return { ...a, status: "processing", lastActionAr: `يرصد الأسعار في أسواق ${p}...` };
        case "disease":
          return { ...a,
            status:      hasDisease ? "alert"  : "active",
            lastActionAr: hasDisease ? `يحلل الآفات المُبلَّغ عنها في ${p}...` : `يراقب صحة المحاصيل في ${p}...`,
          };
        default: return a;
      }
    });
  }, [thinking, lastMessage, highlightedProvince]);

  const activeCount = runtimeAgents.filter((a) => a.status === "active" || a.status === "processing").length;
  const alertCount  = runtimeAgents.filter((a) => a.status === "alert").length;

  return (
    <div className="w-72 flex-shrink-0 h-full hidden lg:flex flex-col glass-status-bar overflow-hidden">

      {/* Panel header */}
      <div className="px-4 pt-4 pb-3 border-b border-emerald-500/10 flex-shrink-0">
        <div className="flex items-center gap-2 mb-1.5" dir="rtl">
          <Zap className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          <p className="text-xs font-bold text-foreground flex-1">مركز العمليات</p>
          {alertCount > 0 && (
            <motion.span
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="text-[9px] font-bold bg-red-500/15 border border-red-500/30 text-red-400 rounded-full px-2 py-0.5 font-numeric"
            >
              {alertCount} تنبيه
            </motion.span>
          )}
        </div>
        <div className="flex items-center gap-2" dir="rtl">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse flex-shrink-0" />
          <span className="text-[11px] text-emerald-400/70 font-numeric">{activeCount} نشط</span>
          <span className="text-muted-foreground/30 text-[10px]">·</span>
          <span className="text-[11px] text-muted-foreground/50 font-numeric">{COPILOT_AGENTS.length} وكيل</span>
        </div>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-5 scrollbar-none">

        {/* Agent cards */}
        <div className="space-y-2">
          {runtimeAgents.map((agent, i) => {
            const st  = STATUS_CFG[agent.status];
            const acc = ACCENT_CFG[agent.accent];
            const Icon = agent.icon;

            return (
              <motion.div
                key={agent.id}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.07, duration: 0.35, ease: EASE }}
                className={cn(
                  "rounded-xl border p-3 transition-colors duration-300",
                  st.border, st.bg,
                )}
                dir="rtl"
              >
                <div className="flex items-center gap-2.5">
                  <div className={cn("w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0", acc.iconBg)}>
                    <Icon className={cn("w-4 h-4", acc.icon)} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <p className="text-[11px] font-bold text-foreground/90 flex-1">{agent.nameAr}</p>
                      <span className="text-[9px] font-semibold font-numeric text-muted-foreground/55">{agent.metric}</span>
                    </div>
                    <p className="text-[9px] text-muted-foreground/45 truncate mb-1">{agent.descAr}</p>
                    <div className="flex items-center gap-1.5">
                      <span className="relative flex-shrink-0 w-2 h-2">
                        <span className={cn("w-2 h-2 rounded-full block", st.dot)} />
                        {st.pulse && (
                          <span className={cn("absolute inset-0 rounded-full animate-ping opacity-60", st.dot)} />
                        )}
                      </span>
                      <span className="text-[9px] text-muted-foreground/55 truncate">{agent.lastActionAr}</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Map Command Center */}
        <div>
          <div className="flex items-center gap-1.5 mb-2" dir="rtl">
            <MapPin className="w-3 h-3 text-emerald-400/60 flex-shrink-0" />
            <p className="text-[9px] font-bold text-muted-foreground/50 uppercase tracking-wider flex-1">
              القيادة الجغرافية
            </p>
            {/* Climate layer toggles */}
            <button
              onClick={() => onToggleClimate("heat")}
              title="طبقة الحرارة"
              className={cn(
                "w-5 h-5 rounded-md flex items-center justify-center transition-all border text-[8px]",
                climateLayer === "heat"
                  ? "bg-red-500/20 border-red-500/40 text-red-400"
                  : "bg-white/[0.04] border-white/[0.08] text-muted-foreground/40 hover:text-red-400",
              )}
            >
              <Thermometer className="w-3 h-3" />
            </button>
            <button
              onClick={() => onToggleClimate("humidity")}
              title="طبقة الرطوبة"
              className={cn(
                "w-5 h-5 rounded-md flex items-center justify-center transition-all border",
                climateLayer === "humidity"
                  ? "bg-sky-500/20 border-sky-500/40 text-sky-400"
                  : "bg-white/[0.04] border-white/[0.08] text-muted-foreground/40 hover:text-sky-400",
              )}
            >
              <Droplets className="w-3 h-3" />
            </button>
          </div>
          <div className="rounded-xl border border-emerald-500/12 bg-white/[0.02] p-2 overflow-hidden">
            <MiniSyriaMap
              highlightedProvince={highlightedProvince}
              diseaseProvince={diseaseProvince}
              climateLayer={climateLayer}
              onProvinceClick={onProvinceClick}
            />
            {(highlightedProvince || diseaseProvince) && (
              <p className="text-center text-[9px] mt-1" dir="rtl">
                <span className={cn(
                  "font-semibold",
                  diseaseProvince ? "text-red-400" : "text-emerald-400",
                )}>
                  {diseaseProvince ?? highlightedProvince}
                </span>
                <span className="text-muted-foreground/40">
                  {diseaseProvince ? " — تحذير آفات" : " — محددة"}
                </span>
              </p>
            )}
            {!highlightedProvince && !diseaseProvince && (
              <p className="text-center text-[9px] text-muted-foreground/30 mt-1" dir="rtl">
                حدد المحافظة التي تريد السؤال عنها
              </p>
            )}
          </div>
        </div>

        {/* Live Metrics */}
        <div>
          <p className="text-[9px] font-bold text-muted-foreground/50 uppercase tracking-wider mb-2.5" dir="rtl">
            مؤشرات حية
          </p>
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 space-y-2.5">
            {LIVE_METRICS.map((m) => (
              <div key={m.label} dir="rtl">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-muted-foreground/55">{m.label}</span>
                  <span className={cn("text-[11px] font-bold font-numeric", m.color)}>{m.value}</span>
                </div>
                <span className="text-[8px] text-muted-foreground/30 block">
                  بيانات تجريبية
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Log / Reasoning Stream footer */}
      <div className={cn(
        "px-3 pt-2.5 pb-3.5 border-t flex-shrink-0 transition-colors duration-300",
        thinking
          ? isEmergency ? "border-red-500/20" : "border-sky-500/15"
          : "border-emerald-500/10",
      )}>
        <div className="flex items-center gap-1.5 mb-2" dir="rtl">
          {thinking
            ? <Brain className={cn("w-3 h-3", isEmergency ? "text-red-400/70" : "text-sky-400/70")} />
            : <Activity className="w-3 h-3 text-emerald-400/70" />}
          <span className={cn(
            "text-[10px] font-semibold uppercase tracking-wide",
            thinking
              ? isEmergency ? "text-red-400/70" : "text-sky-400/70"
              : "text-emerald-400/70",
          )}>
            {thinking ? "تدفق الاستدلال" : "سجل مباشر"}
          </span>
          <span className={cn(
            "ms-auto w-1.5 h-1.5 rounded-full",
            thinking
              ? isEmergency ? "bg-red-400 animate-pulse" : "bg-sky-400 animate-pulse"
              : "bg-emerald-400 animate-pulse",
          )} />
        </div>
        <div className="min-h-[34px] overflow-hidden">
          <AnimatePresence mode="wait">
            {thinking ? (
              <motion.div
                key={`stream-${streamIdx}`}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                className="text-[10px] leading-relaxed"
                dir="rtl"
              >
                <span className={cn("font-semibold", isEmergency ? "text-red-400" : "text-sky-400")}>
                  {contextLog[streamIdx % contextLog.length].agent}{" "}
                </span>
                <span className="text-muted-foreground/60">{contextLog[streamIdx % contextLog.length].action}</span>
              </motion.div>
            ) : (
              <motion.div
                key={logIdx}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                className="text-[10px] leading-relaxed"
                dir="rtl"
              >
                <span className="font-semibold text-emerald-400">{contextLog[logIdx % contextLog.length].agent} </span>
                <span className="text-muted-foreground/60">{contextLog[logIdx % contextLog.length].action}</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// CENTER PANEL — Chat Workspace
// ════════════════════════════════════════════════════════════════════

interface ChatCenterProps {
  messages: Message[];
  thinking: boolean;
  thinkingHasImage: boolean;
  input: string;
  onInputChange: (v: string) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onSend: () => void;
  imagePreview: string | null;
  imageBase64: string | null;
  imageError: string | null;
  onAttach: () => void;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onClearImage: () => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  isEmergency: boolean;
  onToggleEmergency: () => void;
  isRecording: boolean;
  onToggleRecording: () => void;
  onExportPDF: () => void;
  onClearChat: () => void;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
  onArchive: (msg: Message) => void;
  onRetry: (msg: Message) => void;
  onEdit: (msg: Message) => void;
  retryingId: string | null;
  proactiveAlert: string | null;
  onDismissAlert: () => void;
}

function ChatCenter({
  messages, thinking, thinkingHasImage,
  input, onInputChange, onKeyDown, onSend,
  imagePreview, imageBase64, imageError,
  onAttach, onFileChange, onClearImage, fileInputRef,
  isEmergency, onToggleEmergency,
  isRecording, onToggleRecording,
  onExportPDF, onClearChat,
  messagesEndRef,
  onArchive,
  onRetry,
  onEdit,
  retryingId,
  proactiveAlert,
  onDismissAlert,
}: ChatCenterProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const canSend = (!!input.trim() || !!imageBase64) && !thinking;

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 128)}px`;
  }, [input]);

  return (
    <div className={cn(
      "flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden transition-all duration-500",
      isEmergency && "ring-1 ring-red-500/40 shadow-[0_0_60px_oklch(0.577_0.245_27/20%)]",
    )}>

      {/* Chat header */}
      <div className="flex-shrink-0 px-3 sm:px-5 py-3 border-b border-emerald-500/10 flex items-center gap-3" dir="rtl">
        <div className="w-8 h-8 rounded-xl bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center flex-shrink-0">
          <Bot className="w-4 h-4 text-emerald-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-foreground leading-tight">جلسة عمل نشطة</p>
          <p className="text-[10px] text-muted-foreground/60">مدعوم بتقنية الوكلاء الذكيين · يدعم تحليل الصور</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[10px] text-emerald-400/70">متصل</span>
          </div>
          <div className="w-px h-4 bg-white/[0.08]" />
          <motion.button
            whileTap={{ scale: 0.88 }}
            onClick={onExportPDF}
            disabled={thinking}
            title="تصدير التقرير PDF"
            className="p-2 rounded-lg text-muted-foreground/45 hover:text-emerald-400 hover:bg-emerald-500/8 disabled:opacity-30 transition-colors"
          >
            <FileDown className="w-3.5 h-3.5" />
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.88 }}
            onClick={onClearChat}
            disabled={thinking}
            title="بدء محادثة جديدة"
            className="p-2 rounded-lg text-muted-foreground/45 hover:text-red-400 hover:bg-red-500/8 disabled:opacity-30 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </motion.button>
        </div>
      </div>

      {/* Emergency banner */}
      <AnimatePresence>
        {isEmergency && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="flex-shrink-0 overflow-hidden"
          >
            <div className="flex items-center gap-2.5 px-5 py-2.5 bg-red-500/10 border-b border-red-500/25" dir="rtl">
              <ShieldAlert className="w-4 h-4 text-red-400 flex-shrink-0 animate-pulse" />
              <p className="text-[11px] font-semibold text-red-300/90 flex-1">
                وضع البلاغ الطارئ مفعّل — رسالتك ستُعلَّم كأولوية قصوى
              </p>
              <button
                onClick={onToggleEmergency}
                className="text-red-400/60 hover:text-red-400 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Messages area */}
      <div
        className="flex-1 overflow-y-auto px-3 sm:px-5 py-5 space-y-5 scrollbar-none relative"
        dir="ltr"
        style={{
          backgroundImage: "radial-gradient(circle, rgba(52,211,153,0.055) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      >
        <AnimatePresence initial={false}>
          {messages.map((msg) => (
            <MessageBubble
              key={msg.id}
              message={msg}
              onArchive={onArchive}
              onRetry={msg.id !== "welcome" && msg.role !== "user" ? onRetry : undefined}
              onEdit={msg.id !== "welcome" && msg.role === "user" ? onEdit : undefined}
              isRetrying={retryingId === msg.id}
            />
          ))}
          {thinking && <ThinkingBubble key="__thinking__" hasImage={thinkingHasImage} />}
        </AnimatePresence>
        <div ref={messagesEndRef} />
      </div>

      {/* Proactive alert bubble */}
      <AnimatePresence>
        {proactiveAlert && (
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="mx-5 mb-2 flex items-start gap-3 px-4 py-3 rounded-2xl border border-emerald-500/25 bg-emerald-500/8 backdrop-blur-sm"
            dir="rtl"
          >
            <div className="w-7 h-7 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Brain className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <p className="flex-1 text-[11px] text-emerald-300/85 leading-relaxed">{proactiveAlert}</p>
            <button
              onClick={onDismissAlert}
              className="text-muted-foreground/35 hover:text-muted-foreground/70 transition-colors flex-shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input area */}
      <div className={cn(
        "flex-shrink-0 px-3 sm:px-5 py-4 border-t transition-colors duration-300",
        isEmergency ? "border-red-500/25 bg-red-500/[0.03]" : "border-emerald-500/10",
      )}>
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={onFileChange}
        />

        {/* Image preview strip */}
        <AnimatePresence>
          {imagePreview && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
              className="mb-3 overflow-hidden"
            >
              <div className="relative w-fit">
                <img
                  src={imagePreview}
                  alt="معاينة الصورة"
                  className="h-20 w-auto rounded-xl object-cover border border-emerald-500/30"
                />
                <motion.button
                  whileTap={{ scale: 0.85 }}
                  onClick={onClearImage}
                  className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-red-500/80 hover:bg-red-500 flex items-center justify-center transition-colors"
                >
                  <X className="w-3 h-3 text-white" />
                </motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Image error */}
        <AnimatePresence>
          {imageError && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-1.5 text-[11px] text-red-400/80 mb-2.5"
              dir="rtl"
            >
              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
              {imageError}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Input row */}
        <div className="flex items-end gap-2">

          {/* Action buttons (RTL: appear on the right) */}
          <div className="flex items-center gap-1.5 flex-shrink-0 order-last">
            {/* Emergency */}
            <motion.button
              whileTap={{ scale: 0.88 }}
              onClick={onToggleEmergency}
              title={isEmergency ? "إلغاء البلاغ الطارئ" : "إرسال بلاغ طارئ"}
              className={cn(
                "w-10 h-10 rounded-xl flex items-center justify-center border transition-all duration-200",
                isEmergency
                  ? "bg-red-500/20 border-red-500/50 text-red-400"
                  : "bg-white/[0.04] border-white/[0.08] text-muted-foreground/50 hover:text-red-400 hover:border-red-500/35 hover:bg-red-500/8",
              )}
            >
              <ShieldAlert className="w-4 h-4" />
            </motion.button>

            {/* Voice */}
            <motion.button
              whileTap={{ scale: 0.88 }}
              onClick={onToggleRecording}
              title={isRecording ? "إيقاف التسجيل" : "تسجيل رسالة صوتية"}
              className={cn(
                "w-10 h-10 rounded-xl flex items-center justify-center border transition-all duration-200",
                isRecording
                  ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-400"
                  : "bg-white/[0.04] border-white/[0.08] text-muted-foreground/50 hover:text-emerald-400 hover:border-emerald-500/35 hover:bg-emerald-500/8",
              )}
            >
              {isRecording
                ? <motion.span animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 1 }}>
                    <MicOff className="w-4 h-4" />
                  </motion.span>
                : <Mic className="w-4 h-4" />}
            </motion.button>

            {/* Attach */}
            <motion.button
              whileTap={{ scale: 0.88 }}
              onClick={onAttach}
              disabled={thinking}
              title="إرفاق صورة (حد أقصى 5 ميغابايت)"
              className={cn(
                "w-10 h-10 rounded-xl flex items-center justify-center border transition-all duration-200",
                imageBase64
                  ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-300"
                  : "bg-white/[0.04] border-white/[0.08] text-muted-foreground/50",
                "hover:text-emerald-400 hover:border-emerald-500/35 hover:bg-emerald-500/8",
                "disabled:opacity-35 disabled:cursor-not-allowed",
              )}
            >
              <Paperclip className="w-4 h-4" />
            </motion.button>
          </div>

          {/* Textarea */}
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={
              isEmergency
                ? "اكتب تفاصيل البلاغ الطارئ هنا..."
                : imageBase64
                ? "أضف وصفاً للصورة (اختياري)..."
                : "اكتب سؤالك الزراعي هنا..."
            }
            rows={1}
            disabled={thinking}
            dir="rtl"
            className={cn(
              "flex-1 resize-none rounded-xl px-4 py-3 transition-all duration-200",
              "text-sm text-foreground placeholder:text-muted-foreground/45",
              "focus:outline-none focus:ring-1 leading-relaxed min-h-[44px]",
              isEmergency
                ? "bg-red-500/8 border border-red-500/30 focus:border-red-500/50 focus:ring-red-500/20"
                : "bg-white/[0.04] border border-emerald-500/20 focus:border-emerald-500/45 focus:ring-emerald-500/15",
              thinking && "opacity-50 cursor-not-allowed",
            )}
            style={{ scrollbarWidth: "none" }}
          />

          {/* Send */}
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={onSend}
            disabled={!canSend}
            className={cn(
              "w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 border transition-all duration-200",
              canSend
                ? isEmergency
                  ? "bg-red-500/25 border-red-500/50 text-red-300 hover:bg-red-500/35"
                  : "bg-emerald-500/20 border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/30"
                : "bg-white/[0.03] border-white/[0.06] text-muted-foreground/25 cursor-not-allowed",
            )}
          >
            <Send className="w-4 h-4" />
          </motion.button>
        </div>

        <p className="text-center text-[10px] text-muted-foreground/30 mt-2.5">
          Enter للإرسال · Shift+Enter لسطر جديد · الإرفاق يدعم JPG و PNG حتى 5 MB
        </p>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// MAIN EXPORT — CopilotWorkspace
// ════════════════════════════════════════════════════════════════════

export function CopilotWorkspace() {
  const searchParams = useSearchParams();

  // ── Chat state ────────────────────────────────────────────────────
  const [messages, setMessages]             = useState<Message[]>([makeWelcome()]);
  const [input, setInput]                   = useState(searchParams.get("q") ?? "");
  const [thinking, setThinking]             = useState(false);
  const [thinkingHasImage, setThinkingHasImage] = useState(false);
  const [hydrated, setHydrated]             = useState(false);
  const [isEmergency, setIsEmergency]       = useState(false);
  const [isRecording, setIsRecording]       = useState(false);
  const [retryingId, setRetryingId]         = useState<string | null>(null);
  const [editReplaceIds, setEditReplaceIds] = useState<{ userId: string; assistantId: string } | null>(null);

  // Image attachment
  const [imageBase64, setImageBase64]       = useState<string | null>(null);
  const [imagePreview, setImagePreview]     = useState<string | null>(null);
  const [imageError, setImageError]         = useState<string | null>(null);

  // Phase 3 state
  const [knowledgeCards, setKnowledgeCards]     = useState<KnowledgeCard[]>([]);
  const [highlightedProvince, setHighlightedProvince] = useState<string | null>(null);
  const [diseaseProvince, setDiseaseProvince]   = useState<string | null>(null);
  const [climateLayer, setClimateLayer]         = useState<"heat" | "humidity" | null>(null);
  const [proactiveAlert, setProactiveAlert]     = useState<string | null>(null);
  const [lastMessage, setLastMessage]           = useState<string>("");

  // Context-awareness bridge — will be populated by حقولي / المحاصيل pages
  // Shape is intentionally typed via UserContext from api.ts
  const userContextRef = useRef<import("@/lib/api").UserContext>({
    fields: [],
    active_crops: [],
    preferred_province: undefined,
  });

  // Refs
  const sessionId      = useRef<string | null>(null);
  const messagesEndRef  = useRef<HTMLDivElement | null>(null);
  const fileInputRef    = useRef<HTMLInputElement | null>(null);
  const isFirstScroll   = useRef(true);
  const lastMsgTimeRef  = useRef<number>(Date.now());
  const alertIdxRef     = useRef(0);

  // ── Hydrate ───────────────────────────────────────────────────────
  useEffect(() => {
    const stored = storageGet<Message[]>(STORAGE_MESSAGES);
    if (stored && stored.length > 0) setMessages(stored);
    const sid = storageGet<string>(STORAGE_SESSION);
    if (sid) sessionId.current = sid;
    const storedKnowledge = storageGet<KnowledgeCard[]>(STORAGE_KNOWLEDGE);
    if (storedKnowledge && storedKnowledge.length > 0) setKnowledgeCards(storedKnowledge);
    // Load fields context written by /fields page
    try {
      const raw = localStorage.getItem("agro_fields_v1_context");
      if (raw) {
        const ctx = JSON.parse(raw) as import("@/lib/api").UserContext;
        userContextRef.current = ctx;
      }
    } catch { /* ignore */ }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    storageSet(STORAGE_MESSAGES, messages);
  }, [messages, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    storageSet(STORAGE_KNOWLEDGE, knowledgeCards);
  }, [knowledgeCards, hydrated]);

  // ── Proactive alert (45s idle) ────────────────────────────────────
  useEffect(() => {
    const id = setInterval(() => {
      if (Date.now() - lastMsgTimeRef.current >= 45_000) {
        setProactiveAlert(PROACTIVE_ALERTS[alertIdxRef.current % PROACTIVE_ALERTS.length]);
        alertIdxRef.current += 1;
        lastMsgTimeRef.current = Date.now();
      }
    }, 5_000);
    return () => clearInterval(id);
  }, []);

  // Auto-scroll
  useEffect(() => {
    if (!hydrated) return;
    const behavior: ScrollBehavior = isFirstScroll.current ? "instant" : "smooth";
    isFirstScroll.current = false;
    messagesEndRef.current?.scrollIntoView({ behavior });
  }, [messages, thinking, hydrated]);

  // ── Handlers ──────────────────────────────────────────────────────
  const clearImage = useCallback(() => {
    setImageBase64(null);
    setImagePreview(null);
    setImageError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  const clearChat = useCallback(() => {
    storageRemove(STORAGE_MESSAGES);
    storageRemove(STORAGE_SESSION);
    sessionId.current = null;
    isFirstScroll.current = true;
    setEditReplaceIds(null);
    setMessages([makeWelcome()]);
    setIsEmergency(false);
    setHighlightedProvince(null);
    setDiseaseProvince(null);
    setProactiveAlert(null);
    clearImage();
  }, [clearImage]);

  const archiveMessage = useCallback((msg: Message) => {
    const firstLine = msg.text.split("\n")[0]?.slice(0, 55) ?? "توصية زراعية";
    const summary   = msg.text.slice(0, 160).trim();
    const tag: KnowledgeCard["tag"] = msg.smartCard ?? "general";
    const card: KnowledgeCard = {
      id:        crypto.randomUUID(),
      titleAr:   firstLine,
      summaryAr: summary,
      time:      nowHHMM(),
      tag,
    };
    setKnowledgeCards((prev) => [card, ...prev].slice(0, 20));
  }, []);

  const handleAttach = useCallback(() => {
    if (thinking) return;
    fileInputRef.current?.click();
  }, [thinking, fileInputRef]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setImageError(null);

    if (!file.type.startsWith("image/")) {
      setImageError("الملف يجب أن يكون صورة");
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setImageError("الصورة يجب أن تكون أقل من 5 ميغابايت");
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      setImagePreview(dataUrl);
      setImageBase64(dataUrl.split(",")[1] ?? dataUrl);
    };
    reader.readAsDataURL(file);
  }, []);

  // Send the composer's current message. If an Edit&Resend is pending
  // (editReplaceIds), the old user bubble + its reply are filtered out before
  // the new user bubble is appended.
  const send = useCallback(async () => {
    const text = input.trim();
    if ((!text && !imageBase64) || thinking) return;

    const msgText    = text;
    const msgPreview = imagePreview;
    const msgB64     = imageBase64;
    const emergency  = isEmergency;
    const replaceIds = editReplaceIds;

    lastMsgTimeRef.current = Date.now();
    setProactiveAlert(null);
    setEditReplaceIds(null);

    const msgProvince = detectProvince(msgText);
    if (msgProvince) setHighlightedProvince(msgProvince);

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      text: emergency ? `[بلاغ طارئ] ${msgText}` : msgText,
      imagePreview: msgPreview ?? undefined,
      emergency,
      time: nowHHMM(),
    };

    setMessages((m) => {
      const filtered = replaceIds
        ? m.filter((msg) => msg.id !== replaceIds.userId && msg.id !== replaceIds.assistantId)
        : m;
      return [...filtered, userMessage];
    });

    setInput("");
    clearImage();
    setIsEmergency(false);
    setLastMessage(msgText);
    setThinking(true);
    setThinkingHasImage(!!msgB64);

    try {
      const res = await sendChatMessage({
        message: emergency ? `[URGENT REPORT] ${msgText}` : msgText,
        session_id: sessionId.current ?? undefined,
        image_base64: msgB64 ?? undefined,
        user_context: userContextRef.current,
      });

      if (!sessionId.current) {
        sessionId.current = res.session_id;
        storageSet(STORAGE_SESSION, res.session_id);
      }

      const detected = detectSmartCard(msgText, res.reply);
      const replyProvince = detectProvince(msgText + " " + res.reply);

      if (detected?.type === "disease" && replyProvince) {
        setDiseaseProvince(replyProvince);
        setHighlightedProvince(null);
      } else if (replyProvince) {
        setHighlightedProvince(replyProvince);
        setDiseaseProvince(null);
      }

      setMessages((m) => [
        ...m,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          text: res.reply,
          thoughts: res.chain_of_thought,
          visualization: res.visualization ?? undefined,
          time: nowHHMM(),
          smartCard: detected?.type,
          smartCardMeta: detected?.meta,
        },
      ]);
    } catch (err) {
      const isTimeout = err instanceof DOMException && err.name === "AbortError";
      const errorText = isTimeout
        ? "انتهت مهلة الاتصال — جارٍ إعادة الاتصال بالخبراء، حاول مجدداً."
        : "تعذّر الوصول إلى شبكة الوكلاء — جارٍ إعادة الاتصال. تحقق من الاتصال بالإنترنت وأعد المحاولة.";
      setMessages((m) => [
        ...m,
        {
          id: crypto.randomUUID(),
          role: "error",
          text: errorText,
          time: nowHHMM(),
        },
      ]);
    } finally {
      setThinking(false);
      setThinkingHasImage(false);
    }
  }, [input, imageBase64, imagePreview, isEmergency, thinking, editReplaceIds, clearImage]);

  // BUTTON 1 — Retry: regenerate a reply IN PLACE (same id + array index) using
  // the preceding user message. Works on assistant replies AND error bubbles.
  const regenerateReply = useCallback(async (assistantMsg: Message) => {
    if (thinking || retryingId) return;
    const idx = messages.findIndex((m) => m.id === assistantMsg.id);
    if (idx === -1) return;
    let userMsg: Message | null = null;
    for (let i = idx - 1; i >= 0; i--) {
      if (messages[i].role === "user") { userMsg = messages[i]; break; }
    }
    if (!userMsg) return;

    const msgText = userMsg.text.replace(/^\[بلاغ طارئ\]\s*/, "");
    const preview = userMsg.imagePreview ?? null;
    const msgB64  = preview ? (preview.split(",")[1] ?? null) : null;

    setRetryingId(assistantMsg.id);
    lastMsgTimeRef.current = Date.now();
    setProactiveAlert(null);

    try {
      const res = await sendChatMessage({
        message: msgText,
        session_id: sessionId.current ?? undefined,
        image_base64: msgB64 ?? undefined,
        user_context: userContextRef.current,
      });

      if (!sessionId.current) {
        sessionId.current = res.session_id;
        storageSet(STORAGE_SESSION, res.session_id);
      }

      const detected = detectSmartCard(msgText, res.reply);
      const replyProvince = detectProvince(msgText + " " + res.reply);
      if (detected?.type === "disease" && replyProvince) {
        setDiseaseProvince(replyProvince);
        setHighlightedProvince(null);
      } else if (replyProvince) {
        setHighlightedProvince(replyProvince);
        setDiseaseProvince(null);
      }

      setMessages((m) => m.map((msg) => (msg.id === assistantMsg.id ? {
        id: msg.id,
        role: "assistant" as const,
        text: res.reply,
        thoughts: res.chain_of_thought,
        visualization: res.visualization ?? undefined,
        time: nowHHMM(),
        smartCard: detected?.type,
        smartCardMeta: detected?.meta,
      } : msg)));
    } catch {
      // Keep role "error" so the Retry button stays available.
      setMessages((m) => m.map((msg) => (msg.id === assistantMsg.id ? {
        id: msg.id,
        role: "error" as const,
        text: "تعذّر إعادة المحاولة — حاول مجدداً.",
        time: nowHHMM(),
      } : msg)));
    } finally {
      setRetryingId(null);
    }
  }, [thinking, retryingId, messages]);

  // BUTTON 2 — Edit & Resend: load the user message into the composer and record
  // the pair (user + its reply) to remove on next send. Does NOT auto-send.
  const handleEdit = useCallback((userMsg: Message) => {
    const cleanText = userMsg.text.replace(/^\[بلاغ طارئ\]\s*/, "");
    const idx = messages.findIndex((m) => m.id === userMsg.id);
    const next = idx !== -1 ? messages[idx + 1] : undefined;
    setEditReplaceIds(
      next && (next.role === "assistant" || next.role === "error")
        ? { userId: userMsg.id, assistantId: next.id }
        : { userId: userMsg.id, assistantId: userMsg.id },
    );
    setInput(cleanText);
    setIsEmergency(!!userMsg.emergency);
  }, [messages]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  };

  const exportPDF = useCallback(() => {
    const advisory = messages.filter((m) => m.role === "assistant" && !m.text.startsWith("أهلاً وسهلاً"));
    if (advisory.length === 0) return;

    const rows = advisory
      .map((m) => `<div class="msg"><pre>${m.text.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</pre></div>`)
      .join("");

    const html = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="utf-8">
  <title>تقرير أغرو-سيريا</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: "Segoe UI", Tahoma, Arial, sans-serif; direction: rtl;
           padding: 36px 48px; color: #111; background: #fff; margin: 0; }
    h1 { font-size: 22px; color: #059669; border-bottom: 2px solid #059669;
         padding-bottom: 8px; margin-bottom: 6px; }
    .meta { color: #6b7280; font-size: 12px; margin-bottom: 24px; }
    .msg { background: #f0fdf4; border: 1px solid #6ee7b7; border-radius: 10px;
           padding: 16px 20px; margin-bottom: 16px; }
    pre { white-space: pre-wrap; font-family: inherit; font-size: 14px;
          line-height: 1.7; margin: 0; }
    footer { color: #9ca3af; font-size: 11px; margin-top: 32px;
             border-top: 1px solid #e5e7eb; padding-top: 12px; }
  </style>
</head>
<body>
  <h1>تقرير أغرو-سيريا — نصائح زراعية</h1>
  <p class="meta">التاريخ: ${new Date().toLocaleDateString("ar-SY")} · عدد التوصيات: ${advisory.length}</p>
  ${rows}
  <footer>تم إنشاء هذا التقرير بواسطة منصة أغرو-سيريا | نظام الزراعة الذكي للمزارع السوري</footer>
</body>
</html>`;

    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 400);
  }, [messages]);

  // ── Current time for header (empty on server to prevent hydration mismatch)
  const [currentTime, setCurrentTime] = useState("");
  useEffect(() => {
    setCurrentTime(nowHHMM());
    const id = setInterval(() => setCurrentTime(nowHHMM()), 30_000);
    return () => clearInterval(id);
  }, []);

  const activeAgents = COPILOT_AGENTS.filter((a) => a.status === "active" || a.status === "processing").length;
  const alertAgents  = COPILOT_AGENTS.filter((a) => a.status === "alert").length;

  // ── Render ────────────────────────────────────────────────────────
  return (
    <div className="h-[100dvh] w-full bg-forest-mesh flex flex-col overflow-hidden">

      {/* ── Top header bar ── */}
      <header className="h-14 flex-shrink-0 flex items-center justify-between gap-2 px-3 sm:px-5 border-b border-emerald-500/12 bg-[oklch(0.075_0.016_152/90%)] backdrop-blur-xl">

        {/* RTL: brand appears on visual right, controls on visual left */}
        <div className="flex items-center gap-3" dir="rtl">
          <AgroLogo size={28} />
          <div>
            <p className="text-sm font-bold text-emerald-gradient leading-tight">
              المساعد الزراعي الوطني الذكي
            </p>
            <p className="text-[10px] text-muted-foreground/60">
              منصة أغرو-سيريا · نظام الوكلاء الذكيين
            </p>
          </div>
        </div>

        {/* Center: status chips (desktop only — keeps the mobile header clean) */}
        <div className="flex-1 hidden md:flex items-center justify-center gap-3">
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[10px] font-semibold text-emerald-400 font-numeric">{activeAgents} وكيل نشط</span>
          </div>
          {alertAgents > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-500/10 border border-red-500/25">
              <ShieldAlert className="w-3 h-3 text-red-400" />
              <span className="text-[10px] font-semibold text-red-400 font-numeric">{alertAgents} تنبيه</span>
            </div>
          )}
        </div>

        {/* Controls: time + back link */}
        <div className="flex items-center gap-3 flex-shrink-0" dir="rtl">
          <span className="text-[11px] text-muted-foreground/45 font-numeric">{currentTime}</span>
          <div className="w-px h-4 bg-white/[0.08]" />
          <Link
            href="/dashboard"
            className="flex items-center gap-1.5 text-[11px] text-muted-foreground/60 hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>لوحة التحكم</span>
          </Link>
        </div>
      </header>

      {/* Top accent line */}
      <div className="h-[1px] w-full bg-gradient-to-l from-transparent via-emerald-500/30 to-transparent flex-shrink-0" />

      {/* ── 3-column workspace ── */}
      {/* RTL flex: first child = visual RIGHT, last = visual LEFT */}
      <div className="flex-1 flex overflow-hidden">

        {/* Visual RIGHT: Intelligence Library */}
        <IntelligenceLibrary
          onNewSession={clearChat}
          knowledgeCards={knowledgeCards}
          onRemoveKnowledge={(id) => setKnowledgeCards((prev) => prev.filter((k) => k.id !== id))}
        />

        {/* Visual CENTER: Chat workspace */}
        <ChatCenter
          messages={messages}
          thinking={thinking}
          thinkingHasImage={thinkingHasImage}
          input={input}
          onInputChange={setInput}
          onKeyDown={handleKeyDown}
          onSend={() => void send()}
          imagePreview={imagePreview}
          imageBase64={imageBase64}
          imageError={imageError}
          onAttach={handleAttach}
          onFileChange={handleFileChange}
          onClearImage={clearImage}
          fileInputRef={fileInputRef}
          isEmergency={isEmergency}
          onToggleEmergency={() => setIsEmergency((e) => !e)}
          isRecording={isRecording}
          onToggleRecording={() => setIsRecording((r) => !r)}
          onExportPDF={exportPDF}
          onClearChat={clearChat}
          messagesEndRef={messagesEndRef}
          onArchive={archiveMessage}
          onRetry={regenerateReply}
          onEdit={handleEdit}
          retryingId={retryingId}
          proactiveAlert={proactiveAlert}
          onDismissAlert={() => setProactiveAlert(null)}
        />

        {/* Visual LEFT: Agent Operating Center */}
        <AgentOperatingCenter
          thinking={thinking}
          isEmergency={isEmergency}
          highlightedProvince={highlightedProvince}
          diseaseProvince={diseaseProvince}
          climateLayer={climateLayer}
          lastMessage={lastMessage}
          onToggleClimate={(layer) => setClimateLayer((c) => c === layer ? null : layer)}
          onProvinceClick={(name) => {
            setHighlightedProvince(name);
            setInput("أخبرني عن الوضع الزراعي في محافظة " + name);
          }}
        />
      </div>
    </div>
  );
}
