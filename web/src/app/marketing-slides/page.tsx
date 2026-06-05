"use client";

/**
 * Hidden marketing slide-deck utility — /marketing-slides
 *
 * Standalone, immersive social-carousel deck (LinkedIn / X / Instagram).
 * Not linked in app navigation. Single premium 3D Discord-style frame per
 * feature bound to high-fidelity static screenshots under /public/marketing/,
 * native PDF export (print), and full Sun-Cycle light/dark sync.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { toPng } from "html-to-image";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft, ChevronRight, Camera, Sparkles, ArrowLeft,
  LayoutDashboard, CloudSun, Bot, Map as MapIcon, Sprout, TrendingUp,
  ShieldCheck, Rocket, AlertTriangle, Globe, Zap, Heart, ExternalLink,
  Download, Users, Newspaper,
  Monitor, Square, RectangleVertical, Smartphone,
  ImageDown, ChevronDown, Loader2, RectangleHorizontal, FileText,
} from "lucide-react";
import { ThemeToggle } from "@/components/ThemeController";
import { cn } from "@/lib/utils";

type Bezier = [number, number, number, number];
const EASE: Bezier = [0.22, 1, 0.36, 1];

const PROD_URL = "agro-syria.vercel.app";

/* Export formats — each maps to a named @page size in globals.css (print). */
type DeckFormat = "landscape" | "square" | "portrait" | "story";
const FORMATS: { id: DeckFormat; label: string; Icon: React.ElementType }[] = [
  { id: "landscape", label: "أفقي · لينكدإن و X",       Icon: Monitor },
  { id: "square",    label: "مربّع 1:1 · إنستغرام",      Icon: Square },
  { id: "portrait",  label: "عمودي 4:5 · إنستغرام",      Icon: RectangleVertical },
  { id: "story",     label: "ستوري 9:16 · ريلز و واتساب", Icon: Smartphone },
];

/* Single-slide image export — target social aspect ratios (html-to-image). */
interface ImageFormat {
  id: string; label: string; sub: string;
  w: number; h: number; designW: number; padX: number; padY: number;
  vertical: boolean; Icon: React.ElementType;
}
const IMAGE_FORMATS: ImageFormat[] = [
  { id: "instagram",       label: "إنستغرام — منشور مربّع", sub: "1080 × 1080", w: 1080, h: 1080, designW: 980,  padX: 60, padY: 60,  vertical: true,  Icon: Square },
  { id: "instagram-story", label: "إنستغرام — ستوري",       sub: "1080 × 1920", w: 1080, h: 1920, designW: 940,  padX: 80, padY: 110, vertical: true,  Icon: Smartphone },
  { id: "linkedin",        label: "لينكدإن — منشور",        sub: "1200 × 627",  w: 1200, h: 627,  designW: 1150, padX: 48, padY: 34,  vertical: false, Icon: FileText },
  { id: "twitter",         label: "تويتر / X — منشور",      sub: "1600 × 900",  w: 1600, h: 900,  designW: 1500, padX: 64, padY: 56,  vertical: false, Icon: RectangleHorizontal },
  { id: "facebook",        label: "فيسبوك — منشور",         sub: "1200 × 630",  w: 1200, h: 630,  designW: 1150, padX: 48, padY: 34,  vertical: false, Icon: Monitor },
];

// ── FEATURE 3 · decorative overlay (Option A: fine golden neural/root network) ──
// Self-contained SVG, corner-concentrated, center stays clean; captured with the slide.
function NeuralCluster() {
  return (
    <g stroke="#C9A84C" strokeWidth={0.8} strokeLinecap="round" fill="none">
      <path d="M5,98 C20,90 30,75 35,60" />
      <path d="M35,60 C40,50 52,48 62,42" />
      <path d="M35,60 C30,48 33,35 28,22" />
      <path d="M5,98 C18,92 28,88 42,86" />
      <path d="M42,86 C52,84 60,78 70,74" />
      <path d="M28,22 C26,14 30,8 24,2" />
      <path d="M62,42 C70,38 76,40 84,34" />
      {[[35,60],[62,42],[28,22],[42,86],[70,74],[24,2],[84,34]].map(([x,y],i) => (
        <circle key={i} cx={x} cy={y} r={1.1} fill="#C9A84C" stroke="none" />
      ))}
    </g>
  );
}
function DeckOverlay() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
      <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet"
        className="absolute" style={{ left: "-3%", bottom: "-3%", width: "44%", height: "44%", opacity: 0.18 }}>
        <NeuralCluster />
      </svg>
      <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet"
        className="absolute" style={{ right: "-3%", top: "-3%", width: "44%", height: "44%", opacity: 0.18, transform: "rotate(180deg)" }}>
        <NeuralCluster />
      </svg>
    </div>
  );
}

/**
 * CRITICAL for export: Tailwind v4 uses oklch() colors, which html-to-image's
 * SVG <foreignObject> rasterizer renders as BLANK. We resolve every element's
 * computed colors to plain rgb (via a canvas 2D parser) and inline them before
 * capture, eliminating oklch from the serialized styles.
 */
function flattenColorsForCapture(root: HTMLElement): void {
  const probe = document.createElement("canvas").getContext("2d");
  if (!probe) return;
  const toRgb = (c: string): string => {
    if (!c || c === "transparent" || c.startsWith("rgb") || c.startsWith("#")) return c;
    try { probe.fillStyle = "#000000"; probe.fillStyle = c; return probe.fillStyle as string; }
    catch { return c; }
  };
  const nodes: HTMLElement[] = [root, ...Array.from(root.querySelectorAll<HTMLElement>("*"))];
  for (const el of nodes) {
    const cs = getComputedStyle(el);
    el.style.color = toRgb(cs.color);
    el.style.backgroundColor = toRgb(cs.backgroundColor);
    el.style.borderTopColor = toRgb(cs.borderTopColor);
    el.style.borderRightColor = toRgb(cs.borderRightColor);
    el.style.borderBottomColor = toRgb(cs.borderBottomColor);
    el.style.borderLeftColor = toRgb(cs.borderLeftColor);
    if (cs.backgroundImage && cs.backgroundImage.includes("oklch")) el.style.backgroundImage = "none";
    if (cs.fill && cs.fill.includes("oklch")) el.style.fill = toRgb(cs.fill);
    if (cs.stroke && cs.stroke.includes("oklch")) el.style.stroke = toRgb(cs.stroke);
  }
}

/* Per-slide overlay: choose a platform layout and download the slide as a PNG. */
function ImageExportMenu({ onExport, busy }: { onExport: (f: ImageFormat) => void; busy: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)} disabled={busy}
        className="inline-flex items-center gap-1.5 rounded-xl glass-card px-3 py-2 text-xs sm:text-sm font-bold font-arabic text-foreground hover:text-emerald-300 transition-colors disabled:opacity-60"
      >
        {busy ? <Loader2 className="w-4 h-4 animate-spin text-emerald-400" /> : <ImageDown className="w-4 h-4 text-emerald-400" />}
        <span className="hidden sm:inline">{busy ? "جارٍ التصدير…" : "حفظ كصورة للمنصات"}</span>
        <span className="sm:hidden">صورة</span>
        {!busy && <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", open && "rotate-180")} />}
      </button>
      <AnimatePresence>
        {open && !busy && (
          <>
            <button className="fixed inset-0 z-10 cursor-default" aria-hidden tabIndex={-1} onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.16 }} dir="rtl"
              className="absolute end-0 mt-2 w-72 z-20 rounded-2xl glass-card border border-white/10 p-1.5 shadow-2xl"
            >
              <p className="px-2.5 pt-1.5 pb-1 text-[10px] font-bold text-muted-foreground/70 font-arabic">اختر مقاس المنصّة</p>
              {IMAGE_FORMATS.map(f => {
                const I = f.Icon;
                return (
                  <button
                    key={f.id} onClick={() => { setOpen(false); onExport(f); }}
                    className="w-full flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-start hover:bg-emerald-500/12 transition-colors"
                  >
                    <span className="w-7 h-7 rounded-lg bg-emerald-500/12 border border-emerald-500/25 flex items-center justify-center flex-shrink-0">
                      <I className="w-3.5 h-3.5 text-emerald-400" />
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-[12px] font-bold text-foreground font-arabic truncate">{f.label}</span>
                      <span className="block text-[10px] text-muted-foreground font-numeric" dir="ltr">{f.sub}</span>
                    </span>
                  </button>
                );
              })}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   Discord-inspired 3D glass window mockup — static screenshot, perfectly clipped
   ───────────────────────────────────────────────────────────────────────── */
function MacWindow({ url, image, caption }: { url: string; image: string; caption: string }) {
  const [errored, setErrored] = useState(false);

  return (
    <div
      className={cn(
        "group relative w-full rounded-xl overflow-hidden",
        "bg-slate-950/40 backdrop-blur-xl border border-emerald-500/30",
        // Layered 3D float: inner top highlight + deep shadow + emerald neon glow
        "shadow-[inset_0_1px_0_0_rgba(255,255,255,0.07),0_28px_70px_-15px_rgba(0,0,0,0.72),0_14px_40px_-12px_rgba(16,185,129,0.42)]",
        "transition-transform duration-500 sm:hover:-translate-y-1",
      )}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-400/70 to-transparent" />

      {/* Title bar */}
      <div className="flex items-center gap-3 px-3 sm:px-4 py-2.5 border-b border-white/[0.07] bg-slate-900/50">
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span className="w-3 h-3 rounded-full" style={{ backgroundColor: "#FF5F56" }} />
          <span className="w-3 h-3 rounded-full" style={{ backgroundColor: "#FFBD2E" }} />
          <span className="w-3 h-3 rounded-full" style={{ backgroundColor: "#27C93F" }} />
        </div>
        <div className="flex-1 min-w-0 px-1 sm:px-4">
          <div dir="ltr" className="mx-auto max-w-[280px] rounded-md bg-slate-950/60 border border-emerald-500/20 px-3 py-1 text-[10px] sm:text-[11px] text-emerald-200/60 text-center font-numeric truncate">
            {url}
          </div>
        </div>
        <div className="w-[54px] flex-shrink-0 hidden sm:block" />
      </div>

      {/* Screen — static screenshot, clipped flush to the frame's curves */}
      <div className="relative overflow-hidden rounded-b-xl bg-slate-950/40"
           style={{ minHeight: "280px", height: "clamp(280px, 38vw, 520px)" }}>
        {!errored ? (
          <Image
            src={image}
            alt={caption}
            fill
            quality={95}
            priority
            sizes="(max-width: 1024px) 100vw, 60vw"
            onError={() => setErrored(true)}
            className="object-cover object-top rounded-b-xl"
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6">
            <div
              className="absolute inset-0"
              style={{ background: "radial-gradient(ellipse 70% 60% at 50% 28%, oklch(0.696 0.170 162 / 16%), transparent 70%)" }}
            />
            <div className="relative mb-3 w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shadow-[0_0_24px_-4px_rgba(16,185,129,0.6)]">
              <Camera className="w-6 h-6 text-emerald-300" />
            </div>
            <p className="relative text-xs sm:text-sm text-slate-200/85 font-arabic leading-relaxed max-w-sm mx-auto">{caption}</p>
            <p dir="ltr" className="relative mt-2 text-[10px] text-slate-400/60 font-numeric">{image}</p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   Slide chrome
   ───────────────────────────────────────────────────────────────────────── */
function Kicker({ icon: Icon, text }: { icon: React.ElementType; text: string }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 border border-emerald-500/22 px-4 py-2">
      <Icon className="w-4 h-4 text-emerald-400" />
      <span className="text-sm sm:text-base font-bold text-emerald-300 font-arabic">{text}</span>
    </div>
  );
}

/* Clean numbered highlights — no connector lines */
function Highlights({ points }: { points: string[] }) {
  return (
    <ul className="space-y-4">
      {points.map((p, i) => (
        <li key={i} className="flex items-start gap-3.5">
          <span className="flex-shrink-0 w-8 h-8 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-sm font-black flex items-center justify-center font-numeric">
            {i + 1}
          </span>
          <span className="text-lg sm:text-xl text-foreground/90 leading-relaxed font-arabic pt-0.5">{p}</span>
        </li>
      ))}
    </ul>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   Feature catalogue — single frame per slide, bound to a static asset
   ───────────────────────────────────────────────────────────────────────── */
interface Feature {
  id: string;
  icon: React.ElementType;
  kicker: string;
  title: string;
  tagline: string;
  url: string;
  image: string;
  caption: string;
  points: string[];
}

const FEATURES: Feature[] = [
  {
    id: "dashboard", icon: LayoutDashboard, kicker: "مركز القيادة", title: "لوحة تحكّم تضع المزرعة كلّها بين يديك",
    tagline: "مزرعتك كلّها في شاشة واحدة، لا شيء يفوتك.",
    url: `${PROD_URL}/dashboard`, image: "/marketing/dashboard.png",
    caption: "📸 [مكان لقطة الشاشة: لوحة التحكم مع خريطة المخاطر الجغرافية التفاعلية]",
    points: [
      "كنت تتنقّل بين دفاترَ وتطبيقاتٍ متفرّقة؟ الآن كلّ أرضك في لوحةٍ واحدة.",
      "كنت تكتشف الخطر بعد فوات الأوان؟ الخريطة تُنذرك بحدود محافظتك لحظةً بلحظة.",
      "كنت تتردّد في القرار؟ مؤشّر صحة المزرعة وإجراءٌ بنقرةٍ يحسمان أمرك.",
    ],
  },
  {
    id: "weather", icon: CloudSun, kicker: "مُعاد بناؤه من الجذور", title: "طقسٌ ذكيّ يحمي موسمك قبل أن يبدأ الخطر",
    tagline: "اعرف ما سيحدث لأرضك قبل أن يحدث.",
    url: `${PROD_URL}/weather`, image: "/marketing/weather.png",
    caption: "📸 [مكان لقطة الشاشة: صفحة الطقس المتجاوبة الجديدة]",
    points: [
      "كم مرّةٍ باغتك الصقيع أو موجة الحر؟ الآن إنذارٌ مبكر يصلك بوقتٍ كافٍ.",
      "كنت تروي بالتخمين؟ محرّك التبخّر-نتح (ET₀) يحسب حاجة أرضك للماء بدقّة.",
      "كنت تتابع طقساً عامّاً لا يخصّك؟ توقّعات سبعة أيام مثبّتة على محافظتك وحدها.",
    ],
  },
  {
    id: "copilot", icon: Bot, kicker: "تجربة غامرة", title: "مساعدٌ ذكيّ يفهمك بلهجتك ويقف إلى جانبك",
    tagline: "خبيرٌ زراعيّ في جيبك، يفهم لهجتك.",
    url: `${PROD_URL}/copilot`, image: "/marketing/copilot.png",
    caption: "📸 [مكان لقطة الشاشة: مساحة المحادثة متعددة الوكلاء]",
    points: [
      "كنت تنتظر المهندس أياماً؟ الآن تسأل فتأتيك الإجابة في ثوانٍ، بلهجتك.",
      "ظهرت بقعةٌ غريبة على نبتتك؟ صوّرها، فيشخّص لك المرض من صورةٍ واحدة.",
      "كنت تشكّ في صحّة النصيحة؟ كلّ توصيةٍ مستندةٌ إلى مراجع زراعية موثوقة.",
    ],
  },
  {
    id: "fields", icon: MapIcon, kicker: "سجلّ جغرافي", title: "كل حقلٍ له صوته... وبياناته الخاصة",
    tagline: "أرضك مرسومةٌ ومُراقَبة، حقلاً حقلاً.",
    url: `${PROD_URL}/fields`, image: "/marketing/fields.png",
    caption: "📸 [مكان لقطة الشاشة: خريطة الحقول ونظام GIS]",
    points: [
      "كنت تحفظ حدود حقولك في ذاكرتك؟ الآن كلّها مسجّلةٌ بإحداثياتها على الخريطة.",
      "كنت تعامل أرضك كقطعةٍ واحدة؟ الآن لكلّ حقلٍ بياناته المناخية الخاصّة.",
      "كنت تفقد تفاصيل المواسم؟ سجلٌّ جغرافيٌّ يجمع أراضيك كلّها في مكانٍ واحد.",
    ],
  },
  {
    id: "crops", icon: Sprout, kicker: "معرفة موثوقة", title: "موسوعة المحاصيل السورية في جيبك",
    tagline: "كلّ ما يحتاجه محصولك، بين يديك.",
    url: `${PROD_URL}/crops`, image: "/marketing/crops.png",
    caption: "📸 [مكان لقطة الشاشة: وحدة المحاصيل وحاسبة الإنتاجية]",
    points: [
      "كنت تبحث عن إرشادٍ موثوق؟ بيانات أحد عشر محصولاً سورياً وفق مرجعية GCSAR.",
      "كنت تقدّر الإنتاج بالحدس؟ حاسبةٌ تفاعلية تعطيك الرقم قبل أن تزرع.",
      "كنت تنسى مواعيد الموسم؟ إرشاداتٌ موسمية تذكّرك بالخطوة الصحيحة في وقتها.",
    ],
  },
  {
    id: "market", icon: TrendingUp, kicker: "ذكاء الأسواق", title: "بِع في الوقت المناسب... وبالسعر الذي تستحقّه",
    tagline: "لا تبِع بأقلّ ممّا يستحقّ تعبك.",
    url: `${PROD_URL}/dashboard/market`, image: "/marketing/market.png",
    caption: "📸 [مكان لقطة الشاشة: تحليلات السوق واتجاهات الأسعار]",
    points: [
      "كنت تبيع وأنت تجهل السعر العادل؟ الآن أسعار محصولك أمامك أسبوعياً.",
      "كنت تتساءل أين السعر أفضل؟ قارن إنتاج المحافظات واختر سوقك بثقة.",
      "كنت تبيع في توقيتٍ خاطئ؟ توصيةٌ ذكية تدلّك على أفضل نافذةٍ للبيع.",
    ],
  },
  {
    id: "community", icon: Users, kicker: "مجتمع مزارعي أغرو-سوريا", title: "نبض الأرض.. مجتمع يجمعنا",
    tagline: "لن تواجه أرضك وحدك بعد اليوم.",
    url: `${PROD_URL}/community`, image: "/marketing/community.png",
    caption: "📸 [مكان لقطة الشاشة: مجتمع المزارعين التفاعلي]",
    points: [
      "واجهتك مشكلةٌ لم تعرف حلّها؟ اسأل، فيجيبك خبراء ومزارعون عاشوا التجربة.",
      "اكتشفت طريقةً نجحت معك؟ شاركها، وانفع بها آلاف المزارعين السوريين.",
      "كنت تعمل في عزلة؟ شبكةٌ وطنية تربط المحافظات بالخبرة والتجارة.",
    ],
  },
  {
    id: "news", icon: Newspaper, kicker: "الأخبار والقرارات · قريباً", title: "أخبار ومواسم الزراعة.. لحظة بلحظة (قريباً)",
    tagline: "كلّ قرارٍ يخصّ أرضك، يصلك أوّلاً.",
    url: `${PROD_URL}/news`, image: "/marketing/news.png",
    caption: "📸 [مكان لقطة الشاشة: لوحة الأخبار والقرارات الزراعية]",
    points: [
      "كنت آخر من يعلم بالقرارات؟ قريباً ترصد قرارات وزارة الزراعة فور صدورها.",
      "باغتتك الأسعار في السوق؟ قريباً تتابع أسعار السماد والوقود يوماً بيوم.",
      "فاجأك الطقس القاسي؟ قريباً تنبيهاتٌ استباقية بالصقيع والرياح وانتشار الأوبئة.",
    ],
  },
];

const TRUST = [
  { icon: ShieldCheck, title: "خصوصيتك أولاً", desc: "بياناتك تُعالَج بأمان ولا تُكشف — أنت صاحب القرار دائماً." },
  { icon: Zap,         title: "لا تتوقّف أبداً", desc: "تعمل بثبات حتى عند انقطاع الخدمات الخارجية، فلا تُترك وحدك." },
  { icon: Heart,       title: "دقّة تستحقّ الثقة", desc: "كل توصية تمرّ بفحص جودة دقيق قبل أن تصل إليك." },
];

/* ═════════════════════════════════════════════════════════════════════════
   EXPORT COMPOSITIONS — purpose-built layouts authored at the target pixel
   size (NO downscaling), with enforced minimum readable font sizes. Solid
   inline colors (no glass/blur/oklch-dependence) so html-to-image captures
   cleanly. Shared text constants mirror the on-screen copy.
   ═════════════════════════════════════════════════════════════════════════ */
const EC = {
  title: "#F4FBF6",
  tagline: "#6EE7B7",
  body: "rgba(244,251,246,0.90)",
  muted: "rgba(176,201,186,0.78)",
  emerald: "#10B981",
  chipBg: "rgba(16,185,129,0.12)",
  chipBorder: "rgba(16,185,129,0.30)",
  panel: "rgba(255,255,255,0.045)",
  panelBorder: "rgba(255,255,255,0.09)",
} as const;

const EXPORT_BG = "linear-gradient(135deg, #0D2018 0%, #0A1F14 40%, #061510 70%, #0D1A0E 100%)";

const INTRO_COPY = {
  pre: "أرضُك تستحقّ قراراً أذكى — و",
  hi: "الذكاء الاصطناعي",
  post: " الآن في يد كلّ مزارعٍ سوري.",
  subtitle: "منصّة ذكية بصناعة وخبرات سورية وطنية مخلصة — يبنيها شباب سوريا في الداخل والمهجر، بإيمانٍ راسخ بأنّ أرضنا تستحقّ أحدث ما وصل إليه العالم.",
  chips: ["زراعة ذكية", "وكلاء متعدّدون", "بخبرات سورية وطنية"],
};
const PROBLEM_COPY = {
  headline: "من التخمين والقلق... إلى قرارٍ تطمئنّ إليه",
  reality: ["بياناتٌ مبعثرة بين الورق والذاكرة، وقرارٌ مبنيٌّ على التخمين.", "الطقس يباغتك، والآفة تنتشر قبل أن تنتبه.", "أحدث الأبحاث بعيدةٌ عنك، والخبرة تصل متأخّرة."],
  solution: ["كلّ بياناتك موحّدةٌ ومحلّلة في مكانٍ واحد، فوراً.", "إنذارٌ مبكر يسبق الطقس والآفة بخطوة.", "توصيةٌ عملية بلغتك، مستندةٌ إلى مراجع موثوقة."],
};
const TRUST_HEADLINE = "بياناتك محميّة... وخدمتك لا تتوقّف";
const CTA_COPY = {
  pre: "انضمّ إلى ",
  hi: "ثورة الزراعة الذكية",
  subtitle: "منصّة سورية وطنية، قابلة للتوسّع، تخدم كل مزارع — جرّبها الآن مباشرةً على الإنترنت.",
};

// Minimum readable font floors (px) — title ≥44, tagline ≥30, bullet ≥26 at 1080-wide.
function exportSizes(fmt: ImageFormat) {
  if (fmt.vertical)  return { title: 58, tagline: 36, bullet: 30, kicker: 22, gap: 26 };
  if (fmt.h <= 700)  return { title: 46, tagline: 30, bullet: 26, kicker: 18, gap: 16 }; // linkedin/facebook (short)
  return { title: 64, tagline: 40, bullet: 32, kicker: 22, gap: 22 };                    // twitter
}
type ExportSizes = ReturnType<typeof exportSizes>;

function ExportShot({ image, url }: { image: string; url: string }) {
  return (
    <div style={{ width: "100%", height: "100%", borderRadius: 20, overflow: "hidden", display: "flex", flexDirection: "column",
      border: "1px solid rgba(201,168,76,0.22)", background: "#0A1410", boxShadow: "0 24px 60px -18px rgba(0,0,0,0.65)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "12px 16px", flexShrink: 0,
        background: "#0E1A14", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <span style={{ width: 12, height: 12, borderRadius: 99, background: "#FF5F56" }} />
        <span style={{ width: 12, height: 12, borderRadius: 99, background: "#FFBD2E" }} />
        <span style={{ width: 12, height: 12, borderRadius: 99, background: "#27C93F" }} />
        <span style={{ marginInlineStart: "auto", fontSize: 13, color: "rgba(167,196,180,0.55)", direction: "ltr", fontFamily: "ui-monospace, monospace" }}>{url}</span>
      </div>
      {/* same-origin /public asset → no crossOrigin (would force CORS + fail) */}
      <img src={image} alt="" style={{ width: "100%", flex: 1, minHeight: 0, objectFit: "cover", objectPosition: "top", display: "block" }} />
    </div>
  );
}

function EBullet({ text, sz }: { text: string; sz: ExportSizes }) {
  return (
    <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
      <span style={{ flexShrink: 0, marginTop: sz.bullet * 0.5, width: 12, height: 12, borderRadius: 99, background: EC.emerald }} />
      <span style={{ fontSize: sz.bullet, lineHeight: 1.5, color: EC.body, fontWeight: 600 }}>{text}</span>
    </div>
  );
}

function FeatureExport({ f, sz, isV, fmt }: { f: Feature; sz: ExportSizes; isV: boolean; fmt: ImageFormat }) {
  const kicker  = <span style={{ alignSelf: "flex-start", fontSize: sz.kicker, fontWeight: 800, color: EC.tagline, background: EC.chipBg, border: `1px solid ${EC.chipBorder}`, borderRadius: 999, padding: "8px 18px" }}>{f.kicker}</span>;
  const title   = <h2 style={{ fontSize: sz.title, fontWeight: 900, color: EC.title, lineHeight: 1.15, margin: 0 }}>{f.title}</h2>;
  const tagline = <p style={{ fontSize: sz.tagline, fontWeight: 700, color: EC.tagline, lineHeight: 1.4, margin: 0 }}>{f.tagline}</p>;
  const bullets = <div style={{ display: "flex", flexDirection: "column", gap: sz.gap * 0.7 }}>{f.points.map((p, i) => <EBullet key={i} text={p} sz={sz} />)}</div>;
  const shot    = <ExportShot image={f.image} url={f.url} />;

  if (isV) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: sz.gap, height: "100%" }}>
        {kicker}{title}{tagline}
        <div style={{ flex: 1, minHeight: fmt.h * 0.40 }}>{shot}</div>
        {bullets}
      </div>
    );
  }
  return (
    <div style={{ display: "flex", flexDirection: "row", gap: 40, height: "100%", alignItems: "stretch" }}>
      <div style={{ flex: "0 0 40%", display: "flex", flexDirection: "column", gap: sz.gap, justifyContent: "center" }}>
        {kicker}{title}{tagline}{bullets}
      </div>
      <div style={{ flex: 1, minHeight: 0 }}>{shot}</div>
    </div>
  );
}

function IntroExport({ sz }: { sz: ExportSizes }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", height: "100%", gap: sz.gap }}>
      <img src="/assets/agro-syria-logo.svg" alt="" style={{ width: "46%", maxWidth: 360, height: "auto" }} />
      <h1 style={{ fontSize: sz.title * 1.05, fontWeight: 900, color: EC.title, lineHeight: 1.2, margin: 0, maxWidth: "92%" }}>
        {INTRO_COPY.pre}<span style={{ color: EC.tagline }}>{INTRO_COPY.hi}</span>{INTRO_COPY.post}
      </h1>
      <p style={{ fontSize: sz.tagline * 0.9, color: EC.muted, lineHeight: 1.6, margin: 0, maxWidth: "86%" }}>{INTRO_COPY.subtitle}</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "center" }}>
        {INTRO_COPY.chips.map((c, i) => (
          <span key={c} style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: sz.bullet * 0.8, fontWeight: 800, color: EC.tagline, background: EC.chipBg, border: `1px solid ${EC.chipBorder}`, borderRadius: 999, padding: "8px 18px" }}>
            {c}{i === 2 && <img src="/assets/syria-flag.svg" alt="" style={{ width: 26, height: 17, borderRadius: 2 }} />}
          </span>
        ))}
      </div>
    </div>
  );
}

function ProblemExport({ sz, isV }: { sz: ExportSizes; isV: boolean }) {
  const Panel = (heading: string, items: string[], accent: string) => (
    <div style={{ flex: 1, background: EC.panel, border: `1px solid ${EC.panelBorder}`, borderRadius: 24, padding: 28, display: "flex", flexDirection: "column", gap: 18 }}>
      <h3 style={{ fontSize: sz.tagline, fontWeight: 900, color: EC.title, margin: 0 }}>{heading}</h3>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {items.map((t, i) => (
          <div key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
            <span style={{ flexShrink: 0, marginTop: sz.bullet * 0.5, width: 11, height: 11, borderRadius: 99, background: accent }} />
            <span style={{ fontSize: sz.bullet, lineHeight: 1.5, color: EC.body }}>{t}</span>
          </div>
        ))}
      </div>
    </div>
  );
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", gap: sz.gap }}>
      <h2 style={{ fontSize: sz.title, fontWeight: 900, color: EC.title, textAlign: "center", lineHeight: 1.2, margin: 0 }}>{PROBLEM_COPY.headline}</h2>
      <div style={{ flex: 1, display: "flex", flexDirection: isV ? "column" : "row", gap: 22 }}>
        {Panel("الواقع اليوم", PROBLEM_COPY.reality, "#F87171")}
        {Panel("الحل", PROBLEM_COPY.solution, EC.emerald)}
      </div>
    </div>
  );
}

function TrustExport({ sz, isV }: { sz: ExportSizes; isV: boolean }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", gap: sz.gap, justifyContent: "center" }}>
      <h2 style={{ fontSize: sz.title, fontWeight: 900, color: EC.title, textAlign: "center", lineHeight: 1.2, margin: 0 }}>{TRUST_HEADLINE}</h2>
      <div style={{ display: "flex", flexDirection: isV ? "column" : "row", gap: 20 }}>
        {TRUST.map(({ icon: Icon, title, desc }) => (
          <div key={title} style={{ flex: 1, background: EC.panel, border: `1px solid ${EC.panelBorder}`, borderRadius: 24, padding: 28, display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 12 }}>
            <span style={{ width: 56, height: 56, borderRadius: 16, background: "rgba(16,185,129,0.12)", border: `1px solid ${EC.chipBorder}`, display: "flex", alignItems: "center", justifyContent: "center", color: EC.emerald }}>
              <Icon style={{ width: 28, height: 28 }} />
            </span>
            <h3 style={{ fontSize: sz.tagline, fontWeight: 900, color: EC.title, margin: 0 }}>{title}</h3>
            <p style={{ fontSize: sz.bullet, lineHeight: 1.5, color: EC.body, margin: 0 }}>{desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function CtaExport({ sz }: { sz: ExportSizes }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", height: "100%", gap: sz.gap }}>
      <img src="/assets/agro-syria-mark.svg" alt="" style={{ height: sz.title * 1.4, width: "auto" }} />
      <h2 style={{ fontSize: sz.title * 1.05, fontWeight: 900, color: EC.title, lineHeight: 1.2, margin: 0, maxWidth: "90%" }}>
        {CTA_COPY.pre}<span style={{ color: EC.tagline }}>{CTA_COPY.hi}</span>
      </h2>
      <p style={{ fontSize: sz.tagline * 0.9, color: EC.muted, lineHeight: 1.6, margin: 0, maxWidth: "82%" }}>{CTA_COPY.subtitle}</p>
      <span style={{ fontSize: sz.tagline, fontWeight: 900, color: "#06281A", background: EC.emerald, borderRadius: 999, padding: "16px 40px", direction: "ltr", fontFamily: "ui-monospace, monospace" }}>{PROD_URL}</span>
    </div>
  );
}

type ExportSlide =
  | { kind: "intro" }
  | { kind: "problem" }
  | { kind: "feature"; feature: Feature }
  | { kind: "trust" }
  | { kind: "cta" };

// Order MUST mirror buildSlides(): intro, problem, …features, trust, cta.
const EXPORT_SLIDES: ExportSlide[] = [
  { kind: "intro" },
  { kind: "problem" },
  ...FEATURES.map((feature): ExportSlide => ({ kind: "feature", feature })),
  { kind: "trust" },
  { kind: "cta" },
];

/** The capturable node: a slide composed at the platform's exact pixel size. */
function ExportComposition({ slide, fmt, nodeRef }: { slide: ExportSlide; fmt: ImageFormat; nodeRef: React.Ref<HTMLDivElement> }) {
  const sz = exportSizes(fmt);
  const isV = fmt.vertical;
  return (
    <div ref={nodeRef} dir="rtl" className="font-arabic"
      style={{ position: "relative", width: fmt.w, height: fmt.h, overflow: "hidden", boxSizing: "border-box",
        padding: isV ? 64 : 52, background: EXPORT_BG }}>
      <DeckOverlay />
      <div style={{ position: "relative", zIndex: 1, width: "100%", height: "100%" }}>
        {slide.kind === "feature" && <FeatureExport f={slide.feature} sz={sz} isV={isV} fmt={fmt} />}
        {slide.kind === "intro"   && <IntroExport sz={sz} />}
        {slide.kind === "problem" && <ProblemExport sz={sz} isV={isV} />}
        {slide.kind === "trust"   && <TrustExport sz={sz} isV={isV} />}
        {slide.kind === "cta"     && <CtaExport sz={sz} />}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   Slide builders
   ───────────────────────────────────────────────────────────────────────── */
function buildSlides(): React.ReactNode[] {
  const slides: React.ReactNode[] = [];

  // 1 — Intro
  slides.push(
    <div key="intro" className="flex flex-col items-center text-center gap-7">
      <img
        src="/assets/agro-syria-logo.svg" alt="أغرو-سيريا" draggable={false}
        className="w-56 sm:w-72 md:w-80 h-auto drop-shadow-[0_10px_34px_oklch(0.696_0.170_162/_0.30)]"
      />
      <h1 className="text-3xl sm:text-5xl md:text-6xl font-black text-foreground leading-tight tracking-tight max-w-4xl">
        أرضُك تستحقّ قراراً أذكى — و<span className="text-emerald-gradient">الذكاء الاصطناعي</span> الآن في يد كلّ مزارعٍ سوري.
      </h1>
      <p className="text-lg sm:text-2xl text-muted-foreground font-arabic leading-relaxed max-w-3xl">
        منصّة ذكية <span className="text-foreground/90 font-bold">بصناعة وخبرات سورية وطنية مخلصة</span> —
        يبنيها شباب سوريا في الداخل والمهجر، بإيمانٍ راسخ بأنّ أرضنا تستحقّ أحدث ما وصل إليه العالم.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-2.5">
        {["زراعة ذكية", "وكلاء متعدّدون", "بخبرات سورية وطنية"].map((t, i) => (
          <span key={t} className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 border border-emerald-500/22 px-5 py-2 text-base sm:text-lg font-bold text-emerald-300 font-arabic">
            {t}
            {i === 2 && (
              <img
                src="/assets/syria-flag.svg" alt="علم سوريا" draggable={false}
                className="w-7 h-[18.6px] rounded-[2px] object-cover ring-1 ring-white/20 shadow-sm flex-shrink-0"
              />
            )}
          </span>
        ))}
      </div>
    </div>,
  );

  // 2 — Problem & Solution
  slides.push(
    <div key="problem" className="flex flex-col gap-6">
      <div className="text-center">
        <Kicker icon={Sparkles} text="التحدّي والحل" />
        <h2 className="mt-3 text-3xl sm:text-5xl font-black text-foreground tracking-tight leading-tight">من التخمين والقلق... إلى قرارٍ تطمئنّ إليه</h2>
      </div>
      <div className="grid md:grid-cols-2 gap-5">
        <div className="glass-card rounded-3xl p-7 space-y-5">
          <div className="flex items-center gap-2.5">
            <div className="w-11 h-11 rounded-xl bg-red-500/12 border border-red-500/25 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-red-400" />
            </div>
            <h3 className="text-2xl font-black text-foreground">الواقع اليوم</h3>
          </div>
          <ul className="space-y-4">
            {["بياناتٌ مبعثرة بين الورق والذاكرة، وقرارٌ مبنيٌّ على التخمين.", "الطقس يباغتك، والآفة تنتشر قبل أن تنتبه.", "أحدث الأبحاث بعيدةٌ عنك، والخبرة تصل متأخّرة."].map(t => (
              <li key={t} className="flex items-start gap-3">
                <span className="mt-2.5 w-2 h-2 rounded-full bg-red-400 flex-shrink-0" />
                <span className="text-lg sm:text-xl text-foreground/85 leading-relaxed font-arabic">{t}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="glass-card rounded-3xl p-7 space-y-5 emerald-glow-sm">
          <div className="flex items-center gap-2.5">
            <div className="w-11 h-11 rounded-xl bg-emerald-500/12 border border-emerald-500/25 flex items-center justify-center">
              <Bot className="w-5 h-5 text-emerald-400" />
            </div>
            <h3 className="text-2xl font-black text-foreground">حلّنا السوري الذكي</h3>
          </div>
          <ul className="space-y-4">
            {["كلّ بياناتك موحّدةٌ ومحلّلة في مكانٍ واحد، فوراً.", "إنذارٌ مبكر يسبق الطقس والآفة بخطوة.", "توصيةٌ عملية بلغتك، مستندةٌ إلى مراجع موثوقة."].map(t => (
              <li key={t} className="flex items-start gap-3">
                <span className="mt-2.5 w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0" />
                <span className="text-lg sm:text-xl text-foreground/90 leading-relaxed font-arabic">{t}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>,
  );

  // 3..N — Feature deep-dives: single large static frame
  FEATURES.forEach((f) => {
    const Icon = f.icon;
    slides.push(
      <div key={`feat-${f.id}`} className="feat-slide grid lg:grid-cols-[1fr_2fr] gap-6 lg:gap-10 items-start">
        <div className="feat-text order-2 lg:order-1 space-y-5">
          <Kicker icon={Icon} text={f.kicker} />
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-foreground leading-tight tracking-tight">{f.title}</h2>
          <p className="text-xl sm:text-2xl text-emerald-300/90 font-arabic leading-relaxed font-bold">{f.tagline}</p>
          <div className="pt-1"><Highlights points={f.points} /></div>
        </div>
        <div className="feat-media order-1 lg:order-2 flex flex-col">
          <div style={{ minHeight: "320px" }}>
            <MacWindow url={f.url} image={f.image} caption={f.caption} />
          </div>
        </div>
      </div>,
    );
  });

  // N+1 — Trust & reliability (value-driven, no jargon)
  slides.push(
    <div key="trust" className="flex flex-col gap-7">
      <div className="text-center">
        <Kicker icon={ShieldCheck} text="أمان وموثوقية" />
        <h2 className="mt-3 text-3xl sm:text-5xl font-black text-foreground leading-tight tracking-tight max-w-4xl mx-auto">
          بياناتك محميّة... وخدمتك <span className="text-emerald-gradient">لا تتوقّف</span>
        </h2>
        <p className="mt-3 text-lg sm:text-xl text-muted-foreground font-arabic leading-relaxed max-w-2xl mx-auto">
          بنينا أغرو-سوريا على أساسٍ من الثقة — لأنّ المزارع يستحقّ أداةً يعتمد عليها كل يوم.
        </p>
      </div>
      <div className="grid sm:grid-cols-3 gap-5">
        {TRUST.map(({ icon: Icon, title, desc }) => (
          <div key={title} className="glass-card rounded-3xl p-7 flex flex-col items-center text-center gap-3.5 emerald-glow-sm">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/12 border border-emerald-500/25 flex items-center justify-center">
              <Icon className="w-7 h-7 text-emerald-400" />
            </div>
            <h3 className="text-xl font-black text-foreground">{title}</h3>
            <p className="text-lg text-foreground/80 font-arabic leading-relaxed">{desc}</p>
          </div>
        ))}
      </div>
    </div>,
  );

  // Final — Grand finale: production URL showcase
  slides.push(
    <div key="cta" className="relative flex flex-col items-center text-center gap-7 glass-card rounded-[2rem] p-8 sm:p-14 overflow-hidden emerald-glow">
      <div className="absolute inset-0 bg-forest-mesh opacity-50 pointer-events-none" />
      <div className="relative flex flex-col items-center gap-7 w-full">
        <img src="/assets/agro-syria-mark.svg" alt="أغرو-سيريا" draggable={false} className="h-14 w-auto" />
        <h2 className="text-3xl sm:text-5xl md:text-6xl font-black text-foreground leading-tight tracking-tight max-w-4xl">
          انضمّ إلى <span className="text-emerald-gradient">ثورة الزراعة الذكية</span>
        </h2>
        <p className="text-lg sm:text-2xl text-muted-foreground font-arabic leading-relaxed max-w-2xl">
          منصّة سورية وطنية، قابلة للتوسّع، تخدم كل مزارع — جرّبها الآن مباشرةً على الإنترنت.
        </p>

        <div className="relative">
          <motion.div
            aria-hidden
            className="absolute inset-0 rounded-2xl bg-emerald-500/40 blur-2xl print:hidden"
            animate={{ opacity: [0.35, 0.7, 0.35], scale: [0.95, 1.06, 0.95] }}
            transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.a
            href={`https://${PROD_URL}`} target="_blank" rel="noopener noreferrer"
            className="relative inline-flex items-center gap-3 rounded-2xl bg-emerald-500 text-emerald-950 px-7 sm:px-9 py-4 sm:py-5 font-black text-lg sm:text-2xl font-numeric"
            whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.98 }}
            animate={{ boxShadow: [
              "0 0 0 0 rgba(16,185,129,0.45)",
              "0 0 44px 6px rgba(16,185,129,0.40)",
              "0 0 0 0 rgba(16,185,129,0.45)",
            ] }}
            transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
          >
            <Globe className="w-6 h-6" />
            {PROD_URL}
            <ExternalLink className="w-5 h-5 opacity-80" />
          </motion.a>
        </div>

        <div className="grid sm:grid-cols-3 gap-3 w-full max-w-2xl pt-1">
          {[
            { icon: Rocket,      t: "جاهزة للنشر السحابي" },
            { icon: ShieldCheck, t: "بخبرات سورية موثوقة" },
            { icon: Sprout,      t: "أثرٌ مستدام للأجيال" },
          ].map(({ icon: Icon, t }) => (
            <div key={t} className="rounded-2xl bg-white/[0.04] border border-white/[0.07] p-5 flex flex-col items-center gap-2.5">
              <Icon className="w-6 h-6 text-emerald-400" />
              <span className="text-base text-foreground/85 font-arabic leading-relaxed">{t}</span>
            </div>
          ))}
        </div>
      </div>
    </div>,
  );

  return slides;
}

/* ─────────────────────────────────────────────────────────────────────────
   Deck shell
   ───────────────────────────────────────────────────────────────────────── */
const variants = {
  enter: (d: number) => ({ opacity: 0, x: d > 0 ? 64 : -64 }),
  center: { opacity: 1, x: 0 },
  exit: (d: number) => ({ opacity: 0, x: d > 0 ? -64 : 64 }),
};

export default function MarketingSlidesPage() {
  const slides = useMemo(() => buildSlides(), []);
  const total = slides.length;
  const [[index, dir], setState] = useState<[number, number]>([0, 0]);
  const [format, setFormat] = useState<DeckFormat>("landscape");
  const [preview, setPreview] = useState<ImageFormat | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [vp, setVp] = useState({ w: 1280, h: 800 });
  const stageRef = useRef<HTMLDivElement>(null);

  // Track the viewport so the preview can be scaled to fit any screen.
  useEffect(() => {
    const update = () => setVp({ w: window.innerWidth, h: window.innerHeight });
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const openPreview = useCallback((fmt: ImageFormat) => setPreview(fmt), []);

  // Capture the live preview node (already on-screen at full size) → download PNG.
  const runCapture = useCallback(async () => {
    const fmt = preview;
    const stage = stageRef.current;
    if (!fmt || !stage || busy) return;
    setBusy(true);
    try {
      await new Promise<void>(r => requestAnimationFrame(() => requestAnimationFrame(() => r())));
      // Wait for screenshots + fonts to load (prevents a blank export).
      const imgs = Array.from(stage.querySelectorAll("img"));
      await Promise.all(imgs.map(img =>
        img.complete ? img.decode().catch(() => {}) : new Promise<void>(r => { img.onload = () => r(); img.onerror = () => r(); })
      ));
      await document.fonts.ready;
      // Resolve oklch() → rgb so the foreignObject never rasterizes blank.
      flattenColorsForCapture(stage);
      await new Promise<void>(r => requestAnimationFrame(() => r()));
      const opts = { pixelRatio: 2, cacheBust: true, width: fmt.w, height: fmt.h };
      await toPng(stage, opts);                  // prime pass — discarded
      const dataUrl = await toPng(stage, opts);  // real capture
      const link = document.createElement("a");
      link.download = `agro-syria-slide-${index + 1}-${fmt.id}.png`;
      link.href = dataUrl;
      link.click();
      setToast("تم حفظ الصورة ✓");
      window.setTimeout(() => setToast(null), 2600);
    } catch (err) {
      console.error("تعذّر إنشاء صورة الشريحة:", err);
      setToast("تعذّر الحفظ — حاول مجدداً");
      window.setTimeout(() => setToast(null), 2600);
    } finally {
      setBusy(false);
    }
  }, [preview, busy, index]);

  const go = useCallback((d: number) => {
    setState(([i]) => [Math.min(Math.max(i + d, 0), total - 1), d]);
  }, [total]);

  const jump = useCallback((target: number) => {
    setState(([i]) => [target, target > i ? 1 : -1]);
  }, []);

  // Keyboard navigation (RTL: Left = next, Right = previous)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" || e.key === " ") { e.preventDefault(); go(1); }
      else if (e.key === "ArrowRight") { e.preventDefault(); go(-1); }
      else if (e.key === "Home") jump(0);
      else if (e.key === "End") jump(total - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, jump, total]);

  return (
    <div dir="rtl" className={cn("marketing-deck relative flex flex-col h-[100dvh] w-full overflow-hidden bg-forest-mesh", `fmt-${format}`)}>
      {/* Top utility control bar */}
      <header className="deck-ui flex items-center justify-between gap-3 px-4 sm:px-6 py-3 flex-shrink-0 z-20 border-b border-white/[0.06] bg-background/40 backdrop-blur-md print:hidden">
        <div className="flex items-center gap-2">
          <img src="/assets/agro-syria-mark.svg" alt="أغرو-سيريا" className="h-7 w-auto" draggable={false} />
          <span className="text-xs text-muted-foreground/70 font-arabic hidden sm:inline">عرض تقديمي تسويقي</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-muted-foreground/60 font-numeric tabular-nums hidden md:inline">
            {index + 1} / {total}
          </span>

          {/* Export-format selector — sets the PDF page size per social platform */}
          <div className="flex items-center gap-0.5 rounded-xl glass-card p-0.5" title="صيغة تصدير PDF">
            {FORMATS.map(({ id, label, Icon }) => (
              <button
                key={id} onClick={() => setFormat(id)} title={label} aria-label={label}
                aria-pressed={format === id}
                className={cn("flex items-center justify-center w-7 h-7 rounded-lg transition-colors",
                  format === id ? "bg-emerald-500/20 text-emerald-300" : "text-muted-foreground hover:text-foreground")}
              >
                <Icon className="w-4 h-4" />
              </button>
            ))}
          </div>

          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500 text-emerald-950 px-3 sm:px-4 py-2 text-xs sm:text-sm font-bold font-arabic hover:bg-emerald-400 transition-colors emerald-glow-sm"
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">📄 تصدير العرض كـ PDF</span>
            <span className="sm:hidden">PDF</span>
          </button>
          <div className="rounded-xl glass-card overflow-hidden">
            <ThemeToggle collapsed />
          </div>
        </div>
      </header>

      {/* Stage (screen only) */}
      <main className="deck-ui relative flex-1 min-h-0 flex items-center justify-center overflow-y-auto overflow-x-hidden px-4 sm:px-8 py-4 print:hidden">
        {/* Decorative golden neural/root overlay (behind the slide content) */}
        <DeckOverlay />
        {/* Per-slide image export overlay */}
        <div className="absolute top-3 end-3 z-30 print:hidden">
          <ImageExportMenu onExport={openPreview} busy={busy} />
        </div>
        <AnimatePresence mode="wait" custom={dir}>
          <motion.section
            key={index} custom={dir} variants={variants}
            initial="enter" animate="center" exit="exit"
            transition={{ duration: 0.4, ease: EASE }}
            className="relative z-10 w-full max-w-6xl mx-auto"
          >
            {slides[index]}
          </motion.section>
        </AnimatePresence>
      </main>

      {/* Controls (screen only) */}
      <footer className="deck-ui flex items-center justify-center gap-4 px-4 py-4 flex-shrink-0 z-10 print:hidden">
        <button
          onClick={() => go(-1)} disabled={index === 0} aria-label="السابق"
          className={cn("w-10 h-10 rounded-xl glass-card flex items-center justify-center transition-all",
            index === 0 ? "opacity-30 cursor-not-allowed" : "hover:bg-emerald-500/[0.12] hover:text-emerald-400")}
        >
          <ChevronRight className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-1.5">
          {slides.map((_, i) => (
            <button
              key={i} onClick={() => jump(i)} aria-label={`الشريحة ${i + 1}`}
              className={cn("rounded-full transition-all duration-300",
                i === index ? "w-6 h-2 bg-emerald-400" : "w-2 h-2 bg-foreground/20 hover:bg-foreground/40")}
            />
          ))}
        </div>
        <button
          onClick={() => go(1)} disabled={index === total - 1} aria-label="التالي"
          className={cn("w-10 h-10 rounded-xl glass-card flex items-center justify-center transition-all",
            index === total - 1 ? "opacity-30 cursor-not-allowed" : "hover:bg-emerald-500/[0.12] hover:text-emerald-400")}
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
      </footer>

      {/* Exit to app (screen only) */}
      <a href="/dashboard"
        className="deck-ui absolute bottom-4 start-4 z-10 inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] text-muted-foreground/60 hover:text-foreground glass-card transition-colors font-arabic print:hidden">
        <ArrowLeft className="w-3.5 h-3.5" /> العودة للمنصّة
      </a>

      {/* Print-only: every slide as its own full-bleed landscape page */}
      <div className="deck-print hidden print:block">
        {slides.map((node, i) => (
          <section key={i} className="deck-print-page bg-forest-mesh" dir="rtl">
            <div className="w-full max-w-6xl mx-auto">{node}</div>
          </section>
        ))}
      </div>

      {/* Non-blocking toast (e.g. auto font-shrink notice) */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.2 }} dir="rtl"
            className="deck-ui fixed bottom-20 left-1/2 -translate-x-1/2 z-50 print:hidden rounded-xl glass-card border border-emerald-500/25 px-4 py-2.5 text-sm font-arabic text-emerald-200 shadow-2xl"
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Preview-before-download modal — the previewed node IS what gets captured */}
      <AnimatePresence>
        {preview && (() => {
          const s = Math.min((vp.w * 0.92) / preview.w, (vp.h * 0.60) / preview.h, 1);
          return (
            <motion.div
              className="deck-ui fixed inset-0 z-[80] flex items-center justify-center p-4 print:hidden"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} dir="rtl"
            >
              <button aria-label="إغلاق" className="absolute inset-0 bg-black/70 backdrop-blur-sm"
                onClick={() => { if (!busy) setPreview(null); }} />
              <motion.div
                initial={{ scale: 0.96, y: 16 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, y: 16 }}
                transition={{ duration: 0.24, ease: EASE }}
                className="relative z-10 w-full max-w-[min(96vw,1180px)] max-h-[94dvh] overflow-y-auto glass-card rounded-3xl border border-emerald-500/20 p-4 sm:p-6"
              >
                {/* Header */}
                <div className="flex items-center justify-between gap-3 mb-3">
                  <div className="min-w-0">
                    <h3 className="text-base sm:text-lg font-black text-foreground font-arabic truncate">معاينة قبل الحفظ — {preview.label}</h3>
                    <p className="text-[11px] text-muted-foreground font-numeric" dir="ltr">شريحة {index + 1} · {preview.w} × {preview.h}px</p>
                  </div>
                  <button onClick={() => { if (!busy) setPreview(null); }} aria-label="إغلاق"
                    className="w-9 h-9 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.08] flex items-center justify-center flex-shrink-0">
                    <ArrowLeft className="w-4 h-4 text-muted-foreground -rotate-90" />
                  </button>
                </div>

                {/* Live preview — scaled wrapper; inner node is full-size & captured */}
                <div className="mx-auto rounded-xl overflow-hidden ring-1 ring-white/10" style={{ width: preview.w * s, height: preview.h * s }}>
                  <div style={{ width: preview.w, height: preview.h, transform: `scale(${s})`, transformOrigin: "top left" }}>
                    <ExportComposition slide={EXPORT_SLIDES[index]} fmt={preview} nodeRef={stageRef} />
                  </div>
                </div>

                {/* Platform switcher */}
                <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                  {IMAGE_FORMATS.map(f => {
                    const I = f.Icon;
                    const active = f.id === preview.id;
                    return (
                      <button key={f.id} onClick={() => { if (!busy) setPreview(f); }}
                        className={cn("inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-bold font-arabic transition-colors",
                          active ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300" : "border-white/10 text-muted-foreground hover:text-foreground")}>
                        <I className="w-3.5 h-3.5" />{f.label}
                      </button>
                    );
                  })}
                </div>

                {/* Actions */}
                <div className="mt-4 flex items-center justify-center gap-2.5">
                  <button onClick={runCapture} disabled={busy}
                    className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 text-emerald-950 hover:bg-emerald-400 px-6 py-3 text-sm font-black font-arabic transition-colors emerald-glow-sm disabled:opacity-60">
                    {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageDown className="w-4 h-4" />}
                    {busy ? "جارٍ الحفظ…" : "تحميل الصورة"}
                  </button>
                  <button onClick={() => { if (!busy) setPreview(null); }}
                    className="rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.1] px-5 py-3 text-sm font-semibold text-muted-foreground font-arabic transition-colors">
                    إغلاق
                  </button>
                </div>
              </motion.div>
            </motion.div>
          );
        })()}
      </AnimatePresence>
    </div>
  );
}
