"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Bug, Flame, Snowflake, Droplets, Send, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

type ReportType = "pest" | "fire" | "frost" | "water";

const REPORT_TYPES: { type: ReportType; label: string; icon: React.ElementType; cls: string }[] = [
  { type: "pest",  label: "تفشي آفات", icon: Bug,       cls: "text-orange-400 bg-orange-500/15 border-orange-500/30" },
  { type: "fire",  label: "حريق",       icon: Flame,     cls: "text-red-400    bg-red-500/15    border-red-500/30"    },
  { type: "frost", label: "صقيع",       icon: Snowflake, cls: "text-sky-400    bg-sky-500/15    border-sky-500/30"    },
  { type: "water", label: "شح مياه",    icon: Droplets,  cls: "text-blue-400   bg-blue-500/15   border-blue-500/30"   },
];

const CITIES = [
  "دمشق", "حلب", "حمص", "حماة", "اللاذقية", "طرطوس",
  "إدلب", "الرقة", "دير الزور", "الحسكة", "السويداء", "درعا", "القنيطرة", "ريف دمشق",
];

interface Props { open: boolean; onClose: () => void }

export function GreenReportModal({ open, onClose }: Props) {
  const [type, setType]   = useState<ReportType | null>(null);
  const [city, setCity]   = useState(CITIES[0]);
  const [notes, setNotes] = useState("");
  const [sent, setSent]   = useState(false);

  function handleSubmit() {
    if (!type) return;
    setSent(true);
    setTimeout(() => { setSent(false); setType(null); setNotes(""); onClose(); }, 2400);
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        >
          <motion.div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            className="relative glass-card rounded-2xl p-6 w-full max-w-md shadow-2xl"
            initial={{ scale: 0.92, y: 24 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.92, y: 24 }}
            transition={{ type: "spring", stiffness: 320, damping: 28 }}
          >
            <AnimatePresence mode="wait">
              {sent ? (
                <motion.div
                  key="sent"
                  initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }}
                  className="text-center py-6"
                >
                  <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
                  <p className="text-base font-bold text-foreground">تم إرسال التقرير</p>
                  <p className="text-sm text-muted-foreground mt-1">سيُبلَّغ المجتمع في نطاق 10 كم</p>
                </motion.div>
              ) : (
                <motion.div key="form" dir="rtl">
                  <div className="flex items-center justify-between mb-5">
                    <div>
                      <h3 className="text-base font-bold text-foreground">التقرير الطارئ</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">أبلغ مجتمعك عن حادثة ميدانية</p>
                    </div>
                    <button
                      onClick={onClose}
                      className="p-1.5 rounded-lg hover:bg-white/[0.06] text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <p className="text-xs font-semibold text-muted-foreground mb-2">نوع الحادثة</p>
                  <div className="grid grid-cols-2 gap-2 mb-4">
                    {REPORT_TYPES.map(({ type: t, label, icon: Icon, cls }) => (
                      <button
                        key={t}
                        onClick={() => setType(t)}
                        className={cn(
                          "flex items-center gap-2 p-2.5 rounded-xl border text-sm font-semibold transition-all",
                          type === t ? cls : "bg-white/[0.03] border-white/[0.08] text-muted-foreground hover:border-white/20"
                        )}
                      >
                        <Icon className="w-4 h-4 flex-shrink-0" /> {label}
                      </button>
                    ))}
                  </div>

                  <p className="text-xs font-semibold text-muted-foreground mb-1.5">المنطقة</p>
                  <select
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="w-full mb-4 bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2 text-sm text-foreground appearance-none focus:outline-none focus:border-emerald-500/40"
                  >
                    {CITIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>

                  <p className="text-xs font-semibold text-muted-foreground mb-1.5">ملاحظات</p>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="صف الحادثة بإيجاز"
                    rows={3}
                    className="w-full mb-4 bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 resize-none focus:outline-none focus:border-emerald-500/40"
                  />

                  <button
                    onClick={handleSubmit}
                    disabled={!type}
                    className={cn(
                      "w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold text-sm transition-all",
                      type
                        ? "bg-red-500/20 border border-red-500/30 text-red-300 hover:bg-red-500/30"
                        : "bg-white/[0.04] border border-white/[0.08] text-muted-foreground cursor-not-allowed"
                    )}
                  >
                    <Send className="w-4 h-4" /> إرسال التقرير للمجتمع
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
