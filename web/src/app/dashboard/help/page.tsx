"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, ChevronDown, Map, TrendingUp, Bot,
  CloudSun, MessageCircle, BookOpen, LifeBuoy,
  Mail, ExternalLink, Play, CheckCircle,
} from "lucide-react";
import { WorkspaceLayout } from "@/components/workspace/WorkspaceLayout";
import Link from "next/link";

type Bezier = [number, number, number, number];
const EASE: Bezier = [0.22, 1, 0.36, 1];

const cardV = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.42, ease: EASE } },
};
const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.09, delayChildren: 0.06 } },
};

// ── Data ───────────────────────────────────────────────────────────────────
interface FAQ {
  id: number;
  q: string;
  a: string;
  category: string;
}

const FAQS: FAQ[] = [
  {
    id: 1, category: "حقول",
    q: "كيف أضيف حقلاً جديداً على الخريطة؟",
    a: "انتقل إلى صفحة 'حقولي' من القائمة الجانبية، ثم انقر على زر 'إضافة حقل' في أعلى الصفحة. ستظهر واجهة رسم الحدود — انقر على الخريطة لإضافة نقاط الحدود حتى تكتمل الشكل، ثم أكمل معلومات المحصول ونوع التربة وانقر 'حفظ الحقل'.",
  },
  {
    id: 2, category: "سوق",
    q: "هل بيانات أسعار السوق محدّثة فعلاً؟",
    a: "نعم، يتم تحديث الأسعار كل 10 دقائق من مصادر وزارة الزراعة السورية ومؤشرات الحبوب العالمية. يمكنك رؤية وقت آخر تحديث في رأس صفحة السوق، مع إمكانية التحديث اليدوي في أي وقت بالنقر على زر التحديث.",
  },
  {
    id: 3, category: "ذكاء اصطناعي",
    q: "ما مدى دقة توصيات المساعد الزراعي الذكي؟",
    a: "يعتمد المساعد على نماذج لغوية متخصصة بالزراعة السورية مدعومة ببيانات موسمية ومناخية محلية. الدقة مرتفعة للمحاصيل الرئيسية كالقمح والقطن والزيتون. ننصح دائماً باستشارة مهندس زراعي محلي للقرارات الكبيرة.",
  },
  {
    id: 4, category: "طقس",
    q: "هل بيانات الطقس مخصصة لمنطقتي تحديداً؟",
    a: "تعتمد بيانات الطقس على أقرب محطة قياس للمنطقة التي اخترتها في إعداداتك. لتحسين الدقة، تأكد من تحديد محافظتك بشكل صحيح في الإعدادات. خطط مستقبلية تشمل ربط بمحطات قياس محلية إضافية.",
  },
  {
    id: 5, category: "حقول",
    q: "كيف أتابع مرحلة نمو محصولي بدقة؟",
    a: "في صفحة 'حقولي'، يظهر شريط التقدم لكل حقل بناءً على تاريخ الزراعة الذي أدخلته والمعدلات المتوقعة للمحصول. يمكنك تحديث المرحلة يدوياً بالنقر على الحقل وتعديل النسبة المئوية للنمو.",
  },
  {
    id: 6, category: "مجتمع",
    q: "كيف أشارك في مجتمع المزارعين؟",
    a: "انتقل إلى صفحة 'المجتمع' من القائمة الجانبية. يمكنك طرح سؤالك بالنقر على 'اطرح سؤالاً'، استعراض إعلانات السوق، أو الرد على أسئلة مزارعين آخرين. الوكيل الذكي يرد على كل سؤال خلال دقائق.",
  },
  {
    id: 7, category: "سوق",
    q: "كيف أفهم مؤشر الطلب في موسوعة المحاصيل؟",
    a: "مؤشر الطلب (1-100٪) يعكس نسبة الطلب على المحصول في السوق السورية والإقليمية مقارنة بالعرض. مؤشر فوق 70٪ يعني طلب مرتفع وفرصة تسويق جيدة. يتم تحديثه شهرياً بناءً على بيانات التجارة.",
  },
  {
    id: 8, category: "تقني",
    q: "كيف أستخدم التطبيق بدون اتصال إنترنت؟",
    a: "أغرو-سيريا تطبيق PWA يدعم العمل دون اتصال جزئياً. بيانات الحقول والخريطة وآخر أسعار السوق تُحفظ تلقائياً للاستخدام في حالة انقطاع الإنترنت. لتفعيل الوضع غير المتصل، أضف التطبيق إلى الشاشة الرئيسية من متصفح Safari أو Chrome.",
  },
];

const FAQ_CATEGORIES = ["الكل", "حقول", "سوق", "طقس", "ذكاء اصطناعي", "مجتمع", "تقني"];

interface Tutorial {
  id: number;
  title: string;
  description: string;
  steps: string[];
  icon: React.ElementType;
  color: string;
  link: string;
}

const TUTORIALS: Tutorial[] = [
  {
    id: 1,
    title: "كيفية رسم حقلك على الخريطة",
    description: "تعلّم كيف تضيف حقلك الزراعي وتتابع مراحل نموه",
    icon: Map,
    color: "emerald",
    link: "/fields",
    steps: [
      "افتح صفحة 'حقولي' من القائمة الجانبية",
      "انقر على 'إضافة حقل' وارسم الحدود على الخريطة",
      "أدخل معلومات المحصول ونوع التربة ثم احفظ",
    ],
  },
  {
    id: 2,
    title: "قراءة وتحليل بيانات السوق",
    description: "افهم أسعار المحاصيل والمؤشرات الزراعية الاستراتيجية",
    icon: TrendingUp,
    color: "amber",
    link: "/dashboard/market",
    steps: [
      "افتح 'لوحة السوق' واختر المحافظة من المحدد",
      "تصفّح شريط الأسعار وانقر على محصول للتفاصيل",
      "استخدم زر 'وضع المستثمر' لتحليل أعمق",
      "راقب مؤشر الاتجاه والتغيير الشهري للمحصول",
    ],
  },
  {
    id: 3,
    title: "استخدام المساعد الزراعي الذكي",
    description: "كيف تحصل على توصيات زراعية دقيقة ومخصصة",
    icon: Bot,
    color: "sky",
    link: "/dashboard",
    steps: [
      "انقر على 'المساعد الزراعي' في القائمة الجانبية",
      "اكتب سؤالك بالعربية العامية أو الفصحى",
      "أرسل صورة إن أردت تشخيص مرض أو آفة",
    ],
  },
  {
    id: 4,
    title: "تفسير بيانات الطقس الزراعي",
    description: "اقرأ مؤشرات ET والصقيع وسلامة رش المبيدات",
    icon: CloudSun,
    color: "purple",
    link: "/weather",
    steps: [
      "افتح 'الطقس' واختر مدينتك من القائمة",
      "راجع مؤشر التبخر-النتح (ET) لتحديد كمية الري",
      "تحقق من 'آمن للرش' قبل استخدام المبيدات",
    ],
  },
];

const COLOR_MAP: Record<string, { bg: string; border: string; text: string; icon: string }> = {
  emerald: { bg: "bg-emerald-500/10", border: "border-emerald-500/25", text: "text-emerald-400", icon: "bg-emerald-500/15 border-emerald-500/30" },
  amber:   { bg: "bg-amber-500/10",   border: "border-amber-500/25",   text: "text-amber-400",   icon: "bg-amber-500/15 border-amber-500/30"   },
  sky:     { bg: "bg-sky-500/10",     border: "border-sky-500/25",     text: "text-sky-400",     icon: "bg-sky-500/15 border-sky-500/30"       },
  purple:  { bg: "bg-purple-500/10",  border: "border-purple-500/25",  text: "text-purple-400",  icon: "bg-purple-500/15 border-purple-500/30"  },
};

// ── FAQ Accordion Item ─────────────────────────────────────────────────────
function FAQItem({ faq }: { faq: FAQ }) {
  const [open, setOpen] = useState(false);

  return (
    <motion.div variants={cardV} className="glass-card rounded-2xl overflow-hidden" dir="rtl">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between gap-4 px-5 py-4 text-start hover:bg-white/[0.02] transition-colors"
      >
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <span className={`mt-0.5 text-[9px] font-bold rounded-full px-2 py-0.5 flex-shrink-0 ${faq.category === "حقول" ? "bg-emerald-500/15 text-emerald-400" : faq.category === "سوق" ? "bg-amber-500/15 text-amber-400" : faq.category === "ذكاء اصطناعي" ? "bg-sky-500/15 text-sky-400" : faq.category === "طقس" ? "bg-purple-500/15 text-purple-400" : faq.category === "مجتمع" ? "bg-pink-500/15 text-pink-400" : "bg-white/10 text-muted-foreground"}`}>
            {faq.category}
          </span>
          <span className="text-[13px] font-semibold text-foreground font-arabic leading-relaxed">{faq.q}</span>
        </div>
        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.25, ease: EASE }}
          className="flex-shrink-0"
        >
          <ChevronDown className="w-4 h-4 text-muted-foreground/60" />
        </motion.span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: EASE }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-4 pt-0 border-t border-white/[0.04]">
              <p className="text-[12px] text-muted-foreground leading-relaxed mt-3 font-arabic">{faq.a}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── Tutorial Card ──────────────────────────────────────────────────────────
function TutorialCard({ t }: { t: Tutorial }) {
  const [expanded, setExpanded] = useState(false);
  const c = COLOR_MAP[t.color];
  const Icon = t.icon;

  return (
    <motion.div
      variants={cardV}
      className={`glass-card rounded-2xl overflow-hidden border ${c.border} cursor-pointer`}
      whileHover={{ y: -2, transition: { duration: 0.2 } }}
      dir="rtl"
    >
      {/* Header */}
      <div className={`px-4 py-3 flex items-start gap-3 ${c.bg}`} onClick={() => setExpanded(v => !v)}>
        <div className={`w-9 h-9 rounded-xl border flex items-center justify-center flex-shrink-0 ${c.icon}`}>
          <Icon className={`w-4.5 h-4.5 ${c.text}`} />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className={`text-[12px] font-bold font-arabic ${c.text}`}>{t.title}</h4>
          <p className="text-[10px] text-muted-foreground font-arabic leading-relaxed mt-0.5">{t.description}</p>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <span className={`text-[10px] font-semibold ${c.text}`}>{t.steps.length} خطوات</span>
          <motion.span animate={{ rotate: expanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
            <ChevronDown className={`w-3.5 h-3.5 ${c.text} opacity-70`} />
          </motion.span>
        </div>
      </div>

      {/* Steps */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: EASE }}
            className="overflow-hidden"
          >
            <div className="px-4 py-3 space-y-2">
              {t.steps.map((step, i) => (
                <div key={i} className="flex items-start gap-2.5">
                  <span className={`w-5 h-5 rounded-full border flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5 ${c.icon} ${c.text}`}>
                    {i + 1}
                  </span>
                  <p className="text-[12px] text-muted-foreground font-arabic leading-relaxed">{step}</p>
                </div>
              ))}
              <div className="pt-1">
                <Link
                  href={t.link}
                  className={`inline-flex items-center gap-1.5 text-[11px] font-semibold font-arabic ${c.text} hover:opacity-80 transition-opacity`}
                >
                  <Play className="w-3 h-3" />
                  ابدأ الآن
                  <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                </Link>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────
function HelpContent() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("الكل");
  const [showContactForm, setShowContactForm] = useState(false);
  const [contactMsg, setContactMsg] = useState("");
  const [contactSent, setContactSent] = useState(false);

  const filteredFAQs = useMemo(() =>
    FAQS.filter(f =>
      (category === "الكل" || f.category === category) &&
      (!search || f.q.includes(search) || f.a.includes(search))
    ), [category, search]);

  const handleSend = () => {
    setContactSent(true);
    setContactMsg("");
    setTimeout(() => setContactSent(false), 3000);
  };

  return (
    <div className="flex-1 overflow-y-auto overflow-x-hidden" dir="rtl">
      <div className="p-4 sm:p-6 max-w-4xl mx-auto w-full">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
          className="mb-6"
        >
          <h2 className="text-2xl font-bold text-foreground font-arabic">المساعدة والدعم</h2>
          <p className="text-sm text-muted-foreground mt-0.5 font-arabic">كل ما تحتاجه لاستخدام أغرو-سيريا بكفاءة</p>

          {/* Search */}
          <div className="relative mt-4">
            <Search className="absolute start-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="ابحث في الأسئلة والإرشادات..."
              className="w-full bg-white/[0.04] border border-white/[0.08] hover:border-emerald-500/25 focus:border-emerald-500/40 rounded-2xl ps-11 pe-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none transition-colors font-arabic"
              dir="rtl"
            />
          </div>
        </motion.div>

        {/* Tutorials */}
        {!search && (
          <motion.div
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="mb-8"
          >
            <div className="flex items-center gap-2 mb-4">
              <BookOpen className="w-4 h-4 text-emerald-400" />
              <h3 className="text-sm font-bold text-foreground font-arabic">دروس تعليمية سريعة</h3>
            </div>
            <motion.div variants={stagger} initial="hidden" animate="visible"
              className="grid grid-cols-1 sm:grid-cols-2 gap-3"
            >
              {TUTORIALS.map(t => <TutorialCard key={t.id} t={t} />)}
            </motion.div>
          </motion.div>
        )}

        {/* FAQ */}
        <motion.div
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className="mb-8"
        >
          <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <MessageCircle className="w-4 h-4 text-emerald-400" />
              <h3 className="text-sm font-bold text-foreground font-arabic">الأسئلة الشائعة</h3>
            </div>
            {/* Category filter */}
            <div className="flex gap-1.5 flex-wrap">
              {FAQ_CATEGORIES.map(cat => (
                <button
                  key={cat}
                  onClick={() => setCategory(cat)}
                  className={`px-2.5 py-1 rounded-full text-[10px] font-semibold border transition-all font-arabic ${category === cat ? "bg-emerald-500/20 border-emerald-500/35 text-emerald-300" : "bg-white/[0.03] border-white/[0.06] text-muted-foreground hover:text-foreground"}`}
                >{cat}</button>
              ))}
            </div>
          </div>

          <motion.div variants={stagger} initial="hidden" animate="visible" className="space-y-3">
            {filteredFAQs.length > 0
              ? filteredFAQs.map(f => <FAQItem key={f.id} faq={f} />)
              : (
                <motion.div
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  className="text-center py-14 glass-card rounded-2xl"
                >
                  <p className="text-sm font-semibold text-foreground font-arabic mb-1">لم يُعثر على نتائج</p>
                  <p className="text-[12px] text-muted-foreground font-arabic">جرّب كلمة بحث مختلفة أو تصفية أخرى</p>
                </motion.div>
              )
            }
          </motion.div>
        </motion.div>

        {/* Support section */}
        <motion.div
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
          className="space-y-4"
        >
          <div className="flex items-center gap-2 mb-4">
            <LifeBuoy className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-bold text-foreground font-arabic">تواصل مع الدعم</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* AI Support */}
            <Link href="/dashboard" className="glass-card rounded-2xl p-4 border border-sky-500/20 hover:border-sky-500/40 transition-all group">
              <div className="w-9 h-9 rounded-xl bg-sky-500/12 border border-sky-500/25 flex items-center justify-center mb-3">
                <Bot className="w-4.5 h-4.5 text-sky-400" />
              </div>
              <h4 className="text-[13px] font-bold text-sky-400 font-arabic mb-1">دعم الذكاء الاصطناعي</h4>
              <p className="text-[10px] text-muted-foreground font-arabic leading-relaxed">محادثة فورية مع المساعد الزراعي الذكي — إجابات في ثوانٍ</p>
              <div className="flex items-center gap-1 mt-3 text-sky-400/70 text-[10px] font-semibold font-arabic group-hover:text-sky-400 transition-colors">
                ابدأ المحادثة <ExternalLink className="w-3 h-3" />
              </div>
            </Link>

            {/* Email */}
            <div className="glass-card rounded-2xl p-4 border border-emerald-500/15">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/12 border border-emerald-500/25 flex items-center justify-center mb-3">
                <Mail className="w-4.5 h-4.5 text-emerald-400" />
              </div>
              <h4 className="text-[13px] font-bold text-emerald-400 font-arabic mb-1">البريد الإلكتروني</h4>
              <p className="text-[10px] text-muted-foreground font-arabic leading-relaxed mb-2">للاستفسارات التقنية والشراكات</p>
              <a
                href="mailto:support@agro-syria.com"
                className="text-[10px] text-emerald-400/70 font-semibold hover:text-emerald-400 transition-colors break-all"
                dir="ltr"
              >
                support@agro-syria.com
              </a>
            </div>

            {/* Community */}
            <Link href="/community" className="glass-card rounded-2xl p-4 border border-purple-500/15 hover:border-purple-500/30 transition-all group">
              <div className="w-9 h-9 rounded-xl bg-purple-500/12 border border-purple-500/25 flex items-center justify-center mb-3">
                <MessageCircle className="w-4.5 h-4.5 text-purple-400" />
              </div>
              <h4 className="text-[13px] font-bold text-purple-400 font-arabic mb-1">مجتمع المزارعين</h4>
              <p className="text-[10px] text-muted-foreground font-arabic leading-relaxed">اطرح سؤالك على مجتمع المزارعين السوريين والخبراء</p>
              <div className="flex items-center gap-1 mt-3 text-purple-400/70 text-[10px] font-semibold font-arabic group-hover:text-purple-400 transition-colors">
                اذهب للمجتمع <ExternalLink className="w-3 h-3" />
              </div>
            </Link>
          </div>

          {/* Contact form */}
          <div className="glass-card rounded-2xl p-5" dir="rtl">
            <h4 className="text-[13px] font-bold text-foreground font-arabic mb-3">أرسل رسالة مباشرة</h4>
            <div className="space-y-3">
              <textarea
                value={contactMsg}
                onChange={e => setContactMsg(e.target.value)}
                placeholder="اكتب استفساركَ أو ملاحظتك هنا — فريق الدعم يرد خلال 24 ساعة..."
                rows={3}
                className="w-full bg-white/[0.04] border border-white/[0.08] hover:border-emerald-500/25 focus:border-emerald-500/40 rounded-xl px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none transition-colors resize-none font-arabic"
                dir="rtl"
              />
              <div className="flex items-center gap-3">
                <button
                  onClick={handleSend}
                  disabled={!contactMsg.trim() || contactSent}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 text-emerald-400 text-[12px] font-semibold font-arabic transition-all disabled:opacity-40"
                >
                  {contactSent ? <><CheckCircle className="w-3.5 h-3.5" /> تم الإرسال!</> : "إرسال الرسالة"}
                </button>
                <span className="text-[10px] text-muted-foreground/50 font-arabic">سيتم الرد على بريدك الإلكتروني المسجل</span>
              </div>
            </div>
          </div>

          {/* Version note */}
          <p className="text-center text-[10px] text-muted-foreground/40 pb-2 font-arabic">
            أغرو-سيريا v1.0.0 · للحصول على أفضل تجربة استخدم Chrome أو Safari
          </p>
        </motion.div>

      </div>
    </div>
  );
}

export default function HelpPage() {
  return (
    <WorkspaceLayout activeView="help">
      <HelpContent />
    </WorkspaceLayout>
  );
}
