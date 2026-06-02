// Weather data engine — Syrian provinces, May 30 2026
// Late-spring context: rising temps, dry Khamsin winds, zero/minimal rain

export type AmbientState = "sunny" | "cloudy" | "rainy" | "dusty" | "clear-night";
export type RiskType     = "none"  | "heatwave" | "sandstorm" | "strong-wind" | "rain";

export interface ProvinceWeather {
  id: string;
  nameAr: string;
  region: string;
  temp: number;
  feelsLike: number;
  humidity: number;
  windSpeed: number;
  windDirection: string;
  precipitation: number;
  solarRadiation: number;
  uvIndex: number;
  airQualityIndex: number;
  isExtreme: boolean;
  ambientState: AmbientState;
  condition: string;
  aiSummary: string;
}

export interface DayForecast {
  dayAr: string;
  dateStr: string;
  tempHigh: number;
  tempLow: number;
  ambientState: AmbientState;
  condition: string;
  precipChance: number;
  windSpeed: number;
  riskType: RiskType;
  agroTag: string;
  riskAdvice: string;
}

/* ─── Province live data ─────────────────────────────────────────────── */
export const PROVINCES: ProvinceWeather[] = [
  { id:"damascus",    nameAr:"دمشق",       region:"حوض دمشق",           temp:29, feelsLike:32, humidity:35, windSpeed:16, windDirection:"غرب شمالي",  precipitation:3,  solarRadiation:820, uvIndex:9,  airQualityIndex:68,  isExtreme:false, ambientState:"sunny",  condition:"مشمس صافٍ",       aiSummary:"أجواء مثالية للحصاد الصباحي — نافذة رش آمنة حتى 11:30 ص" },
  { id:"aleppo",      nameAr:"حلب",        region:"سهل حلب",             temp:27, feelsLike:29, humidity:42, windSpeed:18, windDirection:"شمال غربي",  precipitation:5,  solarRadiation:790, uvIndex:8,  airQualityIndex:55,  isExtreme:false, ambientState:"sunny",  condition:"صحو جزئياً",       aiSummary:"أجواء حارة مستقرة؛ مثالية لعمليات الحصاد في حلب" },
  { id:"homs",        nameAr:"حمص",        region:"وسط سوريا",           temp:31, feelsLike:34, humidity:30, windSpeed:18, windDirection:"جنوب غربي",  precipitation:2,  solarRadiation:835, uvIndex:9,  airQualityIndex:72,  isExtreme:false, ambientState:"sunny",  condition:"حار ومشمس",        aiSummary:"حرارة متصاعدة — زد ري الشوندر السكري 20% واعمل قبل الظهر" },
  { id:"latakia",     nameAr:"اللاذقية",   region:"الساحل السوري",       temp:24, feelsLike:26, humidity:66, windSpeed:12, windDirection:"غرب بحري",   precipitation:8,  solarRadiation:680, uvIndex:7,  airQualityIndex:38,  isExtreme:false, ambientState:"sunny",  condition:"مشمس ورطب",        aiSummary:"رطوبة ساحلية مرتفعة — فحص ذبابة الزيتون والبياض الزغبي مطلوب" },
  { id:"hama",        nameAr:"حماة",       region:"وادي العاصي",         temp:30, feelsLike:33, humidity:33, windSpeed:16, windDirection:"شمال غربي",  precipitation:3,  solarRadiation:815, uvIndex:9,  airQualityIndex:60,  isExtreme:false, ambientState:"sunny",  condition:"مشمس دافئ",        aiSummary:"نافذة دلتا-ت ممتازة — رش المبيدات فجراً قبل 9 صباحاً" },
  { id:"idlib",       nameAr:"إدلب",       region:"شمال غرب سوريا",      temp:28, feelsLike:30, humidity:38, windSpeed:20, windDirection:"غرب شمالي",  precipitation:6,  solarRadiation:775, uvIndex:8,  airQualityIndex:65,  isExtreme:false, ambientState:"sunny",  condition:"صحو مع رياح",      aiSummary:"رياح خفيفة تنعش الزيتون — موسم إزهار الفستق في ذروته" },
  { id:"raqqa",       nameAr:"الرقة",      region:"شمال شرق الفرات",     temp:34, feelsLike:40, humidity:19, windSpeed:26, windDirection:"جنوب شرقي",  precipitation:0,  solarRadiation:870, uvIndex:11, airQualityIndex:148, isExtreme:true,  ambientState:"dusty",  condition:"حار وغباري",       aiSummary:"تحذير: رياح خماسينية شرقية — أوقف العمل الميداني 12ص-4م" },
  { id:"hasakah",     nameAr:"الحسكة",     region:"شمال شرق الجزيرة",   temp:33, feelsLike:38, humidity:22, windSpeed:24, windDirection:"شمال شرقي",  precipitation:0,  solarRadiation:855, uvIndex:10, airQualityIndex:122, isExtreme:true,  ambientState:"dusty",  condition:"حار جداً",         aiSummary:"موجة حر مستمرة — الري الفجري 5-9 ص إلزامي وزد المعدل 25%" },
  { id:"deir-ez-zur", nameAr:"دير الزور",  region:"البادية السورية",     temp:37, feelsLike:43, humidity:16, windSpeed:22, windDirection:"جنوب شرقي",  precipitation:0,  solarRadiation:892, uvIndex:12, airQualityIndex:185, isExtreme:true,  ambientState:"dusty",  condition:"حار شديد وغبار",   aiSummary:"إنذار حراري — تبخر-نتح 9.5مم/يوم؛ زد الري 40% وجنّب الرش الكيميائي" },
  { id:"tartus",      nameAr:"طرطوس",      region:"الساحل الجنوبي",      temp:23, feelsLike:25, humidity:70, windSpeed:14, windDirection:"غرب بحري",   precipitation:10, solarRadiation:650, uvIndex:7,  airQualityIndex:35,  isExtreme:false, ambientState:"sunny",  condition:"لطيف وساحلي",      aiSummary:"أفضل درجات في سوريا اليوم — مثالية لمحاصيل الحمضيات والحبة الخضراء" },
  { id:"daraa",       nameAr:"درعا",       region:"جنوب سوريا",          temp:31, feelsLike:34, humidity:28, windSpeed:19, windDirection:"جنوب غربي",  precipitation:2,  solarRadiation:840, uvIndex:10, airQualityIndex:78,  isExtreme:false, ambientState:"sunny",  condition:"حار صافٍ",         aiSummary:"حرارة جنوبية — محاصيل العنب والتين في طور النضج المبكر" },
  { id:"suwayda",     nameAr:"السويداء",   region:"جبل العرب",           temp:27, feelsLike:29, humidity:36, windSpeed:20, windDirection:"شمال غربي",  precipitation:4,  solarRadiation:800, uvIndex:9,  airQualityIndex:50,  isExtreme:false, ambientState:"sunny",  condition:"مشمس جبلي",        aiSummary:"ارتفاع 900م يمنح فجوة ليلية مثالية لنضج الكرمة والتفاح" },
  { id:"quneitra",    nameAr:"القنيطرة",   region:"جنوب غرب سوريا",     temp:26, feelsLike:28, humidity:40, windSpeed:16, windDirection:"غرب شمالي",  precipitation:5,  solarRadiation:780, uvIndex:8,  airQualityIndex:45,  isExtreme:false, ambientState:"sunny",  condition:"صحو معتدل",        aiSummary:"مناخ جولاني منعش — موسم الكرز في أوجه الآن" },
  { id:"rif-dimashq", nameAr:"ريف دمشق",  region:"أطراف دمشق",          temp:28, feelsLike:31, humidity:38, windSpeed:15, windDirection:"غرب شمالي",  precipitation:3,  solarRadiation:810, uvIndex:9,  airQualityIndex:75,  isExtreme:false, ambientState:"sunny",  condition:"دافئ ومشمس",       aiSummary:"أحواض الغوطة في مرحلة نضج مثالية — راقب احتياجات الري الليلي" },
];

export function getProvinceById(id: string): ProvinceWeather | undefined {
  return PROVINCES.find((p) => p.id === id);
}

export function getDefaultProvince(storedId?: string | null): ProvinceWeather {
  if (storedId) {
    const found = getProvinceById(storedId);
    if (found) return found;
  }
  return PROVINCES.find((p) => p.id === "damascus")!;
}

export function getAmbientGradient(state: AmbientState): string {
  switch (state) {
    case "sunny":
      return "radial-gradient(ellipse 120% 80% at 70% 10%, oklch(0.55 0.12 70 / 18%) 0%, transparent 60%), radial-gradient(ellipse 80% 60% at 20% 90%, oklch(0.50 0.10 162 / 10%) 0%, transparent 55%)";
    case "dusty":
      return "radial-gradient(ellipse 140% 90% at 60% 5%, oklch(0.55 0.10 55 / 22%) 0%, transparent 65%), radial-gradient(ellipse 100% 70% at 80% 80%, oklch(0.45 0.08 40 / 12%) 0%, transparent 50%)";
    case "cloudy":
      return "radial-gradient(ellipse 130% 80% at 50% 0%, oklch(0.25 0.04 220 / 20%) 0%, transparent 60%), radial-gradient(ellipse 90% 60% at 30% 90%, oklch(0.20 0.03 200 / 12%) 0%, transparent 55%)";
    case "rainy":
      return "radial-gradient(ellipse 130% 90% at 40% 5%, oklch(0.20 0.06 240 / 25%) 0%, transparent 65%), radial-gradient(ellipse 80% 60% at 70% 85%, oklch(0.25 0.07 210 / 15%) 0%, transparent 50%)";
    case "clear-night":
      return "radial-gradient(ellipse 120% 80% at 50% 0%, oklch(0.12 0.04 270 / 20%) 0%, transparent 65%), radial-gradient(ellipse 60% 50% at 80% 80%, oklch(0.10 0.03 250 / 10%) 0%, transparent 50%)";
    default:
      return "";
  }
}

export function getAQILabel(aqi: number): { label: string; color: string } {
  if (aqi <= 50)  return { label: "ممتاز",  color: "text-emerald-400" };
  if (aqi <= 100) return { label: "جيد",    color: "text-yellow-400"  };
  if (aqi <= 150) return { label: "مقبول",  color: "text-orange-400"  };
  if (aqi <= 200) return { label: "سيء",    color: "text-red-400"     };
  return                  { label: "خطير",  color: "text-red-600"     };
}

export function getUVLabel(uv: number): string {
  if (uv <= 2)  return "منخفض";
  if (uv <= 5)  return "معتدل";
  if (uv <= 7)  return "مرتفع";
  if (uv <= 10) return "مرتفع جداً";
  return "شديد الخطورة";
}

/* ─── Heat color helper ──────────────────────────────────────────────── */
function lerpHex(a: string, b: string, t: number): string {
  const p = (s: string, o: number) => parseInt(s.slice(o, o + 2), 16);
  const [ar,ag,ab] = [p(a,1),p(a,3),p(a,5)];
  const [br,bg,bb] = [p(b,1),p(b,3),p(b,5)];
  const h = (v: number) => Math.round(v).toString(16).padStart(2, "0");
  return `#${h(ar+(br-ar)*t)}${h(ag+(bg-ag)*t)}${h(ab+(bb-ab)*t)}`;
}

export function tempToHeatColor(temp: number): string {
  const t = Math.max(0, Math.min(1, (temp - 18) / 22));
  if (t < 0.5) return lerpHex("#60a5fa", "#f59e0b", t * 2);
  return lerpHex("#f59e0b", "#ef4444", (t - 0.5) * 2);
}

/* ─── Wind direction → SVG arrow angle ──────────────────────────────── */
// Angle = where wind blows TO (0° = east, 90° = south in SVG)
export const WIND_DIRECTION_ANGLE: Record<string, number> = {
  "شمالي":       90,
  "جنوبي":      270,
  "شرقي":       180,
  "غربي":         0,
  "شمال غربي":  135,
  "شمال شرقي":  225,
  "جنوب شرقي":  315,
  "جنوب غربي":   45,
  "غرب شمالي":  135,
  "غرب بحري":     0,
};

/* ─── 7-Day Forecast ─────────────────────────────────────────────────── */
const DAYS = [
  { dayAr: "السبت",    dateStr: "30 مايو" },
  { dayAr: "الأحد",    dateStr: "31 مايو" },
  { dayAr: "الاثنين",  dateStr: "1 يونيو" },
  { dayAr: "الثلاثاء", dateStr: "2 يونيو" },
  { dayAr: "الأربعاء", dateStr: "3 يونيو" },
  { dayAr: "الخميس",   dateStr: "4 يونيو" },
  { dayAr: "الجمعة",   dateStr: "5 يونيو" },
];

type DayRaw = Omit<DayForecast, "dayAr" | "dateStr">;
function mk(h:number, l:number, amb:AmbientState, cond:string, prec:number, wind:number, risk:RiskType, tag:string, advice=""): DayRaw {
  return { tempHigh:h, tempLow:l, ambientState:amb, condition:cond, precipChance:prec, windSpeed:wind, riskType:risk, agroTag:tag, riskAdvice:advice };
}

const RAW_FORECASTS: Record<string, DayRaw[]> = {
  damascus: [
    mk(29,17,"sunny",  "مشمس صافٍ",   3,  16, "none",       "مثالي للري"),
    mk(31,18,"sunny",  "مشمس حار",    0,  14, "none",       "رش فجري فقط"),
    mk(33,20,"sunny",  "حار جداً",    0,  16, "heatwave",   "خطر حر شديد",      "زيادة فترات الري لتعويض التبخر المتصاعد"),
    mk(32,19,"sunny",  "حار",         2,  19, "heatwave",   "أوقف الرش نهاراً", "تجنب الرش الكيميائي فوق 32°م"),
    mk(28,17,"sunny",  "صحو معتدل",   8,  22, "none",       "جو مثالي للري"),
    mk(25,15,"rainy",  "أمطار خفيفة", 22, 20, "rain",       "هطول مفيد متوقع",  "وفر مياه الري 24 ساعة قبل الهطول وبعده"),
    mk(27,16,"sunny",  "صحو جزئي",    10, 16, "none",       "تعافٍ زراعي طبيعي"),
  ],
  aleppo: [
    mk(27,15,"sunny",  "صحو جزئياً",  5,  18, "none",       "مثالي للحصاد"),
    mk(29,17,"sunny",  "مشمس",        0,  14, "none",       "رش صباحي فقط"),
    mk(32,19,"sunny",  "حار",         0,  12, "heatwave",   "خطر إجهاد حراري",  "زيادة فترات الري لتعويض التبخر المتصاعد"),
    mk(30,18,"sunny",  "حار جزئياً",  3,  20, "heatwave",   "ري مكثف ليلاً",    "تجنب الرش الكيميائي فوق 30°م"),
    mk(26,14,"cloudy", "غيوم جزئية",  12, 25, "strong-wind","رياح قوية تجنب الرش","تأجيل الرش وتثبيت دعائم النباتات"),
    mk(23,13,"rainy",  "أمطار",       35, 22, "rain",       "أمطار خفيفة مفيدة","وفر مياه الري 24 ساعة قبل الهطول وبعده"),
    mk(25,14,"sunny",  "صحو جزئي",    8,  15, "none",       "تربة رطبة جيدة"),
  ],
  homs: [
    mk(31,19,"sunny",  "مشمس حار",    2,  18, "none",       "مثالي للري"),
    mk(33,21,"sunny",  "حار جداً",    0,  16, "heatwave",   "خطر حر متصاعد",    "زيادة فترات الري لتعويض التبخر المتصاعد"),
    mk(35,22,"sunny",  "حر شديد",     0,  14, "heatwave",   "إنذار حر أقصى",    "أوقف العمل الميداني 12ص-4م وزد الري 40%"),
    mk(33,20,"sunny",  "حار",         2,  20, "heatwave",   "ري ليلي مكثف",     "تجنب الرش الكيميائي فوق 32°م"),
    mk(29,17,"sunny",  "صحو معتدل",   8,  24, "none",       "تعافٍ جزئي"),
    mk(26,16,"cloudy", "غيوم",        18, 22, "rain",       "هطول خفيف متوقع",  "وفر مياه الري 24 ساعة قبل الهطول وبعده"),
    mk(28,17,"sunny",  "صحو جزئي",    8,  18, "none",       "جو زراعي مقبول"),
  ],
  latakia: [
    mk(24,16,"sunny",  "مشمس ورطب",   8,  12, "none",       "راقب البياض الزغبي"),
    mk(25,17,"sunny",  "صحو جزئي",    12, 10, "none",       "رطوبة حذر الزيتون"),
    mk(27,18,"cloudy", "غيوم",        20, 14, "none",       "تأجيل رش الزيتون"),
    mk(26,17,"sunny",  "صحو ساحلي",   15, 16, "none",       "جو ساحلي معتدل"),
    mk(24,16,"rainy",  "أمطار",       40, 18, "rain",       "هطول غزير وقفة الري","وفر مياه الري 24 ساعة قبل الهطول وبعده"),
    mk(22,15,"cloudy", "غيوم ثقيلة",  30, 20, "rain",       "تأجيل كل الرش",    "وفر مياه الري 24 ساعة قبل الهطول وبعده"),
    mk(24,16,"sunny",  "مشمس",        10, 12, "none",       "مثالي للحمضيات"),
  ],
  hama: [
    mk(30,18,"sunny",  "مشمس دافئ",   3,  16, "none",       "مثالي للزيتون"),
    mk(32,19,"sunny",  "حار",         0,  14, "heatwave",   "خطر حر متزايد",    "زيادة فترات الري لتعويض التبخر المتصاعد"),
    mk(34,21,"sunny",  "حر شديد",     0,  12, "heatwave",   "إنذار حر شديد",    "أوقف العمل الميداني 12ص-4م وزد الري 35%"),
    mk(32,20,"sunny",  "حار جداً",    2,  18, "heatwave",   "زد الري 30%",      "تجنب الرش الكيميائي فوق 32°م"),
    mk(28,17,"sunny",  "صحو معتدل",   10, 22, "none",       "جو مريح"),
    mk(25,15,"rainy",  "أمطار خفيفة", 20, 20, "rain",       "هطول مفيد",        "وفر مياه الري 24 ساعة قبل الهطول وبعده"),
    mk(27,16,"sunny",  "صحو جزئي",    8,  16, "none",       "ري طبيعي"),
  ],
  idlib: [
    mk(28,15,"sunny",  "صحو مع رياح", 6,  20, "none",       "مثالي للزيتون والفستق"),
    mk(30,17,"sunny",  "مشمس",        0,  18, "none",       "رش صباحي مبكر"),
    mk(33,19,"sunny",  "حار",         0,  14, "heatwave",   "خطر حر متصاعد",    "زيادة فترات الري لتعويض التبخر المتصاعد"),
    mk(31,18,"sunny",  "صحو جزئي",    5,  22, "strong-wind","رياح قوية تأجيل الرش","تأجيل الرش وتثبيت دعائم النباتات"),
    mk(27,15,"cloudy", "غيوم",        14, 26, "strong-wind","تثبيت المحميات",    "تأجيل الرش وتثبيت دعائم النباتات"),
    mk(24,13,"rainy",  "أمطار",       30, 22, "rain",       "هطول مفيد متوقع",  "وفر مياه الري 24 ساعة قبل الهطول وبعده"),
    mk(26,14,"sunny",  "صحو جزئي",    10, 18, "none",       "جو زراعي مناسب"),
  ],
  raqqa: [
    mk(34,22,"dusty",  "حار وغباري",  0,  26, "sandstorm",  "عاصفة رملية قادمة","أغلق المحميات وأوقف الرش كلياً حتى زوال الغبار"),
    mk(36,23,"dusty",  "عاصفة غبار",  0,  28, "sandstorm",  "توقف عن العمل الميداني","أغلق المحميات وأوقف الرش كلياً حتى زوال الغبار"),
    mk(38,25,"sunny",  "حر أقصى",     0,  22, "heatwave",   "إنذار حر أقصى",    "أوقف العمل الميداني 12ص-4م وزد الري 40%"),
    mk(36,23,"sunny",  "حار جداً",    0,  20, "heatwave",   "ري ليلي كامل",     "تجنب الرش الكيميائي فوق 35°م"),
    mk(33,21,"sunny",  "صحو جزئي",    2,  18, "none",       "تعافٍ تدريجي"),
    mk(31,20,"sunny",  "صحو",         5,  16, "none",       "جو مقبول نسبياً"),
    mk(33,21,"sunny",  "حار",         0,  18, "heatwave",   "مراقبة مستمرة للحرارة","زيادة فترات الري لتعويض التبخر المتصاعد"),
  ],
  hasakah: [
    mk(33,21,"dusty",  "حار جداً",    0,  24, "heatwave",   "موجة حر مستمرة",   "زيادة فترات الري لتعويض التبخر المتصاعد"),
    mk(35,22,"sunny",  "حر شديد",     0,  20, "heatwave",   "إنذار حر شديد",    "أوقف العمل الميداني 12ص-4م وزد الري 35%"),
    mk(34,22,"sunny",  "حار جداً",    0,  22, "heatwave",   "ري فجري إلزامي",   "تجنب الرش الكيميائي فوق 33°م"),
    mk(32,20,"sunny",  "صحو حار",     2,  26, "strong-wind","رياح قوية اليوم",  "تأجيل الرش وتثبيت دعائم النباتات"),
    mk(30,19,"sunny",  "صحو جزئي",    3,  20, "none",       "تحسن تدريجي"),
    mk(31,19,"sunny",  "مشمس",        0,  18, "heatwave",   "ارتداد حراري",     "زيادة فترات الري لتعويض التبخر المتصاعد"),
    mk(34,21,"sunny",  "حار",         0,  16, "heatwave",   "مراقبة محاصيل الشوندر","زيادة فترات الري لتعويض التبخر المتصاعد"),
  ],
  "deir-ez-zur": [
    mk(37,24,"dusty",  "حار وغباري",  0,  22, "heatwave",   "إنذار حر أقصى",    "أوقف العمل الميداني 12ص-4م وزد الري 40%"),
    mk(39,25,"sunny",  "حر قياسي",    0,  18, "heatwave",   "حر قياسي توقف فوري","أوقف العمل الميداني كلياً وزد الري 50%"),
    mk(37,24,"dusty",  "حار وغباري",  0,  24, "sandstorm",  "عاصفة رملية مع حر","أغلق المحميات وأوقف الرش كلياً حتى زوال الغبار"),
    mk(36,23,"sunny",  "حار جداً",    0,  20, "heatwave",   "زد الري 40% فوراً","تجنب الرش الكيميائي فوق 36°م"),
    mk(34,22,"sunny",  "حار",         0,  18, "heatwave",   "تخفيف تدريجي",     "زيادة فترات الري لتعويض التبخر المتصاعد"),
    mk(32,21,"sunny",  "صحو جزئي",    3,  16, "none",       "مقبول نسبياً"),
    mk(34,22,"sunny",  "حار",         0,  18, "heatwave",   "ارتداد درجات الحرارة","زيادة فترات الري لتعويض التبخر المتصاعد"),
  ],
  tartus: [
    mk(23,15,"sunny",  "لطيف وساحلي", 10, 14, "none",       "مثالي للحمضيات"),
    mk(24,16,"sunny",  "صحو ساحلي",   12, 12, "none",       "جو ساحلي ممتاز"),
    mk(26,17,"sunny",  "صحو جزئي",    15, 16, "none",       "راقب البياض الزغبي"),
    mk(25,16,"cloudy", "غيوم",        22, 18, "rain",       "هطول خفيف متوقع",  "وفر مياه الري 24 ساعة قبل الهطول وبعده"),
    mk(23,15,"rainy",  "أمطار",       38, 20, "rain",       "أمطار وقفة الري",  "وفر مياه الري 24 ساعة قبل الهطول وبعده"),
    mk(21,14,"cloudy", "غيوم ثقيلة",  28, 22, "rain",       "تأجيل كل الرش",    "وفر مياه الري 24 ساعة قبل الهطول وبعده"),
    mk(23,15,"sunny",  "مشمس",        8,  14, "none",       "مثالي لحصاد الحمضيات"),
  ],
  daraa: [
    mk(31,19,"sunny",  "مشمس حار",    2,  19, "none",       "مثالي للعنب والتين"),
    mk(33,20,"sunny",  "حار جداً",    0,  17, "heatwave",   "خطر حر متصاعد",    "زيادة فترات الري لتعويض التبخر المتصاعد"),
    mk(35,22,"sunny",  "حر شديد",     0,  15, "heatwave",   "إنذار حر شديد",    "أوقف العمل الميداني 12ص-4م وزد الري 35%"),
    mk(33,21,"sunny",  "حار",         2,  20, "heatwave",   "ري ليلي إلزامي",   "تجنب الرش الكيميائي فوق 33°م"),
    mk(29,18,"sunny",  "صحو معتدل",   8,  23, "none",       "جو مريح"),
    mk(26,16,"cloudy", "غيوم",        18, 21, "rain",       "هطول متوقع",       "وفر مياه الري 24 ساعة قبل الهطول وبعده"),
    mk(28,17,"sunny",  "صحو جزئي",    8,  17, "none",       "عودة طبيعية"),
  ],
  suwayda: [
    mk(27,14,"sunny",  "مشمس جبلي",   4,  20, "none",       "مثالي لكروم العنب"),
    mk(29,16,"sunny",  "جو جبلي منعش",2,  18, "none",       "جو جبلي منعش"),
    mk(31,17,"sunny",  "حار جبلي",    0,  16, "heatwave",   "خطر حر جبلي",      "زيادة فترات الري لتعويض التبخر المتصاعد"),
    mk(30,16,"sunny",  "صحو جزئي",    5,  22, "strong-wind","رياح قوية تأجيل الرش","تأجيل الرش وتثبيت دعائم النباتات"),
    mk(27,14,"cloudy", "غيوم",        14, 25, "strong-wind","تثبيت دعائم الكروم","تأجيل الرش وتثبيت دعائم النباتات"),
    mk(24,13,"rainy",  "أمطار خفيفة", 28, 22, "rain",       "هطول مفيد للكروم", "وفر مياه الري 24 ساعة قبل الهطول وبعده"),
    mk(26,14,"sunny",  "صحو جزئي",    10, 18, "none",       "جو جبلي مناسب"),
  ],
  quneitra: [
    mk(26,14,"sunny",  "صحو معتدل",   5,  16, "none",       "مثالي للكرز والتفاح"),
    mk(28,16,"sunny",  "جو جولاني",   3,  14, "none",       "جو جولاني ممتاز"),
    mk(30,18,"sunny",  "صحو جزئي",    5,  12, "none",       "راقب ري الكرز"),
    mk(29,17,"sunny",  "معتدل",       8,  20, "none",       "جو مناسب"),
    mk(26,15,"cloudy", "غيوم",        15, 24, "strong-wind","رياح جنوبية قوية",  "تأجيل الرش وتثبيت دعائم النباتات"),
    mk(23,14,"rainy",  "أمطار خفيفة", 25, 22, "rain",       "هطول خفيف",        "وفر مياه الري 24 ساعة قبل الهطول وبعده"),
    mk(25,15,"sunny",  "مشمس",        8,  16, "none",       "مثالي لحصاد الكرز"),
  ],
  "rif-dimashq": [
    mk(28,16,"sunny",  "دافئ ومشمس",  3,  15, "none",       "مثالي لأحواض الغوطة"),
    mk(30,17,"sunny",  "مشمس حار",    0,  13, "none",       "رش صباحي فجري"),
    mk(33,20,"sunny",  "حار جداً",    0,  15, "heatwave",   "خطر حر على الخضار","تغطية الشتلات الحساسة وزد الري 30%"),
    mk(31,18,"sunny",  "حار",         2,  18, "heatwave",   "تغطية الشتلات",    "تجنب الرش الكيميائي فوق 31°م"),
    mk(27,16,"sunny",  "صحو معتدل",   8,  21, "none",       "جو معتدل"),
    mk(24,15,"cloudy", "غيوم",        20, 19, "rain",       "هطول مفيد للغوطة", "وفر مياه الري 24 ساعة قبل الهطول وبعده"),
    mk(26,16,"sunny",  "صحو جزئي",    10, 15, "none",       "تعافٍ زراعي"),
  ],
};

export const PROVINCE_FORECASTS: Record<string, DayForecast[]> =
  Object.fromEntries(
    Object.entries(RAW_FORECASTS).map(([id, rows]) => [
      id,
      rows.map((row, i) => ({ ...DAYS[i], ...row })),
    ])
  );
