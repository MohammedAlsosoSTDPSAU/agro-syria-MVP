"use client";

import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Droplets, AlertTriangle, CheckCircle, Clock, Sprout,
  Bell, CalendarCheck, Bot, Calendar, X,
} from "lucide-react";
import { cn } from "@/lib/utils";

/* ─── Shared task types (exported for FieldsPage) ──────────────────── */
export interface Task {
  id: number; date: string; task: string; field: string;
  type: "irrigation" | "fertilize" | "harvest" | "spray" | "inspect";
  urgent: boolean;
}

export const TASK_STYLE: Record<Task["type"], { icon: React.ElementType; cls: string }> = {
  irrigation: { icon: Droplets,      cls: "text-sky-400     bg-sky-500/10     border-sky-500/20"     },
  fertilize:  { icon: Sprout,        cls: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" },
  harvest:    { icon: CheckCircle,   cls: "text-amber-400   bg-amber-500/10   border-amber-500/20"   },
  spray:      { icon: AlertTriangle, cls: "text-orange-400  bg-orange-500/10  border-orange-500/20"  },
  inspect:    { icon: Clock,         cls: "text-purple-400  bg-purple-500/10  border-purple-500/20"  },
};

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

/* ─── PWA-style Agent Toast ────────────────────────────────────────── */
interface ToastData { taskName: string; taskDate: string }

function AgentToast({ data, onClose }: { data: ToastData; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 4500);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 24, scale: 0.93 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 18, scale: 0.94 }}
      transition={{ type: "spring", stiffness: 340, damping: 28 }}
      className="fixed bottom-5 end-5 z-50 glass-card rounded-2xl shadow-2xl overflow-hidden"
      style={{ maxWidth: 310, minWidth: 252, borderColor: "oklch(0.696 0.170 162 / 40%)" }}
      dir="rtl"
    >
      {/* PWA notification header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-emerald-500/15">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-md bg-emerald-500/25 border border-emerald-500/40 flex items-center justify-center flex-shrink-0">
            <Bot className="w-2.5 h-2.5 text-emerald-400" />
          </div>
          <span className="text-[10px] font-bold text-emerald-400">وكيل التواصل</span>
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative rounded-full h-1.5 w-1.5 bg-emerald-400" />
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[9px] text-muted-foreground/50">الآن</span>
          <button
            onClick={onClose}
            className="text-muted-foreground/40 hover:text-muted-foreground transition-colors"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Notification body */}
      <div className="px-3 py-2.5">
        <p className="text-xs text-foreground leading-relaxed">
          حاضر، سأذكّرك بـ{" "}
          <span className="text-emerald-400 font-semibold">«{data.taskName}»</span>{" "}
          قبل 30 دقيقة ({data.taskDate}) عبر الإشعارات.
        </p>
        <p className="text-[10px] text-muted-foreground/60 mt-1">
          تم تسجيل التذكير في جدولك الزراعي.
        </p>
      </div>

      {/* Auto-dismiss progress bar */}
      <div className="h-[2px] bg-white/[0.05]">
        <motion.div
          className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400"
          initial={{ width: "100%" }}
          animate={{ width: "0%" }}
          transition={{ duration: 4.5, ease: "linear" }}
          style={{ transformOrigin: "right" }}
        />
      </div>
    </motion.div>
  );
}

/* ─── Main component ───────────────────────────────────────────────── */
interface UpcomingTasksProps {
  tasks: Task[];
  onFieldHover?: (fieldName: string | null) => void;
}

export function UpcomingTasks({ tasks, onFieldHover }: UpcomingTasksProps) {
  const [reminded, setReminded] = useState<Set<number>>(new Set());
  const [ringing, setRinging]   = useState<number | null>(null);
  const [toast, setToast]       = useState<ToastData | null>(null);

  const closeToast = useCallback(() => setToast(null), []);

  function handleRemind(task: Task) {
    if (reminded.has(task.id)) return;

    // Bell ring animation for 550ms
    setRinging(task.id);
    setTimeout(() => setRinging(null), 550);

    // Mark as reminded and show agent toast
    setReminded(prev => new Set([...prev, task.id]));
    setToast({ taskName: task.task, taskDate: task.date });
  }

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: EASE }}
        className="glass-card rounded-2xl p-5"
        dir="rtl"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-foreground">جدول المهام القادمة</h3>
            <p className="text-[10px] text-muted-foreground">{tasks.length} مهام مجدولة</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse flex-shrink-0" />
              <span className="text-[9px] text-muted-foreground/60">وكيل التواصل نشط</span>
            </div>
            <Calendar className="w-4 h-4 text-emerald-400/50" />
          </div>
        </div>

        {/* Task list */}
        <div className="space-y-2">
          {tasks.map((task, i) => {
            const { icon: Icon, cls } = TASK_STYLE[task.type];
            const isReminded = reminded.has(task.id);
            const isRinging  = ringing === task.id;

            return (
              <motion.div
                key={task.id}
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.6 + 0.2, duration: 0.35, ease: EASE }}
                onMouseEnter={() => onFieldHover?.(task.field)}
                onMouseLeave={() => onFieldHover?.(null)}
                className={cn(
                  "flex items-center gap-2.5 p-3 rounded-xl border transition-colors group",
                  task.urgent
                    ? "bg-red-500/6 border-red-500/20"
                    : "bg-white/[0.02] border-white/[0.04] hover:bg-white/[0.04] hover:border-white/[0.07]"
                )}
              >
                {/* Task type icon */}
                <div className={cn(
                  "w-7 h-7 rounded-lg border flex items-center justify-center flex-shrink-0",
                  task.urgent ? "text-red-400 bg-red-500/10 border-red-500/25" : cls
                )}>
                  <Icon className="w-3.5 h-3.5" />
                </div>

                {/* Task info — flex-1 so date stays at end */}
                <div className="flex-1 min-w-0">
                  <p className={cn(
                    "text-xs font-semibold truncate leading-snug",
                    task.urgent ? "text-red-300" : "text-foreground"
                  )}>
                    {task.task}
                  </p>
                  <p className="text-[10px] text-muted-foreground/70 truncate leading-snug">{task.field}</p>
                </div>

                {/* Date + urgent badge — fixed width column */}
                <div className="flex flex-col items-start gap-0.5 flex-shrink-0 min-w-[52px]">
                  <span className={cn(
                    "text-[10px] font-semibold leading-none",
                    task.urgent ? "text-red-400" : "text-muted-foreground"
                  )}>
                    {task.date}
                  </span>
                  {task.urgent && (
                    <span className="text-[9px] font-bold text-red-500 leading-none bg-red-500/10 px-1.5 py-0.5 rounded-full border border-red-500/20">
                      عاجل
                    </span>
                  )}
                </div>

                {/* Remind Me button — hidden until hover, persistent when set */}
                <motion.button
                  onClick={() => handleRemind(task)}
                  disabled={isReminded}
                  whileTap={!isReminded ? { scale: 0.85 } : {}}
                  className={cn(
                    "flex-shrink-0 w-7 h-7 rounded-lg border flex items-center justify-center transition-all duration-200",
                    isReminded
                      ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400 cursor-default"
                      : "bg-white/[0.04] border-white/[0.08] text-muted-foreground/40 hover:border-emerald-500/35 hover:text-emerald-400 hover:bg-emerald-500/8 opacity-0 group-hover:opacity-100"
                  )}
                  title={isReminded ? "تم ضبط التذكير" : "ذكرني"}
                >
                  <motion.span
                    animate={isRinging
                      ? { rotate: [-18, 18, -12, 12, -6, 0], scale: [1, 1.3, 1.15, 1] }
                      : {}
                    }
                    transition={{ duration: 0.52, ease: "easeInOut" }}
                    className="flex items-center justify-center"
                  >
                    {isReminded
                      ? <CalendarCheck className="w-3.5 h-3.5" />
                      : <Bell       className="w-3.5 h-3.5" />
                    }
                  </motion.span>
                </motion.button>
              </motion.div>
            );
          })}
        </div>

        {/* Agent status footer */}
        <div className="mt-3 pt-3 border-t border-white/[0.04] flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Bot className="w-3 h-3 text-emerald-400/50" />
            <span className="text-[9px] text-muted-foreground/50">
              {reminded.size > 0
                ? `وكيل التواصل: ${reminded.size} تذكير نشط`
                : "مرر على مهمة للتذكير بها"}
            </span>
          </div>
          {reminded.size > 0 && (
            <span className="text-[9px] text-emerald-400/60 font-semibold">{reminded.size} / {tasks.length}</span>
          )}
        </div>
      </motion.div>

      {/* PWA-style Agent Toast */}
      <AnimatePresence>
        {toast && <AgentToast key={toast.taskName} data={toast} onClose={closeToast} />}
      </AnimatePresence>
    </>
  );
}
