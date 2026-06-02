"use client";

import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ComposableMap,
  Geographies,
  Geography,
  Marker,
  ZoomableGroup,
} from "react-simple-maps";
import type { GeoFeature } from "react-simple-maps";
import type { VisualizationPoint } from "@/lib/api";

const GEO_URL = "/syria-gov.json";

// Syria geographic center and scale to fit all 14 governorates in the viewport
const SYRIA_CENTER: [number, number] = [39.5, 34.8];
const SYRIA_SCALE = 2400;

// No-data fill: neutral dark gray so missing-data provinces don't mislead
const NO_DATA_FILL   = "oklch(0.22 0.12 155 / 55%)";
const NO_DATA_STROKE = "oklch(0.38 0.12 155 / 70%)";

function intensityToColor(intensity: number): string {
  if (intensity >= 0.75)
    return "oklch(0.577 0.245 27.325 / 72%)";   // red
  if (intensity >= 0.45)
    return "oklch(0.75 0.18 70 / 68%)";           // amber
  return "oklch(0.696 0.170 162 / 55%)";          // emerald
}

function intensityToStroke(intensity: number): string {
  if (intensity >= 0.75) return "oklch(0.577 0.245 27.325)";
  if (intensity >= 0.45) return "oklch(0.75 0.18 70)";
  return "oklch(0.696 0.170 162)";
}

function intensityLabel(intensity: number): string {
  if (intensity >= 0.75) return "مرتفع";
  if (intensity >= 0.45) return "متوسط";
  return "منخفض";
}

function intensityTextColor(intensity: number): string {
  if (intensity >= 0.75) return "text-red-400";
  if (intensity >= 0.45) return "text-amber-400";
  return "text-emerald-400";
}

const GOV_STATS: Record<string, { area: string; primary: string; yield: string }> = {
  "دمشق":      { area: "105 كم²",    primary: "خضروات",         yield: "عالٍ"  },
  "ريف دمشق": { area: "18,032 كم²", primary: "خضروات وقمح",   yield: "متوسط" },
  "حلب":       { area: "18,482 كم²", primary: "قمح وقطن",      yield: "متوسط" },
  "حمص":       { area: "42,223 كم²", primary: "قمح وزيتون",    yield: "متوسط" },
  "حماة":      { area: "8,883 كم²",  primary: "قمح وقطن",      yield: "عالٍ"  },
  "اللاذقية":  { area: "2,297 كم²",  primary: "زيتون وحمضيات", yield: "عالٍ"  },
  "طرطوس":     { area: "1,892 كم²",  primary: "زيتون وحمضيات", yield: "عالٍ"  },
  "إدلب":      { area: "5,932 كم²",  primary: "زيتون وقمح",    yield: "متوسط" },
  "الرقة":     { area: "19,616 كم²", primary: "قمح وقطن",      yield: "منخفض" },
  "دير الزور": { area: "33,060 كم²", primary: "قمح وقطن",      yield: "منخفض" },
  "الحسكة":    { area: "23,334 كم²", primary: "قمح وشمندر",    yield: "متوسط" },
  "السويداء":  { area: "5,550 كم²",  primary: "عنب وكرز",      yield: "عالٍ"  },
  "درعا":      { area: "3,730 كم²",  primary: "قمح وخضروات",   yield: "متوسط" },
  "القنيطرة":  { area: "1,861 كم²",  primary: "قمح وفاكهة",    yield: "منخفض" },
};

// ── Inner component: renders geographies & fires onLoaded after mount ────
// Keeps the setIsLoaded call out of the Geographies render-prop (which runs
// during the parent's render phase), satisfying React's "no state updates
// while rendering a different component" rule.
function GeoRenderer({
  geographies,
  intensityMap,
  handleMouseEnter,
  handleMouseLeave,
  onLoaded,
}: {
  geographies: GeoFeature[];
  intensityMap: Map<string, number>;
  handleMouseEnter: (n: string, h: boolean, e: React.MouseEvent) => void;
  handleMouseLeave: () => void;
  onLoaded: () => void;
}) {
  useEffect(() => {
    if (geographies.length > 0) onLoaded();
  }, [geographies.length, onLoaded]);

  return (
    <>
      {geographies.map((geo: GeoFeature) => {
        const nameAr: string = String(geo.properties?.name_ar ?? geo.id ?? "");
        const hasData = intensityMap.has(nameAr);
        const intensity = hasData ? (intensityMap.get(nameAr) ?? 0) : 0;
        const fill   = hasData ? intensityToColor(intensity)  : NO_DATA_FILL;
        const stroke = hasData ? intensityToStroke(intensity) : NO_DATA_STROKE;
        return (
          <Geography
            key={geo.rsmKey}
            geography={geo}
            fill={fill}
            stroke={stroke}
            strokeWidth={0.6}
            onMouseEnter={(e: React.MouseEvent<SVGPathElement>) =>
              handleMouseEnter(nameAr, hasData, e as unknown as React.MouseEvent)
            }
            onMouseLeave={handleMouseLeave}
            style={{
              default: { outline: "none", cursor: "pointer", transition: "fill 0.2s" },
              hover:   { outline: "none", fill: hasData ? stroke : "oklch(0.30 0.12 155 / 70%)", opacity: 0.9 },
              pressed: { outline: "none" },
            }}
          />
        );
      })}
    </>
  );
}

interface TooltipData {
  name_ar: string;
  intensity: number;
  hasData: boolean;
  x: number;
  y: number;
}

interface SyriaHeatMapProps {
  points: VisualizationPoint[];
  compact?: boolean;
}

function MapSkeleton({ compact }: { compact: boolean }) {
  return (
    <div
      className="w-full animate-pulse rounded-xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center"
      style={{ height: compact ? 220 : 320 }}
    >
      <div className="text-[11px] text-muted-foreground/40">جارٍ تحميل الخريطة</div>
    </div>
  );
}

export function SyriaHeatMap({ points, compact = false }: SyriaHeatMapProps) {
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);
  const [zoom, setZoom] = useState(1);
  const [isLoaded, setIsLoaded] = useState(false);

  // Build lookup: name_ar → intensity (only for provinces that have data)
  const intensityMap = new Map<string, number>(
    points.map((p) => [p.label_ar, p.intensity])
  );

  const handleMouseEnter = useCallback(
    (nameAr: string, hasData: boolean, evt: React.MouseEvent) => {
      const intensity = intensityMap.get(nameAr) ?? 0;
      const containerRect = (evt.currentTarget as SVGElement)
        .closest(".rsm-container")
        ?.getBoundingClientRect() ??
        (evt.currentTarget as SVGElement).closest("svg")?.getBoundingClientRect();
      setTooltip({
        name_ar: nameAr,
        intensity,
        hasData,
        x: evt.clientX - (containerRect?.left ?? 0),
        y: evt.clientY - (containerRect?.top ?? 0),
      });
    },
    [intensityMap]
  );

  const handleLoaded = useCallback(() => setIsLoaded(true), []);
  const handleMouseLeave = useCallback(() => setTooltip(null), []);
  const handleMouseMove = useCallback(
    (evt: React.MouseEvent) => {
      if (!tooltip) return;
      const containerRect = (evt.currentTarget as HTMLElement).getBoundingClientRect();
      setTooltip((t) =>
        t
          ? { ...t, x: evt.clientX - containerRect.left, y: evt.clientY - containerRect.top }
          : null
      );
    },
    [tooltip]
  );

  return (
    <div className="relative rsm-container" onMouseMove={handleMouseMove}>
      {/* Zoom controls */}
      {!compact && (
        <div className="absolute top-2 start-2 z-10 flex flex-col gap-1">
          {[
            { label: "+", delta: 0.5 },
            { label: "−", delta: -0.5 },
          ].map(({ label, delta }) => (
            <button
              key={label}
              onClick={() => setZoom((z) => Math.min(Math.max(z + delta, 1), 4))}
              className="w-6 h-6 rounded-md glass-card text-xs font-bold text-emerald-400 hover:text-emerald-300 flex items-center justify-center transition-colors"
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {!isLoaded && <MapSkeleton compact={compact} />}

      <div style={{ display: isLoaded ? "block" : "none" }}>
        <ComposableMap
          projection="geoMercator"
          projectionConfig={{ center: SYRIA_CENTER, scale: SYRIA_SCALE }}
          width={420}
          height={compact ? 220 : 320}
          style={{ width: "100%", height: "auto" }}
        >
          <ZoomableGroup zoom={zoom} center={SYRIA_CENTER} minZoom={1} maxZoom={4}>
            <Geographies geography={GEO_URL}>
              {({ geographies }) => (
                <GeoRenderer
                  geographies={geographies}
                  intensityMap={intensityMap}
                  handleMouseEnter={handleMouseEnter}
                  handleMouseLeave={handleMouseLeave}
                  onLoaded={handleLoaded}
                />
              )}
            </Geographies>

            {/* Markers for high-intensity provinces */}
            {!compact &&
              points
                .filter((p) => p.intensity > 0.4)
                .slice(0, 6)
                .map((p) => (
                  <Marker key={p.label_ar} coordinates={[p.lng, p.lat]}>
                    <circle r={2.5} fill={intensityToStroke(p.intensity)} opacity={0.9} />
                    {p.intensity >= 0.75 && (
                      <circle
                        r={5}
                        fill="none"
                        stroke={intensityToStroke(p.intensity)}
                        strokeWidth={0.8}
                        opacity={0.5}
                        style={{ animation: "ping 1.8s ease-out infinite" }}
                      />
                    )}
                  </Marker>
                ))}
          </ZoomableGroup>
        </ComposableMap>
      </div>

      {/* Floating tooltip */}
      <AnimatePresence>
        {tooltip && (
          <motion.div
            key="tip"
            initial={{ opacity: 0, scale: 0.92, y: 4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92 }}
            transition={{ duration: 0.14 }}
            className="pointer-events-none absolute z-20 glass-card rounded-xl px-3 py-2.5 shadow-lg min-w-[170px]"
            style={{ left: tooltip.x + 12, top: tooltip.y - 60 }}
          >
            <div className="flex items-center justify-between gap-3 mb-1.5" dir="rtl">
              <span className="text-[12px] font-bold text-foreground">{tooltip.name_ar}</span>
              {tooltip.hasData ? (
                <span
                  className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                    tooltip.intensity >= 0.75
                      ? "bg-red-500/20 text-red-400"
                      : tooltip.intensity >= 0.45
                      ? "bg-amber-500/20 text-amber-400"
                      : "bg-emerald-500/20 text-emerald-400"
                  }`}
                >
                  {intensityLabel(tooltip.intensity)}
                </span>
              ) : (
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-white/5 text-muted-foreground">
                  لا توجد بيانات
                </span>
              )}
            </div>
            <div className="space-y-1" dir="rtl">
              {tooltip.hasData && (
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-muted-foreground">مستوى الإصابة</span>
                  <span className={`text-[10px] font-bold ${intensityTextColor(tooltip.intensity)}`}>
                    {Math.round(tooltip.intensity * 100)}٪
                  </span>
                </div>
              )}
              {GOV_STATS[tooltip.name_ar] && (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-muted-foreground">المحصول الرئيسي</span>
                    <span className="text-[10px] text-foreground">
                      {GOV_STATS[tooltip.name_ar].primary}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-muted-foreground">المساحة</span>
                    <span className="text-[10px] text-foreground" dir="ltr">
                      {GOV_STATS[tooltip.name_ar].area}
                    </span>
                  </div>
                </>
              )}
            </div>

            {tooltip.hasData && (
              <div className="mt-2 h-1 rounded-full bg-white/10 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    tooltip.intensity >= 0.75
                      ? "bg-red-400"
                      : tooltip.intensity >= 0.45
                      ? "bg-amber-400"
                      : "bg-emerald-400"
                  }`}
                  style={{ width: `${tooltip.intensity * 100}%` }}
                />
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Legend */}
      {isLoaded && (
        <div className="flex items-center gap-3 mt-1.5 justify-center flex-wrap" dir="rtl">
          {[
            { color: "bg-emerald-400/70", label: "منخفض (1–44٪)" },
            { color: "bg-amber-400/70",   label: "متوسط (45–74٪)" },
            { color: "bg-red-400/70",     label: "مرتفع (75٪+)" },
            { color: "bg-white/10",       label: "لا توجد بيانات" },
          ].map(({ color, label }) => (
            <div key={label} className="flex items-center gap-1">
              <span className={`w-2.5 h-2.5 rounded-sm ${color}`} />
              <span className="text-[10px] text-muted-foreground">{label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
