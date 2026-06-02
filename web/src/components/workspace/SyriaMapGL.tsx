"use client";

import { useState, useCallback, useMemo, useRef } from "react";
import ReactMap, {
  Source,
  Layer,
  Popup,
  NavigationControl,
  type MapRef,
  type MapMouseEvent,
  type MapLayerMouseEvent,
} from "react-map-gl/maplibre";
import maplibregl from "maplibre-gl";
import { motion, AnimatePresence } from "framer-motion";
import type {
  FillLayerSpecification,
  LineLayerSpecification,
} from "@maplibre/maplibre-gl-style-spec";
import type { RegionSummary } from "@/app/api/market/route";

// ── RTL text plugin — enables proper Arabic letter joining on map tiles ─
// Loaded lazily; gracefully ignored if CDN is unreachable
if (typeof window !== "undefined") {
  try {
    maplibregl.setRTLTextPlugin(
      "https://unpkg.com/@mapbox/mapbox-gl-rtl-text@0.2.3/mapbox-gl-rtl-text.min.js",
      true // lazy load
    );
  } catch {
    // Already set in a previous render cycle
  }
}

// ── Tile style — OpenStreetMap via OpenFreeMap (no token required) ────
const OSM_STYLE = "https://tiles.openfreemap.org/styles/liberty";
const MAP_STYLE = OSM_STYLE;

// Syria viewport — center [lat 34.8, lng 38.99], zoom captures all 14 provinces
const INITIAL_VIEW = { latitude: 34.8, longitude: 38.99, zoom: 5.6 };

// ── Intensity → fill color ─────────────────────────────────────────────
function intensityFill(v: number): string {
  if (v < 0)    return "rgba(45, 50, 45, 0.50)";
  if (v >= 0.75) return "rgba(239, 68,  68,  0.65)";
  if (v >= 0.45) return "rgba(245, 158, 11,  0.62)";
  return "rgba(16, 185, 129, 0.58)";
}
function intensityStroke(v: number): string {
  if (v < 0)    return "rgba(90, 100, 90, 0.45)";
  if (v >= 0.75) return "rgba(239, 68,  68,  1)";
  if (v >= 0.45) return "rgba(245, 158, 11,  1)";
  return "rgba(16, 185, 129, 1)";
}

// ── Types ─────────────────────────────────────────────────────────────
interface HoverInfo {
  lng: number;
  lat: number;
  name_ar: string;
  name_en: string;
  intensity: number;
  top_crop_ar: string;
  production_score: number;
}

interface SyriaMapGLProps {
  regions: RegionSummary[];
  selectedRegion?: string | null;
  onRegionSelect?: (gov_ar: string | null) => void;
  compact?: boolean;
}

// ── Component ─────────────────────────────────────────────────────────
export function SyriaMapGL({
  regions,
  selectedRegion,
  onRegionSelect,
  compact = false,
}: SyriaMapGLProps) {
  const mapRef        = useRef<MapRef>(null);
  const hoveredIdRef  = useRef<string | null>(null);
  const [hoverInfo, setHoverInfo] = useState<HoverInfo | null>(null);

  // name_ar → RegionSummary lookup
  const regionMap = useMemo(
    () => new globalThis.Map(regions.map((r) => [r.gov_ar, r])),
    [regions]
  );

  // ── Layer specs ──────────────────────────────────────────────────────
  // Fill color driven by intensity — built once per regions change
  const fillMatchExpr = useMemo(() => {
    const pairs: unknown[] = [];
    for (const [name, r] of regionMap) {
      pairs.push(name, intensityFill(r.intensity));
    }
    return ["match", ["get", "name_ar"], ...pairs, "rgba(45, 50, 45, 0.45)"];
  }, [regionMap]);

  const strokeMatchExpr = useMemo(() => {
    const pairs: unknown[] = [];
    for (const [name, r] of regionMap) {
      pairs.push(name, intensityStroke(r.intensity));
    }
    return ["match", ["get", "name_ar"], ...pairs, "rgba(90, 100, 90, 0.45)"];
  }, [regionMap]);

  // Base fill layer — color driven by intensity
  const fillLayer: FillLayerSpecification = {
    id: "provinces-fill",
    type: "fill",
    source: "syria-provinces",
    paint: {
      "fill-color":   fillMatchExpr as NonNullable<FillLayerSpecification["paint"]>["fill-color"],
      "fill-opacity": 1,
    },
  };

  // Hover highlight layer — white overlay via feature-state
  const hoverLayer: FillLayerSpecification = {
    id: "provinces-hover",
    type: "fill",
    source: "syria-provinces",
    paint: {
      "fill-color":   "#ffffff",
      "fill-opacity": [
        "case",
        ["boolean", ["feature-state", "hover"], false],
        0.18,
        0,
      ] as NonNullable<FillLayerSpecification["paint"]>["fill-opacity"],
    },
  };

  // Selected province — bright emerald border
  const selectedLineLayer: LineLayerSpecification = {
    id: "provinces-selected-border",
    type: "line",
    source: "syria-provinces",
    filter: ["==", ["get", "name_ar"], selectedRegion ?? "___none___"],
    paint: {
      "line-color": "#10b981",
      "line-width": 2.8,
      "line-opacity": 0.95,
    },
  };

  // Default province borders
  const borderLayer: LineLayerSpecification = {
    id: "provinces-border",
    type: "line",
    source: "syria-provinces",
    paint: {
      "line-color":   strokeMatchExpr as NonNullable<LineLayerSpecification["paint"]>["line-color"],
      "line-width":   0.75,
      "line-opacity": 0.85,
    },
  };

  // ── Handlers ─────────────────────────────────────────────────────────
  const onMouseMove = useCallback(
    (e: MapLayerMouseEvent) => {
      const map = mapRef.current;
      if (!map) return;

      const feat = e.features?.[0];
      if (feat) {
        const name_ar = feat.properties?.name_ar as string;

        // Clear old hover feature state
        if (hoveredIdRef.current && hoveredIdRef.current !== name_ar) {
          map.setFeatureState(
            { source: "syria-provinces", id: hoveredIdRef.current },
            { hover: false }
          );
        }

        // Set new hover feature state
        map.setFeatureState(
          { source: "syria-provinces", id: name_ar },
          { hover: true }
        );
        hoveredIdRef.current = name_ar;

        const region = regionMap.get(name_ar);
        setHoverInfo({
          lng: e.lngLat.lng,
          lat: e.lngLat.lat,
          name_ar,
          name_en:          feat.properties?.name_en as string ?? "",
          intensity:        region?.intensity        ?? -1,
          top_crop_ar:      region?.top_crop_ar      ?? "—",
          production_score: region?.production_score ?? 0,
        });
      } else {
        // Mouse left all features
        if (hoveredIdRef.current) {
          map.setFeatureState(
            { source: "syria-provinces", id: hoveredIdRef.current },
            { hover: false }
          );
          hoveredIdRef.current = null;
        }
        setHoverInfo(null);
      }
    },
    [regionMap]
  );

  const onClick = useCallback(
    (e: MapLayerMouseEvent) => {
      const feat = e.features?.[0];
      if (feat) {
        const name_ar = feat.properties?.name_ar as string;
        const next = selectedRegion === name_ar ? null : name_ar;
        onRegionSelect?.(next);

        // Fly to province centroid
        const r = regionMap.get(name_ar);
        if (r && mapRef.current) {
          mapRef.current.flyTo({
            center: [r.lng, r.lat],
            zoom:   compact ? 6.8 : 7.2,
            duration: 850,
            essential: true,
          });
        }
      } else {
        onRegionSelect?.(null);
        mapRef.current?.flyTo({
          center:   [INITIAL_VIEW.longitude, INITIAL_VIEW.latitude],
          zoom:     INITIAL_VIEW.zoom,
          duration: 700,
        });
      }
    },
    [selectedRegion, onRegionSelect, regionMap, compact]
  );

  const onMouseLeave = useCallback(() => {
    const map = mapRef.current;
    if (map && hoveredIdRef.current) {
      map.setFeatureState(
        { source: "syria-provinces", id: hoveredIdRef.current },
        { hover: false }
      );
      hoveredIdRef.current = null;
    }
    setHoverInfo(null);
  }, []);

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <div
      className="relative rounded-xl overflow-hidden"
      style={{ height: compact ? 260 : 420 }}
    >
      <ReactMap
        ref={mapRef}
        mapStyle={MAP_STYLE}
        initialViewState={INITIAL_VIEW}
        interactiveLayerIds={["provinces-fill", "provinces-hover"]}
        onMouseMove={onMouseMove}
        onClick={onClick}
        onMouseLeave={onMouseLeave}
        style={{ width: "100%", height: "100%" }}
        attributionControl={false}
        cursor={hoverInfo ? "pointer" : "default"}
      >
        {/* promoteId uses name_ar as feature ID for feature-state */}
        <Source
          id="syria-provinces"
          type="geojson"
          data="/syria-provinces.geojson"
          promoteId="name_ar"
        >
          <Layer {...fillLayer} />
          <Layer {...hoverLayer} />
          <Layer {...borderLayer} />
          <Layer {...selectedLineLayer} />
        </Source>

        {!compact && (
          <NavigationControl
            position="top-left"
            style={{ marginTop: 8, marginLeft: 8 }}
            showCompass={false}
          />
        )}

        {/* Hover popup — styled glass card matching design system */}
        {hoverInfo && (
          <Popup
            longitude={hoverInfo.lng}
            latitude={hoverInfo.lat}
            closeButton={false}
            closeOnClick={false}
            anchor="bottom"
            offset={14}
          >
            <div
              className="min-w-[175px] rounded-xl px-3 py-2.5 text-white"
              style={{
                background:     "oklch(0.12 0.25 158 / 0.96)",
                border:         "1px solid oklch(0.696 0.170 162 / 0.30)",
                backdropFilter: "blur(16px)",
                fontFamily:     "var(--font-arabic, var(--font-sans, Cairo, sans-serif))",
              }}
              dir="rtl"
            >
              {/* Province name + badge */}
              <div className="flex items-center justify-between gap-3 mb-2">
                <span className="text-[13px] font-bold">{hoverInfo.name_ar}</span>
                <span
                  className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${
                    hoverInfo.intensity < 0
                      ? "bg-white/10 text-white/40"
                      : hoverInfo.intensity >= 0.75
                      ? "bg-red-500/25 text-red-300"
                      : hoverInfo.intensity >= 0.45
                      ? "bg-amber-500/25 text-amber-300"
                      : "bg-emerald-500/25 text-emerald-300"
                  }`}
                >
                  {hoverInfo.intensity < 0
                    ? "غير متاح"
                    : hoverInfo.intensity >= 0.75
                    ? "إنتاج عالٍ"
                    : hoverInfo.intensity >= 0.45
                    ? "إنتاج متوسط"
                    : "إنتاج منخفض"}
                </span>
              </div>

              {hoverInfo.intensity >= 0 && (
                <>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[10px]">
                    <span className="text-white/50">المحصول الأول</span>
                    <span className="text-white/90 text-left">{hoverInfo.top_crop_ar}</span>
                    <span className="text-white/50">مؤشر الإنتاج</span>
                    <span className="font-bold text-emerald-300 text-left tabular-nums" style={{ fontFamily: "var(--font-inter, ui-sans-serif)" }}>
                      {hoverInfo.production_score}
                    </span>
                  </div>

                  {/* Intensity bar */}
                  <div className="mt-2 h-[3px] rounded-full bg-white/10 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        hoverInfo.intensity >= 0.75
                          ? "bg-red-400"
                          : hoverInfo.intensity >= 0.45
                          ? "bg-amber-400"
                          : "bg-emerald-400"
                      }`}
                      style={{ width: `${Math.round(hoverInfo.intensity * 100)}%` }}
                    />
                  </div>
                </>
              )}

              {/* Click hint */}
              <p className="text-[9px] text-white/30 mt-1.5 text-center">
                انقر لتصفية البيانات
              </p>
            </div>
          </Popup>
        )}
      </ReactMap>

      {/* Legend */}
      <div
        className="absolute bottom-3 end-3 flex flex-col gap-1.5 px-2.5 py-2 rounded-xl pointer-events-none"
        style={{
          background:     "oklch(0.12 0.25 158 / 0.88)",
          border:         "1px solid oklch(0.696 0.170 162 / 0.18)",
          backdropFilter: "blur(12px)",
        }}
        dir="rtl"
      >
        {([
          { cls: "bg-emerald-400/80", label: "منخفض" },
          { cls: "bg-amber-400/80",   label: "متوسط" },
          { cls: "bg-red-400/80",     label: "مرتفع" },
          { cls: "bg-white/15",       label: "لا بيانات" },
        ] as const).map(({ cls, label }) => (
          <div key={label} className="flex items-center gap-1.5">
            <span className={`w-2.5 h-2.5 rounded-sm flex-shrink-0 ${cls}`} />
            <span className="text-[9px] text-white/55">{label}</span>
          </div>
        ))}
      </div>

      {/* Recenter Syria button — always visible, top-left after nav controls */}
      <button
        onClick={() => {
          onRegionSelect?.(null);
          mapRef.current?.flyTo({
            center:   [INITIAL_VIEW.longitude, INITIAL_VIEW.latitude],
            zoom:     INITIAL_VIEW.zoom,
            duration: 750,
            essential: true,
          });
        }}
        aria-label="إعادة توسيط سوريا"
        title="إعادة توسيط سوريا"
        className="absolute top-3 start-3 flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-[10px] text-white/55 hover:text-white/90 transition-all hover:scale-105 active:scale-95"
        style={{
          background:     "oklch(0.12 0.25 158 / 0.88)",
          border:         "1px solid oklch(0.696 0.170 162 / 0.20)",
          backdropFilter: "blur(10px)",
          marginTop: compact ? 4 : 44,
        }}
        dir="rtl"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="3"/><path d="M12 2v4m0 12v4M2 12h4m12 0h4"/>
        </svg>
        {!compact && <span>سوريا</span>}
      </button>

      {/* Selected province badge */}
      <AnimatePresence>
        {selectedRegion && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18 }}
            className="absolute top-3 start-24 flex items-center gap-1.5 px-2.5 py-1.5 rounded-full"
            style={{
              background:     "oklch(0.12 0.25 158 / 0.92)",
              border:         "1px solid oklch(0.696 0.170 162 / 0.45)",
              backdropFilter: "blur(10px)",
              marginTop: compact ? 4 : 44,
            }}
            dir="rtl"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[11px] text-emerald-300 font-semibold">{selectedRegion}</span>
            <button
              aria-label="إلغاء تحديد المحافظة"
              onClick={() => {
                onRegionSelect?.(null);
                mapRef.current?.flyTo({
                  center:   [INITIAL_VIEW.longitude, INITIAL_VIEW.latitude],
                  zoom:     INITIAL_VIEW.zoom,
                  duration: 700,
                });
              }}
              className="text-white/35 hover:text-white/80 text-[11px] leading-none ms-0.5 transition-colors"
            >
              ✕
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
