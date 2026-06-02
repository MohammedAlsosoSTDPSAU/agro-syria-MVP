"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  User, Globe, Bell, Shield, ChevronDown,
  Check, LogOut, Trash2, Save,
} from "lucide-react";
import { WorkspaceLayout } from "@/components/workspace/WorkspaceLayout";

type Bezier = [number, number, number, number];
const EASE: Bezier = [0.22, 1, 0.36, 1];

const sectionV = {
  hidden: { opacity: 0, y: 18 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.42, ease: EASE } },
};
const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1, delayChildren: 0.08 } },
};

// ── Data ───────────────────────────────────────────────────────────────────
const PROVINCES = [
  "دمشق", "ريف دمشق", "حلب", "حمص", "حماة", "اللاذقية",
  "طرطوس", "إدلب", "دير الزور", "الرقة", "الحسكة",
  "السويداء", "درعا", "القنيطرة",
];
const CROPS_LIST = [
  "القمح", "القطن", "الزيتون", "الطماطم", "الشعير",
  "العدس", "الفستق الحلبي", "الحمضيات", "العنب", "المشمش",
];

// ── Toggle Switch ──────────────────────────────────────────────────────────
function Toggle({ enabled, onChange }: { enabled: boolean; onChange: () => void }) {
  return (
    <button
      onClick={onChange}
      role="switch"
      aria-checked={enabled}
      className={`relative w-11 h-6 rounded-full transition-colors duration-200 flex-shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 ${enabled ? "bg-emerald-500" : "bg-white/15"}`}
    >
      <motion.span
        className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm"
        animate={{ x: enabled ? 20 : 0 }}
        transition={{ type: "spring", stiffness: 500, damping: 32 }}
      />
    </button>
  );
}

// ── Select ─────────────────────────────────────────────────────────────────
function Select({
  value, onChange, options,
}: { value: string; onChange: (v: string) => void; options: string[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center justify-between gap-2 w-full bg-white/[0.04] border border-white/[0.08] hover:border-emerald-500/30 rounded-xl px-3 py-2.5 text-sm text-foreground transition-colors focus:outline-none"
        dir="rtl"
      >
        <span className="font-arabic">{value}</span>
        <ChevronDown className={`w-4 h-4 text-muted-foreground flex-shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.15, ease: EASE }}
            className="absolute top-full mt-1 end-0 z-20 w-full glass-card rounded-xl border border-white/[0.08] py-1 max-h-52 overflow-y-auto shadow-xl"
            dir="rtl"
          >
            {options.map(opt => (
              <button
                key={opt}
                onClick={() => { onChange(opt); setOpen(false); }}
                className={`w-full text-start px-3 py-2 text-sm font-arabic flex items-center justify-between transition-colors ${value === opt ? "text-emerald-400 bg-emerald-500/10" : "text-muted-foreground hover:text-foreground hover:bg-white/[0.04]"}`}
              >
                {opt}
                {value === opt && <Check className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Section wrapper ────────────────────────────────────────────────────────
function Section({
  icon: Icon, title, subtitle, children,
}: { icon: React.ElementType; title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <motion.div variants={sectionV} className="glass-card rounded-2xl overflow-hidden" dir="rtl">
      <div className="flex items-center gap-3 px-5 py-4 border-b border-emerald-500/10">
        <div className="w-8 h-8 rounded-lg bg-emerald-500/12 border border-emerald-500/25 flex items-center justify-center flex-shrink-0">
          <Icon className="w-4 h-4 text-emerald-400" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-foreground font-arabic">{title}</h3>
          {subtitle && <p className="text-[10px] text-muted-foreground font-arabic">{subtitle}</p>}
        </div>
      </div>
      <div className="p-5 space-y-4">{children}</div>
    </motion.div>
  );
}

// ── Field Row ──────────────────────────────────────────────────────────────
function FieldRow({ label, description, children }: { label: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 flex-wrap" dir="rtl">
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-semibold text-foreground font-arabic">{label}</p>
        {description && <p className="text-[11px] text-muted-foreground mt-0.5 font-arabic leading-relaxed">{description}</p>}
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  );
}

// ── Radio group ────────────────────────────────────────────────────────────
function RadioGroup<T extends string>({
  options, value, onChange,
}: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="flex gap-1.5 flex-wrap" dir="rtl">
      {options.map(opt => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`px-3 py-1.5 rounded-lg text-[12px] font-semibold border transition-all font-arabic ${value === opt.value ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300" : "bg-white/[0.04] border-white/[0.08] text-muted-foreground hover:text-foreground hover:border-white/15"}`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

// ── Save Toast ─────────────────────────────────────────────────────────────
function SaveToast({ show }: { show: boolean }) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          transition={{ duration: 0.25, ease: EASE }}
          className="fixed bottom-6 start-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-emerald-500/25 border border-emerald-500/40 backdrop-blur-md shadow-xl"
          dir="rtl"
        >
          <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          <span className="text-sm font-semibold text-emerald-300 font-arabic">تم حفظ الإعدادات بنجاح</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────
function SettingsContent() {
  const [name, setName]               = useState("أحمد المحمود");
  const [province, setProvince]       = useState("حلب");
  const [primaryCrop, setPrimaryCrop] = useState("القمح");

  const [language, setLanguage]       = useState<"ar" | "en">("ar");
  const [units, setUnits]             = useState<"metric" | "imperial">("metric");
  const [theme, setTheme]             = useState<"dark" | "light" | "system">("dark");
  const [tempUnit, setTempUnit]       = useState<"celsius" | "fahrenheit">("celsius");

  const [notifs, setNotifs] = useState({
    weather:   true,
    market:    true,
    ai:        true,
    community: false,
    pestAlert: true,
  });

  const [saved, setSaved] = useState(false);

  const handleSave = useCallback(() => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }, []);

  const toggleNotif = (key: keyof typeof notifs) =>
    setNotifs(n => ({ ...n, [key]: !n[key] }));

  return (
    <div className="flex-1 overflow-y-auto overflow-x-hidden" dir="rtl">
      <div className="p-6 max-w-3xl mx-auto w-full">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
          className="mb-6 flex items-start justify-between gap-4 flex-wrap"
        >
          <div>
            <h2 className="text-2xl font-bold text-foreground font-arabic">الإعدادات</h2>
            <p className="text-sm text-muted-foreground mt-0.5 font-arabic">إدارة ملفك الشخصي وتفضيلاتك وإشعاراتك</p>
          </div>
          <button
            onClick={handleSave}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 text-emerald-400 text-sm font-semibold font-arabic transition-all"
          >
            <Save className="w-4 h-4" />
            حفظ التغييرات
          </button>
        </motion.div>

        <motion.div variants={stagger} initial="hidden" animate="visible" className="space-y-5">

          {/* ── Profile ── */}
          <Section icon={User} title="الملف الشخصي" subtitle="بياناتك الزراعية الأساسية">
            <div className="flex items-center gap-4 pb-4 border-b border-white/[0.05]">
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-xl font-bold text-emerald-400 flex-shrink-0">
                {name[0] ?? "م"}
              </div>
              <div>
                <p className="text-sm font-bold text-foreground font-arabic">{name}</p>
                <p className="text-[11px] text-muted-foreground font-arabic">{province} · {primaryCrop}</p>
                <p className="text-[10px] text-emerald-400/60 mt-0.5">مزارع محترف · عضو منذ 2024</p>
              </div>
            </div>

            <FieldRow label="الاسم الكامل">
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                className="bg-white/[0.04] border border-white/[0.08] hover:border-emerald-500/30 focus:border-emerald-500/50 rounded-xl px-3 py-2.5 text-sm text-foreground w-56 focus:outline-none transition-colors font-arabic"
                dir="rtl"
              />
            </FieldRow>

            <FieldRow label="المحافظة" description="يُستخدم لتخصيص بيانات الطقس والسوق">
              <div className="w-44">
                <Select value={province} onChange={setProvince} options={PROVINCES} />
              </div>
            </FieldRow>

            <FieldRow label="المحصول الرئيسي" description="يُستخدم لتخصيص التوصيات الزراعية">
              <div className="w-44">
                <Select value={primaryCrop} onChange={setPrimaryCrop} options={CROPS_LIST} />
              </div>
            </FieldRow>
          </Section>

          {/* ── Preferences ── */}
          <Section icon={Globe} title="التفضيلات" subtitle="لغة العرض والوحدات والمظهر">

            <FieldRow label="اللغة" description="لغة واجهة المستخدم">
              <RadioGroup
                value={language}
                onChange={setLanguage}
                options={[{ value: "ar", label: "العربية" }, { value: "en", label: "English" }]}
              />
            </FieldRow>

            <div className="border-t border-white/[0.04]" />

            <FieldRow label="وحدات القياس">
              <RadioGroup
                value={units}
                onChange={setUnits}
                options={[{ value: "metric", label: "متري (كغ، م)" }, { value: "imperial", label: "إمبريالي (lb, ft)" }]}
              />
            </FieldRow>

            <div className="border-t border-white/[0.04]" />

            <FieldRow label="وحدة درجة الحرارة">
              <RadioGroup
                value={tempUnit}
                onChange={setTempUnit}
                options={[{ value: "celsius", label: "سيلزيوس (°م)" }, { value: "fahrenheit", label: "فهرنهايت (°F)" }]}
              />
            </FieldRow>

            <div className="border-t border-white/[0.04]" />

            <FieldRow label="مظهر التطبيق">
              <RadioGroup
                value={theme}
                onChange={setTheme}
                options={[
                  { value: "dark",   label: "داكن" },
                  { value: "light",  label: "فاتح" },
                  { value: "system", label: "تلقائي" },
                ]}
              />
            </FieldRow>
          </Section>

          {/* ── Notifications ── */}
          <Section icon={Bell} title="الإشعارات" subtitle="تحكم في التنبيهات التي تصلك">
            {[
              {
                key: "weather" as const,
                label: "تنبيهات الطقس",
                desc: "موجات الحر والصقيع والأمطار التي تؤثر على محاصيلك",
              },
              {
                key: "market" as const,
                label: "تغيرات أسعار السوق",
                desc: "إشعار فوري عند تغير سعر محاصيلك أكثر من 5%",
              },
              {
                key: "ai" as const,
                label: "توصيات الذكاء الاصطناعي",
                desc: "توصيات الري والتسميد المخصصة لحقولك",
              },
              {
                key: "pestAlert" as const,
                label: "تحذيرات الآفات والأمراض",
                desc: "إنذارات مبكرة للآفات الزراعية في منطقتك",
              },
              {
                key: "community" as const,
                label: "ردود مجتمع المزارعين",
                desc: "إشعار عند رد أحد المزارعين أو الخبراء على أسئلتك",
              },
            ].map(({ key, label, desc }, i) => (
              <div key={key}>
                {i > 0 && <div className="border-t border-white/[0.04]" />}
                <FieldRow label={label} description={desc}>
                  <Toggle enabled={notifs[key]} onChange={() => toggleNotif(key)} />
                </FieldRow>
              </div>
            ))}
          </Section>

          {/* ── Account / Danger zone ── */}
          <Section icon={Shield} title="الحساب والأمان" subtitle="إجراءات الحساب الرئيسية">
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/[0.05]">
                <div dir="rtl">
                  <p className="text-[13px] font-semibold text-foreground font-arabic">تغيير كلمة المرور</p>
                  <p className="text-[11px] text-muted-foreground font-arabic">آخر تغيير منذ 30 يوماً</p>
                </div>
                <button className="px-3 py-1.5 rounded-lg text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 transition-all font-arabic">
                  تغيير
                </button>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-amber-500/5 border border-amber-500/15">
                <div dir="rtl">
                  <p className="text-[13px] font-semibold text-amber-300 font-arabic">تسجيل الخروج</p>
                  <p className="text-[11px] text-muted-foreground font-arabic">ستحتاج إلى تسجيل الدخول مجدداً</p>
                </div>
                <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 transition-all font-arabic">
                  <LogOut className="w-3.5 h-3.5" /> خروج
                </button>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-red-500/5 border border-red-500/15">
                <div dir="rtl">
                  <p className="text-[13px] font-semibold text-red-400 font-arabic">حذف بيانات الحقول</p>
                  <p className="text-[11px] text-muted-foreground font-arabic">لا يمكن التراجع عن هذا الإجراء</p>
                </div>
                <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold text-red-400 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 transition-all font-arabic">
                  <Trash2 className="w-3.5 h-3.5" /> حذف
                </button>
              </div>
            </div>
          </Section>

          <motion.p
            variants={sectionV}
            className="text-center text-[10px] text-muted-foreground/40 pb-2 font-arabic"
          >
            أغرو-سيريا v1.0.0 · © 2026 · جميع الحقوق محفوظة
          </motion.p>
        </motion.div>
      </div>

      <SaveToast show={saved} />
    </div>
  );
}

export default function SettingsPage() {
  return (
    <WorkspaceLayout activeView="settings">
      <SettingsContent />
    </WorkspaceLayout>
  );
}
