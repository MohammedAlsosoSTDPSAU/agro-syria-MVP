export interface Field {
  id: number;
  name: string;
  crop: string;
  province: string;
  healthScore: number;      // 0–100
  waterStress: number;      // 0–100 (higher = more stressed)
  areaHa: number;
  soilType: string;
  irrigDaysAgo: number;
  history: number[];        // last 7 days health scores
  geoPin: [number, number]; // Position in Syria SVG coordinate space
  aiInsight: string;
  guardianAlert: string | null;
  stage: string;
  stageProgress: number;    // 0–100
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

export const FIELDS: Field[] = [
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
    aiInsight: "نمو أسرع من المتوسط بـ 10% — توقع حصاداً مبكراً بـ 5 أيام.",
    guardianAlert: null,
    stage: "مرحلة النضج",
    stageProgress: 78,
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
    aiInsight: "ارتفاع الحرارة يزيد استهلاك المياه — زد جرعة الري 20% في الأيام الثلاثة القادمة.",
    guardianAlert: "تفشي دودة القطن على بُعد 5 كم — يُنصح بالرش الوقائي فوراً.",
    stage: "مرحلة النمو",
    stageProgress: 40,
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
    aiInsight: "الزيتون في ذروة النضج — يُنصح بالحصاد خلال أسبوعين للحصول على أفضل جودة زيت.",
    guardianAlert: null,
    stage: "جاهز للحصاد",
    stageProgress: 94,
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
    aiInsight: "تأخر الري الحاد يهدد المحصول — الإجراء الفوري ضروري لتجنب الخسارة.",
    guardianAlert: "تنبيه حرج: إجهاد مائي شديد · المحصول معرض للخسارة خلال 48 ساعة.",
    stage: "مرحلة الإنبات",
    stageProgress: 20,
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
    aiInsight: "تربة الفرات خصبة — إضافة الآزوت ستحسن الإنتاجية بنسبة 15%.",
    guardianAlert: null,
    stage: "مرحلة التفريع",
    stageProgress: 55,
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
    aiInsight: "إنتاج العنب يسير وفق الجدول — درجات الحرارة مثالية لتطور السكريات.",
    guardianAlert: null,
    stage: "مرحلة الإزهار",
    stageProgress: 60,
  },
];

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
