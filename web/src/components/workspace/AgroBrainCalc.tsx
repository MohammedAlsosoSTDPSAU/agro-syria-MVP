"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Calculator, Droplets, TrendingUp, Sprout, Bot, ChevronDown, CheckCircle, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

type CalcTab = "seed" | "irrigation" | "profit";

const TABS: { id: CalcTab; label: string; icon: React.ElementType }[] = [
  { id: "seed",       label: "معدل البذار",    icon: Sprout     },
  { id: "irrigation", label: "احتياج الري",    icon: Droplets   },
  { id: "profit",     label: "إسقاط الربحية", icon: TrendingUp },
];

const CROP_DATA: Record<string, { seedRate: number; waterPerDunum: number; yieldPerDunum: number; pricePerKg: number }> = {
  "قمح":         { seedRate: 150, waterPerDunum: 450, yieldPerDunum: 350,  pricePerKg: 1400 },
  "قطن":         { seedRate: 12,  waterPerDunum: 750, yieldPerDunum: 250,  pricePerKg: 1850 },
  "شمندر سكري": { seedRate: 8,   waterPerDunum: 600, yieldPerDunum: 5000, pricePerKg: 420  },
  "زيتون":       { seedRate: 0,   waterPerDunum: 350, yieldPerDunum: 200,  pricePerKg: 8500 },
  "ذرة":         { seedRate: 25,  waterPerDunum: 520, yieldPerDunum: 600,  pricePerKg: 950  },
};
const CROPS = Object.keys(CROP_DATA);

// ── Shared sub-components ──────────────────────────────────────────────────

function NumInput({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div dir="rtl">
      <p className="text-[10px] font-semibold text-muted-foreground mb-1">{label}</p>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-emerald-500/40"
        dir="ltr"
      />
    </div>
  );
}

function CropSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div dir="rtl">
      <p className="text-[10px] font-semibold text-muted-foreground mb-1">نوع المحصول</p>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full appearance-none bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2 text-sm text-foreground focus:outline-none focus:border-emerald-500/40 pe-8"
        >
          {CROPS.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <ChevronDown className="absolute inset-y-0 end-2.5 my-auto w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
      </div>
    </div>
  );
}

function CalcBtn({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 text-sm font-semibold hover:bg-emerald-500/22 transition-all"
    >
      <Calculator className="w-4 h-4" /> احسب
    </button>
  );
}

function ResultBox({ headline, body }: { headline: string; body: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-3" dir="rtl"
    >
      <div className="flex items-center gap-1.5 mb-1.5">
        <Bot className="w-3.5 h-3.5 text-emerald-400" />
        <span className="text-[11px] font-bold text-emerald-400">تحليل الوكيل المالي</span>
      </div>
      <p className="text-lg font-bold text-foreground mb-1" dir="ltr">{headline}</p>
      <p className="text-[10px] text-muted-foreground leading-relaxed">{body}</p>
    </motion.div>
  );
}

// ── Calculator panels ──────────────────────────────────────────────────────

function SeedCalc() {
  const [area, setArea] = useState("");
  const [crop, setCrop] = useState("قمح");
  const [res, setRes]   = useState<number | null>(null);

  function calc() {
    const a = parseFloat(area);
    if (!a || a <= 0) return;
    setRes(a * CROP_DATA[crop].seedRate);
  }

  return (
    <div className="space-y-3">
      <NumInput label="المساحة (دونم)" value={area} onChange={setArea} placeholder="10" />
      <CropSelect value={crop} onChange={(v) => { setCrop(v); setRes(null); }} />
      <CalcBtn onClick={calc} />
      {res !== null && (
        <ResultBox
          headline={`${res.toLocaleString()} كغ`}
          body={`لزراعة ${crop} على ${area} دونم تحتاج ${res.toLocaleString()} كغ من البذور. التكلفة التقديرية للبذار: ${Math.round(res * 850).toLocaleString()} ل.س.`}
        />
      )}
    </div>
  );
}

function IrrigationCalc() {
  const [area, setArea] = useState("");
  const [crop, setCrop] = useState("قمح");
  const [days, setDays] = useState("30");
  const [res, setRes]   = useState<number | null>(null);

  function calc() {
    const a = parseFloat(area), d = parseFloat(days);
    if (!a || !d || a <= 0 || d <= 0) return;
    const daily = CROP_DATA[crop].waterPerDunum / 180;
    setRes(Math.round(a * daily * d));
  }

  return (
    <div className="space-y-3">
      <NumInput label="المساحة (دونم)" value={area} onChange={setArea} placeholder="10" />
      <NumInput label="عدد الأيام"     value={days} onChange={setDays} placeholder="30" />
      <CropSelect value={crop} onChange={(v) => { setCrop(v); setRes(null); }} />
      <CalcBtn onClick={calc} />
      {res !== null && (
        <ResultBox
          headline={`${res.toLocaleString()} م³`}
          body={`${crop} على ${area} دونم خلال ${days} يوماً يحتاج ${res.toLocaleString()} م³. جدول الري: ${Math.round(res / parseFloat(days))} م³ / يوم.`}
        />
      )}
    </div>
  );
}

function ProfitCalc() {
  const [area, setArea] = useState("");
  const [crop, setCrop] = useState("قمح");
  const [cost, setCost] = useState("50000");
  const [res, setRes]   = useState<{ rev: number; cost: number; profit: number; roi: number } | null>(null);

  function calc() {
    const a = parseFloat(area), c = parseFloat(cost);
    if (!a || !c || a <= 0 || c <= 0) return;
    const d    = CROP_DATA[crop];
    const rev  = a * d.yieldPerDunum * d.pricePerKg;
    const tot  = a * c;
    const prof = rev - tot;
    setRes({ rev, cost: tot, profit: prof, roi: (prof / tot) * 100 });
  }

  return (
    <div className="space-y-3">
      <NumInput label="المساحة (دونم)"      value={area} onChange={setArea} placeholder="10" />
      <NumInput label="تكلفة الدونم (ل.س)" value={cost} onChange={setCost} placeholder="50000" />
      <CropSelect value={crop} onChange={(v) => { setCrop(v); setRes(null); }} />
      <CalcBtn onClick={calc} />
      {res !== null && (
        <motion.div
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-3 space-y-2" dir="rtl"
        >
          <div className="flex items-center gap-1.5 mb-1">
            <Bot className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-[11px] font-bold text-emerald-400">تحليل الوكيل المالي</span>
          </div>
          {[
            { label: "الإيراد المتوقع",  val: `${res.rev.toLocaleString()} ل.س`,    clr: "text-emerald-400" },
            { label: "إجمالي التكاليف", val: `${res.cost.toLocaleString()} ل.س`,   clr: "text-red-400"     },
            { label: "صافي الربح",       val: `${res.profit.toLocaleString()} ل.س`, clr: res.profit >= 0 ? "text-emerald-400" : "text-red-400" },
            { label: "العائد (ROI)",     val: `${res.roi.toFixed(1)}٪`,             clr: res.roi >= 20 ? "text-emerald-400" : "text-amber-400" },
          ].map(({ label, val, clr }) => (
            <div key={label} className="flex justify-between items-center">
              <span className="text-[10px] text-muted-foreground">{label}</span>
              <span className={`text-[11px] font-bold ${clr}`} dir="ltr">{val}</span>
            </div>
          ))}
          <div className="flex items-start gap-1.5 border-t border-white/[0.06] pt-2">
            {res.roi >= 30
              ? <><CheckCircle className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0 mt-0.5" /><p className="text-[10px] text-muted-foreground/80 leading-relaxed">فرصة ممتازة — العائد يتجاوز متوسط السوق.</p></>
              : res.roi >= 10
              ? <><CheckCircle className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0 mt-0.5" /><p className="text-[10px] text-muted-foreground/80 leading-relaxed">مقبول — فكر في تقليل تكلفة الدونم.</p></>
              : <><AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" /><p className="text-[10px] text-muted-foreground/80 leading-relaxed">هامش منخفض — راجع خطة الإنتاج.</p></>}
          </div>
        </motion.div>
      )}
    </div>
  );
}

// ── Main export ────────────────────────────────────────────────────────────

export function AgroBrainCalc() {
  const [tab, setTab] = useState<CalcTab>("seed");

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5 }}
      className="glass-card rounded-2xl p-4 mb-4"
    >
      <div className="flex items-center gap-2 mb-4" dir="rtl">
        <div className="w-8 h-8 rounded-xl bg-emerald-500/15 border border-emerald-500/20 flex items-center justify-center">
          <Calculator className="w-4 h-4 text-emerald-400" />
        </div>
        <div>
          <p className="text-sm font-bold text-foreground">الوكيل الحاسب — أغرو برين</p>
          <p className="text-[10px] text-muted-foreground">حسابات ذكية للقرارات الزراعية</p>
        </div>
      </div>

      <div className="flex gap-1 mb-4 bg-white/[0.03] rounded-xl p-0.5 border border-white/[0.06]" dir="rtl">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[11px] font-semibold transition-all",
              tab === id ? "bg-emerald-500/20 text-emerald-300" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className="w-3 h-3" /> {label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}
          transition={{ duration: 0.18 }}
        >
          {tab === "seed"       && <SeedCalc />}
          {tab === "irrigation" && <IrrigationCalc />}
          {tab === "profit"     && <ProfitCalc />}
        </motion.div>
      </AnimatePresence>
    </motion.div>
  );
}
