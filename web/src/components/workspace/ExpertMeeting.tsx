"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bot, Zap, CloudSun, Sprout, TrendingUp, Users } from "lucide-react";

export type CityKey = "damascus" | "aleppo" | "latakia" | "homs" | "deir";

interface Dialogue {
  agent: string;
  icon: React.ElementType;
  cls: string;
  message: string;
}

const DIALOGUES: Record<CityKey, Dialogue[]> = {
  damascus: [
    { agent: "وكيل الطقس",    icon: CloudSun,  cls: "text-sky-400     bg-sky-500/12     border-sky-500/25",     message: "رياح جنوبية خفيفة 12 كم/س، رطوبة 42٪. لا عوائق مناخية اليوم." },
    { agent: "وكيل المحاصيل", icon: Sprout,     cls: "text-emerald-400 bg-emerald-500/12 border-emerald-500/25", message: "ظروف دمشق مثالية لري القمح — كفاءة الري تصل 92٪ في هذه الأحوال." },
    { agent: "وكيل السوق",    icon: TrendingUp, cls: "text-amber-400   bg-amber-500/12   border-amber-500/25",   message: "سعر القمح ارتفع 7٪ هذا الأسبوع — نافذة تسويق ممتازة في الـ 3 أيام القادمة." },
  ],
  aleppo: [
    { agent: "وكيل الطقس",    icon: CloudSun,  cls: "text-sky-400     bg-sky-500/12     border-sky-500/25",     message: "غيوم جزئية ورياح متوسطة 18 كم/س — تأجيل الرش حتى المساء موصى به." },
    { agent: "وكيل المحاصيل", icon: Sprout,     cls: "text-emerald-400 bg-emerald-500/12 border-emerald-500/25", message: "قطن حلب في مرحلة الإزهار — الرياح تُعزز التلقيح الطبيعي هذه الأيام." },
    { agent: "وكيل السوق",    icon: TrendingUp, cls: "text-amber-400   bg-amber-500/12   border-amber-500/25",   message: "القطن يتراجع 3.2٪ — انتظر استقرار السعر قبل عرض المحصول." },
  ],
  latakia: [
    { agent: "وكيل الطقس",    icon: CloudSun,  cls: "text-sky-400     bg-sky-500/12     border-sky-500/25",     message: "رطوبة 76٪ وضباب ساحلي صباحي — مثالي لبساتين الزيتون." },
    { agent: "وكيل المحاصيل", icon: Sprout,     cls: "text-emerald-400 bg-emerald-500/12 border-emerald-500/25", message: "الزيتون والحمضيات يستجيبان إيجاباً للضباب — قلل الري بنسبة 20٪." },
    { agent: "وكيل السوق",    icon: TrendingUp, cls: "text-amber-400   bg-amber-500/12   border-amber-500/25",   message: "زيت الزيتون تراجع 2.7٪ — أيدع الإنتاج وانتظر السعر يزيد العائد 8-12٪." },
  ],
  homs: [
    { agent: "وكيل الطقس",    icon: CloudSun,  cls: "text-sky-400     bg-sky-500/12     border-sky-500/25",     message: "31 درجة ورياح جنوبية — خطر تبخر المياه مرتفع في فترة الظهيرة." },
    { agent: "وكيل المحاصيل", icon: Sprout,     cls: "text-emerald-400 bg-emerald-500/12 border-emerald-500/25", message: "الري الليلي بين 9م-6ص يوفر 30٪ من استهلاك المياه في هذه الحرارة." },
    { agent: "وكيل السوق",    icon: TrendingUp, cls: "text-amber-400   bg-amber-500/12   border-amber-500/25",   message: "شمندر حمص يحقق سعراً مستقراً — الإنتاج المبكر يحظى بعلاوة 15٪." },
  ],
  deir: [
    { agent: "وكيل الطقس",    icon: CloudSun,  cls: "text-sky-400     bg-sky-500/12     border-sky-500/25",     message: "موجة حر شديدة 38°م ورياح شرقية — أوقف العمل الحقلي بين 11ص-4م." },
    { agent: "وكيل المحاصيل", icon: Sprout,     cls: "text-emerald-400 bg-emerald-500/12 border-emerald-500/25", message: "الشتلات بحاجة تظليل طارئ — زد معدل الري 40٪ وراقب علامات الذبول." },
    { agent: "وكيل السوق",    icon: TrendingUp, cls: "text-amber-400   bg-amber-500/12   border-amber-500/25",   message: "موجات الحر ترفع عروض القمح — ارتفاع 5-8٪ متوقع في الأسبوع القادم." },
  ],
};

const RECOMMENDATIONS: Record<CityKey, string> = {
  damascus: "التوصية: ابدأ الري الصباحي — نافذة التسويق مفتوحة ومثالية لعرض القمح هذا الأسبوع.",
  aleppo:   "التوصية: أجّل رش المبيدات للمساء، واستعد لنافذة تسويق القطن بعد استقرار السعر.",
  latakia:  "التوصية: قلل الري 20٪ وادرس تخزين الزيتون لانتظار ارتفاع السعر المتوقع.",
  homs:     "التوصية: اعتمد الري الليلي حصراً، وابادر ببيع الشمندر مبكراً للحصول على العلاوة.",
  deir:     "التوصية: أوقف العمل الميداني وزد الري — ارتفاع الأسعار يجعل الحفاظ على المحصول أولوية.",
};

export function ExpertMeeting({ city }: { city: CityKey }) {
  const [running, setRunning] = useState(false);
  const [step, setStep]       = useState(0);
  const dialogues             = DIALOGUES[city];

  useEffect(() => {
    setRunning(false);
    setStep(0);
  }, [city]);

  function startAnalysis() {
    setRunning(true);
    setStep(0);
    let s = 0;
    const iv = setInterval(() => {
      s += 1;
      setStep(s);
      if (s >= dialogues.length) clearInterval(iv);
    }, 1100);
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.6 }}
      className="glass-card rounded-2xl p-4 mb-4"
    >
      <div className="flex items-center justify-between mb-4" dir="rtl">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-purple-500/15 border border-purple-500/25 flex items-center justify-center">
            <Users className="w-4 h-4 text-purple-400" />
          </div>
          <div>
            <p className="text-sm font-bold text-foreground">اجتماع الخبراء</p>
            <p className="text-[10px] text-muted-foreground">تحليل متعدد الوكلاء — تزامن فوري</p>
          </div>
        </div>
        {(!running || step >= dialogues.length) && (
          <button
            onClick={startAnalysis}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-500/15 border border-purple-500/25 text-purple-300 text-[11px] font-semibold hover:bg-purple-500/25 transition-all"
          >
            <Zap className="w-3 h-3" /> {step >= dialogues.length ? "إعادة التحليل" : "تشغيل التحليل"}
          </button>
        )}
      </div>

      <AnimatePresence mode="wait">
        {running ? (
          <motion.div key="running" className="space-y-2.5" dir="rtl">
            {dialogues.slice(0, step).map(({ agent, icon: Icon, cls, message }, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -14 }} animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.38 }}
                className={`flex items-start gap-2.5 p-3 rounded-xl border ${cls}`}
              >
                <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 border ${cls}`}>
                  <Icon className="w-3 h-3" />
                </div>
                <div>
                  <p className="text-[10px] font-bold mb-1">{agent}</p>
                  <p className="text-xs text-foreground/80 leading-relaxed">{message}</p>
                </div>
              </motion.div>
            ))}

            {step >= dialogues.length && (
              <motion.div
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                className="rounded-xl border border-emerald-500/30 bg-emerald-500/8 p-3"
              >
                <p className="text-xs text-emerald-300 font-semibold leading-relaxed" dir="rtl">
                  {RECOMMENDATIONS[city]}
                </p>
              </motion.div>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="idle"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center py-8 gap-2 text-center"
          >
            <div className="w-10 h-10 rounded-full bg-purple-500/10 border border-purple-500/15 flex items-center justify-center">
              <Bot className="w-5 h-5 text-purple-400/60" />
            </div>
            <p className="text-xs text-muted-foreground">
              اضغط &quot;تشغيل التحليل&quot; لبدء حوار الوكلاء
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
