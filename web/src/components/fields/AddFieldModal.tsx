"use client";

/**
 * Add Field modal — creates a new field with PRECISE coordinates.
 * Pick a location by tapping the mini Syria map, typing Lat/Lng, or using
 * the device GPS. Fully responsive (mobile bottom-sheet → desktop dialog).
 */

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Sprout, MapPin, Ruler, Layers, Plus, LocateFixed, Loader2, CalendarDays } from "lucide-react";
import { PROVINCE_BBOX, estimateGrowthStage, type Field } from "@/lib/fields";
import { PROVINCES as GEO_SHAPES, VIEW_BOX } from "@/components/workspace/SyriaMap";
import { PROVINCE_GEO, nearestProvince, isInSyria, latLngToSvg, svgToLatLng } from "@/lib/geo";
import { cn } from "@/lib/utils";

const PROVINCES = Object.keys(PROVINCE_BBOX);
const CROPS = ["القمح", "القطن", "الزيتون", "الطماطم", "الشعير", "العدس", "الفستق الحلبي", "الحمضيات", "العنب", "المشمش", "الذرة", "البطاطا"];
const SOILS = ["طمية", "رملية", "رملية طينية", "طينية", "جيرية", "صخرية"];

function centroidLatLng(nameAr: string): { lat: number; lng: number } {
  const g = PROVINCE_GEO.find(p => p.nameAr === nameAr) ?? PROVINCE_GEO[0];
  return { lat: g.lat, lng: g.lng };
}

let _seq = 0;
function buildField(
  name: string, crop: string, province: string, areaHa: number, soilType: string,
  geoPin: [number, number], latitude: number, longitude: number, plantingDate: string,
): Field {
  // Growth stage is derived dynamically from the planting date — never hardcoded.
  const { stage, stageProgress } = estimateGrowthStage(plantingDate, crop);
  return {
    id: Date.now() + (_seq++),
    name, crop, province, areaHa, soilType,
    healthScore: 75,
    waterStress: 28,
    irrigDaysAgo: 0,
    history: [70, 71, 72, 73, 74, 74, 75],
    geoPin,
    latitude,        // precise GPS — strictly persisted, not discarded after SVG conversion
    longitude,
    plantingDate,
    aiInsight: "حقل جديد — يجمع وكلاؤنا البيانات الأولية لإعداد تحليل دقيق خلال ساعات.",
    guardianAlert: null,
    stage,
    stageProgress,
  };
}

function FieldInput({ label, icon: Icon, children }: { label: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="flex items-center gap-1.5 text-[11px] font-bold text-muted-foreground font-arabic mb-1.5">
        <Icon className="w-3.5 h-3.5 text-emerald-400/70" /> {label}
      </span>
      {children}
    </label>
  );
}

const fieldCls = "w-full bg-white/[0.04] border border-white/[0.1] focus:border-emerald-500/50 rounded-xl px-3 py-2.5 text-sm text-foreground focus:outline-none transition-colors font-arabic";

// VIEW_BOX = "-0.06 -0.06 7.5574 5.6276"
const VB_X = -0.06, VB_Y = -0.06, VB_W = 7.5574, VB_H = 5.6276;

export function AddFieldModal({ onClose, onAdd }: { onClose: () => void; onAdd: (f: Field) => void }) {
  const init = centroidLatLng(PROVINCES[0]);
  const [name, setName] = useState("");
  const [crop, setCrop] = useState(CROPS[0]);
  const [province, setProvince] = useState(PROVINCES[0]);
  const [area, setArea] = useState("");
  const [soil, setSoil] = useState(SOILS[0]);
  const [plantingDate, setPlantingDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [lat, setLat] = useState(String(init.lat));
  const [lng, setLng] = useState(String(init.lng));
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState("");
  const [touchedCoords, setTouchedCoords] = useState(false);

  const latNum = parseFloat(lat);
  const lngNum = parseFloat(lng);
  const pin = (!isNaN(latNum) && !isNaN(lngNum)) ? latLngToSvg(latNum, lngNum) : null;

  // When province changes and the user hasn't set coords manually, snap to its centre.
  const onProvinceChange = (p: string) => {
    setProvince(p);
    if (!touchedCoords) { const c = centroidLatLng(p); setLat(String(c.lat)); setLng(String(c.lng)); }
  };

  const setCoords = (la: number, ln: number) => {
    setLat(String(Math.round(la * 1000) / 1000));
    setLng(String(Math.round(ln * 1000) / 1000));
    setTouchedCoords(true);
  };

  const onMapTap = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const scale = Math.min(rect.width / VB_W, rect.height / VB_H);   // xMidYMid meet
    const offX = (rect.width - VB_W * scale) / 2;
    const offY = (rect.height - VB_H * scale) / 2;
    const x = VB_X + (e.clientX - rect.left - offX) / scale;
    const y = VB_Y + (e.clientY - rect.top - offY) / scale;
    const { lat: la, lng: ln } = svgToLatLng(x, y);
    setCoords(la, ln);
    const np = nearestProvince(la, ln);
    setProvince(PROVINCES.includes(np.nameAr) ? np.nameAr : province);
  };

  const useMyLocation = useCallback(() => {
    if (!navigator.geolocation) { setError("المتصفح لا يدعم تحديد الموقع"); return; }
    setLocating(true); setError("");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setLocating(false);
        if (!isInSyria(latitude, longitude)) { setError("موقعك الحالي خارج حدود سوريا — اختر يدوياً"); return; }
        setCoords(latitude, longitude);
        const np = nearestProvince(latitude, longitude);
        if (PROVINCES.includes(np.nameAr)) setProvince(np.nameAr);
      },
      () => { setLocating(false); setError("تعذّر تحديد الموقع — تحقق من إذن الموقع"); },
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }, []);

  const submit = () => {
    const areaHa = parseFloat(area);
    if (!name.trim()) { setError("الرجاء إدخال اسم الحقل"); return; }
    if (!areaHa || areaHa <= 0) { setError("الرجاء إدخال مساحة صحيحة بالهكتار"); return; }
    if (!pin) { setError("الرجاء تحديد موقع الحقل"); return; }
    if (!plantingDate) { setError("الرجاء تحديد تاريخ الزراعة"); return; }
    // Persist the PRECISE captured coordinates — SVG pin is only for rendering.
    onAdd(buildField(name.trim(), crop, province, areaHa, soil, pin, latNum, lngNum, plantingDate));
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center" dir="rtl">
      <motion.button
        aria-label="إغلاق"
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, y: 40, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 40, scale: 0.98 }}
        transition={{ type: "spring", stiffness: 360, damping: 32 }}
        className="relative w-full sm:max-w-md sm:mx-4 glass-card rounded-t-3xl sm:rounded-3xl border border-emerald-500/20 emerald-glow-sm p-5 sm:p-6 max-h-[92dvh] overflow-y-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
              <Sprout className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-base font-black text-foreground font-arabic leading-none">إضافة حقل جديد</h2>
              <p className="text-[11px] text-muted-foreground font-arabic mt-1">حدّد موقع حقلك بدقة ليبدأ الوكلاء بمراقبته</p>
            </div>
          </div>
          <button onClick={onClose} aria-label="إغلاق"
            className="w-8 h-8 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.08] flex items-center justify-center transition-colors">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        <div className="space-y-4">
          <FieldInput label="اسم الحقل" icon={Sprout}>
            <input type="text" value={name} onChange={e => { setName(e.target.value); setError(""); }}
              placeholder="مثال: حقل الشمال" className={fieldCls} />
          </FieldInput>

          <div className="grid grid-cols-2 gap-3">
            <FieldInput label="المحصول" icon={Sprout}>
              <select value={crop} onChange={e => setCrop(e.target.value)} className={cn(fieldCls, "appearance-none")}>
                {CROPS.map(c => <option key={c} value={c} className="bg-slate-900">{c}</option>)}
              </select>
            </FieldInput>
            <FieldInput label="المحافظة" icon={MapPin}>
              <select value={province} onChange={e => onProvinceChange(e.target.value)} className={cn(fieldCls, "appearance-none")}>
                {PROVINCES.map(p => <option key={p} value={p} className="bg-slate-900">{p}</option>)}
              </select>
            </FieldInput>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <FieldInput label="المساحة (هكتار)" icon={Ruler}>
              <input type="number" inputMode="decimal" min="0" step="0.1" value={area}
                onChange={e => { setArea(e.target.value); setError(""); }}
                placeholder="4.5" className={cn(fieldCls, "font-numeric")} dir="ltr" />
            </FieldInput>
            <FieldInput label="نوع التربة" icon={Layers}>
              <select value={soil} onChange={e => setSoil(e.target.value)} className={cn(fieldCls, "appearance-none")}>
                {SOILS.map(s => <option key={s} value={s} className="bg-slate-900">{s}</option>)}
              </select>
            </FieldInput>
          </div>

          {/* ── Planting date (drives the dynamic growth stage) ── */}
          <FieldInput label="تاريخ الزراعة" icon={CalendarDays}>
            <input
              type="date"
              value={plantingDate}
              max={new Date().toISOString().slice(0, 10)}
              onChange={e => { setPlantingDate(e.target.value); setError(""); }}
              className={cn(fieldCls, "font-numeric [color-scheme:dark]")}
              dir="ltr"
            />
            <span className="block mt-1 text-[10px] text-muted-foreground/55 font-arabic">
              تُحتسب مرحلة النمو تلقائياً من هذا التاريخ — {estimateGrowthStage(plantingDate, crop).stage}
              {" "}({estimateGrowthStage(plantingDate, crop).stageProgress}%)
            </span>
          </FieldInput>

          {/* ── Precise location picker ── */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="flex items-center gap-1.5 text-[11px] font-bold text-muted-foreground font-arabic">
                <MapPin className="w-3.5 h-3.5 text-emerald-400/70" /> موقع الحقل (اضغط على الخريطة)
              </span>
              <button type="button" onClick={useMyLocation} disabled={locating}
                className="inline-flex items-center gap-1 rounded-lg bg-emerald-500/12 border border-emerald-500/25 text-emerald-300 px-2 py-1 text-[10px] font-bold font-arabic hover:bg-emerald-500/20 transition-colors disabled:opacity-50">
                {locating ? <Loader2 className="w-3 h-3 animate-spin" /> : <LocateFixed className="w-3 h-3" />}
                موقعي الحالي
              </button>
            </div>

            <div className="rounded-xl border border-emerald-500/15 bg-slate-950/40 p-1.5">
              <svg viewBox={VIEW_BOX} className="w-full h-auto cursor-crosshair" style={{ aspectRatio: "7.5574 / 5.6276" }}
                onClick={onMapTap}>
                {GEO_SHAPES.map(g => (
                  <path key={g.name} d={g.path} fill="oklch(0.55 0.09 158)" fillOpacity={0.14}
                    stroke="oklch(0.696 0.170 162 / 30%)" strokeWidth={0.012} />
                ))}
                {pin && (
                  <g className="pointer-events-none">
                    <motion.circle cx={pin[0]} cy={pin[1]} r={0.22} fill="none"
                      stroke="oklch(0.696 0.170 162 / 60%)" strokeWidth={0.05}
                      initial={{ r: 0.12, opacity: 1 }} animate={{ r: 0.42, opacity: 0 }}
                      transition={{ duration: 1.6, repeat: Infinity, ease: "easeOut" }} />
                    <circle cx={pin[0]} cy={pin[1]} r={0.12} fill="oklch(0.85 0.16 162)" stroke="white" strokeWidth={0.03} />
                  </g>
                )}
              </svg>
            </div>

            <div className="grid grid-cols-2 gap-3 mt-2">
              <label className="block">
                <span className="text-[10px] text-muted-foreground/70 font-arabic">خط العرض (Lat)</span>
                <input type="number" inputMode="decimal" step="0.0001" value={lat} dir="ltr"
                  onChange={e => { setLat(e.target.value); setTouchedCoords(true); setError(""); }}
                  className={cn(fieldCls, "font-numeric mt-1 py-2")} />
              </label>
              <label className="block">
                <span className="text-[10px] text-muted-foreground/70 font-arabic">خط الطول (Lng)</span>
                <input type="number" inputMode="decimal" step="0.0001" value={lng} dir="ltr"
                  onChange={e => { setLng(e.target.value); setTouchedCoords(true); setError(""); }}
                  className={cn(fieldCls, "font-numeric mt-1 py-2")} />
              </label>
            </div>
          </div>

          {error && <p className="text-[11px] text-red-400 font-arabic">{error}</p>}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 mt-6">
          <button onClick={submit}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 text-emerald-950 hover:bg-emerald-400 px-4 py-3 text-sm font-bold font-arabic transition-colors emerald-glow-sm">
            <Plus className="w-4 h-4" /> حفظ الحقل
          </button>
          <button onClick={onClose}
            className="rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.1] px-4 py-3 text-sm font-semibold text-muted-foreground font-arabic transition-colors">
            إلغاء
          </button>
        </div>
      </motion.div>
    </div>
  );
}
