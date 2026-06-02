"use client";

import { useRef } from "react";
import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, ChevronLeft, ChevronRight } from "lucide-react";
import type { CropPrice, CropCategory } from "@/app/api/market/route";

const CATEGORY_META: Record<CropCategory, { label_ar: string; color: string; ring: string }> = {
  strategic:  { label_ar: "استراتيجية", color: "text-emerald-400", ring: "ring-emerald-500/40" },
  vegetables: { label_ar: "خضروات",     color: "text-lime-400",    ring: "ring-lime-500/40" },
  fruits:     { label_ar: "فواكه",      color: "text-amber-400",   ring: "ring-amber-500/40" },
  grains:     { label_ar: "حبوب",       color: "text-yellow-400",  ring: "ring-yellow-500/40" },
};

interface CropCardProps {
  crop: CropPrice;
}

function CropCard({ crop }: CropCardProps) {
  const meta = CATEGORY_META[crop.category];
  const up = crop.change_pct >= 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex-shrink-0 w-44 glass-card rounded-2xl p-3.5 ring-1 ${meta.ring} cursor-default`}
      dir="rtl"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-1 mb-2">
        <div>
          <p className="text-[13px] font-bold text-foreground leading-tight">{crop.name_ar}</p>
          <p className={`text-[9px] font-medium mt-0.5 ${meta.color}`}>{meta.label_ar}</p>
        </div>
        <div className={`flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
          up ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"
        }`}>
          {up
            ? <TrendingUp className="w-2.5 h-2.5" />
            : <TrendingDown className="w-2.5 h-2.5" />}
          {Math.abs(crop.change_pct).toFixed(1)}٪
        </div>
      </div>

      {/* Price */}
      <p className="text-xl font-bold text-foreground tabular-nums leading-none font-numeric" dir="ltr">
        {crop.price_syp.toLocaleString("en")}
      </p>
      <p className="text-[9px] text-muted-foreground mt-0.5">{crop.unit}</p>

      {/* Sparkline using SVG */}
      <div className="mt-2.5 h-8">
        <CropSparkline history={crop.history} up={up} />
      </div>

      {/* Footer */}
      <div className="mt-2 pt-2 border-t border-white/[0.06] flex items-center justify-between">
        <span className="text-[9px] text-muted-foreground/60">أعلى منتج</span>
        <span className={`text-[9px] font-semibold ${meta.color}`}>{crop.top_gov_ar}</span>
      </div>
    </motion.div>
  );
}

function CropSparkline({
  history,
  up,
}: {
  history: { month_ar: string; price: number }[];
  up: boolean;
}) {
  if (!history.length) return null;
  const vals = history.map((h) => h.price);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const range = max - min || 1;
  const W = 136;
  const H = 32;
  const pts = vals.map((v, i) => ({
    x: (i / (vals.length - 1)) * W,
    y: H - ((v - min) / range) * H,
  }));
  const path = pts
    .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(" ");
  const area = `${path} L${W},${H} L0,${H} Z`;
  const color = up ? "#10b981" : "#ef4444";

  return (
    <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
      <defs>
        <linearGradient id={`spark-${up ? "up" : "dn"}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.3} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#spark-${up ? "up" : "dn"})`} />
      <path d={path} stroke={color} strokeWidth={1.5} fill="none" strokeLinejoin="round" />
    </svg>
  );
}

interface CropCarouselProps {
  crops: CropPrice[];
  activeCategory: CropCategory | "all";
  onCategoryChange: (cat: CropCategory | "all") => void;
}

const CATEGORY_TABS: (CropCategory | "all")[] = ["all", "strategic", "vegetables", "fruits", "grains"];
const CATEGORY_LABELS: Record<CropCategory | "all", string> = {
  all:        "الكل",
  strategic:  "استراتيجية",
  vegetables: "خضروات",
  fruits:     "فواكه",
  grains:     "حبوب",
};

export function CropCarousel({ crops, activeCategory, onCategoryChange }: CropCarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // RTL carousel: "next" = items to the LEFT = positive scrollBy (content moves left).
  // "prev" = items to the RIGHT = negative scrollBy.
  const scroll = (dir: "next" | "prev") => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollBy({ left: dir === "next" ? 320 : -320, behavior: "smooth" });
  };

  const filtered =
    activeCategory === "all"
      ? crops
      : crops.filter((c) => c.category === activeCategory);

  return (
    <div>
      {/* Category tabs */}
      <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-1 scrollbar-none" dir="rtl">
        {CATEGORY_TABS.map((cat) => {
          const active = activeCategory === cat;
          const meta = cat !== "all" ? CATEGORY_META[cat] : null;
          return (
            <button
              key={cat}
              onClick={() => onCategoryChange(cat)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-[11px] font-semibold transition-all border ${
                active
                  ? `border-transparent text-background bg-foreground`
                  : `border-white/10 text-muted-foreground hover:text-foreground`
              }`}
            >
              {CATEGORY_LABELS[cat]}
            </button>
          );
        })}
      </div>

      {/* Scroll controls — RTL: ChevronRight (→) = next (forward/left), ChevronLeft (←) = prev (back/right) */}
      <div className="relative">
        <button
          onClick={() => scroll("next")}
          aria-label="التالي"
          className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-7 h-7 rounded-full glass-card flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => scroll("prev")}
          aria-label="السابق"
          className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-7 h-7 rounded-full glass-card flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>

        {/* Carousel track */}
        <div
          ref={scrollRef}
          className="flex gap-3 overflow-x-auto pb-2 px-8 scrollbar-none"
          style={{ scrollbarWidth: "none" }}
          dir="rtl"
        >
          {filtered.map((crop) => (
            <CropCard key={crop.key} crop={crop} />
          ))}
          {filtered.length === 0 && (
            <div className="text-[12px] text-muted-foreground/50 py-8 text-center w-full">
              لا توجد بيانات
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
