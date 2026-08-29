// Agricultural Intelligence Engine — Dashboard Brain
// May 30, 2026 — Syrian province + crop context

import { PROVINCES, PROVINCE_FORECASTS, type ProvinceWeather } from "./weather";
import { getAgentInsight, type AgroContext } from "./ai-service";

/* ─── Public types ───────────────────────────────────────────────────── */
export type AlertSeverity = "critical" | "warning" | "info" | "opportunity";
export type AmbientMood   = "normal" | "heatwave" | "sandstorm" | "rainy";

export interface FarmContext {
  provinceId: string | null;
  cropKey:    string | null;
}

export interface HealthBreakdown {
  total:      number;   // 0-100
  weather:    number;   // 0-40
  crop:       number;   // 0-30
  irrigation: number;   // 0-30
  label:      string;
  hex:        string;   // fill color for gauge
  glowClass:  string;   // Tailwind glow class
}

export interface DashboardInsight {
  type:     "weather" | "action" | "market";
  severity: AlertSeverity;
  title:    string;
  body:     string;
  priority: string;     // short actionable task for the Trio card
}

export interface DashboardAlert {
  severity: AlertSeverity;
  agent:    string;
  text:     string;
}

export interface DashboardData {
  health:      HealthBreakdown;
  insights:    [DashboardInsight, DashboardInsight, DashboardInsight];
  alerts:      DashboardAlert[];
  ambient:     AmbientMood;
  briefingLine: string;           // typewriter main text
  province:    ProvinceWeather;
  cropNameAr:  string | null;
}

/* ─── Internal crop thresholds ───────────────────────────────────────── */
const CROP_OPT: Record<string, { nameAr: string; optMax: number; stressMax: number; harvestNow: boolean }> = {
  wheat:    { nameAr: "قمح",    optMax: 25, stressMax: 30, harvestNow: true  },
  barley:   { nameAr: "شعير",   optMax: 22, stressMax: 28, harvestNow: true  },
  cotton:   { nameAr: "قطن",    optMax: 35, stressMax: 39, harvestNow: false },
  lentils:  { nameAr: "عدس",    optMax: 26, stressMax: 31, harvestNow: true  },
  tomato:   { nameAr: "طماطم",  optMax: 29, stressMax: 33, harvestNow: false },
  potato:   { nameAr: "بطاطا",  optMax: 21, stressMax: 26, harvestNow: false },
  olive:    { nameAr: "زيتون",  optMax: 35, stressMax: 40, harvestNow: false },
  grapes:   { nameAr: "كرمة",   optMax: 32, stressMax: 37, harvestNow: false },
  chickpeas:{ nameAr: "حمص",    optMax: 27, stressMax: 32, harvestNow: true  },
  cucumber: { nameAr: "خيار",   optMax: 30, stressMax: 34, harvestNow: false },
  eggplant: { nameAr: "باذنجان",optMax: 32, stressMax: 36, harvestNow: false },
  onion:    { nameAr: "بصل",    optMax: 24, stressMax: 28, harvestNow: true  },
};

/* ─── ET₀ helper (simplified FAO-56) ────────────────────────────────── */
function et0(p: ProvinceWeather): number {
  const Rs = p.solarRadiation * 0.0864 * (10 / 24);
  const Rn = (1 - 0.23) * Rs * 0.55;
  const u2 = p.windSpeed / 3.6;
  const es = 0.6108 * Math.exp(17.27 * p.temp / (p.temp + 237.3));
  const ea = (p.humidity / 100) * es;
  const d  = 4098 * es / Math.pow(p.temp + 237.3, 2);
  const g  = 0.0665;
  const Tk = p.temp + 273;
  return Math.max(1, Math.round((0.408 * d * Rn + g * (900 / Tk) * u2 * Math.max(0, es - ea)) / (d + g * (1 + 0.34 * u2)) * 10) / 10);
}

/* ─── Score sub-calculators ──────────────────────────────────────────── */
function weatherScore(p: ProvinceWeather): number {
  let s = 40;
  if (p.isExtreme)            s -= 20;
  if (p.airQualityIndex > 150) s -= 8;
  else if (p.airQualityIndex > 100) s -= 4;
  if (p.uvIndex >= 11)         s -= 5;
  else if (p.uvIndex >= 9)     s -= 2;
  if (p.windSpeed > 25)        s -= 4;
  return Math.max(0, s);
}

function cropScore(cropKey: string | null, temp: number): number {
  if (!cropKey) return 18;
  const m = CROP_OPT[cropKey];
  if (!m) return 18;
  if (temp <= m.optMax)    return 30;
  if (temp <= m.stressMax) return 20;
  return 8;
}

function irrigationScore(p: ProvinceWeather): number {
  if (p.precipitation > 40) return 26;
  const e = et0(p);
  if (e < 4)  return 28;
  if (e < 7)  return 22;
  if (e < 10) return 14;
  return 7;
}

function healthLabel(total: number): { label: string; hex: string; glowClass: string } {
  if (total >= 85) return { label: "ممتاز",     hex: "#10b981", glowClass: "shadow-[0_0_40px_oklch(0.696_0.170_162_/_25%)]" };
  if (total >= 70) return { label: "جيد جداً",  hex: "#22c55e", glowClass: "shadow-[0_0_40px_#22c55e40]" };
  if (total >= 55) return { label: "جيد",       hex: "#84cc16", glowClass: "shadow-[0_0_35px_#84cc1640]" };
  if (total >= 40) return { label: "تحذير",     hex: "#f59e0b", glowClass: "shadow-[0_0_35px_#f59e0b40]" };
  if (total >= 25) return { label: "خطر",       hex: "#f97316", glowClass: "shadow-[0_0_35px_#f9731640]" };
  return               { label: "حرج",       hex: "#ef4444", glowClass: "shadow-[0_0_35px_#ef444440]" };
}

/* ─── Insight generators ─────────────────────────────────────────────── */
function weatherInsight(p: ProvinceWeather): DashboardInsight {
  const forecast = PROVINCE_FORECASTS[p.id] ?? [];
  const rainSoon = forecast.slice(1, 3).some(d => d.precipChance > 35);

  if (p.isExtreme && p.ambientState === "dusty")
    return {
      type: "weather", severity: "critical",
      title: `عاصفة غبارية — ${p.nameAr}`,
      body:  `رياح خماسينية ${p.windSpeed} كم/س وغبار كثيف. أغلق المحميات وأوقف الرش كلياً.`,
      priority: `أغلق محميات ${p.nameAr} فوراً`,
    };

  if (p.isExtreme)
    return {
      type: "weather", severity: "critical",
      title: `موجة حر شديدة — ${p.temp}°م`,
      body:  `الحرارة ${p.temp}°م في ${p.nameAr} تفوق الحد الحرج. الري الفجري 5-9 ص إلزامي وزد الكميات 35%.`,
      priority: `اروِ فجراً وتجنب العمل 12-4م`,
    };

  if (rainSoon)
    return {
      type: "weather", severity: "opportunity",
      title: "أمطار قادمة — فرصة تعبئة",
      body:  `احتمال هطول ${forecast[1]?.precipChance ?? 0}% خلال 48 ساعة في ${p.nameAr}. وفّر مياه الري وجهّز خزانات التجميع.`,
      priority: "وفّر مياه الري 24 ساعة مسبقاً",
    };

  if (p.windSpeed > 20)
    return {
      type: "weather", severity: "warning",
      title: `رياح قوية ${p.windSpeed} كم/س`,
      body:  `الرياح تتجاوز حد الرش الآمن في ${p.nameAr}. أجّل رش المبيدات حتى الفجر (< 15 كم/س).`,
      priority: "أجّل الرش — انتظر الفجر",
    };

  return {
    type: "weather", severity: "info",
    title: `طقس مستقر — ${p.nameAr}`,
    body:  `${p.temp}°م وصحو في ${p.nameAr}. نافذة عمل مثالية الآن حتى ارتفاع الحرارة بعد الظهر.`,
    priority: "استغل الصباح للعمل الميداني",
  };
}

function actionInsight(p: ProvinceWeather, cropKey: string | null): DashboardInsight {
  const m = cropKey ? CROP_OPT[cropKey] : null;

  if (m?.harvestNow)
    return {
      type: "action", severity: "opportunity",
      title: `موسم حصاد ${m.nameAr}`,
      body:  `${m.nameAr} في ${p.nameAr} جاهز للحصاد — تأخير الحصاد فوق ${m.stressMax}°م يخفض جودة الحبة. ابدأ فجراً.`,
      priority: `ابدأ حصاد ${m.nameAr} من الفجر`,
    };

  if (cropKey === "olive")
    return {
      type: "action", severity: "warning",
      title: "إزهار الزيتون — مرحلة حرجة",
      body:  `الزيتون في ${p.nameAr} في طور الإزهار الحساس. زد الري 15% وافحص أسبوعياً لذبابة الزيتون.`,
      priority: "راقب ذبابة الزيتون أسبوعياً",
    };

  if (cropKey === "cotton")
    return {
      type: "action", severity: "info",
      title: "القطن — طور الإنبات",
      body:  `القطن في ${p.nameAr} يحتاج ريّاً منتظماً كل 4 أيام في هذا الطور. الحرارة ${p.temp}°م مثالية للنمو.`,
      priority: "اروِ القطن كل 4 أيام",
    };

  if (m)
    return {
      type: "action", severity: "info",
      title: `توصية ${m.nameAr}`,
      body:  `محصول ${m.nameAr} في ${p.nameAr}: الوقت مثالي للتسميد النيتروجيني قبل ارتفاع درجات الحرارة.`,
      priority: `سمّد ${m.nameAr} هذا الأسبوع`,
    };

  // no crop selected
  return {
    type: "action", severity: "info",
    title: "موسم التخطيط الصيفي",
    body:  "نهاية مايو: وقت مثالي لتحضير الأرض لمحاصيل الصيف (قطن، طماطم، خيار). راجع خطة الدورة الزراعية.",
    priority: "جهّز الأرض لمحاصيل الصيف",
  };
}

function marketInsight(p: ProvinceWeather): DashboardInsight {
  if (p.humidity > 65)
    return {
      type: "market", severity: "warning",
      title: "خطر البياض الزغبي",
      body:  `رطوبة ${p.humidity}% في ${p.nameAr} تهيئ لتفشي البياض الزغبي. رش مانكوزيب 2غ/ل وقائياً هذا الصباح.`,
      priority: "رش مانكوزيب وقائياً اليوم",
    };

  if (p.airQualityIndex > 100)
    return {
      type: "market", severity: "warning",
      title: "العنكبوت الأحمر — تحذير",
      body:  `ظروف الغبار في ${p.nameAr} تنشّط العنكبوت الأحمر. افحص الحقول وارش أبامكتين 0.5مل/ل عند الرصد.`,
      priority: "افحص الحقول للعنكبوت الأحمر",
    };

  return {
    type: "market", severity: "opportunity",
    title: "السوق: فرصة القمح",
    body:  "أسعار القمح السوري ترتفع 4% هذا الأسبوع. المزارعون الذين يحتفظون بمخزونهم يستفيدون من الارتفاع المتوقع.",
    priority: "راجع أسعار القمح قبل البيع",
  };
}

/* ─── Alert ribbon generator ─────────────────────────────────────────── */
function buildAlerts(p: ProvinceWeather): DashboardAlert[] {
  const alerts: DashboardAlert[] = [];
  const extremes = PROVINCES.filter(x => x.isExtreme);

  if (extremes.length > 0)
    alerts.push({
      severity: "critical", agent: "وكيل المناخ",
      text: `موجة حر في ${extremes.map(x => x.nameAr).join("، ")} — إنذار نشط`,
    });

  if (p.windSpeed > 18)
    alerts.push({
      severity: "warning", agent: "وكيل الري",
      text: `رياح ${p.windSpeed} كم/س في ${p.nameAr} — أجّل الرش حتى الفجر`,
    });

  if (p.humidity > 62)
    alerts.push({
      severity: "warning", agent: "وكيل الآفات",
      text: `رطوبة ${p.humidity}% ترفع خطر البياض الزغبي في ${p.nameAr}`,
    });

  if (p.airQualityIndex > 100)
    alerts.push({
      severity: "warning", agent: "وكيل الآفات",
      text: `جودة هواء سيئة (AQI ${p.airQualityIndex}) — ظروف مواتية للعنكبوت الأحمر`,
    });

  alerts.push({
    severity: "info", agent: "وكيل السوق",
    text: "أسعار القمح +4% الأسبوع الماضي — فرصة للمزارعين",
  });

  alerts.push({
    severity: "info", agent: "وكيل المناخ",
    text: "الانقلاب الصيفي بعد 22 يوماً — جهّز خطة الري الصيفية",
  });

  return alerts.slice(0, 5);
}

/* ─── Ambient mood ───────────────────────────────────────────────────── */
function ambientMood(p: ProvinceWeather): AmbientMood {
  if (p.isExtreme && p.ambientState === "dusty") return "sandstorm";
  if (p.isExtreme)                               return "heatwave";
  if (p.precipitation > 40)                     return "rainy";
  return "normal";
}

/* ─── Briefing line ──────────────────────────────────────────────────── */
function buildBriefingLine(health: HealthBreakdown, p: ProvinceWeather, cropAr: string | null): string {
  if (health.total >= 80)
    return `منظومة مزرعتك في ${p.nameAr} ${health.label} — وكلاء الذكاء جاهزون لتحقيق أفضل موسم`;
  if (p.isExtreme)
    return `تحذير: ضغط حراري حرج في ${p.nameAr} — اتبع توصيات الري الفوري لحماية محاصيلك`;
  if (cropAr)
    return `محصول ${cropAr} في ${p.nameAr} يحتاج انتباهاً — ثلاث أولويات تنتظرك هذا الصباح`;
  return `صباح الزراعة الذكية — ثلاث توصيات مخصصة لمزرعتك في ${p.nameAr}`;
}

/* ─── Public API ─────────────────────────────────────────────────────── */
export function loadFarmContext(): FarmContext {
  if (typeof window === "undefined") return { provinceId: null, cropKey: null };
  let provinceId: string | null = null;
  let cropKey:    string | null = null;
  try {
    const s = localStorage.getItem("agro_settings");
    if (s) { const p = JSON.parse(s) as { province?: string; region?: string }; provinceId = p.province ?? p.region ?? null; }
  } catch {}
  if (!provinceId) {
    try {
      const ws = localStorage.getItem("agro_weather_settings");
      if (ws) { const p = JSON.parse(ws) as { province?: string }; provinceId = p.province ?? null; }
    } catch {}
  }
  try {
    const c = localStorage.getItem("agro_crop_context");
    if (c) {
      const p = JSON.parse(c) as { cropId?: string; crop?: string; id?: string };
      cropKey = ((p.cropId ?? p.crop ?? p.id ?? "").toLowerCase().replace(/\s/g, "")) || null;
    }
  } catch {}
  return { provinceId, cropKey };
}

export function buildDashboard(ctx: FarmContext): DashboardData {
  // Resolve province
  const province = ctx.provinceId
    ? (PROVINCES.find(p =>
        p.nameAr === ctx.provinceId ||
        p.id     === ctx.provinceId ||
        p.region.includes(ctx.provinceId!)
      ) ?? PROVINCES.find(p => p.id === "damascus")!)
    : PROVINCES.find(p => p.id === "damascus")!;

  // Crop meta
  const cropMeta  = ctx.cropKey ? CROP_OPT[ctx.cropKey] ?? null : null;
  const cropNameAr = cropMeta?.nameAr ?? null;

  // Health
  const wScore = weatherScore(province);
  const cScore = cropScore(ctx.cropKey, province.temp);
  const iScore = irrigationScore(province);
  const total  = wScore + cScore + iScore;
  const { label, hex, glowClass } = healthLabel(total);
  const health: HealthBreakdown = { total, weather: wScore, crop: cScore, irrigation: iScore, label, hex, glowClass };

  // Insights
  const i1 = weatherInsight(province);
  const i2 = actionInsight(province, ctx.cropKey);
  const i3 = marketInsight(province);

  return {
    health,
    insights: [i1, i2, i3],
    alerts:   buildAlerts(province),
    ambient:  ambientMood(province),
    briefingLine: buildBriefingLine(health, province, cropNameAr),
    province,
    cropNameAr,
  };
}

/* ─── AI-generated briefing (Gemini) ─────────────────────────────────── */
export interface AIBriefing {
  briefingLine: string;
  insights:     { title: string; body: string; priority: string }[]; // up to 3
  alert:        { text: string } | null;
  tasks:        string[];                                             // up to 5
  riskScore:    number | null;                                        // 0-100
}

/**
 * Override a deterministic HealthBreakdown with an AI risk score.
 * riskScore is 0 (safe) → 100 (critical); health is the inverse.
 */
export function applyRiskScore(base: HealthBreakdown, riskScore: number): HealthBreakdown {
  const healthTotal = Math.max(0, Math.min(100, 100 - riskScore));
  const { label, hex, glowClass } = healthLabel(healthTotal);
  const ratio = base.total > 0 ? healthTotal / base.total : 1;
  return {
    total:      healthTotal,
    weather:    Math.round(base.weather * ratio),
    crop:       Math.round(base.crop * ratio),
    irrigation: Math.round(base.irrigation * ratio),
    label, hex, glowClass,
  };
}

/** Strip ```json fences and isolate the JSON object from a model reply. */
function extractJson(raw: string): unknown | null {
  if (!raw) return null;
  let s = raw.trim();
  s = s.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  const start = s.indexOf("{");
  const end   = s.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) return null;
  try {
    return JSON.parse(s.slice(start, end + 1));
  } catch {
    return null;
  }
}

/**
 * Generate a fresh, AI-driven dashboard briefing via the agent chat endpoint.
 * Returns null on any failure → caller falls back to deterministic buildDashboard().
 */
export async function getAIIntegratedBriefing(ctx: AgroContext): Promise<AIBriefing | null> {
  // Enrich context with live weather from the resolved province
  const province =
    PROVINCES.find(p =>
      p.nameAr === ctx.province || p.id === ctx.province || (ctx.province ? p.region.includes(ctx.province) : false)
    ) ?? PROVINCES.find(p => p.id === "damascus")!;

  const enriched: AgroContext = {
    ...ctx,
    province:      ctx.province ?? province.nameAr,
    temperature:  province.temp,
    humidity:     province.humidity,
    windSpeed:    province.windSpeed,
    precipitation: province.precipitation ?? 0, // defensive default — never undefined for known provinces
  };

  const prompt =
`بناءً على بيانات المزارع في السياق أعلاه (المحافظة، المحصول، الطقس، الحقول) وتاريخ اليوم 30 مايو 2026، قم بتوليد تحليل صباحي طازج وفريد.

أعد ردك بصيغة JSON فقط (بدون أي نص قبله أو بعده، وبدون علامات markdown) بالبنية التالية بالضبط:
{
  "briefingLine": "جملة ملخص صباحي مشجعة واحدة مخصصة لحالة المزرعة",
  "insights": [
    {"title": "عنوان قصير", "body": "شرح من جملة أو جملتين", "priority": "إجراء مختصر"},
    {"title": "...", "body": "...", "priority": "..."},
    {"title": "...", "body": "...", "priority": "..."}
  ],
  "alert": {"text": "أهم تنبيه حرج بناءً على الطقس الحالي"},
  "tasks": ["مهمة 1", "مهمة 2", "مهمة 3", "مهمة 4", "مهمة 5"],
  "riskScore": 0
}

يجب أن تغطي النصائح الثلاث: الري، الحصاد، ووقاية النبات. اجعل riskScore رقماً بين 0 و100 يمثل المخاطر العامة (0=آمن، 100=حرج). كل النصوص بالعربية والأرقام إنجليزية.`;

  // Returning null is the signal to fall back to the deterministic buildDashboard() briefing.
  // Both failure paths below are routine (offline, quota, unparseable reply), so we log at debug
  // level (not console.error) to keep the console clean and avoid tripping the Next.js error overlay.
  let raw: string;
  try {
    raw = await getAgentInsight(prompt, enriched);
  } catch (err) {
    console.debug("[dashboard-engine] AI briefing unavailable — using deterministic fallback", err);
    return null;
  }

  let parsed: Partial<AIBriefing> | null;
  try {
    parsed = extractJson(raw) as Partial<AIBriefing> | null;
  } catch {
    parsed = null;
  }
  if (!parsed || typeof parsed.briefingLine !== "string") {
    console.debug("[dashboard-engine] AI briefing JSON not parseable — using deterministic fallback");
    return null;
  }

  return {
    briefingLine: parsed.briefingLine,
    insights: Array.isArray(parsed.insights)
      ? parsed.insights
          .filter(i => i && typeof i.title === "string" && typeof i.body === "string")
          .slice(0, 3)
          .map(i => ({ title: i.title, body: i.body, priority: i.priority ?? i.title }))
      : [],
    alert: parsed.alert && typeof parsed.alert.text === "string" ? { text: parsed.alert.text } : null,
    tasks: Array.isArray(parsed.tasks) ? parsed.tasks.filter(t => typeof t === "string").slice(0, 5) : [],
    riskScore: typeof parsed.riskScore === "number" ? Math.max(0, Math.min(100, parsed.riskScore)) : null,
  };
}
