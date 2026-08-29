"use client";

import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Bot, Workflow, Server, ShieldCheck,
  Boxes, Cpu, Sparkles, HeartHandshake, ArrowLeft,
  LayoutGrid, LayoutDashboard, Map as MapIcon, CloudSun, Sprout,
  TrendingUp, Users, Newspaper, Settings, ChevronLeft,
} from "lucide-react";
import { WorkspaceLayout } from "@/components/workspace/WorkspaceLayout";
import { cn } from "@/lib/utils";

type Bezier = [number, number, number, number];
const EASE: Bezier = [0.22, 1, 0.36, 1];

const fadeUp = {
  hidden: { opacity: 0, y: 22 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { duration: 0.5, ease: EASE, delay: i * 0.08 },
  }),
};

const STACK = [
  { icon: Boxes,       name: "Next.js",   descAr: "واجهة فائقة السرعة بتقنية App Router" },
  { icon: Server,      name: "FastAPI",   descAr: "خادم Python غير متزامن عالي الأداء" },
  { icon: Workflow,    name: "LangGraph", descAr: "تنسيق الوكلاء المتعددين كرسم حالة" },
  { icon: ShieldCheck, name: "Pydantic",  descAr: "عقود بيانات صارمة بين الوكلاء" },
  { icon: Cpu,         name: "AI Agents", descAr: "وكلاء متخصّصون يعملون بالتوازي" },
];

const WORKSPACE_PAGES = [
  { icon: LayoutDashboard, name: "لوحة التحكم",   href: "/dashboard",         desc: "مركز القيادة: خريطة المخاطر، إحاطة ذكية، ومؤشر صحة المزرعة." },
  { icon: MapIcon,         name: "حقولي",          href: "/fields",            desc: "سجّل حقولك بإحداثيات دقيقة وتابع صحتها على الخريطة." },
  { icon: CloudSun,        name: "الطقس",          href: "/weather",           desc: "طقس لحظي لكل محافظة، توقّعات ٧ أيام، ومحرّك الري ET₀." },
  { icon: Bot,             name: "المساعد الذكي",  href: "/copilot",           desc: "محادثة زراعية ذكية بلهجتك — تشخيص أمراض المحاصيل من الصور قريباً." },
  { icon: Sprout,          name: "المحاصيل",       href: "/crops",             desc: "موسوعة المحاصيل السورية وحاسبة الإنتاجية الموسمية." },
  { icon: TrendingUp,      name: "لوحة السوق",     href: "/dashboard/market",  desc: "أسعار واتجاهات السوق وتوصية بأفضل وقت للبيع." },
  { icon: Users,           name: "المجتمع",        href: "/community",         desc: "تبادل الخبرات والتعاون مع آلاف المزارعين السوريين." },
  { icon: Newspaper,       name: "الأخبار",        href: "/news",              desc: "قرارات رسمية، تنبيهات عاجلة، وأسعار المدخلات (قريباً)." },
  { icon: Settings,        name: "الإعدادات",      href: "/dashboard/settings", desc: "ملفك الشخصي، الإشعارات، والمظهر والتفضيلات." },
];

const AGENTS = [
  { ar: "وكيل التواصل",     en: "Liaison",     desc: "يفهم لهجتك ويوجّه سؤالك" },
  { ar: "خبير الرؤية",      en: "Vision",      desc: "يحلّل صور المحاصيل والأمراض" },
  { ar: "عميل الحقل",       en: "Calculator",  desc: "يحسب الري والتسميد بدقّة" },
  { ar: "وكيل البحث",       en: "Research",    desc: "يستند للمراجع الزراعية السورية" },
  { ar: "المُجمِّع",         en: "Synthesizer", desc: "يصيغ ردّاً واضحاً بلهجتك" },
];

export default function AboutPage() {
  const router = useRouter();

  return (
    <WorkspaceLayout activeView="about" onNavigate={(id) => router.push(`/${id === "dashboard" ? "dashboard" : id}`)}>
      <div dir="rtl" className="mx-auto w-full max-w-5xl px-4 sm:px-6 py-8 sm:py-12 flex flex-col gap-8">

        {/* ── Hero ── */}
        <motion.section custom={0} variants={fadeUp} initial="hidden" animate="visible"
          className="glass-card rounded-3xl p-6 sm:p-10 text-center relative overflow-hidden">
          <div className="absolute inset-0 bg-forest-mesh opacity-40 pointer-events-none" />
          <div className="relative">
            {/* Brand logo — premium centred entry with a gentle floating pulse */}
            <motion.div
              initial={{ scale: 0.85, opacity: 0, y: 14 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: EASE }}
              className="relative mx-auto mb-6 w-fit"
            >
              <div className="absolute inset-0 -z-10 blur-3xl rounded-full bg-emerald-500/20" aria-hidden />
              <motion.img
                src="/assets/agro-syria-logo.svg"
                alt="شعار أغرو-سيريا"
                draggable={false}
                animate={{ scale: [1, 1.035, 1], y: [0, -5, 0] }}
                transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
                className="w-40 sm:w-52 md:w-64 lg:w-72 h-auto select-none drop-shadow-[0_10px_34px_oklch(0.696_0.170_162/_0.28)]"
              />
            </motion.div>
            <h1 className="text-2xl sm:text-4xl font-black text-foreground leading-tight">
              حول منصة <span className="text-emerald-gradient">أغرو-سيريا</span>
            </h1>
            <p className="mt-4 text-sm sm:text-base text-muted-foreground leading-relaxed max-w-2xl mx-auto font-arabic">
              مبادرة متواضعة من شاب سوري، هدفها رقمنة الزراعة السورية عبر منظومة ذكاء اصطناعي
              متعدّدة الوكلاء — تضع خبرة الأرض بين يدي كل مزارع، بلهجته وبما يخدم بيئته المحلية.
            </p>
            <div className="mt-6 inline-flex items-center gap-2 rounded-full bg-emerald-500/10 border border-emerald-500/22 px-4 py-2">
              <HeartHandshake className="w-4 h-4 text-emerald-400" />
              <span className="text-xs font-bold text-emerald-300 font-arabic">صُنع بحبّ من أجل المزارع السوري</span>
            </div>
          </div>
        </motion.section>

        {/* ── Vision ── */}
        <motion.section custom={1} variants={fadeUp} initial="hidden" animate="visible"
          className="glass-card rounded-3xl p-6 sm:p-8">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="w-5 h-5 text-emerald-400" />
            <h2 className="text-lg font-black text-foreground">الرؤية</h2>
          </div>
          <p className="text-sm text-foreground/85 leading-loose font-arabic">
            بدأت أغرو-سيريا من سؤال بسيط: كيف نعيد للأرض السورية عافيتها بأدوات هذا العصر؟
            الجواب كان بناء «فريق» من الوكلاء البرمجيين المتخصّصين، يعمل كلٌّ منهم في مجاله —
            من فهم سؤالك بلهجتك، إلى تحليل صورة المرض، وحساب احتياج الري، والعودة إلى المراجع
            الزراعية الموثوقة — ثم يجتمعون ليقدّموا لك نصيحة واحدة واضحة وعملية.
          </p>
        </motion.section>

        {/* ── Workspace services matrix — every page & what it does ── */}
        <motion.section custom={2} variants={fadeUp} initial="hidden" animate="visible">
          <div className="flex items-center gap-2 mb-4 px-1">
            <LayoutGrid className="w-5 h-5 text-emerald-400" />
            <h2 className="text-lg font-black text-foreground">خدمات المنصّة — كل صفحة وما تقدّمه لك</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {WORKSPACE_PAGES.map((p, i) => {
              const Icon = p.icon;
              return (
                <motion.button
                  key={p.name} onClick={() => router.push(p.href)}
                  custom={i} variants={fadeUp} initial="hidden" animate="visible"
                  className="glass-card rounded-2xl p-4 text-start flex items-start gap-3 border border-transparent hover:border-emerald-500/30 hover:emerald-glow-sm transition-all group"
                >
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center flex-shrink-0 group-hover:bg-emerald-500/18 transition-colors">
                    <Icon className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1">
                      <p className="text-sm font-bold text-foreground">{p.name}</p>
                      <ChevronLeft className="w-3.5 h-3.5 text-emerald-400/0 group-hover:text-emerald-400/70 transition-colors" />
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1 font-arabic leading-relaxed">{p.desc}</p>
                  </div>
                </motion.button>
              );
            })}
          </div>
        </motion.section>

        {/* ── The multi-agent team ── */}
        <motion.section custom={3} variants={fadeUp} initial="hidden" animate="visible">
          <div className="flex items-center gap-2 mb-4 px-1">
            <Bot className="w-5 h-5 text-emerald-400" />
            <h2 className="text-lg font-black text-foreground">فريق الوكلاء الذكي</h2>
            <span className="text-[10px] font-bold text-amber-300 bg-amber-500/10 border border-amber-500/25 rounded-full px-2.5 py-1">
              نظام متعدد الوكلاء — قيد التطوير النشط
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {AGENTS.map((a, i) => (
              <motion.div key={a.en} custom={i} variants={fadeUp} initial="hidden" animate="visible"
                className="glass-card rounded-2xl p-4 flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center flex-shrink-0">
                  <Bot className="w-4 h-4 text-emerald-400" />
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground">{a.ar}</p>
                  <p className="text-[10px] text-emerald-400/70 font-numeric">{a.en}</p>
                  <p className="text-[11px] text-muted-foreground mt-1 font-arabic leading-relaxed">{a.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.section>

        {/* ── Tech stack ── */}
        <motion.section custom={3} variants={fadeUp} initial="hidden" animate="visible">
          <div className="flex items-center gap-2 mb-4 px-1">
            <Cpu className="w-5 h-5 text-emerald-400" />
            <h2 className="text-lg font-black text-foreground">البنية التقنية</h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {STACK.map((s, i) => {
              const Icon = s.icon;
              return (
                <motion.div key={s.name} custom={i} variants={fadeUp} initial="hidden" animate="visible"
                  className="glass-card rounded-2xl p-4 flex flex-col gap-2 hover:emerald-glow-sm transition-shadow">
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                    <Icon className="w-4 h-4 text-emerald-400" />
                  </div>
                  <p className="text-sm font-bold text-foreground font-numeric">{s.name}</p>
                  <p className="text-[11px] text-muted-foreground font-arabic leading-relaxed">{s.descAr}</p>
                </motion.div>
              );
            })}
          </div>
        </motion.section>

        {/* ── Hybrid architecture & data protection ── */}
        <motion.section custom={4} variants={fadeUp} initial="hidden" animate="visible"
          className="glass-card rounded-3xl p-6 sm:p-8">
          <div className="flex items-center gap-2 mb-4">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            <h2 className="text-lg font-black text-foreground">بنية هجينة تحمي بياناتك</h2>
          </div>
          <ul className="space-y-3 text-sm text-foreground/85 font-arabic leading-relaxed">
            <li className="flex gap-2">
              <span className="text-emerald-400 mt-1">●</span>
              واجهة Next.js سريعة تتواصل مع خادم FastAPI عبر طبقة وسيطة، فتبقى مفاتيح الذكاء
              الاصطناعي على الخادم ولا تُكشف للمتصفّح.
            </li>
            <li className="flex gap-2">
              <span className="text-emerald-400 mt-1">●</span>
              عند تعذّر الاتصال بالخدمة السحابية، تُعلمك المنصّة بوضوح بدلاً من تقديم
              إجابة غير دقيقة.
            </li>
            <li className="flex gap-2">
              <span className="text-emerald-400 mt-1">●</span>
              عقود بيانات صارمة (Pydantic) تُنظّم تبادل المعلومات بين طبقات النظام.
            </li>
          </ul>
        </motion.section>

        {/* ── Back ── */}
        <motion.div custom={5} variants={fadeUp} initial="hidden" animate="visible" className="flex justify-center pb-4">
          <button onClick={() => router.push("/dashboard")}
            className={cn(
              "inline-flex items-center gap-2 rounded-xl px-5 py-2.5",
              "bg-emerald-500/12 border border-emerald-500/25 text-emerald-300",
              "hover:bg-emerald-500/20 transition-all duration-200 font-arabic text-sm font-bold",
            )}>
            <ArrowLeft className="w-4 h-4" />
            العودة إلى لوحة التحكم
          </button>
        </motion.div>
      </div>
    </WorkspaceLayout>
  );
}
