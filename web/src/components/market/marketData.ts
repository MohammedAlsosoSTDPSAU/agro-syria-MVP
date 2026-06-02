// ── Mock historical market data — Syrian agricultural commodities ─────
// Prices in SYP (Syrian Pounds). Covers the last 6 months (Nov 2025–Apr 2026).

export interface PricePoint {
  month: string;
  month_ar: string;
  wheat: number;       // SYP / kg
  cotton: number;      // SYP / kg
  tomato: number;      // SYP / kg
  olive_oil: number;   // SYP / kg
  barley: number;      // SYP / kg
  lentils: number;     // SYP / kg
  citrus: number;      // SYP / kg
  pistachios: number;  // SYP / kg
  sugar_beet: number;  // SYP / kg
  grapes: number;      // SYP / kg
}

export const PRICE_HISTORY: PricePoint[] = [
  { month: "Nov", month_ar: "نوفمبر", wheat: 370, cotton: 1650, tomato: 580,  olive_oil: 8200, barley: 280, lentils: 820,  citrus: 380, pistachios: 11800, sugar_beet: 82,  grapes: 510 },
  { month: "Dec", month_ar: "ديسمبر", wheat: 385, cotton: 1700, tomato: 650,  olive_oil: 8500, barley: 295, lentils: 850,  citrus: 420, pistachios: 12200, sugar_beet: 88,  grapes: 540 },
  { month: "Jan", month_ar: "يناير",  wheat: 395, cotton: 1720, tomato: 720,  olive_oil: 8800, barley: 305, lentils: 880,  citrus: 490, pistachios: 12800, sugar_beet: 95,  grapes: 570 },
  { month: "Feb", month_ar: "فبراير", wheat: 405, cotton: 1780, tomato: 690,  olive_oil: 9100, barley: 312, lentils: 910,  citrus: 460, pistachios: 13400, sugar_beet: 102, grapes: 620 },
  { month: "Mar", month_ar: "مارس",   wheat: 412, cotton: 1820, tomato: 610,  olive_oil: 9300, barley: 320, lentils: 930,  citrus: 400, pistachios: 14100, sugar_beet: 110, grapes: 690 },
  { month: "Apr", month_ar: "أبريل",  wheat: 420, cotton: 1850, tomato: 540,  olive_oil: 9600, barley: 328, lentils: 950,  citrus: 350, pistachios: 14800, sugar_beet: 118, grapes: 760 },
];

// ── Regional yield comparison ─────────────────────────────────────────
export interface RegionalYield {
  gov_ar: string;
  wheat_ton_ha: number;
  cotton_ton_ha: number;
  tomato_ton_ha: number;
  barley_ton_ha: number;
  lentils_ton_ha: number;
  citrus_ton_ha: number;
  pistachios_ton_ha: number;
  sugar_beet_ton_ha: number;
  grapes_ton_ha: number;
}

export const REGIONAL_YIELDS: RegionalYield[] = [
  { gov_ar: "الحسكة",    wheat_ton_ha: 3.2, cotton_ton_ha: 2.8, tomato_ton_ha: 0,  barley_ton_ha: 2.9, lentils_ton_ha: 1.8, citrus_ton_ha: 0,   pistachios_ton_ha: 0,   sugar_beet_ton_ha: 28.0, grapes_ton_ha: 0   },
  { gov_ar: "حلب",       wheat_ton_ha: 2.8, cotton_ton_ha: 2.1, tomato_ton_ha: 18, barley_ton_ha: 2.4, lentils_ton_ha: 1.5, citrus_ton_ha: 0,   pistachios_ton_ha: 1.8, sugar_beet_ton_ha: 22.0, grapes_ton_ha: 3.2 },
  { gov_ar: "حماة",      wheat_ton_ha: 2.6, cotton_ton_ha: 1.9, tomato_ton_ha: 22, barley_ton_ha: 2.1, lentils_ton_ha: 1.2, citrus_ton_ha: 0,   pistachios_ton_ha: 2.1, sugar_beet_ton_ha: 18.5, grapes_ton_ha: 2.8 },
  { gov_ar: "حمص",       wheat_ton_ha: 2.2, cotton_ton_ha: 1.5, tomato_ton_ha: 15, barley_ton_ha: 1.8, lentils_ton_ha: 0.9, citrus_ton_ha: 0,   pistachios_ton_ha: 1.2, sugar_beet_ton_ha: 15.0, grapes_ton_ha: 2.1 },
  { gov_ar: "دير الزور", wheat_ton_ha: 2.0, cotton_ton_ha: 2.4, tomato_ton_ha: 0,  barley_ton_ha: 1.6, lentils_ton_ha: 0.8, citrus_ton_ha: 0,   pistachios_ton_ha: 0,   sugar_beet_ton_ha: 12.0, grapes_ton_ha: 0   },
  { gov_ar: "الرقة",     wheat_ton_ha: 1.8, cotton_ton_ha: 2.2, tomato_ton_ha: 0,  barley_ton_ha: 1.4, lentils_ton_ha: 0.7, citrus_ton_ha: 0,   pistachios_ton_ha: 0,   sugar_beet_ton_ha: 10.0, grapes_ton_ha: 0   },
  { gov_ar: "اللاذقية",  wheat_ton_ha: 1.2, cotton_ton_ha: 0,   tomato_ton_ha: 28, barley_ton_ha: 0.9, lentils_ton_ha: 0,   citrus_ton_ha: 8.5, pistachios_ton_ha: 0.6, sugar_beet_ton_ha: 0,    grapes_ton_ha: 4.8 },
  { gov_ar: "طرطوس",     wheat_ton_ha: 1.1, cotton_ton_ha: 0,   tomato_ton_ha: 24, barley_ton_ha: 0.8, lentils_ton_ha: 0,   citrus_ton_ha: 9.2, pistachios_ton_ha: 0.4, sugar_beet_ton_ha: 0,    grapes_ton_ha: 4.2 },
  { gov_ar: "درعا",      wheat_ton_ha: 2.4, cotton_ton_ha: 0,   tomato_ton_ha: 35, barley_ton_ha: 2.0, lentils_ton_ha: 1.1, citrus_ton_ha: 1.2, pistachios_ton_ha: 0,   sugar_beet_ton_ha: 8.0,  grapes_ton_ha: 3.5 },
  { gov_ar: "إدلب",      wheat_ton_ha: 2.3, cotton_ton_ha: 0.8, tomato_ton_ha: 16, barley_ton_ha: 1.9, lentils_ton_ha: 1.3, citrus_ton_ha: 0,   pistachios_ton_ha: 2.4, sugar_beet_ton_ha: 5.0,  grapes_ton_ha: 2.5 },
  { gov_ar: "السويداء",  wheat_ton_ha: 1.5, cotton_ton_ha: 0,   tomato_ton_ha: 12, barley_ton_ha: 1.2, lentils_ton_ha: 0.6, citrus_ton_ha: 0.5, pistachios_ton_ha: 0.8, sugar_beet_ton_ha: 0,    grapes_ton_ha: 6.8 },
];

// ── Top producer per crop ─────────────────────────────────────────────
export const TOP_PRODUCERS: Record<string, string> = {
  wheat:      "الحسكة",
  cotton:     "الحسكة",
  tomato:     "درعا",
  olive_oil:  "إدلب",
  barley:     "الحسكة",
  lentils:    "الحسكة",
  citrus:     "طرطوس",
  pistachios: "إدلب",
  sugar_beet: "الحسكة",
  grapes:     "السويداء",
};

// ── Simulated news feed ───────────────────────────────────────────────
export interface NewsItem {
  id: string;
  title_ar: string;
  summary_ar: string;
  source_ar: string;
  category: "price" | "policy" | "weather" | "pest" | "export";
  date_ar: string;
  urgent: boolean;
}

export const NEWS_FEED: NewsItem[] = [
  {
    id: "n1",
    title_ar: "وزارة الزراعة: دعم إضافي لمزارعي القمح في محافظة الحسكة",
    summary_ar: "أعلنت الوزارة عن حزمة دعم بقيمة 50 مليار ليرة لمزارعي القمح في الجزيرة السورية تشمل تأمين البذار والأسمدة.",
    source_ar: "وزارة الزراعة والإصلاح الزراعي",
    category: "policy",
    date_ar: "24 أبريل 2026",
    urgent: false,
  },
  {
    id: "n2",
    title_ar: "تحذير: موجة صقيع متوقعة في شمال سوريا خلال الأسبوع القادم",
    summary_ar: "أفادت الأرصاد الجوية بتوقع انخفاض حاد في درجات الحرارة قد يؤثر على محاصيل الزيتون في إدلب واللاذقية.",
    source_ar: "المديرية العامة للأرصاد الجوية",
    category: "weather",
    date_ar: "23 أبريل 2026",
    urgent: true,
  },
  {
    id: "n3",
    title_ar: "ارتفاع أسعار القمح 3% في أسواق حلب وحماة",
    summary_ar: "شهدت أسواق الحبوب في حلب وحماة ارتفاعاً ملحوظاً في أسعار القمح بسبب تراجع المخزون الاستراتيجي.",
    source_ar: "غرفة تجارة حلب",
    category: "price",
    date_ar: "22 أبريل 2026",
    urgent: false,
  },
  {
    id: "n4",
    title_ar: "انتشار آفة حشرة المن في مزارع القطن بمحافظة الرقة",
    summary_ar: "رصدت مديرية الزراعة انتشار حشرة المن في عدة مزارع قطنية، وتنصح بالرش الوقائي فوراً بمبيدات موصى بها.",
    source_ar: "مديرية زراعة الرقة",
    category: "pest",
    date_ar: "21 أبريل 2026",
    urgent: true,
  },
  {
    id: "n5",
    title_ar: "اتفاقية تصدير زيت الزيتون السوري إلى الأسواق الأوروبية",
    summary_ar: "وقّعت الحكومة اتفاقية لتصدير 12 ألف طن من زيت الزيتون إلى دول الاتحاد الأوروبي في موسم 2026.",
    source_ar: "وزارة الاقتصاد والتجارة الخارجية",
    category: "export",
    date_ar: "20 أبريل 2026",
    urgent: false,
  },
  {
    id: "n6",
    title_ar: "إطلاق برنامج التحول الرقمي للمزارع السوري",
    summary_ar: "أطلقت وزارة الزراعة شراكةً مع منصة أغرو-سيريا لتوفير الاستشارة الذكية لـ 50 ألف مزارع في مرحلة أولى.",
    source_ar: "وزارة الزراعة والإصلاح الزراعي",
    category: "policy",
    date_ar: "19 أبريل 2026",
    urgent: false,
  },
];

export const CATEGORY_CONFIG = {
  price:   { label_ar: "أسعار",   color: "text-emerald-400", bg: "bg-emerald-500/15 border-emerald-500/30" },
  policy:  { label_ar: "سياسات", color: "text-sky-400",     bg: "bg-sky-500/15 border-sky-500/30" },
  weather: { label_ar: "طقس",     color: "text-amber-400",  bg: "bg-amber-500/15 border-amber-500/30" },
  pest:    { label_ar: "آفات",    color: "text-red-400",    bg: "bg-red-500/15 border-red-500/30" },
  export:  { label_ar: "تصدير",   color: "text-purple-400", bg: "bg-purple-500/15 border-purple-500/30" },
} as const;
