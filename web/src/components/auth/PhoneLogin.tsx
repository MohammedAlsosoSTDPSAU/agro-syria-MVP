"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Phone, ArrowLeft, Loader2, Leaf, Zap, FlaskConical } from "lucide-react";
import { cn } from "@/lib/utils";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabaseClient";

/* ─── Animation variants ─────────────────────────────────────────── */
type Bezier = [number, number, number, number];
const EASE_OUT: Bezier = [0.22, 1, 0.36, 1];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.12, delayChildren: 0.2 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: EASE_OUT },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 40, scale: 0.96 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.65, ease: EASE_OUT },
  },
};

/* ─── Country code selector ──────────────────────────────────────── */
const COUNTRY_CODE = "+963"; // Syria

/* ─── Floating leaf particle ─────────────────────────────────────── */
interface FloatingLeafProps {
  style: React.CSSProperties;
  delay: number;
}

function FloatingLeaf({ style, delay }: FloatingLeafProps) {
  return (
    <motion.div
      className="absolute pointer-events-none opacity-20"
      style={style}
      initial={{ opacity: 0, y: 0, rotate: 0 }}
      animate={{
        opacity: [0, 0.2, 0.15, 0],
        y: [-10, -80, -120],
        rotate: [0, 30, -20, 45],
      }}
      transition={{
        duration: 8 + Math.random() * 4,
        delay,
        repeat: Infinity,
        ease: "easeInOut",
      }}
    >
      <Leaf className="w-5 h-5 text-emerald-400" />
    </motion.div>
  );
}

const LEAVES = [
  { style: { left: "10%", bottom: "20%" }, delay: 0 },
  { style: { left: "80%", bottom: "15%" }, delay: 2.5 },
  { style: { left: "25%", bottom: "10%" }, delay: 5 },
  { style: { left: "65%", bottom: "30%" }, delay: 1.2 },
  { style: { left: "45%", bottom: "5%" },  delay: 3.8 },
];

/* ─── Main component ─────────────────────────────────────────────── */
export function PhoneLogin() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isDemoLoading, setIsDemoLoading] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const isValid = phone.replace(/\D/g, "").length >= 9;
  const isCodeValid = code.replace(/\D/g, "").length >= 4;

  /** Normalize to E.164 (e.g. +9639XXXXXXXX) for Supabase phone auth. */
  function toE164(): string {
    const digits = phone.replace(/\D/g, "").replace(/^0+/, "");
    return `${COUNTRY_CODE}${digits}`;
  }

  function handlePhoneChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value.replace(/[^\d\s\-()]/g, "");
    setPhone(raw);
    setError("");
  }

  // ── STEP 1 · request the SMS OTP ──────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid || isLoading) return;
    setIsLoading(true);
    setError("");

    const sb = getSupabase();
    if (isSupabaseConfigured && sb) {
      // Real Supabase phone OTP dispatch.
      const { error: otpError } = await sb.auth.signInWithOtp({ phone: toE164() });
      setIsLoading(false);
      if (otpError) { setError("تعذّر إرسال رمز التحقق — حاول مرة أخرى"); return; }
      setSubmitted(true);
    } else {
      // Demo fallback (no Supabase env): simulate dispatch, keep the UX flowing.
      await new Promise((r) => setTimeout(r, 1800));
      setIsLoading(false);
      setSubmitted(true);
    }
  }

  // ── STEP 2 · verify the OTP and open a session ────────────────────────
  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    if (!isCodeValid || isVerifying) return;
    setIsVerifying(true);
    setError("");

    const sb = getSupabase();
    if (isSupabaseConfigured && sb) {
      const { error: verifyError } = await sb.auth.verifyOtp({
        phone: toE164(),
        token: code.replace(/\D/g, ""),
        type: "sms",
      });
      setIsVerifying(false);
      if (verifyError) { setError("رمز غير صحيح أو منتهي — أعد المحاولة"); return; }
      router.push("/dashboard"); // session cookie is now set
    } else {
      // Demo fallback: accept any code.
      await new Promise((r) => setTimeout(r, 700));
      setIsVerifying(false);
      router.push("/dashboard");
    }
  }

  function handleChangeNumber() {
    setSubmitted(false);
    setCode("");
    setError("");
  }

  async function handleDemoAccess() {
    if (isDemoLoading) return;
    setIsDemoLoading(true);
    // Brief pause for the transition animation to register
    await new Promise((r) => setTimeout(r, 600));
    router.push("/dashboard");
  }

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center overflow-hidden bg-forest-mesh">

      {/* Background radial glow */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 60% 55% at 50% 50%, oklch(0.696 0.170 162 / 7%), transparent 70%)",
        }}
      />

      {/* Floating leaves */}
      {LEAVES.map((leaf, i) => (
        <FloatingLeaf key={i} style={leaf.style as React.CSSProperties} delay={leaf.delay} />
      ))}

      {/* Card */}
      <motion.div
        variants={cardVariants}
        initial="hidden"
        animate="visible"
        className={cn(
          "relative w-full max-w-sm mx-4",
          "glass-card emerald-glow rounded-2xl p-6 sm:p-8",
        )}
      >
        {/* Top emerald line */}
        <div className="absolute inset-x-0 top-0 h-[1px] rounded-t-2xl bg-gradient-to-r from-transparent via-emerald-400/60 to-transparent" />

        {/* Demo Mode badge — top-left corner */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.9, duration: 0.35, ease: EASE_OUT }}
          className={cn(
            "absolute top-3 left-3",
            "flex items-center gap-1 px-2 py-1 rounded-lg",
            "bg-amber-400/8 border border-amber-400/25",
            "backdrop-blur-sm"
          )}
        >
          <FlaskConical className="w-3 h-3 text-amber-400" />
          <span className="text-[10px] font-semibold text-amber-400/90 tracking-wide">
            تجريبي
          </span>
        </motion.div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="flex flex-col items-center"
        >
          {/* Logo hero — full brand mark (includes wordmark), subtle fade-in via itemVariants */}
          <motion.img
            variants={itemVariants}
            src="/assets/agro-syria-logo.svg"
            alt="أغرو-سوريا — منصة الزراعة الذكية"
            width={220}
            height={245}
            draggable={false}
            className="w-[180px] sm:w-[220px] max-w-full h-auto select-none mb-3"
          />

          <motion.p
            variants={itemVariants}
            className="text-[11px] text-muted-foreground mb-6 tracking-wide"
          >
            منصة الزراعة الذكية
          </motion.p>

          {/* Welcome message */}
          <AnimatePresence mode="wait">
            {!submitted ? (
              <motion.div
                key="welcome"
                variants={itemVariants}
                className="text-center mb-8"
              >
                <p className="text-foreground/90 text-base font-medium leading-relaxed">
                  أهلاً بك بأغرو-سيريا..
                </p>
                <p className="text-foreground/75 text-sm leading-relaxed mt-1 font-light">
                  أرضك تستأهل كل خير،
                  <br />
                  خلينا نبدأ.
                </p>
                <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-emerald-500/10 border border-emerald-500/22 px-3.5 py-1.5">
                  <Zap className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-[11px] text-emerald-300/90 font-arabic">
                    وكلاؤنا البرمجيون جاهزون لتحليل أرضك
                  </span>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="sent"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center mb-8"
              >
                <div className="w-12 h-12 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mx-auto mb-3">
                  <Phone className="w-5 h-5 text-emerald-400" />
                </div>
                <p className="text-foreground/90 text-sm font-medium">
                  تم إرسال رمز التحقق
                </p>
                <p className="text-muted-foreground text-xs mt-1">
                  {COUNTRY_CODE} {phone}
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Form */}
          <AnimatePresence>
            {!submitted && (
              <motion.form
                onSubmit={handleSubmit}
                variants={itemVariants}
                className="w-full space-y-4"
              >
                {/* Phone input */}
                <div className="relative">
                  <label className="block text-xs text-muted-foreground mb-1.5 font-medium">
                    رقم الهاتف
                  </label>

                  <div
                    className={cn(
                      "flex items-center rounded-xl border transition-all duration-300 overflow-hidden",
                      isFocused
                        ? "border-emerald-500/60 ring-2 ring-emerald-500/20"
                        : "border-emerald-500/20",
                      "bg-white/[0.04]"
                    )}
                  >
                    {/* Country code badge */}
                    <div className="flex items-center gap-1.5 px-3 py-3 border-l border-emerald-500/20 bg-emerald-500/5 flex-shrink-0">
                      <span className="text-lg leading-none">🇸🇾</span>
                      <span className="text-sm font-mono text-emerald-400 font-medium">
                        {COUNTRY_CODE}
                      </span>
                    </div>

                    {/* Number input — always LTR for digits */}
                    <input
                      type="tel"
                      dir="ltr"
                      inputMode="tel"
                      placeholder="9XX XXX XXX"
                      value={phone}
                      onChange={handlePhoneChange}
                      onFocus={() => setIsFocused(true)}
                      onBlur={() => setIsFocused(false)}
                      className={cn(
                        "flex-1 bg-transparent px-3 py-3 text-sm text-foreground",
                        "placeholder:text-muted-foreground/50 font-mono tracking-wider",
                        "outline-none border-none focus:ring-0",
                        "text-start"
                      )}
                      maxLength={15}
                      autoComplete="tel"
                    />

                    {/* Valid indicator */}
                    <AnimatePresence>
                      {isValid && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.5 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.5 }}
                          className="px-3"
                        >
                          <div className="w-2 h-2 rounded-full bg-emerald-400" />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>

                {/* Submit button */}
                <motion.button
                  type="submit"
                  disabled={!isValid || isLoading}
                  whileHover={isValid && !isLoading ? { scale: 1.1 } : {}}
                  whileTap={isValid && !isLoading ? { scale: 0.98 } : {}}
                  className={cn(
                    "w-full flex items-center justify-center gap-2 py-3 px-6",
                    "rounded-xl font-semibold text-sm transition-all duration-300",
                    isValid && !isLoading
                      ? [
                          "bg-emerald-500 text-forest hover:bg-emerald-400",
                          "shadow-[0_0_20px_oklch(0.696_0.170_162/_30%)]",
                          "hover:shadow-[0_0_30px_oklch(0.696_0.170_162/_45%)]",
                        ]
                      : "bg-emerald-500/20 text-emerald-500/40 cursor-not-allowed"
                  )}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>جارٍ الإرسال...</span>
                    </>
                  ) : (
                    <>
                      <span>تابع</span>
                      {/* ArrowLeft points right in RTL = forward direction */}
                      <ArrowLeft className="w-4 h-4" />
                    </>
                  )}
                </motion.button>

                {/* ── Divider ── */}
                <div className="flex items-center gap-3 pt-1">
                  <div className="flex-1 h-px bg-emerald-500/10" />
                  <span className="text-[10px] text-muted-foreground/40 select-none">أو</span>
                  <div className="flex-1 h-px bg-emerald-500/10" />
                </div>

                {/* ── Quick Demo Access button ── */}
                <motion.button
                  type="button"
                  onClick={handleDemoAccess}
                  disabled={isDemoLoading}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.98 }}
                  className={cn(
                    "w-full flex items-center justify-center gap-2 py-2.5 px-6",
                    "rounded-xl text-sm font-medium transition-all duration-300",
                    "border border-emerald-500/20 bg-emerald-500/5",
                    "text-emerald-400/80 hover:text-emerald-300",
                    "hover:border-emerald-500/40 hover:bg-emerald-500/10",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/30",
                    isDemoLoading && "opacity-60 cursor-not-allowed"
                  )}
                >
                  {isDemoLoading ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>جارٍ الدخول...</span>
                    </>
                  ) : (
                    <>
                      <Zap className="w-3.5 h-3.5" />
                      <span>الدخول السريع للنسخة التجريبية</span>
                    </>
                  )}
                </motion.button>
              </motion.form>
            )}
          </AnimatePresence>

          {/* ── OTP verification form (shown after the code is sent) ── */}
          <AnimatePresence>
            {submitted && (
              <motion.form
                key="otp-form"
                onSubmit={handleVerify}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 16 }}
                className="w-full space-y-4"
              >
                <div className="relative">
                  <label className="block text-xs text-muted-foreground mb-1.5 font-medium">
                    رمز التحقق
                  </label>
                  <input
                    type="text"
                    dir="ltr"
                    inputMode="numeric"
                    placeholder="• • • • • •"
                    value={code}
                    onChange={(e) => { setCode(e.target.value.replace(/[^\d]/g, "")); setError(""); }}
                    className={cn(
                      "w-full bg-white/[0.04] rounded-xl border border-emerald-500/20",
                      "px-4 py-3 text-center text-lg text-foreground tracking-[0.4em] font-mono",
                      "placeholder:text-muted-foreground/40 outline-none",
                      "focus:border-emerald-500/60 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                    )}
                    maxLength={6}
                    autoComplete="one-time-code"
                  />
                </div>

                <motion.button
                  type="submit"
                  disabled={!isCodeValid || isVerifying}
                  whileHover={isCodeValid && !isVerifying ? { scale: 1.1 } : {}}
                  whileTap={isCodeValid && !isVerifying ? { scale: 0.98 } : {}}
                  className={cn(
                    "w-full flex items-center justify-center gap-2 py-3 px-6",
                    "rounded-xl font-semibold text-sm transition-all duration-300",
                    isCodeValid && !isVerifying
                      ? [
                          "bg-emerald-500 text-forest hover:bg-emerald-400",
                          "shadow-[0_0_20px_oklch(0.696_0.170_162/_30%)]",
                          "hover:shadow-[0_0_30px_oklch(0.696_0.170_162/_45%)]",
                        ]
                      : "bg-emerald-500/20 text-emerald-500/40 cursor-not-allowed"
                  )}
                >
                  {isVerifying ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>جارٍ التحقق...</span>
                    </>
                  ) : (
                    <>
                      <span>تأكيد الدخول</span>
                      <ArrowLeft className="w-4 h-4" />
                    </>
                  )}
                </motion.button>

                <button
                  type="button"
                  onClick={handleChangeNumber}
                  className="w-full text-center text-[11px] text-muted-foreground/60 hover:text-emerald-400 transition-colors"
                >
                  تغيير رقم الهاتف
                </button>
              </motion.form>
            )}
          </AnimatePresence>

          {/* Error message */}
          <AnimatePresence>
            {error && (
              <motion.p
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="text-[11px] text-red-400 text-center mt-3 font-arabic"
              >
                {error}
              </motion.p>
            )}
          </AnimatePresence>

          {/* Footer note */}
          <motion.p
            variants={itemVariants}
            className="text-[10px] text-muted-foreground/60 text-center mt-6 leading-relaxed"
          >
            بالمتابعة توافق على شروط الخدمة وسياسة الخصوصية
          </motion.p>
        </motion.div>

        {/* Bottom emerald line */}
        <div className="absolute inset-x-0 bottom-0 h-[1px] rounded-b-2xl bg-gradient-to-r from-transparent via-emerald-400/30 to-transparent" />
      </motion.div>
    </div>
  );
}
