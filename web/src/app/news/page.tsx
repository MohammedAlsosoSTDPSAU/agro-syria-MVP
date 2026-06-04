"use client";

import { motion } from "framer-motion";
import { Newspaper, Sprout } from "lucide-react";
import { WorkspaceLayout } from "@/components/workspace/WorkspaceLayout";
import { PageGuide } from "@/components/ui/PageGuide";

type Bezier = [number, number, number, number];
const EASE: Bezier = [0.22, 1, 0.36, 1];

export default function NewsPage() {
  return (
    <WorkspaceLayout activeView="news">
      <div className="relative flex-1 flex items-center justify-center min-h-full px-6 py-16 overflow-hidden" dir="rtl">

        {/* Ambient emerald glow backdrop */}
        <motion.div
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(520px,85vw)] h-[min(520px,85vw)] rounded-full bg-emerald-500/[0.07] blur-[120px]"
          animate={{ opacity: [0.5, 0.85, 0.5], scale: [0.95, 1.05, 0.95] }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        />

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: EASE }}
          className="relative z-10 glass-card rounded-3xl px-8 py-12 md:px-16 md:py-16 max-w-xl w-full flex flex-col items-center text-center gap-6"
        >
          {/* Icon medallion */}
          <div className="relative">
            <motion.div
              className="absolute inset-0 rounded-3xl bg-emerald-500/20 blur-xl"
              animate={{ opacity: [0.4, 0.9, 0.4] }}
              transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
            />
            <motion.div
              className="relative w-20 h-20 rounded-3xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center emerald-glow"
              animate={{ y: [0, -6, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            >
              <Newspaper className="w-9 h-9 text-emerald-400" />
            </motion.div>
          </div>

          {/* "قريباً" pill */}
          <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/25 px-3 py-1 text-[11px] font-bold text-emerald-300 font-arabic">
            <Sprout className="w-3 h-3" />
            قريباً
          </span>

          {/* Heading */}
          <h1 className="text-3xl md:text-4xl font-extrabold text-emerald-gradient leading-tight">
            الأخبار الزراعية
          </h1>

          {/* Subtext */}
          <p className="text-sm md:text-base text-muted-foreground font-arabic leading-relaxed max-w-md">
            قريباً.. لنضع نبض الحقول بين يديك
          </p>
          <PageGuide
            summary="الأخبار الزراعية — قرارات رسمية وتنبيهات عاجلة وأسعار المدخلات (قريباً)."
            services={["قرارات وزارة الزراعة", "تنبيهات عاجلة", "أسعار السماد والوقود", "تحذيرات مناخية"]}
          />

          {/* Animated progress dots */}
          <div className="flex items-center gap-2 pt-2" dir="ltr">
            {[0, 1, 2].map((i) => (
              <motion.span
                key={i}
                className="w-2 h-2 rounded-full bg-emerald-400/70"
                animate={{ opacity: [0.25, 1, 0.25], scale: [1, 1.25, 1] }}
                transition={{ duration: 1.4, repeat: Infinity, delay: i * 0.22, ease: "easeInOut" }}
              />
            ))}
          </div>
        </motion.div>
      </div>
    </WorkspaceLayout>
  );
}
