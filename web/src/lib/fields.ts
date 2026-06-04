import { svgToLatLng } from "./geo";

// ── Satellite / NDVI telemetry (production-ready data contract) ─────────
export interface NdviPoint {
  ndviScore: number;        // 0–1 normalized difference vegetation index
  waterStressIndex: number; // 0–100 (higher = more stressed)
  capturedAt: string;       // ISO-8601 capture timestamp
}

export interface SatelliteTelemetry {
  ndviScore: number;        // latest NDVI 0–1
  waterStressIndex: number; // 0–100
  capturedAt: string;       // ISO-8601 capture timestamp
  source?: string;          // e.g. "Sentinel-2", "Landsat-9"
}

export interface Field {
  id: number;
  name: string;
  crop: string;
  province: string;
  healthScore: number;      // 0–100 (telemetry-derived when satelliteTelemetry is present)
  waterStress: number;      // 0–100 (higher = more stressed)
  areaHa: number;
  soilType: string;
  irrigDaysAgo: number;
  history: number[];        // last 7 days health scores
  geoPin: [number, number]; // Position in Syria SVG coordinate space (render projection only)
  latitude: number;         // precise GPS latitude  — persisted, never discarded
  longitude: number;        // precise GPS longitude — persisted, never discarded
  plantingDate: string;     // ISO date (YYYY-MM-DD) — drives the dynamic growth stage
  aiInsight: string;
  guardianAlert: string | null;
  stage: string;            // derived from plantingDate via estimateGrowthStage()
  stageProgress: number;    // 0–100, derived from plantingDate
  satelliteTelemetry?: SatelliteTelemetry; // optional live satellite feed
  ndviTimeSeries?: NdviPoint[];            // optional historical NDVI series
  remoteId?: string;                       // Supabase row uuid (when synced to DB)
}

// ── Dynamic growth-stage estimation (replaces hardcoded stage strings) ──
// Typical full crop cycle length (planting → harvest) in days.
const CROP_CYCLE_DAYS: Record<string, number> = {
  "القمح": 220, "الشعير": 210, "القطن": 180, "الذرة": 120, "الطماطم": 110,
  "البطاطا": 120, "العدس": 150, "الزيتون": 240, "العنب": 210, "الحمضيات": 270,
  "الفستق الحلبي": 240, "المشمش": 200,
};
const DEFAULT_CYCLE_DAYS = 150;

/** Estimate the current growth stage + progress from the planting date & crop. */
export function estimateGrowthStage(
  plantingDate?: string,
  crop?: string,
  now: Date = new Date(),
): { stage: string; stageProgress: number } {
  if (!plantingDate) return { stage: "مرحلة التأسيس", stageProgress: 5 };
  const planted = new Date(plantingDate).getTime();
  if (isNaN(planted)) return { stage: "مرحلة التأسيس", stageProgress: 5 };

  const days  = Math.max(0, (now.getTime() - planted) / 86_400_000);
  const cycle = CROP_CYCLE_DAYS[crop ?? ""] ?? DEFAULT_CYCLE_DAYS;
  const progress = Math.min(100, Math.max(0, Math.round((days / cycle) * 100)));

  let stage: string;
  if (progress < 8)        stage = "مرحلة التأسيس";
  else if (progress < 25)  stage = "مرحلة الإنبات";
  else if (progress < 50)  stage = "مرحلة التفريع";
  else if (progress < 70)  stage = "مرحلة النمو";
  else if (progress < 88)  stage = "مرحلة النضج";
  else if (progress < 100) stage = "اقتراب الحصاد";
  else                     stage = "جاهز للحصاد";

  return { stage, stageProgress: progress };
}

// ── Telemetry → health helpers (graceful fallback to simulated scores) ──
/** Convert satellite telemetry to a 0–100 health score. */
export function ndviToHealth(t: SatelliteTelemetry | NdviPoint): number {
  return Math.max(0, Math.min(100, Math.round(t.ndviScore * 100 - t.waterStressIndex * 0.15)));
}

/** Health that prefers live satellite telemetry, else the stored/simulated score. */
export function effectiveHealth(f: Field): number {
  return f.satelliteTelemetry ? ndviToHealth(f.satelliteTelemetry) : f.healthScore;
}

/** Water stress that prefers live telemetry, else the stored/simulated value. */
export function effectiveWaterStress(f: Field): number {
  return f.satelliteTelemetry ? Math.round(f.satelliteTelemetry.waterStressIndex) : f.waterStress;
}

/**
 * Normalize a stored/legacy field record into a complete, current Field:
 * - backfills precise GPS from geoPin if missing,
 * - recomputes the growth stage from plantingDate (so it stays fresh over time),
 * - bakes satellite telemetry into healthScore/waterStress when present.
 */
export function migrateField(raw: Partial<Field> & { area?: number }): Field {
  const geoPin: [number, number] = Array.isArray(raw.geoPin) ? raw.geoPin : [1.5, 2.8];

  let latitude  = typeof raw.latitude === "number" ? raw.latitude : undefined;
  let longitude = typeof raw.longitude === "number" ? raw.longitude : undefined;
  if (latitude == null || longitude == null) {
    const ll = svgToLatLng(geoPin[0], geoPin[1]);
    latitude  = latitude  ?? ll.lat;
    longitude = longitude ?? ll.lng;
  }

  const plantingDate =
    typeof raw.plantingDate === "string" && raw.plantingDate
      ? raw.plantingDate
      : new Date().toISOString().slice(0, 10);

  const { stage, stageProgress } = estimateGrowthStage(plantingDate, raw.crop);

  const tel = raw.satelliteTelemetry;
  const healthScore = tel ? ndviToHealth(tel) : (typeof raw.healthScore === "number" ? raw.healthScore : 75);
  const waterStress = tel ? Math.round(tel.waterStressIndex) : (typeof raw.waterStress === "number" ? raw.waterStress : 28);

  return {
    id: typeof raw.id === "number" ? raw.id : Date.now(),
    name: raw.name ?? "حقل",
    crop: raw.crop ?? "القمح",
    province: raw.province ?? "حمص",
    healthScore,
    waterStress,
    areaHa: raw.areaHa ?? raw.area ?? 1,
    soilType: raw.soilType ?? "طمية",
    irrigDaysAgo: raw.irrigDaysAgo ?? 0,
    history: Array.isArray(raw.history) ? raw.history : [70, 71, 72, 73, 74, 74, 75],
    geoPin,
    latitude,
    longitude,
    plantingDate,
    aiInsight: raw.aiInsight ?? "حقل جديد — يجمع وكلاؤنا البيانات الأولية لإعداد تحليل دقيق.",
    guardianAlert: raw.guardianAlert ?? null,
    stage,
    stageProgress,
    satelliteTelemetry: tel,
    ndviTimeSeries: raw.ndviTimeSeries,
  };
}

// Province bounding boxes in Syria SVG coordinate space
// VIEW_BOX = "-0.06 -0.06 7.5574 5.6276"  →  x: 0–7.5, y: 0–5.6 (y increases southward)
export const PROVINCE_BBOX: Record<string, [number, number, number, number]> = {
  // [minX, minY, width, height] — derived from actual SVG path bounding boxes
  "حمص":       [0.830, 2.178, 4.057, 1.839],
  "ريف دمشق": [0.537, 3.320, 3.322, 1.556],
  "السويداء":  [1.061, 4.341, 1.158, 0.916],
  "القنيطرة":  [0.338, 4.206, 0.375, 0.681],
  "درعا":      [0.491, 4.273, 0.805, 0.939],
  "حلب":       [1.268, 0.645, 2.177, 1.540],
  "حماة":      [0.859, 1.807, 2.169, 0.909],
  "إدلب":      [0.873, 1.226, 1.068, 0.966],
  "دمشق":      [0.922, 3.997, 0.159, 0.113],
  "طرطوس":    [0.579, 2.305, 0.470, 0.636],
  "اللاذقية":  [0.441, 1.629, 0.539, 0.724],
  "الحسكة":   [4.164, 0.250, 2.936, 1.766],
  "دير الزور": [3.967, 1.105, 2.082, 2.387],
  "الرقة":     [2.782, 0.787, 1.747, 1.533],
};

// Raw seed (stage/stageProgress derived below from plantingDate via estimateGrowthStage).
type FieldSeed = Omit<Field, "stage" | "stageProgress">;

const FIELD_SEED: FieldSeed[] = [
  {
    id: 1,
    name: "حقل الشمال",
    crop: "القمح",
    province: "حمص",
    healthScore: 87,
    waterStress: 18,
    areaHa: 4.2,
    soilType: "طمية",
    irrigDaysAgo: 1,
    history: [72, 75, 78, 80, 83, 85, 87],
    geoPin: [1.48, 2.88],
    latitude: 34.58, longitude: 36.56,
    plantingDate: "2025-12-15",
    aiInsight: "نمو أسرع من المتوسط بـ 10% — توقع حصاداً مبكراً بـ 5 أيام.",
    guardianAlert: null,
    // Live satellite feed → healthScore/waterStress are derived from this.
    satelliteTelemetry: { ndviScore: 0.82, waterStressIndex: 18, capturedAt: "2026-06-04T09:30:00Z", source: "Sentinel-2" },
  },
  {
    id: 2,
    name: "حقل الجنوب",
    crop: "القطن",
    province: "حمص",
    healthScore: 54,
    waterStress: 72,
    areaHa: 7.8,
    soilType: "رملية طينية",
    irrigDaysAgo: 5,
    history: [68, 64, 62, 60, 57, 55, 54],
    geoPin: [2.18, 3.55],
    latitude: 33.88, longitude: 37.26,
    plantingDate: "2026-03-25",
    aiInsight: "ارتفاع الحرارة يزيد استهلاك المياه — زد جرعة الري 20% في الأيام الثلاثة القادمة.",
    guardianAlert: "تفشي دودة القطن على بُعد 5 كم — يُنصح بالرش الوقائي فوراً.",
  },
  {
    id: 3,
    name: "البستان الغربي",
    crop: "الزيتون",
    province: "طرطوس",
    healthScore: 92,
    waterStress: 12,
    areaHa: 2.1,
    soilType: "كلسية",
    irrigDaysAgo: 0,
    history: [85, 87, 88, 90, 90, 91, 92],
    geoPin: [0.70, 2.78],
    latitude: 34.69, longitude: 35.78,
    plantingDate: "2025-10-22",
    aiInsight: "الزيتون في ذروة النضج — يُنصح بالحصاد خلال أسبوعين للحصول على أفضل جودة زيت.",
    guardianAlert: null,
  },
  {
    id: 4,
    name: "الحقل الشرقي",
    crop: "الطماطم",
    province: "حماة",
    healthScore: 34,
    waterStress: 88,
    areaHa: 6.5,
    soilType: "طمية",
    irrigDaysAgo: 6,
    history: [55, 52, 48, 44, 41, 37, 34],
    geoPin: [1.62, 2.32],
    latitude: 35.17, longitude: 36.70,
    plantingDate: "2026-05-14",
    aiInsight: "تأخر الري الحاد يهدد المحصول — الإجراء الفوري ضروري لتجنب الخسارة.",
    guardianAlert: "تنبيه حرج: إجهاد مائي شديد · المحصول معرض للخسارة خلال 48 ساعة.",
    // Live satellite feed shows critically low NDVI + high water stress.
    satelliteTelemetry: { ndviScore: 0.34, waterStressIndex: 88, capturedAt: "2026-06-04T09:30:00Z", source: "Sentinel-2" },
  },
  {
    id: 5,
    name: "حقل الفرات",
    crop: "الشعير",
    province: "دير الزور",
    healthScore: 71,
    waterStress: 35,
    areaHa: 9.0,
    soilType: "طمية خفيفة",
    irrigDaysAgo: 2,
    history: [62, 65, 66, 68, 69, 70, 71],
    geoPin: [5.12, 2.42],
    latitude: 35.07, longitude: 40.22,
    plantingDate: "2026-02-10",
    aiInsight: "تربة الفرات خصبة — إضافة الآزوت ستحسن الإنتاجية بنسبة 15%.",
    guardianAlert: null,
  },
  {
    id: 6,
    name: "مزرعة الجبل",
    crop: "العنب",
    province: "اللاذقية",
    healthScore: 80,
    waterStress: 25,
    areaHa: 3.3,
    soilType: "صخرية جيرية",
    irrigDaysAgo: 3,
    history: [74, 75, 76, 77, 78, 79, 80],
    geoPin: [0.66, 2.08],
    latitude: 35.43, longitude: 35.73,
    plantingDate: "2026-01-30",
    aiInsight: "إنتاج العنب يسير وفق الجدول — درجات الحرارة مثالية لتطور السكريات.",
    guardianAlert: null,
  },
];

export const FIELDS: Field[] = FIELD_SEED.map((f) => ({
  ...f,
  ...estimateGrowthStage(f.plantingDate, f.crop),
  // Bake live telemetry into health/stress so the seed matches migrateField().
  ...(f.satelliteTelemetry
    ? { healthScore: ndviToHealth(f.satelliteTelemetry), waterStress: Math.round(f.satelliteTelemetry.waterStressIndex) }
    : {}),
}));

export function healthColor(score: number): string {
  if (score >= 75) return "#10b981";
  if (score >= 50) return "#f59e0b";
  return "#ef4444";
}

export function healthLabel(score: number): string {
  if (score >= 75) return "صحي";
  if (score >= 50) return "متوسط";
  return "حرج";
}

export function totalHa(fields: Field[]): number {
  return fields.reduce((s, f) => s + f.areaHa, 0);
}

export function avgHealth(fields: Field[]): number {
  if (!fields.length) return 0;
  return Math.round(fields.reduce((s, f) => s + f.healthScore, 0) / fields.length);
}

export function criticalCount(fields: Field[]): number {
  return fields.filter(f => f.healthScore < 50 || f.waterStress > 70).length;
}

export function syncFieldsToContext(fields: Field[]): void {
  if (typeof window === "undefined") return;
  const crops = [...new Set(fields.map(f => f.crop))];
  const provinces = fields.map(f => f.province);
  const preferredProvince = provinces.sort(
    (a, b) => provinces.filter(p => p === b).length - provinces.filter(p => p === a).length
  )[0];
  localStorage.setItem("agro_fields_v1_context", JSON.stringify({
    fields: fields.map(f => ({ nameAr: f.name, cropAr: f.crop, areaHa: f.areaHa, provinceAr: f.province })),
    active_crops: crops,
    preferred_province: preferredProvince,
  }));
}
