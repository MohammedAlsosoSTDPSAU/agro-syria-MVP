"use client";

/**
 * Hidden marketing slide-deck utility — /marketing-slides
 *
 * Standalone, immersive social-carousel deck (LinkedIn / X / Instagram).
 * Not linked in app navigation. Single premium 3D Discord-style frame per
 * feature bound to high-fidelity static screenshots under /public/marketing/,
 * native PDF export (print), and full Sun-Cycle light/dark sync.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft, ChevronRight, Camera, Sparkles, ArrowLeft,
  LayoutDashboard, CloudSun, Bot, Map as MapIcon, Sprout, TrendingUp,
  ShieldCheck, Rocket, AlertTriangle, Globe, Zap, Heart, ExternalLink,
  Download, Users, Newspaper,
} from "lucide-react";
import { ThemeToggle } from "@/components/ThemeController";
import { cn } from "@/lib/utils";

type Bezier = [number, number, number, number];
const EASE: Bezier = [0.22, 1, 0.36, 1];

const PROD_URL = "agro-syria.vercel.app";

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
      <div className="relative aspect-[16/10] overflow-hidden rounded-b-xl bg-slate-950/40">
        {!errored ? (
          <img
            src={image}
            alt={caption}
            loading="eager"
            onError={() => setErrored(true)}
            className="absolute inset-0 w-full h-full object-cover object-top rounded-b-xl"
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
    <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 border border-emerald-500/22 px-3.5 py-1.5">
      <Icon className="w-3.5 h-3.5 text-emerald-400" />
      <span className="text-[11px] font-bold text-emerald-300 font-arabic">{text}</span>
    </div>
  );
}

/* Clean numbered highlights — no connector lines */
function Highlights({ points }: { points: string[] }) {
  return (
    <ul className="space-y-3">
      {points.map((p, i) => (
        <li key={i} className="flex items-start gap-3">
          <span className="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[11px] font-black flex items-center justify-center font-numeric">
            {i + 1}
          </span>
          <span className="text-sm sm:text-base text-foreground/85 leading-relaxed font-arabic pt-0.5">{p}</span>
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
    tagline: "نظرة واحدة... وقرار واثق يصنع الفرق.",
    url: `${PROD_URL}/dashboard`, image: "/marketing/dashboard.png",
    caption: "📸 [مكان لقطة الشاشة: لوحة التحكم مع خريطة المخاطر الجغرافية التفاعلية]",
    points: [
      "خريطة مخاطر جغرافية دقيقة بحدود المحافظات السورية الحقيقية",
      "ملخّص لحظي من وكيل المناخ ومؤشر صحة المزرعة",
      "إنذارات الطقس المتطرف وإجراءات سريعة بنقرة واحدة",
    ],
  },
  {
    id: "weather", icon: CloudSun, kicker: "مُعاد بناؤه من الجذور", title: "طقسٌ ذكيّ يحمي موسمك قبل أن يبدأ الخطر",
    tagline: "دقّة على مستوى كل محافظة... وثقة في كل قرار ريّ.",
    url: `${PROD_URL}/weather`, image: "/marketing/weather.png",
    caption: "📸 [مكان لقطة الشاشة: صفحة الطقس المتجاوبة الجديدة]",
    points: [
      "مؤشرات حرارة ورياح وأمطار مثبّتة على مركز كل محافظة بدقّة",
      "توقّعات ٧ أيام ومحرّك التبخّر-نتح (ET₀) لجدولة ريّ أذكى",
      "إنذارات الصقيع وموجات الحر والجفاف بألوان واضحة فوراً",
    ],
  },
  {
    id: "copilot", icon: Bot, kicker: "تجربة غامرة", title: "مساعدٌ ذكيّ يفهمك بلهجتك ويقف إلى جانبك",
    tagline: "اسأل، أرسل صورة محصولك... ودع الخبرة تأتي إليك.",
    url: `${PROD_URL}/copilot`, image: "/marketing/copilot.png",
    caption: "📸 [مكان لقطة الشاشة: مساحة المحادثة متعددة الوكلاء]",
    points: [
      "محادثة باللهجة السورية مع فريق وكلاء متخصّص يعمل معاً",
      "تحليل بصري لأمراض النبات من صورة واحدة فقط",
      "توصيات عملية مدعومة بالمراجع الزراعية الموثوقة",
    ],
  },
  {
    id: "fields", icon: MapIcon, kicker: "سجلّ جغرافي", title: "كل حقلٍ له صوته... وبياناته الخاصة",
    tagline: "نظّم أرضك رقمياً، وتابعها كأنّك تقف فوقها.",
    url: `${PROD_URL}/fields`, image: "/marketing/fields.png",
    caption: "📸 [مكان لقطة الشاشة: خريطة الحقول ونظام GIS]",
    points: [
      "تسجيل الحقول وربطها بالمحاصيل والمساحات بسهولة",
      "متابعة كل حقل ببياناته المناخية الدقيقة",
      "رؤية مكانية شاملة تجمع كامل أراضيك في مكان واحد",
    ],
  },
  {
    id: "crops", icon: Sprout, kicker: "معرفة موثوقة", title: "موسوعة المحاصيل السورية في جيبك",
    tagline: "علمٌ زراعيّ سوريّ موثوق... متاح لكل مزارع.",
    url: `${PROD_URL}/crops`, image: "/marketing/crops.png",
    caption: "📸 [مكان لقطة الشاشة: وحدة المحاصيل وحاسبة الإنتاجية]",
    points: [
      "بيانات ١١ محصولاً سورياً وفق مرجعية GCSAR",
      "إرشادات موسمية وحاسبة إنتاجية تفاعلية",
      "مزامنة سياق المحصول عبر كامل المنصّة",
    ],
  },
  {
    id: "market", icon: TrendingUp, kicker: "ذكاء الأسواق", title: "بِع في الوقت المناسب... وبالسعر الذي تستحقّه",
    tagline: "السوق بين يديك، والقرار الرابح لك.",
    url: `${PROD_URL}/dashboard/market`, image: "/marketing/market.png",
    caption: "📸 [مكان لقطة الشاشة: تحليلات السوق واتجاهات الأسعار]",
    points: [
      "أسعار المحاصيل واتجاهاتها الأسبوعية لحظةً بلحظة",
      "مقارنة إنتاجية المحافظات السورية",
      "توصية ذكية بأفضل نافذة للبيع تحمي دخلك",
    ],
  },
  {
    id: "community", icon: Users, kicker: "مجتمع مزارعي أغرو-سوريا", title: "نبض الأرض.. مجتمع يجمعنا",
    tagline: "تبادل الخبرات، واجه التحديات، وشارك نجاحك مع آلاف المزارعين السوريين في منصة تفاعلية واحدة.",
    url: `${PROD_URL}/community`, image: "/marketing/community.png",
    caption: "📸 [مكان لقطة الشاشة: مجتمع المزارعين التفاعلي]",
    points: [
      "تواصل مباشر: طرح الأسئلة والحصول على إجابات من خبراء ومزارعين محليين",
      "مشاركة التجارب: تبادل النصائح حول مكافحة الآفات وتحسين جودة المواسم السورية",
      "تعاون وطني: بناء علاقات تجارية وتكامل زراعي بين جميع المحافظات",
    ],
  },
  {
    id: "news", icon: Newspaper, kicker: "الأخبار والقرارات · قريباً", title: "أخبار ومواسم الزراعة.. لحظة بلحظة (قريباً)",
    tagline: "ابق على اطلاع دائم بآخر القرارات الحكومية، أسعار السماد والوقود، والتحذيرات المناخية العاجلة.",
    url: `${PROD_URL}/news`, image: "/marketing/news.png",
    caption: "📸 [مكان لقطة الشاشة: لوحة الأخبار والقرارات الزراعية]",
    points: [
      "قرارات رسمية: رصد مباشر لقرارات وزارة الزراعة والجهات المعنية فور صدورها",
      "تنبيهات عاجلة: إشعارات استباقية بالصقيع، الرياح الشديدة، أو مواسم انتشار الأوبئة",
      "أسعار المدخلات: تحديثات يومية وموثوقة لأسعار السوق المحلية لضمان تخطيط اقتصادي سليم",
    ],
  },
];

const TRUST = [
  { icon: ShieldCheck, title: "خصوصيتك أولاً", desc: "بياناتك تُعالَج بأمان ولا تُكشف — أنت صاحب القرار دائماً." },
  { icon: Zap,         title: "لا تتوقّف أبداً", desc: "تعمل بثبات حتى عند انقطاع الخدمات الخارجية، فلا تُترك وحدك." },
  { icon: Heart,       title: "دقّة تستحقّ الثقة", desc: "كل توصية تمرّ بفحص جودة دقيق قبل أن تصل إليك." },
];

/* ─────────────────────────────────────────────────────────────────────────
   Slide builders
   ───────────────────────────────────────────────────────────────────────── */
function buildSlides(): React.ReactNode[] {
  const slides: React.ReactNode[] = [];

  // 1 — Intro
  slides.push(
    <div key="intro" className="flex flex-col items-center text-center gap-6">
      <img
        src="/assets/agro-syria-logo.svg" alt="أغرو-سيريا" draggable={false}
        className="w-48 sm:w-64 md:w-72 h-auto drop-shadow-[0_10px_34px_oklch(0.696_0.170_162/_0.30)]"
      />
      <h1 className="text-2xl sm:text-4xl md:text-5xl font-black text-foreground leading-snug max-w-3xl">
        أغرو-سوريا: ثورة <span className="text-emerald-gradient">الذكاء الاصطناعي</span> مكرّسة لخدمة المزارع والمستقبل
      </h1>
      <p className="text-sm sm:text-lg text-muted-foreground font-arabic leading-relaxed max-w-2xl">
        منصّة ذكية <span className="text-foreground/90 font-bold">بصناعة وخبرات سورية وطنية مخلصة</span> —
        يبنيها شباب سوريا في الداخل والمهجر، بإيمانٍ راسخ بأنّ أرضنا تستحقّ أحدث ما وصل إليه العالم.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-2">
        {["زراعة ذكية", "وكلاء متعدّدون", "بخبرات سورية وطنية 🇸🇾"].map(t => (
          <span key={t} className="rounded-full bg-emerald-500/10 border border-emerald-500/22 px-4 py-1.5 text-xs font-bold text-emerald-300 font-arabic">{t}</span>
        ))}
      </div>
    </div>,
  );

  // 2 — Problem & Solution
  slides.push(
    <div key="problem" className="flex flex-col gap-6">
      <div className="text-center">
        <Kicker icon={Sparkles} text="التحدّي والحل" />
        <h2 className="mt-3 text-2xl sm:text-4xl font-black text-foreground">من فوضى البيانات... إلى قرارٍ يصنع الفرق</h2>
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        <div className="glass-card rounded-3xl p-6 space-y-4">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-red-500/12 border border-red-500/25 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4 text-red-400" />
            </div>
            <h3 className="text-lg font-black text-foreground">الواقع اليوم</h3>
          </div>
          <ul className="space-y-3">
            {["بيانات زراعية مبعثرة وغير موثوقة", "مخاطر مناخية متصاعدة دون إنذار مبكر", "فجوة معرفية بين المزارع وأحدث الأبحاث"].map(t => (
              <li key={t} className="flex items-start gap-2.5">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0" />
                <span className="text-sm sm:text-base text-foreground/80 leading-relaxed font-arabic">{t}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="glass-card rounded-3xl p-6 space-y-4 emerald-glow-sm">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/12 border border-emerald-500/25 flex items-center justify-center">
              <Bot className="w-4 h-4 text-emerald-400" />
            </div>
            <h3 className="text-lg font-black text-foreground">حلّنا السوري الذكي</h3>
          </div>
          <ul className="space-y-3">
            {["منظومة وكلاء ذكية توحّد البيانات وتحلّلها فوراً", "إنذارات استباقية للطقس والآفات قبل وقوع الضرر", "توصيات عملية بلهجة المزارع ومستندة للمراجع"].map(t => (
              <li key={t} className="flex items-start gap-2.5">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
                <span className="text-sm sm:text-base text-foreground/85 leading-relaxed font-arabic">{t}</span>
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
      <div key={`feat-${f.id}`} className="grid lg:grid-cols-[1fr_1.35fr] gap-6 lg:gap-12 items-center">
        <div className="order-2 lg:order-1 space-y-4">
          <Kicker icon={Icon} text={f.kicker} />
          <h2 className="text-xl sm:text-3xl font-black text-foreground leading-tight">{f.title}</h2>
          <p className="text-base sm:text-lg text-emerald-300/90 font-arabic leading-relaxed">{f.tagline}</p>
          <div className="pt-1"><Highlights points={f.points} /></div>
        </div>
        <div className="order-1 lg:order-2">
          <MacWindow url={f.url} image={f.image} caption={f.caption} />
        </div>
      </div>,
    );
  });

  // N+1 — Trust & reliability (value-driven, no jargon)
  slides.push(
    <div key="trust" className="flex flex-col gap-7">
      <div className="text-center">
        <Kicker icon={ShieldCheck} text="أمان وموثوقية" />
        <h2 className="mt-3 text-2xl sm:text-4xl font-black text-foreground leading-snug max-w-3xl mx-auto">
          بياناتك محميّة... وخدمتك <span className="text-emerald-gradient">لا تتوقّف</span>
        </h2>
        <p className="mt-3 text-sm sm:text-base text-muted-foreground font-arabic leading-relaxed max-w-2xl mx-auto">
          بنينا أغرو-سوريا على أساسٍ من الثقة — لأنّ المزارع يستحقّ أداةً يعتمد عليها كل يوم.
        </p>
      </div>
      <div className="grid sm:grid-cols-3 gap-4">
        {TRUST.map(({ icon: Icon, title, desc }) => (
          <div key={title} className="glass-card rounded-3xl p-6 flex flex-col items-center text-center gap-3 emerald-glow-sm">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/12 border border-emerald-500/25 flex items-center justify-center">
              <Icon className="w-6 h-6 text-emerald-400" />
            </div>
            <h3 className="text-base font-black text-foreground">{title}</h3>
            <p className="text-sm text-foreground/75 font-arabic leading-relaxed">{desc}</p>
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
        <img src="/assets/agro-syria-mark.svg" alt="أغرو-سيريا" draggable={false} className="h-12 w-auto" />
        <h2 className="text-2xl sm:text-4xl md:text-5xl font-black text-foreground leading-snug max-w-3xl">
          انضمّ إلى <span className="text-emerald-gradient">ثورة الزراعة الذكية</span>
        </h2>
        <p className="text-sm sm:text-lg text-muted-foreground font-arabic leading-relaxed max-w-2xl">
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
            <div key={t} className="rounded-2xl bg-white/[0.04] border border-white/[0.07] p-4 flex flex-col items-center gap-2">
              <Icon className="w-5 h-5 text-emerald-400" />
              <span className="text-xs text-foreground/85 font-arabic leading-relaxed">{t}</span>
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
    <div dir="rtl" className="marketing-deck relative flex flex-col h-[100dvh] w-full overflow-hidden bg-forest-mesh">
      {/* Top utility control bar */}
      <header className="deck-ui flex items-center justify-between gap-3 px-4 sm:px-6 py-3 flex-shrink-0 z-20 border-b border-white/[0.06] bg-background/40 backdrop-blur-md print:hidden">
        <div className="flex items-center gap-2">
          <img src="/assets/agro-syria-mark.svg" alt="أغرو-سيريا" className="h-7 w-auto" draggable={false} />
          <span className="text-xs text-muted-foreground/70 font-arabic hidden sm:inline">عرض تقديمي تسويقي</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-muted-foreground/60 font-numeric tabular-nums hidden sm:inline">
            {index + 1} / {total}
          </span>
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
        <AnimatePresence mode="wait" custom={dir}>
          <motion.section
            key={index} custom={dir} variants={variants}
            initial="enter" animate="center" exit="exit"
            transition={{ duration: 0.4, ease: EASE }}
            className="w-full max-w-6xl mx-auto"
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
    </div>
  );
}
