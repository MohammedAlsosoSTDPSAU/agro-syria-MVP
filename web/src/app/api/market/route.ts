import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

// ── Types ─────────────────────────────────────────────────────────────
export type CropCategory = "strategic" | "vegetables" | "fruits" | "grains";

export interface CropPrice {
  key: string;
  name_ar: string;
  name_en: string;
  category: CropCategory;
  unit: string;
  price_syp: number;          // current price
  price_prev: number;         // previous period
  change_pct: number;         // calculated
  top_gov_ar: string;         // top producing governorate
  yield_ton_ha: number;       // national average
  area_ha: number;            // cultivated area (thousands of ha)
  production_ton: number;     // total production (thousands of tons)
  season: string;             // harvest season
  history: { month_ar: string; price: number }[];
}

export interface RegionSummary {
  gov_ar: string;
  gov_en: string;
  lat: number;
  lng: number;
  intensity: number;
  area_rank: number;
  top_crop_ar: string;
  production_score: number;
}

export interface MarketResponse {
  crops: CropPrice[];
  regions: RegionSummary[];
  lastUpdated: string;
  season_ar: string;
}

// ── Constants ─────────────────────────────────────────────────────────
const MONTHS_AR = ["نوف", "ديس", "يناير", "فبر", "مارس", "أبريل"];

function hist(base: number, trend: number): { month_ar: string; price: number }[] {
  return MONTHS_AR.map((month_ar, i) => ({
    month_ar,
    price: Math.round(base + trend * i + (Math.random() * base * 0.03 - base * 0.015)),
  }));
}

// ── Crop Database (36 crops) ──────────────────────────────────────────
const ALL_CROPS: Omit<CropPrice, "change_pct" | "history">[] = [
  // ── STRATEGIC ─────────────────────────────────────────────────────
  {
    key: "wheat",       name_ar: "قمح",           name_en: "Wheat",
    category: "strategic", unit: "ل.س/كغ",
    price_syp: 420,   price_prev: 405, top_gov_ar: "الحسكة",
    yield_ton_ha: 2.8, area_ha: 1420, production_ton: 3150, season: "مايو–يونيو",
  },
  {
    key: "barley",      name_ar: "شعير",           name_en: "Barley",
    category: "strategic", unit: "ل.س/كغ",
    price_syp: 328,   price_prev: 312, top_gov_ar: "الحسكة",
    yield_ton_ha: 2.2, area_ha: 580, production_ton: 1280, season: "أبريل–مايو",
  },
  {
    key: "cotton",      name_ar: "قطن",            name_en: "Cotton",
    category: "strategic", unit: "ل.س/كغ",
    price_syp: 1850,  price_prev: 1820, top_gov_ar: "الحسكة",
    yield_ton_ha: 2.4, area_ha: 110, production_ton: 265, season: "أكتوبر–نوفمبر",
  },
  {
    key: "lentils",     name_ar: "عدس",            name_en: "Lentils",
    category: "strategic", unit: "ل.س/كغ",
    price_syp: 950,   price_prev: 910, top_gov_ar: "الحسكة",
    yield_ton_ha: 1.5, area_ha: 95, production_ton: 143, season: "مايو–يونيو",
  },
  {
    key: "sugar_beet",  name_ar: "شمندر سكري",     name_en: "Sugar Beet",
    category: "strategic", unit: "ل.س/كغ",
    price_syp: 118,   price_prev: 110, top_gov_ar: "الحسكة",
    yield_ton_ha: 25, area_ha: 42, production_ton: 1050, season: "أكتوبر–ديسمبر",
  },
  {
    key: "chickpeas",   name_ar: "حمص",            name_en: "Chickpeas",
    category: "strategic", unit: "ل.س/كغ",
    price_syp: 1100,  price_prev: 1070, top_gov_ar: "حلب",
    yield_ton_ha: 1.2, area_ha: 72, production_ton: 86, season: "مايو–يونيو",
  },
  {
    key: "peas",        name_ar: "بازلاء",          name_en: "Peas",
    category: "strategic", unit: "ل.س/كغ",
    price_syp: 780,   price_prev: 755, top_gov_ar: "حلب",
    yield_ton_ha: 1.8, area_ha: 38, production_ton: 68, season: "أبريل–مايو",
  },
  {
    key: "tobacco",     name_ar: "تبغ",             name_en: "Tobacco",
    category: "grains", unit: "ل.س/كغ",
    price_syp: 2800,  price_prev: 2750, top_gov_ar: "اللاذقية",
    yield_ton_ha: 1.1, area_ha: 18, production_ton: 20, season: "أغسطس–سبتمبر",
  },

  // ── VEGETABLES ────────────────────────────────────────────────────
  {
    key: "tomato",      name_ar: "طماطم",           name_en: "Tomatoes",
    category: "vegetables", unit: "ل.س/كغ",
    price_syp: 540,   price_prev: 610, top_gov_ar: "درعا",
    yield_ton_ha: 28, area_ha: 75, production_ton: 2100, season: "يونيو–سبتمبر",
  },
  {
    key: "potato",      name_ar: "بطاطا",           name_en: "Potatoes",
    category: "vegetables", unit: "ل.س/كغ",
    price_syp: 380,   price_prev: 360, top_gov_ar: "ريف دمشق",
    yield_ton_ha: 22, area_ha: 45, production_ton: 990, season: "يونيو–أغسطس",
  },
  {
    key: "onion",       name_ar: "بصل",             name_en: "Onion",
    category: "vegetables", unit: "ل.س/كغ",
    price_syp: 290,   price_prev: 275, top_gov_ar: "حمص",
    yield_ton_ha: 18, area_ha: 28, production_ton: 504, season: "يونيو–يوليو",
  },
  {
    key: "garlic",      name_ar: "ثوم",             name_en: "Garlic",
    category: "vegetables", unit: "ل.س/كغ",
    price_syp: 1650,  price_prev: 1590, top_gov_ar: "حمص",
    yield_ton_ha: 6.5, area_ha: 5, production_ton: 32, season: "مايو–يونيو",
  },
  {
    key: "cucumber",    name_ar: "خيار",            name_en: "Cucumber",
    category: "vegetables", unit: "ل.س/كغ",
    price_syp: 320,   price_prev: 295, top_gov_ar: "حماة",
    yield_ton_ha: 24, area_ha: 18, production_ton: 432, season: "مايو–أكتوبر",
  },
  {
    key: "pepper",      name_ar: "فليفلة",          name_en: "Bell Pepper",
    category: "vegetables", unit: "ل.س/كغ",
    price_syp: 480,   price_prev: 445, top_gov_ar: "حماة",
    yield_ton_ha: 16, area_ha: 12, production_ton: 192, season: "يونيو–أكتوبر",
  },
  {
    key: "eggplant",    name_ar: "باذنجان",          name_en: "Eggplant",
    category: "vegetables", unit: "ل.س/كغ",
    price_syp: 360,   price_prev: 340, top_gov_ar: "درعا",
    yield_ton_ha: 20, area_ha: 14, production_ton: 280, season: "يونيو–أكتوبر",
  },
  {
    key: "zucchini",    name_ar: "كوسا",            name_en: "Zucchini",
    category: "vegetables", unit: "ل.س/كغ",
    price_syp: 310,   price_prev: 295, top_gov_ar: "ريف دمشق",
    yield_ton_ha: 18, area_ha: 9, production_ton: 162, season: "مايو–أكتوبر",
  },
  {
    key: "carrot",      name_ar: "جزر",             name_en: "Carrot",
    category: "vegetables", unit: "ل.س/كغ",
    price_syp: 260,   price_prev: 248, top_gov_ar: "حمص",
    yield_ton_ha: 22, area_ha: 7, production_ton: 154, season: "نوفمبر–مارس",
  },
  {
    key: "cabbage",     name_ar: "ملفوف",           name_en: "Cabbage",
    category: "vegetables", unit: "ل.س/كغ",
    price_syp: 200,   price_prev: 192, top_gov_ar: "ريف دمشق",
    yield_ton_ha: 25, area_ha: 6, production_ton: 150, season: "نوفمبر–أبريل",
  },

  // ── FRUITS ────────────────────────────────────────────────────────
  {
    key: "olive",       name_ar: "زيتون",           name_en: "Olive",
    category: "fruits", unit: "ل.س/كغ",
    price_syp: 1200,  price_prev: 1150, top_gov_ar: "إدلب",
    yield_ton_ha: 3.2, area_ha: 420, production_ton: 1344, season: "أكتوبر–ديسمبر",
  },
  {
    key: "olive_oil",   name_ar: "زيت الزيتون",    name_en: "Olive Oil",
    category: "strategic", unit: "ل.س/كغ",
    price_syp: 9600,  price_prev: 9300, top_gov_ar: "إدلب",
    yield_ton_ha: 0.6, area_ha: 420, production_ton: 250, season: "نوفمبر–يناير",
  },
  {
    key: "grapes",      name_ar: "عنب",             name_en: "Grapes",
    category: "fruits", unit: "ل.س/كغ",
    price_syp: 760,   price_prev: 690, top_gov_ar: "السويداء",
    yield_ton_ha: 6.5, area_ha: 52, production_ton: 338, season: "أغسطس–أكتوبر",
  },
  {
    key: "citrus",      name_ar: "حمضيات",          name_en: "Citrus",
    category: "fruits", unit: "ل.س/كغ",
    price_syp: 350,   price_prev: 400, top_gov_ar: "طرطوس",
    yield_ton_ha: 9, area_ha: 28, production_ton: 252, season: "نوفمبر–مارس",
  },
  {
    key: "pistachios",  name_ar: "فستق حلبي",       name_en: "Pistachios",
    category: "fruits", unit: "ل.س/كغ",
    price_syp: 14800, price_prev: 14100, top_gov_ar: "إدلب",
    yield_ton_ha: 1.8, area_ha: 35, production_ton: 63, season: "سبتمبر–أكتوبر",
  },
  {
    key: "apple",       name_ar: "تفاح",            name_en: "Apple",
    category: "fruits", unit: "ل.س/كغ",
    price_syp: 580,   price_prev: 550, top_gov_ar: "السويداء",
    yield_ton_ha: 12, area_ha: 20, production_ton: 240, season: "أغسطس–أكتوبر",
  },
  {
    key: "apricot",     name_ar: "مشمش",            name_en: "Apricot",
    category: "fruits", unit: "ل.س/كغ",
    price_syp: 680,   price_prev: 640, top_gov_ar: "حلب",
    yield_ton_ha: 10, area_ha: 15, production_ton: 150, season: "مايو–يوليو",
  },
  {
    key: "cherry",      name_ar: "كرز",             name_en: "Cherry",
    category: "fruits", unit: "ل.س/كغ",
    price_syp: 1800,  price_prev: 1720, top_gov_ar: "السويداء",
    yield_ton_ha: 8, area_ha: 8, production_ton: 64, season: "مايو–يونيو",
  },
  {
    key: "fig",         name_ar: "تين",             name_en: "Fig",
    category: "fruits", unit: "ل.س/كغ",
    price_syp: 820,   price_prev: 790, top_gov_ar: "اللاذقية",
    yield_ton_ha: 7, area_ha: 12, production_ton: 84, season: "أغسطس–أكتوبر",
  },
  {
    key: "pomegranate", name_ar: "رمان",            name_en: "Pomegranate",
    category: "fruits", unit: "ل.س/كغ",
    price_syp: 750,   price_prev: 710, top_gov_ar: "حماة",
    yield_ton_ha: 9, area_ha: 10, production_ton: 90, season: "سبتمبر–نوفمبر",
  },
  {
    key: "almond",      name_ar: "لوز",             name_en: "Almond",
    category: "fruits", unit: "ل.س/كغ",
    price_syp: 4200,  price_prev: 4050, top_gov_ar: "حلب",
    yield_ton_ha: 1.5, area_ha: 22, production_ton: 33, season: "يونيو–أغسطس",
  },

  // ── GRAINS & OILSEEDS ─────────────────────────────────────────────
  {
    key: "corn",        name_ar: "ذرة شامية",        name_en: "Corn",
    category: "grains", unit: "ل.س/كغ",
    price_syp: 380,   price_prev: 365, top_gov_ar: "الحسكة",
    yield_ton_ha: 5.5, area_ha: 30, production_ton: 165, season: "سبتمبر–أكتوبر",
  },
  {
    key: "sesame",      name_ar: "سمسم",            name_en: "Sesame",
    category: "grains", unit: "ل.س/كغ",
    price_syp: 2200,  price_prev: 2150, top_gov_ar: "دير الزور",
    yield_ton_ha: 0.9, area_ha: 25, production_ton: 22, season: "أغسطس–سبتمبر",
  },
  {
    key: "sunflower",   name_ar: "عباد الشمس",      name_en: "Sunflower",
    category: "grains", unit: "ل.س/كغ",
    price_syp: 680,   price_prev: 660, top_gov_ar: "الحسكة",
    yield_ton_ha: 1.6, area_ha: 18, production_ton: 29, season: "سبتمبر",
  },
  {
    key: "flax",        name_ar: "كتان",            name_en: "Flax",
    category: "grains", unit: "ل.س/كغ",
    price_syp: 920,   price_prev: 900, top_gov_ar: "حلب",
    yield_ton_ha: 0.8, area_ha: 8, production_ton: 6, season: "مايو–يونيو",
  },
  {
    key: "rice",        name_ar: "أرز",             name_en: "Rice",
    category: "grains", unit: "ل.س/كغ",
    price_syp: 1450,  price_prev: 1420, top_gov_ar: "دير الزور",
    yield_ton_ha: 4.2, area_ha: 10, production_ton: 42, season: "أكتوبر",
  },
  {
    key: "sorghum",     name_ar: "ذرة بيضاء",       name_en: "Sorghum",
    category: "grains", unit: "ل.س/كغ",
    price_syp: 310,   price_prev: 298, top_gov_ar: "الرقة",
    yield_ton_ha: 2.8, area_ha: 14, production_ton: 39, season: "سبتمبر–أكتوبر",
  },
  {
    key: "anise",       name_ar: "ينسون",           name_en: "Anise",
    category: "grains", unit: "ل.س/كغ",
    price_syp: 3800,  price_prev: 3700, top_gov_ar: "حلب",
    yield_ton_ha: 0.7, area_ha: 5, production_ton: 4, season: "يونيو–يوليو",
  },
];

// ── Regional summaries ────────────────────────────────────────────────
const ALL_REGIONS: RegionSummary[] = [
  { gov_ar: "الحسكة",    gov_en: "Al-Hasakah",    lat: 36.50, lng: 40.74, intensity: 0.85, area_rank: 1, top_crop_ar: "قمح",         production_score: 92 },
  { gov_ar: "حلب",       gov_en: "Aleppo",         lat: 36.20, lng: 37.16, intensity: 0.75, area_rank: 2, top_crop_ar: "قمح",         production_score: 82 },
  { gov_ar: "حماة",      gov_en: "Hama",           lat: 35.13, lng: 36.75, intensity: 0.70, area_rank: 4, top_crop_ar: "قمح",         production_score: 76 },
  { gov_ar: "الرقة",     gov_en: "Raqqa",          lat: 35.95, lng: 39.01, intensity: 0.63, area_rank: 3, top_crop_ar: "قمح",         production_score: 68 },
  { gov_ar: "حمص",       gov_en: "Homs",           lat: 34.73, lng: 36.72, intensity: 0.58, area_rank: 5, top_crop_ar: "زيتون",       production_score: 62 },
  { gov_ar: "دير الزور", gov_en: "Deir ez-Zor",   lat: 35.34, lng: 40.14, intensity: 0.55, area_rank: 6, top_crop_ar: "قطن",         production_score: 58 },
  { gov_ar: "دمشق",      gov_en: "Damascus",       lat: 33.51, lng: 36.29, intensity: 0.50, area_rank: 14,top_crop_ar: "خضروات",      production_score: 52 },
  { gov_ar: "اللاذقية",  gov_en: "Latakia",        lat: 35.52, lng: 35.79, intensity: 0.45, area_rank: 11,top_crop_ar: "زيتون",       production_score: 48 },
  { gov_ar: "ريف دمشق", gov_en: "Rural Damascus", lat: 33.62, lng: 36.55, intensity: 0.42, area_rank: 7, top_crop_ar: "خضروات",      production_score: 45 },
  { gov_ar: "إدلب",      gov_en: "Idlib",          lat: 35.93, lng: 36.63, intensity: 0.40, area_rank: 8, top_crop_ar: "زيتون",       production_score: 42 },
  { gov_ar: "طرطوس",     gov_en: "Tartus",         lat: 34.89, lng: 35.89, intensity: 0.38, area_rank: 12,top_crop_ar: "حمضيات",      production_score: 40 },
  { gov_ar: "السويداء",  gov_en: "As-Suwayda",    lat: 32.71, lng: 36.57, intensity: 0.32, area_rank: 9, top_crop_ar: "عنب",         production_score: 35 },
  { gov_ar: "درعا",      gov_en: "Daraa",          lat: 32.62, lng: 36.10, intensity: 0.28, area_rank: 13,top_crop_ar: "طماطم",       production_score: 30 },
  { gov_ar: "القنيطرة",  gov_en: "Quneitra",       lat: 33.13, lng: 35.82, intensity: 0.18, area_rank: 10,top_crop_ar: "قمح",         production_score: 20 },
];

// ── Handler ───────────────────────────────────────────────────────────
// ── FastAPI proxy (set FASTAPI_URL=http://localhost:8000 to enable) ───
async function proxyFromFastAPI(
  fastapiUrl: string,
  region: string | null,
  category: string | null,
): Promise<MarketResponse | null> {
  try {
    const params = new URLSearchParams();
    if (region)   params.set("region", region);
    if (category) params.set("category", category);
    const qs = params.toString() ? `?${params}` : "";
    const res = await fetch(`${fastapiUrl}/api/market/summary${qs}`, {
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return null;
    // FastAPI uses snake_case `last_updated`; remap to camelCase
    const data = await res.json() as { crops: CropPrice[]; regions: RegionSummary[]; season_ar: string; last_updated: string };
    return {
      crops:       data.crops,
      regions:     data.regions,
      season_ar:   data.season_ar,
      lastUpdated: data.last_updated,
    };
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const region   = searchParams.get("region");
  const category = searchParams.get("category");

  // Try FastAPI backend first
  const fastapiUrl = process.env.FASTAPI_URL;
  if (fastapiUrl) {
    const proxied = await proxyFromFastAPI(fastapiUrl, region, category);
    if (proxied) {
      return NextResponse.json(proxied, {
        headers: { "Cache-Control": "s-maxage=30, stale-while-revalidate=60" },
      });
    }
  }

  // Built-in data fallback
  let crops: CropPrice[] = ALL_CROPS.map((c) => ({
    ...c,
    change_pct: parseFloat(
      (((c.price_syp - c.price_prev) / c.price_prev) * 100).toFixed(2)
    ),
    history: hist(c.price_prev, (c.price_syp - c.price_prev) / 5),
  }));

  if (category) {
    crops = crops.filter((c) => c.category === category);
  }

  let regions = ALL_REGIONS;
  if (region) {
    const r = ALL_REGIONS.find((r) => r.gov_ar === region);
    regions = r ? [r] : ALL_REGIONS;
  }

  return NextResponse.json(
    {
      crops,
      regions,
      lastUpdated: new Date().toISOString(),
      season_ar: "موسم ٢٠٢٦",
    } satisfies MarketResponse,
    {
      headers: {
        "Cache-Control": "s-maxage=30, stale-while-revalidate=60",
      },
    }
  );
}
