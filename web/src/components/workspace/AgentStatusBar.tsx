"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bot,
  Target,
  Sprout,
  BookOpen,
  MessageCircle,
  Shield,
  Activity,
  WifiOff,
  CloudSun,
  TrendingUp,
  Droplets,
  AlertCircle,
  type LucideProps,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { fetchAgentStatus, type AgentInfo, type AgentStatus } from "@/lib/api";

// ── Icon name → component map (add more as agents grow) ──────────────
const ICON_MAP: Record<string, React.ComponentType<LucideProps>> = {
  Target,
  Sprout,
  BookOpen,
  MessageCircle,
  Shield,
  Bot,
  CloudSun,
  TrendingUp,
  Droplets,
  AlertCircle,
};

// ── Display-layer types ───────────────────────────────────────────────
interface DisplayAgent {
  id: string;
  nameAr: string;
  status: AgentStatus;
  icon: React.ComponentType<LucideProps>;
  metric: string;
  tooltip: string;
}

function toDisplay(a: AgentInfo): DisplayAgent {
  return {
    id: a.id,
    nameAr: a.name_ar,
    status: a.status,
    icon: ICON_MAP[a.icon] ?? Bot,
    metric: a.metric ?? "",
    tooltip: a.role_ar,
  };
}

// ── Static fallback shown when API is offline ─────────────────────────
const FALLBACK_AGENTS: DisplayAgent[] = [
  { id: "strategist",  nameAr: "المخطط الاستراتيجي", status: "idle", icon: Target,        metric: "—", tooltip: "المخطط الاستراتيجي: يدرس توازن المحاصيل بالسوق." },
  { id: "field",       nameAr: "وكيل الميدان",         status: "idle", icon: Sprout,        metric: "—", tooltip: "وكيل الميدان: عيونه على التربة والطقس كل لحظة." },
  { id: "synthesizer", nameAr: "الموثق الذكي",          status: "idle", icon: BookOpen,      metric: "—", tooltip: "الموثق الذكي: يجهز أحدث الأبحاث الزراعية." },
  { id: "liaison",     nameAr: "وكيل التواصل",          status: "idle", icon: MessageCircle, metric: "—", tooltip: "وكيل التواصل: هنا للإجابة على أي استفسار." },
  { id: "security",    nameAr: "الحارس",                status: "idle", icon: Shield,        metric: "—", tooltip: "الحارس: يتحقق من سلامة بياناتك وأمان أرضك." },
];

// ── Live log messages (kept static — independent of API) ──────────────
const LOG_MESSAGES = [
  { agent: "وكيل الميدان",         action: "يحلل صور الأقمار الصناعية لريف حلب..." },
  { agent: "المخطط الاستراتيجي",   action: "يحدّث توقعات أسعار الحبوب للأسبوع القادم..." },
  { agent: "الموثق الذكي",          action: "يراجع أحدث أبحاث الزراعة المستدامة..." },
  { agent: "وكيل التواصل",          action: "جاهز للرد على استفساراتك في أي وقت..." },
  { agent: "الحارس",                action: "يفحص سلامة بياناتك وبروتوكولات الأمان..." },
];

// ── Status visual config ──────────────────────────────────────────────
const STATUS_CONFIG: Record<AgentStatus, { dot: string; ring: string; label: string; pulse: boolean }> = {
  active:     { dot: "bg-emerald-400", ring: "ring-emerald-400/30", label: "نشط",   pulse: true  },
  idle:       { dot: "bg-slate-500",   ring: "ring-slate-500/20",   label: "موقف",  pulse: false },
  alert:      { dot: "bg-amber-400",   ring: "ring-amber-400/30",   label: "تنبيه", pulse: true  },
  processing: { dot: "bg-sky-400",     ring: "ring-sky-400/30",     label: "يعمل",  pulse: true  },
  offline:    { dot: "bg-slate-600",   ring: "ring-slate-600/20",   label: "غير متصل", pulse: false },
};

// ── Data fetching hook ────────────────────────────────────────────────
const POLL_INTERVAL_MS = 30_000;

function useAgentStatus() {
  const [agents, setAgents] = useState<DisplayAgent[]>(FALLBACK_AGENTS);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await fetchAgentStatus();
      setAgents(data.agents.map(toDisplay));
      setOffline(false);
    } catch {
      setOffline(true);
      // Keep whatever agents we had (initial = fallback, subsequent = last good data)
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    const wrappedLoad = async () => { if (mounted) await load(); };

    wrappedLoad();
    const id = setInterval(wrappedLoad, POLL_INTERVAL_MS);
    return () => { mounted = false; clearInterval(id); };
  }, [load]);

  const activeCount = agents.filter(
    (a) => a.status === "active" || a.status === "processing",
  ).length;

  return { agents, loading, offline, activeCount };
}

// ── Sub-components ────────────────────────────────────────────────────

function AgentCardSkeleton({ index }: { index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: index * 0.06 }}
      className="p-3 rounded-xl border border-emerald-500/10 bg-white/[0.02] animate-pulse"
    >
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex-shrink-0" />
        <div className="flex-1 space-y-1.5">
          <div className="h-2.5 bg-emerald-500/10 rounded w-4/5" />
          <div className="h-2 bg-emerald-500/8 rounded w-3/5" />
        </div>
      </div>
    </motion.div>
  );
}

function AgentCard({ agent, index }: { agent: DisplayAgent; index: number }) {
  const [hovered, setHovered] = useState(false);
  const config = STATUS_CONFIG[agent.status];
  const Icon = agent.icon;

  return (
    <motion.div
      initial={{ opacity: 0, x: 16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.08, duration: 0.4, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] }}
      whileHover={{ scale: 1.02 }}
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      className={cn(
        "relative p-3 rounded-xl border cursor-default select-none",
        "transition-colors duration-300",
        hovered
          ? "border-emerald-500/35 bg-white/[0.05]"
          : "border-emerald-500/10 bg-white/[0.02]",
      )}
    >
      <div className="flex items-center gap-2">
        <div className={cn(
          "relative w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0",
          "bg-emerald-500/10 ring-1",
          config.ring,
        )}>
          <Icon className="w-4 h-4 text-emerald-400" />
          <span className={cn(
            "absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full ring-2 ring-background",
            config.dot,
          )}>
            {config.pulse && (
              <span className={cn("absolute inset-0 rounded-full animate-ping opacity-70", config.dot)} />
            )}
          </span>
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-semibold text-foreground/90 truncate leading-tight">
            {agent.nameAr}
          </p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-[9px] text-muted-foreground">{config.label}</span>
            <span className="text-[9px] text-emerald-400/60">·</span>
            <span className="text-[9px] text-emerald-400/70 tabular-nums font-medium">
              {agent.metric}
            </span>
          </div>
        </div>
      </div>

      {/* Expand-in-place tooltip */}
      <AnimatePresence>
        {hovered && (
          <motion.p
            initial={{ opacity: 0, height: 0, marginTop: 0 }}
            animate={{ opacity: 1, height: "auto", marginTop: 10 }}
            exit={{ opacity: 0, height: 0, marginTop: 0 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="text-[10px] leading-relaxed overflow-hidden border-t border-emerald-500/12 pt-2 text-emerald-300/75"
          >
            {agent.tooltip}
          </motion.p>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function AgentLiveLog() {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setIdx((i) => (i + 1) % LOG_MESSAGES.length), 3200);
    return () => clearInterval(id);
  }, []);

  const current = LOG_MESSAGES[idx];

  return (
    <div className="px-3 pt-2 pb-3 border-t border-emerald-500/10">
      <div className="flex items-center gap-1.5 mb-2">
        <Activity className="w-3 h-3 text-emerald-400/70" />
        <span className="text-[10px] text-emerald-400/70 font-semibold tracking-wide uppercase">
          سجل مباشر
        </span>
        <span className="me-auto w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
      </div>
      <div className="min-h-[38px] relative overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={idx}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="text-[10px] leading-relaxed"
          >
            <span className="text-emerald-400 font-semibold">{current.agent}</span>
            <span className="text-muted-foreground/70"> {current.action}</span>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────
export function AgentStatusBar() {
  const { agents, loading, offline, activeCount } = useAgentStatus();

  return (
    <aside className="w-52 flex-shrink-0 h-full glass-status-bar flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-3 pt-4 pb-3 border-b border-emerald-500/10">
        <div className="flex items-center gap-2">
          <Bot className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          <span className="text-xs font-semibold text-foreground/90 truncate">
            الخلية الذكية
          </span>

          {/* Offline badge — appears when API unreachable */}
          <AnimatePresence>
            {offline && (
              <motion.span
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.2 }}
                title="الخادم غير متاح"
                className={cn(
                  "ms-auto flex items-center gap-1 px-1.5 py-0.5 rounded-md",
                  "bg-slate-500/10 border border-slate-500/20",
                )}
              >
                <WifiOff className="w-2.5 h-2.5 text-slate-400" />
                <span className="text-[9px] font-semibold text-slate-400">غير متصل</span>
              </motion.span>
            )}
          </AnimatePresence>
        </div>

        <div className="mt-1.5 flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse flex-shrink-0" />
          <span className="text-[11px] text-emerald-400/80">
            {offline ? `${agents.length} وكيل — وضع غير متصل` : `${activeCount} نشط من ${agents.length}`}
          </span>
        </div>
      </div>

      {/* Agents list */}
      <div className="flex-1 overflow-y-auto px-2 py-2.5 space-y-1.5">
        {loading
          ? Array.from({ length: 5 }).map((_, i) => (
              <AgentCardSkeleton key={i} index={i} />
            ))
          : agents.map((agent, i) => (
              <AgentCard key={agent.id} agent={agent} index={i} />
            ))}
      </div>

      {/* Live Agent Log */}
      <AgentLiveLog />

      {/* Footer — version */}
      <div className="px-3 py-2 border-t border-emerald-500/10">
        <p className="text-[9px] text-muted-foreground/30 text-center font-arabic">أغرو-سيريا — نظام الوكلاء v2.6</p>
      </div>
    </aside>
  );
}
