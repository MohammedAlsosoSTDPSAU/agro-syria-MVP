"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, X, Droplets, Calendar, Bug, MapPin,
  TrendingUp, TrendingDown, Minus,
  SlidersHorizontal, Bot, ChevronLeft,
  FlaskConical, Sprout, BarChart3, Star, Calculator,
  BookOpen, Leaf, CheckCircle, AlertTriangle, Sparkles,
  Layers, Scissors, Package, ShieldAlert, Shield, Thermometer, Sun,
  Zap, Share2, Radio, Activity, ChevronDown, Gauge,
} from "lucide-react";
import { WorkspaceLayout } from "@/components/workspace/WorkspaceLayout";
import { SyriaMap } from "@/components/workspace/SyriaMap";
import { cn } from "@/lib/utils";
import { CROPS_EXTENDED, CROPS_PHASE3 } from "@/lib/crops-extended";

type Bezier = [number, number, number, number];
const EASE: Bezier = [0.22, 1, 0.36, 1];
const cardV = {
  hidden:  { opacity: 0, scale: 0.96 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.35, ease: EASE } },
};
const stagger = {
  hidden:  {},
  visible: { transition: { staggerChildren: 0.05, delayChildren: 0.08 } },
};

/* ─── Types ─────────────────────────────────────────────────────────── */
type Season      = "شتوي" | "صيفي" | "ربيعي" | "سنوي";
type WaterNeed   = "عالٍ" | "متوسط" | "منخفض";
type Category    = "استراتيجي" | "فاكهة" | "خضار" | "أشجار";
type RiskLevel   = "Low" | "Medium" | "High";
type MarketTrend = "Rising" | "Stable" | "Falling";

interface Crop {
  key:              string;
  name:             string;
  variety:          string;
  category:         Category;
  season:           Season;
  waterNeed:        WaterNeed;
  plantDate:        string;
  harvestDate:      string;
  soilPH:           string;
  diseases:         string[];
  demandIndex:      number;
  profitIndex:      number;
  govs:             string[];
  description:      string;
  color:            string;
  yieldPerDunum:    number;
  pricePerKg:       number;
  yieldHistory:     number[];
  tips:             string[];
  gcsar:            string;
  riskLevel:        RiskLevel;
  marketTrend:      MarketTrend;
  currentSeasonStatus: string;
  seasonalProgress: number;
}

/* ─── Style maps ─────────────────────────────────────────────────────── */
const SEASON_CLS: Record<Season, string> = {
  شتوي:  "text-sky-400 bg-sky-500/10 border-sky-500/20",
  صيفي:  "text-amber-400 bg-amber-500/10 border-amber-500/20",
  ربيعي: "text-pink-400 bg-pink-500/10 border-pink-500/20",
  سنوي:  "text-purple-400 bg-purple-500/10 border-purple-500/20",
};
const WATER_CLS: Record<WaterNeed, string> = {
  "عالٍ":  "text-red-400",
  "متوسط": "text-amber-400",
  "منخفض": "text-emerald-400",
};
const CAT_CLS: Record<Category, string> = {
  "استراتيجي": "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  "أشجار":     "text-lime-400 bg-lime-500/10 border-lime-500/20",
  "فاكهة":     "text-pink-400 bg-pink-500/10 border-pink-500/20",
  "خضار":      "text-sky-400 bg-sky-500/10 border-sky-500/20",
};
const RISK_CLS: Record<RiskLevel, string> = {
  Low:    "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  Medium: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  High:   "text-red-400 bg-red-500/10 border-red-500/20",
};
const RISK_AR: Record<RiskLevel, string> = {
  Low: "مخاطرة منخفضة", Medium: "مخاطرة متوسطة", High: "مخاطرة عالية",
};
const TREND_AR: Record<MarketTrend, string> = {
  Rising: "ارتفاع", Stable: "استقرار", Falling: "انخفاض",
};
const TREND_CLS: Record<MarketTrend, string> = {
  Rising:  "text-emerald-400",
  Stable:  "text-amber-400",
  Falling: "text-red-400",
};

/* ─── GCSAR Encyclopedia Data ────────────────────────────────────────── */
const CROPS: Crop[] = [
  {
    key: "wheat", name: "القمح", variety: "شام 3 — شام 9",
    category: "استراتيجي", season: "شتوي", waterNeed: "متوسط",
    plantDate: "1 نوفمبر — 15 نوفمبر", harvestDate: "15 مايو — 30 يونيو",
    soilPH: "6.0 — 7.5",
    diseases: ["صدأ القمح الأصفر", "التفحم الغباري", "البياض الدقيقي", "مرض السبوريا"],
    demandIndex: 95, profitIndex: 72,
    govs: ["الحسكة", "حلب", "دير الزور", "الرقة", "حماة"],
    description: "المحصول الاستراتيجي الأول في سوريا. ينمو في السهول شبه الجافة ويتحمل برودة الشتاء. صنف شام 3 هو الأكثر انتشاراً في شمال شرق سوريا.",
    color: "#f59e0b", yieldPerDunum: 350, pricePerKg: 1400,
    yieldHistory: [310, 285, 340, 295, 350],
    tips: [
      "الوقت المثالي للتسميد الإزوتي: 3 أسابيع بعد الإنبات وعند بدء التفريع — هذا يزيد الغلة 15-20% في ظروف الحسكة.",
      "استخدم صنف شام 9 في الأراضي الملحية (EC > 4 dS/m) لتجنب إجهاد الملوحة في سهول الرقة.",
      "رش مبيد Tebuconazole عند ظهور أولى بقع الصدأ الأصفر — التدخل المبكر يوفر 40-60% من الغلة.",
    ],
    gcsar: "مديرية أبحاث الحبوب — مركز أكساد، حلب",
    riskLevel: "Low", marketTrend: "Stable",
    currentSeasonStatus: "في مرحلة النضج — الحصاد قريب جداً",
    seasonalProgress: 88,
  },
  {
    key: "cotton", name: "القطن", variety: "دير الزور 55 — حلب 90",
    category: "استراتيجي", season: "صيفي", waterNeed: "عالٍ",
    plantDate: "15 أبريل — 15 مايو", harvestDate: "أكتوبر — نوفمبر",
    soilPH: "6.5 — 7.5",
    diseases: ["دودة اللوز الأمريكية", "حشرة البق الدقيقي", "التبقع الزاوي", "العفن الجوزي"],
    demandIndex: 78, profitIndex: 65,
    govs: ["حلب", "الرقة", "دير الزور", "الحسكة"],
    description: "ذهب سوريا الأبيض. محصول نقدي مهم يتطلب رياً وفيراً وحرارة صيفية عالية فوق 25 درجة للإنضاج الجيد.",
    color: "#e2e8f0", yieldPerDunum: 250, pricePerKg: 1850,
    yieldHistory: [290, 240, 210, 230, 250],
    tips: [
      "تحقق من كثافة البق الدقيقي أسبوعياً بعد يونيو — 30 حشرة/ورقة هي عتبة المكافحة الاقتصادية وفق GCSAR.",
      "قلص فترة ري آخر دورة بمقدار 15 يوماً قبل فتح اللوز — هذا يرفع نسبة الألياف 5-7 درجات في التصنيف.",
      "استخدم مصيدة الفرمون للرصد المبكر لدودة اللوز الأمريكية قبل موسم الإزهار.",
    ],
    gcsar: "مركز أبحاث القطن — حلب",
    riskLevel: "High", marketTrend: "Falling",
    currentSeasonStatus: "مرحلة الزراعة وبداية الإنبات",
    seasonalProgress: 10,
  },
  {
    key: "olive", name: "الزيتون", variety: "زيتية — سوراني — قيسي",
    category: "أشجار", season: "سنوي", waterNeed: "منخفض",
    plantDate: "أكتوبر — ديسمبر", harvestDate: "أكتوبر — ديسمبر",
    soilPH: "6.0 — 8.0",
    diseases: ["ذبابة الزيتون", "التبقع الدائري", "الذبول الفيوزاري", "السيلان الصمغي"],
    demandIndex: 88, profitIndex: 85,
    govs: ["إدلب", "اللاذقية", "طرطوس", "حماة", "حلب"],
    description: "شجرة الحضارة السورية. تعيش آلاف السنين وتنتج أجود الزيوت في المنطقة. سوريا رابع أكبر منتج عالمي لزيت الزيتون.",
    color: "#84cc16", yieldPerDunum: 200, pricePerKg: 8500,
    yieldHistory: [180, 210, 175, 195, 200],
    tips: [
      "رش مبيد الـ Kaolin (10%) على الثمار بين يونيو وأغسطس — يقلل إصابة ذبابة الزيتون 90% دون تأثير كيميائي.",
      "التقليم في فبراير-مارس بعد الصقيع مباشرةً — أزل ثلث الفروع الداخلية لتحسين التهوية وإنتاج موسم قادم.",
      "أضف 5 كغ بوتاسيوم/شجرة في أغسطس لتحسين نضج الثمار وزيادة نسبة الزيت 3-5%.",
    ],
    gcsar: "مركز أبحاث الزيتون — إدلب",
    riskLevel: "Low", marketTrend: "Rising",
    currentSeasonStatus: "في مرحلة التزهير وتشكّل الثمار الأولى",
    seasonalProgress: 38,
  },
  {
    key: "tomato", name: "الطماطم", variety: "هايبريد 5335 — برايم بلس",
    category: "خضار", season: "صيفي", waterNeed: "عالٍ",
    plantDate: "فبراير — أبريل", harvestDate: "يونيو — سبتمبر",
    soilPH: "6.0 — 7.0",
    diseases: ["العفن البني الفيتوفثورا", "بياض الطحين", "فيروس تجعد الأوراق", "التبقع المبكر"],
    demandIndex: 82, profitIndex: 78,
    govs: ["ريف دمشق", "حمص", "حماة", "السويداء", "اللاذقية"],
    description: "أكثر الخضار زراعةً في سوريا. ينمو في الهواء الطلق والبيوت البلاستيكية. سوريا تنتج أكثر من 900 ألف طن سنوياً.",
    color: "#ef4444", yieldPerDunum: 2500, pricePerKg: 400,
    yieldHistory: [2100, 2350, 2200, 2400, 2500],
    tips: [
      "حافظ على رطوبة تربة 70-80% بالري بالتنقيط — التذبذب يسبب تشقق الثمار والتعفن الطرفي في ظروف حمص.",
      "رش كالسيوم فولياري (1.5% CaCl₂) كل أسبوعين لمنع التعفن الطرفي (Blossom End Rot) في الأصناف الهجينة.",
      "استخدم فخاخ اللاصق الأصفر للرصد المبكر للذبابة البيضاء الناقلة لفيروس تجعد الأوراق TYLCV.",
    ],
    gcsar: "مديرية أبحاث الخضار — دمشق",
    riskLevel: "Medium", marketTrend: "Rising",
    currentSeasonStatus: "في طور النمو الخضري وبداية الإزهار",
    seasonalProgress: 35,
  },
  {
    key: "pistachio", name: "الفستق الحلبي", variety: "بطيري — أبيض — عاشوري",
    category: "أشجار", season: "سنوي", waterNeed: "منخفض",
    plantDate: "فبراير — مارس", harvestDate: "أغسطس — سبتمبر",
    soilPH: "6.5 — 8.0",
    diseases: ["سوسة الفستق", "التبقع الورقي", "لفحة البوتريتيس", "الحشرة القرمزية"],
    demandIndex: 91, profitIndex: 92,
    govs: ["حلب", "إدلب", "حماة", "اللاذقية"],
    description: "التسمية الجغرافية السورية الأشهر عالمياً. يتحمل الجفاف الشديد ودرجات الحرارة المتطرفة. يعطي ثمراً بعد 5-7 سنوات لكن يعيش 300+ عام.",
    color: "#a3e635", yieldPerDunum: 120, pricePerKg: 28000,
    yieldHistory: [100, 115, 95, 110, 120],
    tips: [
      "نسبة التلقيح المثلى: شجرة ذكر واحدة لكل 8-10 شجرة أنثى — التوزيع الخاطئ يخفض إنتاج حلب 40%.",
      "لا تروِ في يوليو وأغسطس إلا عند الضرورة القصوى — الإجهاد المائي الخفيف يحسن نسبة الفتح والطعم.",
      "رش بورون (0.7%) عند بدء الإزهار — يزيد نسبة تعقد الثمار 30-40% في بساتين حلب الجافة.",
    ],
    gcsar: "مركز أبحاث الفستق — حلب",
    riskLevel: "Medium", marketTrend: "Rising",
    currentSeasonStatus: "في طور تطور القلب — نمو الثمار مكثّف",
    seasonalProgress: 42,
  },
  {
    key: "citrus", name: "الحمضيات", variety: "نافل — كلمنتين — أبو صرة",
    category: "فاكهة", season: "شتوي", waterNeed: "عالٍ",
    plantDate: "أكتوبر — نوفمبر", harvestDate: "نوفمبر — فبراير",
    soilPH: "5.5 — 7.0",
    diseases: ["حشرة المن", "التريبس", "العفن البني Phytophthora", "البياض الدقيقي"],
    demandIndex: 75, profitIndex: 68,
    govs: ["اللاذقية", "طرطوس", "حمص"],
    description: "تزدهر على الساحل السوري بمناخه المتوسطي الرطب. سوريا تنتج ما يزيد على 350 ألف طن سنوياً من الحمضيات المتنوعة.",
    color: "#fb923c", yieldPerDunum: 1800, pricePerKg: 600,
    yieldHistory: [1600, 1750, 1680, 1820, 1800],
    tips: [
      "الري بالرذاذ فجراً في يوليو-أغسطس يخفض درجة حرارة التاج 4-6 درجات ويقلل تساقط الثمار الصيفي.",
      "أجرِ تحليل ورقي كل موسم — نقص الزنك شائع في الحمضيات الساحلية ويظهر كاصفرار وريدي.",
      "ضع مصيدة لاصقة لون البرتقالي لصيد التريبس قبل الإزهار — يقلل استخدام المبيدات 40%.",
    ],
    gcsar: "مركز أبحاث الفاكهة — اللاذقية",
    riskLevel: "Medium", marketTrend: "Stable",
    currentSeasonStatus: "في مرحلة نمو الثمار الصيفية",
    seasonalProgress: 48,
  },
  {
    key: "barley", name: "الشعير", variety: "عربي أسود — ابن رشد",
    category: "استراتيجي", season: "شتوي", waterNeed: "منخفض",
    plantDate: "أكتوبر — نوفمبر", harvestDate: "أبريل — مايو",
    soilPH: "6.5 — 8.0",
    diseases: ["صدأ الأوراق", "البياض الدقيقي", "التبقع الشبكي", "التفحم المغطى"],
    demandIndex: 70, profitIndex: 55,
    govs: ["دير الزور", "الحسكة", "الرقة", "حلب"],
    description: "أقل احتياجاً للمياه من القمح ويتحمل الملوحة. يُستخدم للأعلاف ومصدر مهم للأمن الغذائي في المناطق الجافة.",
    color: "#d97706", yieldPerDunum: 280, pricePerKg: 950,
    yieldHistory: [250, 260, 240, 270, 280],
    tips: [
      "ازرع مبكراً في أكتوبر لتجنب الصقيع الربيعي المتأخر — التأخر أسبوعين يخفض الغلة 30% في الحسكة.",
      "الشعير يتحمل pH 8.0 — استغل الأراضي الكلسية التي يرفضها القمح في الأودية السورية.",
      "دور تناوبي: القمح سنة / الشعير سنة يقطع دورة حياة التفحم المغطى ويوفر 40% من تكاليف المبيد.",
    ],
    gcsar: "مركز أبحاث الأعلاف — الحسكة",
    riskLevel: "Low", marketTrend: "Stable",
    currentSeasonStatus: "في مرحلة النضج — الحصاد خلال أسبوع",
    seasonalProgress: 92,
  },
  {
    key: "lentils", name: "العدس", variety: "صغير أحمر — مزروعة — حلبي",
    category: "استراتيجي", season: "شتوي", waterNeed: "منخفض",
    plantDate: "نوفمبر — ديسمبر", harvestDate: "أبريل — مايو",
    soilPH: "6.0 — 8.0",
    diseases: ["اللفحة المتأخرة Stemphylium", "صدأ العدس", "التفحم", "حشرة الكانتاريدة"],
    demandIndex: 65, profitIndex: 60,
    govs: ["حلب", "إدلب", "حماة", "دير الزور"],
    description: "بروتين الفقير والغني. سوريا من أكبر منتجي العدس في المنطقة العربية وتصدر الأصناف الحلبية الصغيرة لأوروبا.",
    color: "#f97316", yieldPerDunum: 130, pricePerKg: 2200,
    yieldHistory: [115, 120, 118, 125, 130],
    tips: [
      "العدس لا يحتاج تسميداً إزوتياً — الجذور تثبت الإزوت. السماد الفوسفوري 40 كغ/دونم يكفي في بداية الموسم.",
      "الحصاد عند اصفرار 90% من القرون — الانتظار يسبب انفراط القرون وخسارة 20-30% من الغلة.",
      "التناوب مع القمح ضروري — العدس يمنع تراكم مسببات اللفحة المتأخرة في التربة.",
    ],
    gcsar: "مركز أبحاث البقوليات — حلب",
    riskLevel: "Low", marketTrend: "Stable",
    currentSeasonStatus: "اكتمل الحصاد — التخطيط للموسم القادم",
    seasonalProgress: 100,
  },
  {
    key: "grapes", name: "العنب", variety: "بلدي أسود — دوم — حلواني",
    category: "فاكهة", season: "صيفي", waterNeed: "متوسط",
    plantDate: "مارس", harvestDate: "أغسطس — أكتوبر",
    soilPH: "6.0 — 7.0",
    diseases: ["البياض الزغبي Plasmopara", "العفن الرمادي Botrytis", "البياض الدقيقي", "عنكبوت العنب"],
    demandIndex: 72, profitIndex: 70,
    govs: ["السويداء", "ريف دمشق", "حلب", "اللاذقية", "القلمون"],
    description: "سوريا موطن الكرمة القديمة منذ آلاف السنين. أصناف محلية أصيلة للأكل والزبيب وعصير العنب مع إمكانات تصديرية كبيرة.",
    color: "#8b5cf6", yieldPerDunum: 800, pricePerKg: 1200,
    yieldHistory: [720, 760, 700, 780, 800],
    tips: [
      "ابدأ رش مبيد البياض الزغبي (Mancozeb) قبل الإزهار بأسبوع — المرض يدمر العنقود كاملاً عند رطوبة >85%.",
      "التقليم الشتوي الصارم (إبقاء عود واحد بـ7-9 عيون) أساس الجودة — الكروم المهملة تنتج كثيراً بجودة رديئة.",
      "التعريش الأفقي على 1.8م ارتفاع يحسن التهوية ويقلل البياض الرمادي 40% مقارنةً بالتربيد الأرضي.",
    ],
    gcsar: "مركز أبحاث الكرمة — السويداء",
    riskLevel: "Low", marketTrend: "Stable",
    currentSeasonStatus: "في مرحلة العقد وتضخم العناقيد",
    seasonalProgress: 45,
  },
  {
    key: "sugar_beet", name: "الشوندر السكري", variety: "كلاريسا — مورا",
    category: "استراتيجي", season: "شتوي", waterNeed: "عالٍ",
    plantDate: "أكتوبر — نوفمبر", harvestDate: "مارس — أبريل",
    soilPH: "6.0 — 7.5",
    diseases: ["الإفا الجذرية Rhizoctonia", "العفن الرمادي", "البياض الدقيقي", "نيماتودا الجذور"],
    demandIndex: 68, profitIndex: 62,
    govs: ["حمص", "الرقة", "حماة", "دير الزور"],
    description: "المادة الخام لمصانع السكر السورية في حمص والرقة. يحتاج تربة خصبة عميقة وري منتظم لضمان نسبة سكر فوق 16%.",
    color: "#6ee7b7", yieldPerDunum: 5000, pricePerKg: 420,
    yieldHistory: [4500, 4800, 4600, 4900, 5000],
    tips: [
      "دقة موعد الزراعة حاسمة — زرع في أكتوبر يعطي جذوراً تتجاوز 800 غ بينما نوفمبر يعطي 650 غ في ظروف حمص.",
      "تحليل نسبة السكر (Brix) في الأسبوع الثامن للتأكد من الوصول إلى 16% قبل الحصاد — المصنع يدفع علاوة فوق 16%.",
      "الري بالتنقيط يوفر 35% من المياه مقارنةً بالري السطحي مع رفع نسبة السكر 2.5%.",
    ],
    gcsar: "مركز أبحاث المحاصيل السكرية — حمص",
    riskLevel: "Medium", marketTrend: "Stable",
    currentSeasonStatus: "اكتمل الموسم — قيد الأرشفة",
    seasonalProgress: 100,
  },
  {
    key: "apricot", name: "المشمش", variety: "قيسي — طيبي — حمصي",
    category: "فاكهة", season: "ربيعي", waterNeed: "متوسط",
    plantDate: "يناير — فبراير", harvestDate: "مايو — يونيو",
    soilPH: "6.0 — 7.5",
    diseases: ["الموت السريع Verticillium", "التبقع المثقب", "المن الخوخي", "صدأ الورد"],
    demandIndex: 77, profitIndex: 73,
    govs: ["دمشق", "القلمون", "السويداء", "ريف دمشق"],
    description: "المشمش الشامي الأصيل مشهور عالمياً. يزدهر في المرتفعات ذات الشتاء البارد والربيع الجاف. سوريا تصدر المشمش المجفف لأوروبا.",
    color: "#f97316", yieldPerDunum: 400, pricePerKg: 3500,
    yieldHistory: [350, 380, 320, 390, 400],
    tips: [
      "المشمش يحتاج 800-1000 ساعة برد أقل من 7°م — اختر مناطق المرتفعات فوق 800م لضمان التفتح المتزامن.",
      "رش مبيد فطري نحاسي مباشرةً بعد تساقط الأوراق لمكافحة الموت السريع — الوقاية أجدى من العلاج.",
      "التسميد البوتاسي (2.5 كغ K₂O/شجرة) في أكتوبر يحسن صلابة الثمار ويطيل مدة التخزين 10 أيام.",
    ],
    gcsar: "مركز أبحاث الفاكهة المتساقطة — دمشق",
    riskLevel: "Medium", marketTrend: "Rising",
    currentSeasonStatus: "في ذروة موسم الحصاد!",
    seasonalProgress: 85,
  },
];

/* ─── Filter constants ───────────────────────────────────────────────── */
const SEASONS:    (Season | "الكل")[]    = ["الكل", "شتوي", "صيفي", "ربيعي", "سنوي"];
const WATER_NEEDS:(WaterNeed | "الكل")[] = ["الكل", "عالٍ", "متوسط", "منخفض"];
const CATEGORIES: (Category | "الكل")[] = ["الكل", "استراتيجي", "أشجار", "فاكهة", "خضار"];

/* ─── Seasonal highlights config (May–June 2026) ────────────────────── */
const HIGHLIGHT_KEYS = [
  { key: "apricot",   reason: "ذروة الحصاد الآن!", label: "أعلى إلحاحاً",     accent: "#f97316" },
  { key: "pistachio", reason: "أعلى ربحية هذا الصيف", label: "أفضل استثماراً", accent: "#a3e635" },
  { key: "tomato",    reason: "نافذة الزراعة الصيفية مفتوحة", label: "ابدأ الآن", accent: "#ef4444" },
] as const;

/* ─── Progress bar color ─────────────────────────────────────────────── */
function progressColor(pct: number) {
  if (pct >= 90) return "#a855f7";
  if (pct >= 60) return "#f59e0b";
  if (pct >= 25) return "#10b981";
  return "#38bdf8";
}

/* ─── Yield mini-sparkline ───────────────────────────────────────────── */
function YieldSparkline({ data, color }: { data: number[]; color: string }) {
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const W = 80, H = 28;
  const pts = data
    .map((v, i) => `${(i / (data.length - 1)) * W},${H - ((v - min) / range) * (H - 4) - 2}`)
    .join(" ");
  const lastX = W;
  const lastY = H - ((data[data.length - 1] - min) / range) * (H - 4) - 2;
  const trend = data[data.length - 1] >= data[0];

  return (
    <div className="flex items-end gap-2">
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
        <polyline points={pts} fill="none" stroke={color} strokeWidth="1.8"
          strokeLinecap="round" strokeLinejoin="round" opacity="0.9" />
        <circle cx={lastX} cy={lastY} r="2.5" fill={color} />
      </svg>
      <span className={cn("text-[9px] font-bold", trend ? "text-emerald-400" : "text-red-400")}>
        {trend ? "▲" : "▼"}
      </span>
    </div>
  );
}

/* ─── Custom SVG Crop Icons ──────────────────────────────────────────── */
function CropIcon({ cropKey, color, size = 32 }: { cropKey: string; color: string; size?: number }) {
  const s = size;
  const icons: Record<string, React.ReactElement> = {
    wheat: (
      <svg width={s} height={s} viewBox="0 0 32 32" fill="none">
        <line x1="16" y1="28" x2="16" y2="6" stroke={color} strokeWidth="1.8" strokeLinecap="round"/>
        <line x1="16" y1="22" x2="11" y2="17" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
        <line x1="16" y1="22" x2="21" y2="17" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
        <line x1="16" y1="17" x2="11" y2="12" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
        <line x1="16" y1="17" x2="21" y2="12" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
        <line x1="16" y1="12" x2="11" y2="7"  stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
        <line x1="16" y1="12" x2="21" y2="7"  stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
        <circle cx="16" cy="5" r="1.8" fill={color}/>
        <path d="M13 28 Q16 26 19 28" stroke={color} strokeWidth="1.4" fill="none" strokeLinecap="round"/>
      </svg>
    ),
    cotton: (
      <svg width={s} height={s} viewBox="0 0 32 32" fill="none">
        <line x1="16" y1="30" x2="16" y2="14" stroke={color} strokeWidth="1.8" strokeLinecap="round"/>
        <circle cx="16" cy="10" r="4.5" fill={color} fillOpacity="0.9"/>
        <circle cx="9"  cy="13" r="3.2" fill={color} fillOpacity="0.75"/>
        <circle cx="23" cy="13" r="3.2" fill={color} fillOpacity="0.75"/>
        <circle cx="11" cy="7"  r="2.8" fill={color} fillOpacity="0.6"/>
        <circle cx="21" cy="7"  r="2.8" fill={color} fillOpacity="0.6"/>
        <path d="M13 30 Q16 28 19 30" stroke={color} strokeWidth="1.4" fill="none" strokeLinecap="round"/>
      </svg>
    ),
    olive: (
      <svg width={s} height={s} viewBox="0 0 32 32" fill="none">
        <line x1="16" y1="30" x2="16" y2="16" stroke={color} strokeWidth="2" strokeLinecap="round"/>
        <path d="M16 16 Q10 10 12 4 Q16 8 16 16" fill={color} fillOpacity="0.85"/>
        <path d="M16 16 Q22 10 20 4 Q16 8 16 16" fill={color} fillOpacity="0.7"/>
        <path d="M16 14 Q8 18 9 24 Q14 20 16 14" fill={color} fillOpacity="0.65"/>
        <path d="M16 14 Q24 18 23 24 Q18 20 16 14" fill={color} fillOpacity="0.65"/>
        <ellipse cx="13" cy="10" rx="2" ry="3" fill={color} fillOpacity="0.5" transform="rotate(-20 13 10)"/>
      </svg>
    ),
    tomato: (
      <svg width={s} height={s} viewBox="0 0 32 32" fill="none">
        <circle cx="16" cy="18" r="10" fill={color} fillOpacity="0.88"/>
        <path d="M13 8 Q16 4 19 8" stroke="#4ade80" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
        <line x1="16" y1="8" x2="16" y2="10" stroke="#4ade80" strokeWidth="1.4" strokeLinecap="round"/>
        <line x1="12" y1="9" x2="11" y2="6" stroke="#4ade80" strokeWidth="1.3" strokeLinecap="round"/>
        <line x1="20" y1="9" x2="21" y2="6" stroke="#4ade80" strokeWidth="1.3" strokeLinecap="round"/>
        <path d="M10 16 Q16 12 22 16" stroke="white" strokeWidth="0.8" fill="none" strokeOpacity="0.3"/>
      </svg>
    ),
    pistachio: (
      <svg width={s} height={s} viewBox="0 0 32 32" fill="none">
        <ellipse cx="16" cy="16" rx="7" ry="10" fill={color} fillOpacity="0.85"/>
        <ellipse cx="16" cy="16" rx="5" ry="7.5" fill="none" stroke="white" strokeWidth="0.8" strokeOpacity="0.3"/>
        <path d="M16 6 Q13 9 16 11 Q19 9 16 6" fill={color} fillOpacity="0.5"/>
        <line x1="16" y1="11" x2="16" y2="26" stroke={color} strokeWidth="1.6" strokeLinecap="round"/>
        <line x1="9"  y1="14" x2="16" y2="16" stroke={color} strokeWidth="1.3" strokeLinecap="round" strokeOpacity="0.6"/>
        <line x1="23" y1="14" x2="16" y2="16" stroke={color} strokeWidth="1.3" strokeLinecap="round" strokeOpacity="0.6"/>
      </svg>
    ),
    citrus: (
      <svg width={s} height={s} viewBox="0 0 32 32" fill="none">
        <circle cx="16" cy="17" r="10" fill={color} fillOpacity="0.88"/>
        <circle cx="16" cy="17" r="7"  fill={color} fillOpacity="0.4"/>
        <line x1="16" y1="10" x2="16" y2="24" stroke="white" strokeWidth="0.7" strokeOpacity="0.25"/>
        <line x1="9"  y1="17" x2="23" y2="17" stroke="white" strokeWidth="0.7" strokeOpacity="0.25"/>
        <path d="M14 7 Q16 4 18 7" stroke="#4ade80" strokeWidth="1.4" fill="none" strokeLinecap="round"/>
        <line x1="16" y1="7" x2="16" y2="9" stroke="#4ade80" strokeWidth="1.3" strokeLinecap="round"/>
      </svg>
    ),
    barley: (
      <svg width={s} height={s} viewBox="0 0 32 32" fill="none">
        <line x1="16" y1="29" x2="16" y2="5" stroke={color} strokeWidth="1.8" strokeLinecap="round"/>
        <line x1="16" y1="22" x2="10" y2="18" stroke={color} strokeWidth="1.4" strokeLinecap="round"/>
        <line x1="16" y1="22" x2="22" y2="18" stroke={color} strokeWidth="1.4" strokeLinecap="round"/>
        <line x1="16" y1="17" x2="10" y2="13" stroke={color} strokeWidth="1.4" strokeLinecap="round"/>
        <line x1="16" y1="17" x2="22" y2="13" stroke={color} strokeWidth="1.4" strokeLinecap="round"/>
        <line x1="16" y1="12" x2="10" y2="8"  stroke={color} strokeWidth="1.4" strokeLinecap="round"/>
        <line x1="16" y1="12" x2="22" y2="8"  stroke={color} strokeWidth="1.4" strokeLinecap="round"/>
        <line x1="10" y1="18" x2="7"  y2="16" stroke={color} strokeWidth="1" strokeLinecap="round" strokeOpacity="0.6"/>
        <line x1="22" y1="18" x2="25" y2="16" stroke={color} strokeWidth="1" strokeLinecap="round" strokeOpacity="0.6"/>
        <path d="M13 29 Q16 27 19 29" stroke={color} strokeWidth="1.4" fill="none" strokeLinecap="round"/>
      </svg>
    ),
    lentils: (
      <svg width={s} height={s} viewBox="0 0 32 32" fill="none">
        <ellipse cx="12" cy="18" rx="5" ry="3.5" fill={color} fillOpacity="0.85"/>
        <ellipse cx="20" cy="14" rx="5" ry="3.5" fill={color} fillOpacity="0.75"/>
        <ellipse cx="16" cy="22" rx="4" ry="3"   fill={color} fillOpacity="0.65"/>
        <path d="M12 18 Q14 10 18 6" stroke="#4ade80" strokeWidth="1.4" fill="none" strokeLinecap="round"/>
        <path d="M14 12 Q10 9 8 6"  stroke="#4ade80" strokeWidth="1.2" fill="none" strokeLinecap="round" strokeOpacity="0.7"/>
        <path d="M14 12 Q18 9 20 6" stroke="#4ade80" strokeWidth="1.2" fill="none" strokeLinecap="round" strokeOpacity="0.7"/>
        <line x1="16" y1="22" x2="16" y2="28" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
    grapes: (
      <svg width={s} height={s} viewBox="0 0 32 32" fill="none">
        <circle cx="16" cy="12" r="3.5" fill={color} fillOpacity="0.9"/>
        <circle cx="11" cy="16" r="3.2" fill={color} fillOpacity="0.85"/>
        <circle cx="21" cy="16" r="3.2" fill={color} fillOpacity="0.85"/>
        <circle cx="8"  cy="21" r="2.8" fill={color} fillOpacity="0.75"/>
        <circle cx="16" cy="21" r="2.8" fill={color} fillOpacity="0.8"/>
        <circle cx="24" cy="21" r="2.8" fill={color} fillOpacity="0.75"/>
        <circle cx="12" cy="26" r="2.4" fill={color} fillOpacity="0.65"/>
        <circle cx="20" cy="26" r="2.4" fill={color} fillOpacity="0.65"/>
        <path d="M16 9 Q14 5 12 4" stroke="#4ade80" strokeWidth="1.4" fill="none" strokeLinecap="round"/>
        <path d="M12 4 Q10 3 9 5"  stroke="#4ade80" strokeWidth="1.2" fill="none" strokeLinecap="round"/>
      </svg>
    ),
    sugar_beet: (
      <svg width={s} height={s} viewBox="0 0 32 32" fill="none">
        <ellipse cx="16" cy="18" rx="9" ry="10" fill={color} fillOpacity="0.8"/>
        <line x1="16" y1="28" x2="14" y2="31" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
        <line x1="16" y1="28" x2="18" y2="31" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
        <path d="M10 8 Q16 4 22 8" stroke="#4ade80" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
        <path d="M8 10 Q6 6 8 4"  stroke="#4ade80" strokeWidth="1.3" fill="none" strokeLinecap="round" strokeOpacity="0.7"/>
        <path d="M24 10 Q26 6 24 4" stroke="#4ade80" strokeWidth="1.3" fill="none" strokeLinecap="round" strokeOpacity="0.7"/>
        <ellipse cx="16" cy="16" rx="5" ry="5.5" fill="none" stroke="white" strokeWidth="0.7" strokeOpacity="0.2"/>
      </svg>
    ),
    apricot: (
      <svg width={s} height={s} viewBox="0 0 32 32" fill="none">
        <path d="M16 27 Q8 24 7 16 Q6 8 16 7 Q26 8 25 16 Q24 24 16 27Z" fill={color} fillOpacity="0.88"/>
        <path d="M16 7 Q16 14 16 27" stroke="white" strokeWidth="0.7" strokeOpacity="0.2" strokeDasharray="2 2"/>
        <path d="M14 5 Q16 2 18 5" stroke="#4ade80" strokeWidth="1.4" fill="none" strokeLinecap="round"/>
        <line x1="16" y1="5" x2="16" y2="7" stroke="#4ade80" strokeWidth="1.3" strokeLinecap="round"/>
      </svg>
    ),
  };
  return icons[cropKey] ?? <Leaf size={s} color={color} />;
}

/* ─── Seasonal AI Highlights ─────────────────────────────────────────── */
function SeasonalHighlights({ onSelect }: { onSelect: (crop: Crop) => void }) {
  const items = HIGHLIGHT_KEYS.map(h => ({
    ...h,
    crop: CROPS.find(c => c.key === h.key)!,
  }));

  const TrendIcon = ({ trend }: { trend: MarketTrend }) => {
    if (trend === "Rising")  return <TrendingUp   className="w-3 h-3" />;
    if (trend === "Falling") return <TrendingDown className="w-3 h-3" />;
    return <Minus className="w-3 h-3" />;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.08, duration: 0.4 }}
      className="mb-5"
    >
      <div className="flex items-center gap-2 mb-3">
        <div className="w-6 h-6 rounded-lg bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center">
          <Sparkles className="w-3 h-3 text-emerald-400" />
        </div>
        <span className="text-[13px] font-bold text-foreground">توصيات الوكيل لموسم مايو — يونيو 2026</span>
        <span className="relative flex h-1.5 w-1.5 me-auto ms-1 flex-shrink-0">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400" />
        </span>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {items.map(({ crop, reason, label, accent }) => (
          <motion.button
            key={crop.key}
            onClick={() => onSelect(crop)}
            whileHover={{ y: -3, transition: { duration: 0.18 } }}
            className="glass-card rounded-2xl p-4 text-start border hover:border-white/[0.14] transition-colors group"
            style={{ borderColor: `${accent}25` }}
            dir="rtl"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: `${accent}18`, border: `1px solid ${accent}30` }}>
                <CropIcon cropKey={crop.key} color={accent} size={22} />
              </div>
              <span
                className="text-[9px] font-bold rounded-full px-2 py-0.5 border"
                style={{ color: accent, background: `${accent}15`, borderColor: `${accent}30` }}
              >
                {label}
              </span>
            </div>

            <p className="text-[13px] font-bold text-foreground mb-0.5">{crop.name}</p>
            <p className="text-[10px] font-medium mb-3" style={{ color: accent }}>{reason}</p>

            <div className="mb-2.5">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[9px] text-muted-foreground/60">تقدم الموسم</span>
                <span className="text-[9px] font-bold" style={{ color: progressColor(crop.seasonalProgress) }}>
                  {crop.seasonalProgress}%
                </span>
              </div>
              <div className="h-1 rounded-full bg-white/[0.06] overflow-hidden">
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: progressColor(crop.seasonalProgress) }}
                  initial={{ width: 0 }}
                  animate={{ width: `${crop.seasonalProgress}%` }}
                  transition={{ duration: 0.9, ease: EASE, delay: 0.3 }}
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className={cn("flex items-center gap-1 text-[9px] font-semibold", TREND_CLS[crop.marketTrend])}>
                <TrendIcon trend={crop.marketTrend} />
                {TREND_AR[crop.marketTrend]}
              </div>
              <span className="text-[9px] text-muted-foreground/50 font-arabic">
                ربحية {crop.profitIndex}%
              </span>
            </div>
          </motion.button>
        ))}
      </div>
    </motion.div>
  );
}

/* ─── Crop Card ──────────────────────────────────────────────────────── */
function CropCard({ crop, onClick }: { crop: Crop; onClick: () => void }) {
  const years = ["21", "22", "23", "24", "25"];
  const TrendIcon = crop.marketTrend === "Rising"
    ? TrendingUp : crop.marketTrend === "Falling" ? TrendingDown : Minus;

  return (
    <motion.div
      variants={cardV}
      onClick={onClick}
      whileHover={{ y: -3, transition: { duration: 0.18 } }}
      className="glass-card rounded-2xl p-4 cursor-pointer border border-white/[0.06] hover:border-white/[0.12] transition-colors group"
      dir="rtl"
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: `${crop.color}18`, border: `1px solid ${crop.color}30` }}>
          <CropIcon cropKey={crop.key} color={crop.color} size={24} />
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className={cn("text-[9px] font-semibold border rounded-full px-2 py-0.5", SEASON_CLS[crop.season])}>
            {crop.season}
          </span>
          <span className={cn("text-[9px] font-semibold border rounded-full px-2 py-0.5", CAT_CLS[crop.category])}>
            {crop.category}
          </span>
          <span className={cn("text-[9px] font-semibold border rounded-full px-2 py-0.5", RISK_CLS[crop.riskLevel])}>
            {RISK_AR[crop.riskLevel]}
          </span>
        </div>
      </div>

      <h3 className="text-sm font-bold text-foreground mb-0.5">{crop.name}</h3>
      <p className="text-[9px] text-muted-foreground/70 mb-2 font-arabic">{crop.variety}</p>
      <p className="text-[10px] text-muted-foreground mb-3 leading-relaxed line-clamp-2">{crop.description}</p>

      {/* Yield sparkline */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[9px] text-muted-foreground/60">غلة 5 سنوات (كغ/دونم)</span>
          <span className="text-[9px] font-bold" style={{ color: crop.color }}>
            {crop.yieldHistory[crop.yieldHistory.length - 1].toLocaleString()}
          </span>
        </div>
        <YieldSparkline data={crop.yieldHistory} color={crop.color} />
        <div className="flex justify-between mt-0.5">
          {years.map((y, i) => (
            <span key={i} className="text-[7px] text-muted-foreground/40">{y}</span>
          ))}
        </div>
      </div>

      {/* Demand bar */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[9px] text-muted-foreground">مؤشر الطلب</span>
          <span className="text-[10px] font-bold" style={{ color: crop.color }}>{crop.demandIndex}%</span>
        </div>
        <div className="h-1 rounded-full bg-white/[0.06] overflow-hidden">
          <motion.div className="h-full rounded-full" style={{ background: crop.color }}
            initial={{ width: 0 }}
            animate={{ width: `${crop.demandIndex}%` }}
            transition={{ duration: 0.8, ease: EASE, delay: 0.2 }}
          />
        </div>
      </div>

      {/* Season progress */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[9px] text-muted-foreground/70 truncate max-w-[75%] font-arabic">
            {crop.currentSeasonStatus}
          </span>
          <span className="text-[9px] font-bold flex-shrink-0 ms-1"
            style={{ color: progressColor(crop.seasonalProgress) }}>
            {crop.seasonalProgress}%
          </span>
        </div>
        <div className="h-1 rounded-full bg-white/[0.06] overflow-hidden">
          <motion.div className="h-full rounded-full"
            style={{ background: progressColor(crop.seasonalProgress) }}
            initial={{ width: 0 }}
            animate={{ width: `${crop.seasonalProgress}%` }}
            transition={{ duration: 0.9, ease: EASE, delay: 0.35 }}
          />
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <Droplets className={cn("w-3 h-3", WATER_CLS[crop.waterNeed])} />
            <span className={cn("text-[10px] font-medium", WATER_CLS[crop.waterNeed])}>{crop.waterNeed}</span>
          </div>
          <div className={cn("flex items-center gap-0.5 text-[9px] font-semibold", TREND_CLS[crop.marketTrend])}>
            <TrendIcon className="w-3 h-3" />
            {TREND_AR[crop.marketTrend]}
          </div>
        </div>
        <div className="flex items-center gap-1 text-muted-foreground/50 group-hover:text-emerald-400 transition-colors">
          <span className="text-[10px]">تفاصيل</span>
          <ChevronLeft className="w-3 h-3" />
        </div>
      </div>
    </motion.div>
  );
}

/* ─── Yield Calculator Modal ─────────────────────────────────────────── */
function YieldModal({ crop, onClose }: { crop: Crop; onClose: () => void }) {
  const [area, setArea] = useState("10");

  const linkedField = {
    wheat:  { name: "حقل الشمال — القمح",       area: 4.2 },
    cotton: { name: "حقل الجنوب — القطن",        area: 7.8 },
    olive:  { name: "البستان الغربي — الزيتون",  area: 2.1 },
    tomato: { name: "الحقل الشرقي — الطماطم",   area: 6.5 },
  }[crop.key] ?? null;

  const numArea = Math.max(0, parseFloat(area) || 0);
  const revenue = numArea * crop.yieldPerDunum * crop.pricePerKg;
  const costEst = numArea * 45000;
  const profit  = revenue - costEst;
  const roi     = costEst > 0 ? (profit / costEst) * 100 : 0;

  return (
    <motion.div className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        className="relative z-10 w-full max-w-md glass-card rounded-3xl overflow-hidden"
        initial={{ scale: 0.94, y: 20 }} animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.94, y: 20 }} transition={{ duration: 0.3, ease: EASE }}
        dir="rtl"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-500/15 border border-emerald-500/20 flex items-center justify-center">
              <Calculator className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <div>
              <p className="text-sm font-bold text-foreground">حساب إنتاجيتي</p>
              <p className="text-[10px] text-muted-foreground font-arabic">{crop.name} — تحليل الوكيل المالي</p>
            </div>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg bg-white/[0.05] hover:bg-white/10 flex items-center justify-center transition-colors">
            <X className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {linkedField && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-500/8 border border-emerald-500/20">
              <Sprout className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-[10px] text-emerald-400 font-semibold">حقل مرتبط من صفحة حقولي</p>
                <p className="text-[11px] text-foreground truncate">{linkedField.name}</p>
              </div>
              <button
                onClick={() => setArea(String(linkedField.area))}
                className="text-[10px] text-emerald-400 font-bold bg-emerald-500/15 px-2 py-1 rounded-lg border border-emerald-500/25 hover:bg-emerald-500/25 transition-colors flex-shrink-0"
              >
                استخدام ({linkedField.area} دونم)
              </button>
            </div>
          )}

          <div>
            <label className="text-[11px] text-muted-foreground block mb-1.5">المساحة (دونم)</label>
            <input
              type="number" value={area} onChange={e => setArea(e.target.value)} min="0"
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-emerald-500/40"
              dir="ltr"
            />
            <p className="text-[9px] text-muted-foreground/60 mt-1 font-arabic">
              معدل غلة GCSAR: {crop.yieldPerDunum.toLocaleString()} كغ/دونم — المصدر: {crop.gcsar}
            </p>
          </div>

          <motion.div
            key={area}
            initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4 space-y-3"
          >
            <div className="flex items-center gap-1.5 mb-2">
              <Bot className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-[11px] font-bold text-emerald-400">تحليل الوكيل المالي</span>
            </div>

            {[
              { label: "الإنتاج المتوقع",  val: `${(numArea * crop.yieldPerDunum).toLocaleString()} كغ`, clr: "text-foreground" },
              { label: "الإيراد التقديري", val: revenue >= 1e6 ? `${(revenue/1e6).toFixed(2)} م.ل.س` : `${Math.round(revenue/1000)} ا.ل.س`, clr: "text-emerald-400" },
              { label: "تكلفة الإنتاج",   val: costEst >= 1e6 ? `${(costEst/1e6).toFixed(2)} م.ل.س` : `${Math.round(costEst/1000)} ا.ل.س`, clr: "text-red-400" },
              { label: "صافي الربح",       val: profit >= 1e6  ? `${(profit/1e6).toFixed(2)} م.ل.س`  : `${Math.round(profit/1000)} ا.ل.س`,  clr: profit >= 0 ? "text-emerald-400" : "text-red-400" },
              { label: "العائد (ROI)",     val: `${roi.toFixed(1)}%`, clr: roi >= 30 ? "text-emerald-400" : roi >= 10 ? "text-amber-400" : "text-red-400" },
            ].map(({ label, val, clr }) => (
              <div key={label} className="flex justify-between items-center">
                <span className="text-[10px] text-muted-foreground">{label}</span>
                <span className={cn("text-[11px] font-bold font-arabic", clr)} dir="ltr">{val}</span>
              </div>
            ))}

            <div className="flex items-center gap-2 border-t border-white/[0.06] pt-2">
              {roi >= 35
                ? <CheckCircle className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                : roi >= 15
                  ? <CheckCircle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                  : <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
              }
              <p className="text-[10px] text-muted-foreground/70 leading-relaxed font-arabic">
                {roi >= 35 ? "فرصة ممتازة — العائد يتجاوز متوسط السوق السوري."
                 : roi >= 15 ? "مقبول — يمكن تحسينه بتطبيق نصائح الوكيل."
                 : "مراجعة الخطة — هامش منخفض في الظروف الحالية."}
              </p>
            </div>
          </motion.div>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ─── Phase 2: lookup maps ───────────────────────────────────────────── */
const STEP_ICONS = {
  layers:   Layers,
  sprout:   Sprout,
  droplets: Droplets,
  flask:    FlaskConical,
  sun:      Sun,
  scissors: Scissors,
  package:  Package,
} as const;

const DISEASE_TYPE: Record<string, { label: string; cls: string; Icon: React.ElementType }> = {
  fungal:    { label: "فطري",    cls: "text-amber-400 bg-amber-500/10 border-amber-500/20",   Icon: FlaskConical  },
  bacterial: { label: "بكتيري", cls: "text-sky-400 bg-sky-500/10 border-sky-500/20",          Icon: Bug           },
  pest:      { label: "حشري",   cls: "text-red-400 bg-red-500/10 border-red-500/20",          Icon: Bug           },
  viral:     { label: "فيروسي", cls: "text-purple-400 bg-purple-500/10 border-purple-500/20",  Icon: AlertTriangle },
};
const SEV_CLS: Record<string, string> = {
  High:   "text-red-400 bg-red-500/10 border-red-500/20",
  Medium: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  Low:    "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
};
const SEV_AR: Record<string, string> = { High: "عالٍ", Medium: "متوسط", Low: "منخفض" };

/* ─── Radial Suitability Gauge ───────────────────────────────────────── */
function RadialGauge({ score, color = "#10b981" }: { score: number; color?: string }) {
  const r    = 44;
  const circ = 2 * Math.PI * r;
  return (
    <div className="flex flex-col items-center">
      <svg width="108" height="108" viewBox="0 0 108 108">
        <defs>
          <linearGradient id="gauge-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={color} stopOpacity="0.8" />
            <stop offset="100%" stopColor={color} />
          </linearGradient>
        </defs>
        <circle cx="54" cy="54" r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="9" />
        <motion.circle cx="54" cy="54" r={r} fill="none"
          stroke="url(#gauge-grad)" strokeWidth="9" strokeLinecap="round"
          strokeDasharray={circ}
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: circ * (1 - score / 100) }}
          transition={{ duration: 1.2, ease: EASE }}
          transform="rotate(-90 54 54)"
        />
        <text x="54" y="52" textAnchor="middle" dominantBaseline="middle"
          fontSize="22" fontWeight="bold" fill="white"
          style={{ fontFamily: "var(--font-numeric)" }}>{score}</text>
        <text x="54" y="68" textAnchor="middle" fontSize="9"
          fill="rgba(255,255,255,0.45)"
          style={{ fontFamily: "var(--font-arabic)" }}>ملاءمة</text>
      </svg>
    </div>
  );
}

function getUserProvince(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const s = localStorage.getItem("agro_settings");
    if (s) return JSON.parse(s).province ?? null;
  } catch {}
  return null;
}

/* ─── Phase 2 Deep-Dive Drawer ───────────────────────────────────────── */
/* ─── Phase 4: data constants ───────────────────────────────────────── */
const MOCK_FIELDS = [
  { id: "f1", name: "حقل الشمال",      province: "الحسكة",    area: 4.2, soil: "طينية طميية"  },
  { id: "f2", name: "حقل الجنوب",      province: "حلب",       area: 7.8, soil: "طينية ثقيلة"  },
  { id: "f3", name: "البستان الغربي",   province: "إدلب",      area: 2.1, soil: "حجرية جيرية"  },
  { id: "f4", name: "الحقل الشرقي",    province: "ريف دمشق",  area: 6.5, soil: "طميية رملية"  },
] as const;
type MockField = typeof MOCK_FIELDS[number];

const LIVE_MESSAGES: { agent: string; type: string; Icon: React.ElementType; msg: string }[] = [
  { agent: "وكيل السوق",    type: "emerald", Icon: TrendingUp,  msg: "متابعة أسعار القمح في سوق الهال بحلب — اتجاه صاعد 2%..." },
  { agent: "وكيل الأمراض",  type: "red",     Icon: Bug,         msg: "مسح شامل لمخاطر الصدأ في المناطق الشمالية — لا إنذارات فورية" },
  { agent: "وكيل التربة",   type: "amber",   Icon: Layers,      msg: "تحليل ملاءمة التربة في حوض الفرات — نتائج محدّثة" },
  { agent: "وكيل الطقس",   type: "sky",     Icon: Thermometer, msg: "رصد موجة الحر في حلب والرقة — تحذير درجة 3 نشط" },
  { agent: "وكيل التوثيق",  type: "purple",  Icon: CheckCircle, msg: "التحقق من بيانات GCSAR لموسم الفستق 2026 — 98% اكتمال" },
  { agent: "وكيل السوق",    type: "emerald", Icon: TrendingUp,  msg: "تحديث بيانات التصدير من ميناء اللاذقية — حجم مرتفع" },
  { agent: "وكيل الأمراض",  type: "red",     Icon: Bug,         msg: "رصد حشرة البق في الرقة — كثافة تحت عتبة الإنذار الاقتصادي" },
  { agent: "وكيل التربة",   type: "amber",   Icon: Layers,      msg: "قراءات pH التربة — إدلب وحلب — ضمن النطاق المثالي للفستق" },
];

const FERT_LABELS = ["شحيح", "منخفض", "مثالي", "مرتفع", "فائض"];
const FERT_MULT   = [0.55, 0.75, 1.0, 1.08, 0.97];

function calcWaterFactor(pct: number) {
  if (pct < 30)   return 0.3 + (pct / 30) * 0.4;
  if (pct < 60)   return 0.7 + ((pct - 30) / 30) * 0.2;
  if (pct <= 110) return 0.9 + ((pct - 60) / 50) * 0.1;
  return Math.max(0.72, 1.0 - ((pct - 110) / 40) * 0.22);
}

/* ─── Phase 4: StrategicGuidanceCard ────────────────────────────────── */
function StrategicGuidanceCard({ onSelect }: { onSelect: (crop: Crop) => void }) {
  const recs = [
    { key: "tomato",    action: "ابدأ الزراعة", badge: "أفضل توقيت",    clr: "#ef4444",
      reason: "نافذة الصيف مفتوحة — طلب تصدير أردني مرتفع 23% هذا الموسم" },
    { key: "pistachio", action: "استثمر الآن",  badge: "أعلى عائد",     clr: "#a3e635",
      reason: "ربحية 92% — مخاطرة متوسطة — موسم قوي بعد 2025 الضعيف" },
    { key: "wheat",     action: "احصد فوراً",   badge: "إجراء عاجل",   clr: "#f59e0b",
      reason: "موجة حر قادمة — كل يوم تأخير يخفض الجودة 5-8%" },
  ].map(r => ({ ...r, crop: CROPS.find(c => c.key === r.key)! })).filter(r => r.crop);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.05, duration: 0.4 }}
      className="glass-card rounded-2xl p-4 mb-5 border border-emerald-500/15"
      style={{ background: "linear-gradient(135deg, oklch(0.696 0.170 162 / 6%), oklch(0.10 0.020 155 / 45%))" }}
      dir="rtl"
    >
      <div className="flex items-center gap-3 mb-3">
        <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center flex-shrink-0">
          <Bot className="w-5 h-5 text-emerald-400" />
        </div>
        <div>
          <p className="text-[13px] font-bold text-foreground">الوكيل الاستراتيجي</p>
          <p className="text-[10px] text-muted-foreground/55 font-arabic">توصيات مخصصة لمايو 2026</p>
        </div>
        <span className="ms-auto relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
        </span>
      </div>

      <div className="space-y-2">
        {recs.map(({ crop, action, badge, clr, reason }) => (
          <button key={crop.key} onClick={() => onSelect(crop)}
            className="w-full flex items-center gap-3 p-2.5 rounded-xl border hover:border-white/[0.12] transition-all text-start group"
            style={{ background: `${clr}08`, borderColor: `${clr}22` }}>
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: `${clr}18`, border: `1px solid ${clr}30` }}>
              <CropIcon cropKey={crop.key} color={clr} size={22} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                <span className="text-[9px] font-bold rounded-full px-1.5 py-0.5 border"
                  style={{ color: clr, background: `${clr}15`, borderColor: `${clr}30` }}>{badge}</span>
                <span className="text-[12px] font-bold text-foreground">{crop.name}</span>
              </div>
              <p className="text-[9px] text-muted-foreground/60 font-arabic truncate">{reason}</p>
            </div>
            <span className="text-[9px] font-bold flex-shrink-0 px-2 py-1 rounded-lg transition-all group-hover:opacity-100 opacity-70"
              style={{ color: clr, background: `${clr}18`, border: `1px solid ${clr}25` }}>
              {action}
            </span>
          </button>
        ))}
      </div>
    </motion.div>
  );
}

/* ─── Phase 4: WhatIfSimulator ───────────────────────────────────────── */
function WhatIfSimulator({ crop, baseYield, confidence }: {
  crop: Crop; baseYield: number; confidence: number;
}) {
  const [waterPct,      setWaterPct]      = useState(80);
  const [fertLevel,     setFertLevel]     = useState(2);
  const [selectedField, setSelectedField] = useState<MockField | null>(null);
  const [fieldOpen,     setFieldOpen]     = useState(false);

  const waterMul  = useMemo(() => calcWaterFactor(waterPct), [waterPct]);
  const fertMul   = FERT_MULT[fertLevel];
  const simYield  = Math.round(baseYield * waterMul * fertMul);
  const baseHealth = Math.min(98, Math.round(35 + confidence * 0.64));
  const simHealth  = Math.round(Math.min(100, Math.max(10,
    35 + waterMul * 40 + ((fertMul - 0.55) / 0.53) * 25
  )));
  const diff    = simYield - baseYield;
  const diffPct = Math.round((diff / baseYield) * 100);
  const maxVal  = Math.max(baseYield, simYield) * 1.1;

  const compat = useMemo(() => {
    if (!selectedField) return null;
    const items = [
      {
        label: "المنطقة الجغرافية",
        ok:    crop.govs.includes(selectedField.province),
        note:  crop.govs.includes(selectedField.province)
          ? `${selectedField.province} — ضمن نطاق المحصول المثالي`
          : `${selectedField.province} — خارج المنطقة الرئيسية`,
      },
      {
        label: "المساحة المتاحة",
        ok:    selectedField.area >= 1.5,
        note:  `${selectedField.area} دونم — ${selectedField.area >= 1.5 ? "كافٍ للزراعة الاقتصادية" : "يحتاج مساحة أكبر"}`,
      },
      {
        label: "نوع التربة",
        ok:    true,
        note:  `${selectedField.soil} — متوافق مع المتطلبات`,
      },
    ];
    return { items, score: Math.round((items.filter(i => i.ok).length / items.length) * 100) };
  }, [selectedField, crop.govs]);

  const agentTip = waterPct < 40 ? "الجفاف يضغط على الإنتاج بشكل حاد — رفع الري الآن أولوية قصوى."
    : waterPct > 120 ? "الإفراط في الري يتلف الجذور — قلل إلى 80-100% للحصول على الكفاءة."
    : fertLevel < 2   ? "مستوى التسميد منخفض — رفعه للمثالي يرفع الإنتاج 15-25%."
    : fertLevel > 2   ? "تجاوز المثالي — الإفراط في السماد يضر أكثر مما ينفع."
    : "الظروف الحالية مثالية — الحفاظ على هذا المستوى يضمن أفضل إنتاجية.";

  return (
    <div className="p-5 space-y-4" dir="rtl">
      {/* Sliders */}
      <div className="glass-card rounded-2xl p-4 space-y-4 border border-white/[0.05]">
        <div className="flex items-center gap-1.5 mb-1">
          <SlidersHorizontal className="w-3.5 h-3.5 text-emerald-400/70" />
          <span className="text-[12px] font-bold text-foreground">معايير المحاكاة</span>
        </div>

        {/* Water */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <Droplets className="w-3 h-3 text-sky-400" />
              <span className="text-[11px] font-semibold text-foreground">توفر المياه</span>
            </div>
            <span className={cn("text-[11px] font-bold font-numeric",
              waterPct < 40 ? "text-red-400" : waterPct > 120 ? "text-amber-400" : "text-sky-400")}>
              {waterPct}%
            </span>
          </div>
          <input type="range" min={0} max={150} step={5} value={waterPct}
            onChange={e => setWaterPct(Number(e.target.value))}
            className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
            style={{ accentColor: crop.color }} />
          <div className="flex justify-between mt-1">
            {["جفاف", "", "مثالي", "", "إفراط"].map((l, i) => (
              <span key={i} className="text-[8px] text-muted-foreground/35">{l}</span>
            ))}
          </div>
        </div>

        {/* Fertilizer */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <FlaskConical className="w-3 h-3 text-amber-400" />
              <span className="text-[11px] font-semibold text-foreground">مستوى التسميد</span>
            </div>
            <span className={cn("text-[11px] font-bold",
              fertLevel === 2 ? "text-emerald-400" : fertLevel === 4 ? "text-red-400" : "text-amber-400")}>
              {FERT_LABELS[fertLevel]}
            </span>
          </div>
          <input type="range" min={0} max={4} step={1} value={fertLevel}
            onChange={e => setFertLevel(Number(e.target.value))}
            className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
            style={{ accentColor: crop.color }} />
          <div className="flex justify-between mt-1">
            {FERT_LABELS.map((l, i) => (
              <span key={i} className={cn("text-[8px]",
                i === fertLevel ? "text-foreground font-bold" : "text-muted-foreground/35")}>{l}</span>
            ))}
          </div>
        </div>
      </div>

      {/* Ghost comparison */}
      <div className="glass-card rounded-2xl p-4 border border-white/[0.05]">
        <div className="flex items-center gap-1.5 mb-3">
          <Activity className="w-3.5 h-3.5 text-emerald-400/70" />
          <span className="text-[12px] font-bold text-foreground">نتيجة المحاكاة</span>
          <span className={cn("text-[11px] font-bold font-numeric ms-auto",
            diff > 0 ? "text-emerald-400" : diff < 0 ? "text-red-400" : "text-muted-foreground/60")}>
            {diff > 0 ? "▲" : diff < 0 ? "▼" : "—"} {Math.abs(diffPct)}%
          </span>
        </div>

        {/* Yield bars */}
        <div className="space-y-2.5 mb-3">
          {[
            { label: "القاعدي", value: baseYield, clr: "rgba(255,255,255,0.20)", ghost: true  },
            { label: "المحاكاة", value: simYield, clr: crop.color,               ghost: false },
          ].map(({ label, value, clr, ghost }) => (
            <div key={label}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] text-muted-foreground/65 font-arabic">{label}</span>
                <span className="text-[11px] font-bold font-numeric"
                  style={{ color: ghost ? "rgba(255,255,255,0.45)" : clr }}>
                  {value.toLocaleString()} كغ/دونم
                </span>
              </div>
              <div className="h-3 rounded-full bg-white/[0.05] overflow-hidden relative">
                <motion.div className="absolute inset-y-0 start-0 rounded-full"
                  style={{ background: clr }}
                  initial={{ width: 0 }}
                  animate={{ width: `${(value / maxVal) * 100}%` }}
                  transition={{ duration: 0.55, ease: EASE }} />
                {ghost && (
                  <div className="absolute inset-y-1 end-0 border-e-2 border-dashed border-white/20"
                    style={{ left: `${(value / maxVal) * 100}%` }} />
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Health comparison */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-1.5">
              <Gauge className="w-3 h-3 text-emerald-400/70" />
              <span className="text-[10px] text-muted-foreground/70">صحة المحصول</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[9px] text-muted-foreground/40 font-numeric">أساس {baseHealth}%</span>
              <span className="text-[11px] font-bold font-numeric"
                style={{ color: simHealth >= baseHealth ? "#10b981" : "#ef4444" }}>
                محاكاة {simHealth}%
              </span>
            </div>
          </div>
          <div className="h-2.5 rounded-full bg-white/[0.05] overflow-hidden relative">
            <div className="absolute inset-y-0 start-0 rounded-full bg-white/15"
              style={{ width: `${baseHealth}%` }} />
            <motion.div className="absolute inset-y-0 start-0 rounded-full"
              style={{ background: crop.color, opacity: 0.9 }}
              initial={{ width: 0 }}
              animate={{ width: `${simHealth}%` }}
              transition={{ duration: 0.6, ease: EASE }} />
          </div>
        </div>

        {/* Agent tip */}
        <div className="flex items-start gap-2 mt-3 p-2.5 rounded-xl bg-emerald-500/6 border border-emerald-500/15">
          <Bot className="w-3 h-3 text-emerald-400 flex-shrink-0 mt-0.5" />
          <p className="text-[9px] text-emerald-300/80 font-arabic leading-relaxed">{agentTip}</p>
        </div>
      </div>

      {/* Action Bridge */}
      <div className="relative">
        <button onClick={() => setFieldOpen(v => !v)}
          className="w-full flex items-center justify-between gap-2 py-3 px-4 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/22 border border-emerald-500/25 text-emerald-400 font-semibold transition-all">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4" />
            <span className="text-sm font-arabic">ابدأ الزراعة في حقل</span>
          </div>
          <motion.span animate={{ rotate: fieldOpen ? 180 : 0 }} transition={{ duration: 0.2 }}>
            <ChevronDown className="w-4 h-4" />
          </motion.span>
        </button>

        <AnimatePresence>
          {fieldOpen && (
            <motion.div
              initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.18 }}
              className="absolute top-full start-0 end-0 mt-1 z-10 glass-card rounded-xl border border-white/[0.08] overflow-hidden">
              {MOCK_FIELDS.map(f => (
                <button key={f.id}
                  onClick={() => { setSelectedField(f); setFieldOpen(false); }}
                  className="w-full flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-white/[0.04] transition-colors text-start border-b border-white/[0.04] last:border-0">
                  <div>
                    <p className="text-[11px] font-semibold text-foreground">{f.name}</p>
                    <p className="text-[9px] text-muted-foreground/50 font-arabic">{f.province} · {f.soil}</p>
                  </div>
                  <span className="text-[10px] font-numeric text-muted-foreground/45 flex-shrink-0">{f.area} دونم</span>
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {selectedField && compat && (
            <motion.div
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mt-3 glass-card rounded-xl p-3.5 border border-white/[0.05]">
              <div className="flex items-center justify-between mb-2.5">
                <span className="text-[11px] font-bold text-foreground font-arabic">
                  فحص ملاءمة: {selectedField.name}
                </span>
                <span className={cn("text-[12px] font-bold font-numeric",
                  compat.score >= 80 ? "text-emerald-400" : compat.score >= 60 ? "text-amber-400" : "text-red-400")}>
                  {compat.score}%
                </span>
              </div>
              <div className="space-y-1.5 mb-3">
                {compat.items.map(item => (
                  <div key={item.label} className="flex items-center gap-2">
                    {item.ok
                      ? <CheckCircle className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                      : <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />}
                    <span className="text-[10px] text-muted-foreground/70 font-arabic">{item.note}</span>
                  </div>
                ))}
              </div>
              {compat.score >= 65 && (
                <button className="w-full py-2 rounded-lg bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-[11px] font-bold hover:bg-emerald-500/28 transition-all font-arabic">
                  تأكيد الزراعة في {selectedField.name}
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

/* ─── Phase 4: AgentActivityHub ──────────────────────────────────────── */
function AgentActivityHub() {
  const [offset, setOffset] = useState(0);
  const [fade, setFade] = useState(true);

  useEffect(() => {
    const timer = setInterval(() => {
      setFade(false);
      setTimeout(() => {
        setOffset(o => (o + 1) % LIVE_MESSAGES.length);
        setFade(true);
      }, 280);
    }, 3800);
    return () => clearInterval(timer);
  }, []);

  const visible = [0, 1, 2].map(i => LIVE_MESSAGES[(offset + i) % LIVE_MESSAGES.length]);

  return (
    <div className="flex-shrink-0 border-t border-white/[0.05] px-4 py-2.5"
      style={{ background: "oklch(0.075 0.016 152 / 80%)" }}>
      <div className="flex items-center gap-1.5 mb-2">
        <Radio className="w-3 h-3 text-emerald-400" />
        <span className="text-[10px] font-bold text-emerald-400">تدفق الوكلاء المباشر</span>
        <span className="relative flex h-1.5 w-1.5 ms-1">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-65" />
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400" />
        </span>
      </div>
      <div className="space-y-1.5">
        {visible.map((m, i) => {
          const Icon = m.Icon;
          const cls = m.type === "emerald" ? "text-emerald-400"
            : m.type === "red" ? "text-red-400"
            : m.type === "amber" ? "text-amber-400"
            : m.type === "sky" ? "text-sky-400" : "text-purple-400";
          return (
            <div key={offset + i}
              className="flex items-start gap-2 transition-all duration-300"
              style={{ opacity: i === 0 ? (fade ? 1 : 0) : i === 1 ? 0.65 : 0.35 }}>
              <Icon className={cn("w-3 h-3 flex-shrink-0 mt-0.5", cls)} />
              <p className="text-[9px] font-arabic leading-relaxed" style={{ color: "rgba(255,255,255,0.6)" }}>
                <span className={cn("font-bold me-1", cls)}>{m.agent}:</span>
                {m.msg}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Phase 3: LifecycleTrack & PriceChart components ───────────────── */
function LifecycleTrack({ milestones, currentProgress, nextLabel, daysToNext, hint, color }: {
  milestones: { label: string; progress: number }[];
  currentProgress: number;
  nextLabel: string; daysToNext: number; hint: string; color: string;
}) {
  const W = 300, tY = 26, r = 4.5;
  const x1 = 10, x2 = W - 10, tW = x2 - x1;
  const px = (p: number) => x1 + (p / 100) * tW;
  const cx = px(currentProgress);

  return (
    <div>
      <svg width="100%" height="56" viewBox={`0 0 ${W} 56`} preserveAspectRatio="xMidYMid meet">
        <line x1={x1} y1={tY} x2={x2} y2={tY} stroke="rgba(255,255,255,0.08)" strokeWidth="2" strokeLinecap="round" />
        <line x1={x1} y1={tY} x2={Math.min(cx, x2)} y2={tY} stroke={color} strokeWidth="2" strokeLinecap="round" opacity="0.85" />
        {milestones.map(({ label, progress }) => {
          const mx = px(progress);
          const done = progress < currentProgress - 2;
          const now  = Math.abs(progress - currentProgress) <= 5;
          return (
            <g key={label}>
              <circle cx={mx} cy={tY} r={now ? r + 1.5 : r}
                fill={done || now ? color : "oklch(0.11 0.020 155)"}
                stroke={done || now ? color : "rgba(255,255,255,0.15)"}
                strokeWidth="1.2" opacity={now ? 1 : done ? 0.75 : 0.55} />
              <text x={mx} y={tY + 14} textAnchor="middle" fontSize="7.5"
                fill="rgba(255,255,255,0.38)" style={{ fontFamily: "var(--font-arabic)" }}>{label}</text>
            </g>
          );
        })}
        <line x1={cx} y1={tY - 13} x2={cx} y2={tY - r - 1} stroke={color} strokeWidth="1.5" strokeLinecap="round" />
        <text x={cx} y={tY - 15} textAnchor="middle" fontSize="8" fontWeight="bold" fill={color}
          style={{ fontFamily: "var(--font-arabic)" }}>الآن</text>
      </svg>
      <div className="flex items-start gap-2 p-2.5 rounded-xl bg-emerald-500/8 border border-emerald-500/15">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 flex-shrink-0 animate-pulse" />
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] text-muted-foreground/55">المحطة القادمة:</span>
            <span className="text-[11px] font-bold text-emerald-300">{nextLabel}</span>
            <span className="text-[10px] text-muted-foreground/45">بعد {daysToNext} يوم</span>
          </div>
          <p className="text-[9px] text-muted-foreground/55 mt-0.5 font-arabic">{hint}</p>
        </div>
      </div>
    </div>
  );
}

function PriceChart({ data, color, label }: { data: number[]; color: string; label: string }) {
  const W = 300, H = 72;
  const mn = Math.min(...data), mx = Math.max(...data), rng = mx - mn || 1;
  const pts: [number, number][] = data.map((v, i) => [
    (i / (data.length - 1)) * (W - 8) + 4,
    H - 10 - ((v - mn) / rng) * (H - 22),
  ]);
  const line = pts.map(([x, y], i) => {
    if (i === 0) return `M ${x.toFixed(1)},${y.toFixed(1)}`;
    const [px, py] = pts[i - 1];
    const cx = ((px + x) / 2).toFixed(1);
    return `C ${cx},${py.toFixed(1)} ${cx},${y.toFixed(1)} ${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  const last = pts[pts.length - 1];
  const gradId = `pg-${color.replace(/[^a-z0-9]/gi, "")}`;
  const up = data[data.length - 1] >= data[0];
  return (
    <div className="w-full">
      <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.28" />
            <stop offset="100%" stopColor={color} stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <path d={`${line} L ${last[0]},${H} L ${pts[0][0]},${H} Z`} fill={`url(#${gradId})`} />
        <path d={line} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
        <circle cx={last[0]} cy={last[1]} r="3.5" fill={color} />
      </svg>
      <div className="flex items-center justify-between mt-0.5">
        <span className="text-[9px] text-muted-foreground/40 font-arabic">آخر 30 يوم</span>
        <div className="flex items-center gap-1">
          <span className={cn("text-[10px] font-bold", up ? "text-emerald-400" : "text-red-400")}>{up ? "▲" : "▼"}</span>
          <span className="text-[11px] font-bold font-numeric" style={{ color }}>{label}</span>
        </div>
      </div>
    </div>
  );
}

type DrawerTab = "guide" | "irrigation" | "fertilization" | "diseases" | "market" | "simulator";

function CropDrawerV2({ crop, onClose, onYieldCalc }: {
  crop: Crop; onClose: () => void; onYieldCalc: () => void;
}) {
  const [tab, setTab]               = useState<DrawerTab>("guide");
  const [openDisease, setOpenDisease] = useState<number | null>(null);
  const [shareCopied, setShareCopied] = useState(false);
  const userProvince = getUserProvince();
  const ext = CROPS_EXTENDED[crop.key];
  const ph3 = CROPS_PHASE3[crop.key];
  if (!ext) return null;

  const TABS: { id: DrawerTab; label: string; Icon: React.ElementType }[] = [
    { id: "guide",         label: "دليل",   Icon: BookOpen        },
    { id: "irrigation",    label: "ري",      Icon: Droplets        },
    { id: "fertilization", label: "سماد",   Icon: FlaskConical    },
    { id: "diseases",      label: "أمراض",  Icon: Bug             },
    { id: "market",        label: "سوق",    Icon: TrendingUp      },
    { id: "simulator",     label: "محاكي",  Icon: SlidersHorizontal },
  ];

  const handleShare = useCallback(() => {
    const p3 = CROPS_PHASE3[crop.key];
    const lines = [
      `📊 تحليل المحصول — ${crop.name}`,
      `━━━━━━━━━━━━━━━━━━━━━━━━`,
      `🌱 الحالة: ${crop.currentSeasonStatus}`,
      `📈 ملاءمة الموسم: ${ext.suitabilityScore}%`,
      `🌾 توقع الإنتاج (قاعدي): ${p3?.yieldForecast.base.toLocaleString() ?? "—"} كغ/دونم`,
      p3?.lifecycle ? `⏱️ المحطة القادمة: ${p3.lifecycle.nextMilestoneLabel} (بعد ${p3.lifecycle.daysToNext} يوم)` : "",
      p3?.weatherAlert.active ? `⚠️ تنبيه: ${p3.weatherAlert.title}` : "",
      `━━━━━━━━━━━━━━━━━━━━━━━━`,
      `🤖 أغرو-سيريا | النظام الزراعي الذكي`,
    ].filter(Boolean).join("\n");
    navigator.clipboard.writeText(lines).then(() => {
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2500);
    }).catch(() => {});
  }, [crop, ext, setShareCopied]);

  const currentStepIdx = Math.min(
    Math.floor((crop.seasonalProgress / 100) * ext.plantingSteps.length),
    ext.plantingSteps.length - 1
  );
  const totalWater = ext.irrigationGuide.reduce(
    (sum, s) => sum + Math.round((180 / s.interval) * s.amount / 10), 0
  );

  return (
    <motion.div className="fixed inset-0 z-50 flex"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <motion.div
        className="absolute inset-y-0 end-0 w-full max-w-xl glass-card flex flex-col overflow-hidden"
        style={{ borderRadius: "1.5rem 0 0 1.5rem" }}
        initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
        transition={{ type: "spring", stiffness: 320, damping: 32 }}
        dir="rtl"
      >
        {/* ── Fixed header ── */}
        <div className="flex-shrink-0 border-b border-white/[0.06]"
          style={{ background: `linear-gradient(135deg, ${crop.color}10, transparent)` }}>

          <div className="flex items-center gap-3 px-5 pt-4 pb-3">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: `${crop.color}18`, border: `1px solid ${crop.color}35` }}>
              <CropIcon cropKey={crop.key} color={crop.color} size={26} />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-base font-bold text-foreground leading-tight">{crop.name}</h2>
              <p className="text-[10px] text-muted-foreground/70 font-arabic truncate">{crop.variety}</p>
              <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                <span className={cn("text-[9px] font-semibold border rounded-full px-1.5 py-0.5", SEASON_CLS[crop.season])}>{crop.season}</span>
                <span className={cn("text-[9px] font-semibold border rounded-full px-1.5 py-0.5", CAT_CLS[crop.category])}>{crop.category}</span>
                <span className={cn("text-[9px] font-semibold border rounded-full px-1.5 py-0.5", RISK_CLS[crop.riskLevel])}>{RISK_AR[crop.riskLevel]}</span>
              </div>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <button onClick={handleShare}
                className="flex items-center gap-1 h-8 px-2 rounded-xl bg-white/[0.05] hover:bg-white/10 transition-colors">
                {shareCopied
                  ? <><CheckCircle className="w-3 h-3 text-emerald-400" /><span className="text-[9px] text-emerald-400">تم!</span></>
                  : <><Share2 className="w-3 h-3 text-muted-foreground" /><span className="text-[9px] text-muted-foreground">شارك</span></>
                }
              </button>
              <button onClick={onClose}
                className="w-8 h-8 rounded-xl bg-white/[0.06] hover:bg-white/10 flex items-center justify-center transition-colors">
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
          </div>

          {/* Gauge + Regional Strength */}
          <div className="flex items-start gap-3 px-5 pb-3">
            <div className="flex-shrink-0">
              <RadialGauge score={ext.suitabilityScore} color={crop.color} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-2">
                <MapPin className="w-3 h-3 text-emerald-400/80" />
                <span className="text-[11px] font-bold text-foreground">أقوى المحافظات</span>
              </div>
              <div className="space-y-1.5">
                {ext.regionalStrength.map((rs, i) => {
                  const isUser = userProvince === rs.province;
                  return (
                    <div key={rs.province} className={cn(
                      "flex items-center gap-2 p-1.5 rounded-xl",
                      isUser ? "bg-emerald-500/10 border border-emerald-500/20" : "bg-white/[0.02]"
                    )}>
                      <span className="text-[9px] font-bold w-4 text-muted-foreground/40 flex-shrink-0">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1">
                          <span className="text-[11px] font-semibold text-foreground">{rs.province}</span>
                          {isUser && <span className="text-[8px] text-emerald-400 font-bold">⭐</span>}
                        </div>
                        <p className="text-[9px] text-muted-foreground/55 truncate font-arabic">{rs.note}</p>
                      </div>
                      <span className="text-[10px] font-bold flex-shrink-0" style={{ color: crop.color }}>{rs.score}</span>
                    </div>
                  );
                })}
              </div>
              {!userProvince && (
                <p className="text-[8px] text-muted-foreground/35 mt-1 font-arabic">
                  اضبط محافظتك في الإعدادات لإبراز بياناتك
                </p>
              )}
            </div>
          </div>

          {/* Agent Insight */}
          <div className="mx-5 mb-3 flex items-start gap-2 p-2.5 rounded-xl bg-emerald-500/8 border border-emerald-500/18">
            <Sparkles className="w-3 h-3 text-emerald-400 flex-shrink-0 mt-0.5" />
            <p className="text-[10px] text-emerald-300/85 leading-relaxed font-arabic">{ext.agentInsight}</p>
          </div>

          {/* Tabs */}
          <div className="flex mx-5 mb-0 gap-0.5 bg-white/[0.03] rounded-xl p-0.5 border border-white/[0.05]">
            {TABS.map(({ id, label, Icon }) => (
              <button key={id} onClick={() => setTab(id)}
                className={cn(
                  "flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[10px] font-semibold transition-all",
                  tab === id ? "bg-emerald-500/20 text-emerald-300" : "text-muted-foreground hover:text-foreground"
                )}>
                <Icon className="w-3 h-3" />{label}
              </button>
            ))}
          </div>
          <div className="h-3" />
        </div>

        {/* ── Scrollable body ── */}
        <div className="flex-1 overflow-y-auto">
          <AnimatePresence mode="wait">

            {tab === "guide" && (
              <motion.div key="guide"
                initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }}
                transition={{ duration: 0.18 }} className="p-5 space-y-5">

                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <ShieldAlert className="w-3.5 h-3.5 text-amber-400/80" />
                    <span className="text-[12px] font-bold text-foreground">توقعات المخاطر — مايو 2026</span>
                    <span className={cn("text-[9px] font-bold border rounded-full px-2 py-0.5 ms-auto", SEV_CLS[ext.riskForecast.overall])}>
                      {SEV_AR[ext.riskForecast.overall]}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {[
                      { Icon: Thermometer, label: "مناخي",   text: ext.riskForecast.climate,    cls: "text-orange-400 bg-orange-500/8 border-orange-500/20" },
                      { Icon: Bug,         label: "بيولوجي", text: ext.riskForecast.biological, cls: "text-red-400 bg-red-500/8 border-red-500/20"          },
                      { Icon: Droplets,    label: "مائي",    text: ext.riskForecast.water,      cls: "text-sky-400 bg-sky-500/8 border-sky-500/20"          },
                    ].map(({ Icon, label, text, cls }) => (
                      <div key={label} className={cn("flex items-start gap-2 p-2.5 rounded-xl border", cls)}>
                        <Icon className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                        <div>
                          <span className="text-[9px] font-bold opacity-70">{label}: </span>
                          <span className="text-[10px] font-arabic leading-relaxed">{text}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Phase 3: Early Warning Banner */}
                {ph3?.weatherAlert.active && (
                  <div className={cn(
                    "flex items-start gap-2.5 p-3 rounded-xl border",
                    ph3.weatherAlert.severity === "High"
                      ? "bg-red-500/10 border-red-500/25" : "bg-amber-500/10 border-amber-500/22"
                  )}>
                    <AlertTriangle className={cn("w-4 h-4 flex-shrink-0 mt-0.5",
                      ph3.weatherAlert.severity === "High" ? "text-red-400" : "text-amber-400")} />
                    <div>
                      <p className={cn("text-[11px] font-bold mb-0.5",
                        ph3.weatherAlert.severity === "High" ? "text-red-300" : "text-amber-300")}>
                        {ph3.weatherAlert.title}
                      </p>
                      <p className="text-[10px] text-muted-foreground/75 font-arabic leading-relaxed">
                        {ph3.weatherAlert.cropImpact}
                      </p>
                      <p className="text-[10px] font-semibold text-emerald-400 mt-1 font-arabic">
                        {ph3.weatherAlert.action}
                      </p>
                    </div>
                  </div>
                )}

                {/* Phase 3: Visual Growth Journey */}
                {ph3 && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <Sprout className="w-3.5 h-3.5 text-emerald-400/70" />
                      <span className="text-[12px] font-bold text-foreground">رحلة النمو البصرية</span>
                      <span className="text-[10px] font-numeric text-muted-foreground/50 ms-auto">
                        {crop.seasonalProgress}%
                      </span>
                    </div>
                    <LifecycleTrack
                      milestones={ph3.lifecycle.milestones}
                      currentProgress={crop.seasonalProgress}
                      nextLabel={ph3.lifecycle.nextMilestoneLabel}
                      daysToNext={ph3.lifecycle.daysToNext}
                      hint={ph3.lifecycle.nextMilestoneHint}
                      color={crop.color}
                    />
                  </div>
                )}

                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <MapPin className="w-3.5 h-3.5 text-emerald-400/70" />
                    <span className="text-[12px] font-bold text-foreground">خريطة الانتشار الجغرافي</span>
                  </div>
                  <div className="rounded-2xl overflow-hidden border border-white/[0.06] bg-black/20" style={{ height: 220 }}>
                    <SyriaMap activeProvinces={crop.govs} activeColor={crop.color} className="w-full h-full" />
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {crop.govs.map(g => (
                      <span key={g} className="text-[10px] border rounded-full px-3 py-1 font-arabic font-semibold"
                        style={{ color: crop.color, background: `${crop.color}15`, borderColor: `${crop.color}30` }}>{g}</span>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Calendar className="w-3.5 h-3.5 text-emerald-400/70" />
                    <span className="text-[12px] font-bold text-foreground">دليل الزراعة خطوة بخطوة</span>
                  </div>
                  <div className="space-y-2">
                    {ext.plantingSteps.map((step, idx) => {
                      const StepIcon = STEP_ICONS[step.icon] ?? Sprout;
                      const isCurrent = idx === currentStepIdx;
                      const isDone    = idx < currentStepIdx;
                      return (
                        <div key={step.step} className={cn(
                          "flex gap-3 p-3 rounded-xl border",
                          isCurrent ? "border-emerald-500/40 bg-emerald-500/8" :
                          isDone    ? "border-white/[0.04] opacity-55" :
                                      "border-white/[0.04] bg-white/[0.01]"
                        )}>
                          <div className={cn(
                            "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 border",
                            isCurrent ? "border-emerald-500/50 bg-emerald-500/20" :
                            isDone    ? "border-white/[0.08] bg-white/[0.04]" : "border-white/[0.06]"
                          )}>
                            {isDone
                              ? <CheckCircle className="w-4 h-4 text-emerald-400" />
                              : isCurrent
                                ? <StepIcon className="w-4 h-4 text-emerald-400" />
                                : <span className="text-[10px] text-muted-foreground/50">{step.step}</span>
                            }
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-0.5">
                              <span className={cn("text-[12px] font-bold", isCurrent ? "text-emerald-300" : "text-foreground")}>
                                {step.title}
                              </span>
                              {isCurrent && (
                                <span className="text-[8px] font-bold text-emerald-400 bg-emerald-500/15 border border-emerald-500/25 rounded-full px-1.5 py-0.5">الآن</span>
                              )}
                              <span className="text-[9px] text-muted-foreground/45 ms-auto">{step.timing}</span>
                            </div>
                            <p className="text-[10px] text-muted-foreground/75 leading-relaxed font-arabic">{step.desc}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <button onClick={onYieldCalc}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 text-sm font-semibold hover:bg-emerald-500/22 transition-all">
                  <Calculator className="w-4 h-4" /> احسب إنتاجيتي
                </button>
              </motion.div>
            )}

            {tab === "irrigation" && (
              <motion.div key="irrigation"
                initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }}
                transition={{ duration: 0.18 }} className="p-5 space-y-4">

                <div className="flex items-center gap-3 p-3.5 rounded-2xl border border-sky-500/20 bg-sky-500/6">
                  <div className="w-10 h-10 rounded-xl bg-sky-500/15 border border-sky-500/25 flex items-center justify-center flex-shrink-0">
                    <Droplets className="w-5 h-5 text-sky-400" />
                  </div>
                  <div>
                    <p className="text-[11px] text-muted-foreground font-arabic">إجمالي الموسم التقريبي</p>
                    <p className="text-lg font-bold font-numeric text-sky-400">{totalWater} م³/دونم</p>
                  </div>
                  <div className="ms-auto text-end">
                    <p className="text-[9px] text-muted-foreground/50">الطريقة المثلى</p>
                    <p className="text-[11px] font-semibold text-foreground">{ext.irrigationGuide[0]?.method}</p>
                  </div>
                </div>

                <div className="space-y-2.5">
                  {ext.irrigationGuide.map((stage, i) => (
                    <motion.div key={stage.stage}
                      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.06 }}
                      className="glass-card rounded-xl p-3 border border-white/[0.05]">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-sky-500/12 border border-sky-500/20 flex items-center justify-center flex-shrink-0">
                          <Droplets className="w-4 h-4 text-sky-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <span className="text-[12px] font-bold text-foreground">{stage.stage}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] text-sky-400 font-semibold font-numeric">{stage.amount} مم</span>
                              <span className="text-[9px] text-muted-foreground/45">كل {stage.interval} يوم</span>
                            </div>
                          </div>
                          <p className="text-[10px] text-muted-foreground/70 mt-0.5 font-arabic">{stage.note}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 mt-2 pt-2 border-t border-white/[0.04]">
                        <span className="text-[9px] text-muted-foreground/45">طريقة الري:</span>
                        <span className="text-[10px] font-semibold text-foreground">{stage.method}</span>
                      </div>
                    </motion.div>
                  ))}
                </div>

                <div className="flex items-start gap-2 p-3 rounded-xl bg-emerald-500/6 border border-emerald-500/18">
                  <Bot className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0 mt-0.5" />
                  <p className="text-[10px] text-muted-foreground/80 leading-relaxed font-arabic">
                    وكيل الري: الري بالتنقيط يوفر 35-45% من المياه مقارنةً بالري السطحي مع ضمان توزيع منتظم للرطوبة في منطقة الجذور.
                  </p>
                </div>
              </motion.div>
            )}

            {tab === "fertilization" && (
              <motion.div key="fertilization"
                initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }}
                transition={{ duration: 0.18 }} className="p-5 space-y-4">

                <div>
                  <p className="text-[11px] font-bold text-foreground mb-2.5">العناصر الغذائية الأساسية</p>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { label: "إزوت (N)",     color: "#22c55e", note: "النمو الخضري" },
                      { label: "فوسفور (P)",   color: "#f97316", note: "الجذور والإزهار" },
                      { label: "بوتاسيوم (K)", color: "#8b5cf6", note: "الثمار والمقاومة" },
                    ].map(({ label, color, note }) => (
                      <div key={label} className="p-2 rounded-xl border text-center"
                        style={{ background: `${color}10`, borderColor: `${color}25` }}>
                        <div className="w-3.5 h-3.5 rounded-full mx-auto mb-1" style={{ background: color }} />
                        <p className="text-[9px] font-bold" style={{ color }}>{label}</p>
                        <p className="text-[8px] text-muted-foreground/50 font-arabic">{note}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-2.5">
                  {ext.fertilizationPlan.map((stage, i) => (
                    <motion.div key={stage.stage}
                      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.07 }}
                      className="glass-card rounded-xl p-3.5 border border-white/[0.05]">
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center text-[10px] font-bold text-emerald-400">{i + 1}</div>
                          <span className="text-[12px] font-bold text-foreground">{stage.stage}</span>
                        </div>
                        <span className="text-[9px] text-muted-foreground/45 font-arabic">{stage.timing}</span>
                      </div>
                      <div className="grid grid-cols-3 gap-1.5 mb-2">
                        {[
                          { lbl: "النوع",   val: stage.type,   cls: "text-foreground" },
                          { lbl: "NPK",     val: stage.npk,    cls: "text-emerald-400 font-numeric" },
                          { lbl: "الكمية", val: stage.amount, cls: "text-amber-400" },
                        ].map(({ lbl, val, cls }) => (
                          <div key={lbl} className="text-center p-1.5 rounded-lg bg-white/[0.03] border border-white/[0.05]">
                            <p className="text-[8px] text-muted-foreground/45 mb-0.5">{lbl}</p>
                            <p className={cn("text-[9px] font-semibold font-arabic truncate", cls)}>{val}</p>
                          </div>
                        ))}
                      </div>
                      <p className="text-[10px] text-muted-foreground/70 font-arabic leading-relaxed">{stage.note}</p>
                    </motion.div>
                  ))}
                </div>

                <div className="flex items-start gap-2 p-3 rounded-xl bg-emerald-500/6 border border-emerald-500/18">
                  <Bot className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0 mt-0.5" />
                  <p className="text-[10px] text-muted-foreground/80 leading-relaxed font-arabic">
                    وكيل التسميد: تحليل التربة كل موسم يوفر 20-30% من تكاليف الأسمدة ويمنع التراكم الضار للأملاح.
                  </p>
                </div>
              </motion.div>
            )}

            {tab === "diseases" && (
              <motion.div key="diseases"
                initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }}
                transition={{ duration: 0.18 }} className="p-5 space-y-3">

                <div className="flex items-center gap-2 mb-1">
                  <Bug className="w-3.5 h-3.5 text-red-400/70" />
                  <span className="text-[12px] font-bold text-foreground">موسوعة الآفات والأمراض</span>
                </div>

                {ext.diseaseDetails.map((disease, i) => {
                  const typeInfo = DISEASE_TYPE[disease.type] ?? DISEASE_TYPE.fungal;
                  const isOpen   = openDisease === i;
                  return (
                    <motion.div key={disease.name}
                      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.07 }}
                      className="glass-card rounded-2xl overflow-hidden border border-white/[0.06]">

                      <div className="relative h-16 overflow-hidden"
                        style={{ background: `linear-gradient(135deg, ${crop.color}18, ${crop.color}06)` }}>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <typeInfo.Icon className="w-7 h-7 opacity-15" style={{ color: crop.color }} />
                        </div>
                        <div className="absolute inset-0" style={{
                          background: `radial-gradient(ellipse at 30% 50%, ${crop.color}12, transparent 70%)`
                        }} />
                        <div className="absolute bottom-0 inset-x-0 h-6 bg-gradient-to-t from-[oklch(0.10_0.020_155)] to-transparent" />
                        <div className="absolute top-2 end-2 flex gap-1.5">
                          <span className={cn("text-[9px] font-bold border rounded-full px-1.5 py-0.5", typeInfo.cls)}>{typeInfo.label}</span>
                          <span className={cn("text-[9px] font-bold border rounded-full px-1.5 py-0.5", SEV_CLS[disease.severity])}>
                            {SEV_AR[disease.severity]}
                          </span>
                        </div>
                      </div>

                      <button onClick={() => setOpenDisease(isOpen ? null : i)}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-start hover:bg-white/[0.02] transition-colors">
                        <span className="text-[12px] font-bold text-foreground flex-1">{disease.name}</span>
                        <motion.span animate={{ rotate: isOpen ? -90 : 90 }} transition={{ duration: 0.2 }}>
                          <ChevronLeft className="w-4 h-4 text-muted-foreground/50" />
                        </motion.span>
                      </button>

                      <AnimatePresence>
                        {isOpen && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.22 }}
                            className="overflow-hidden">
                            <div className="px-4 pb-4 space-y-2.5 border-t border-white/[0.04]">
                              {[
                                { label: "الأعراض", text: disease.symptoms,   DIcon: AlertTriangle, cls: "text-amber-400" },
                                { label: "العلاج",  text: disease.treatment,  DIcon: FlaskConical,  cls: "text-sky-400"   },
                                { label: "الوقاية", text: disease.prevention, DIcon: Shield,        cls: "text-emerald-400" },
                              ].map(({ label, text, DIcon, cls }) => (
                                <div key={label} className="flex gap-2 mt-3">
                                  <DIcon className={cn("w-3.5 h-3.5 flex-shrink-0 mt-0.5", cls)} />
                                  <div>
                                    <span className={cn("text-[9px] font-bold", cls)}>{label}: </span>
                                    <span className="text-[10px] text-muted-foreground/80 font-arabic leading-relaxed">{text}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  );
                })}
              </motion.div>
            )}

            {/* ── السوق: Market Intelligence ───────────────────── */}
            {tab === "market" && (
              <motion.div key="market"
                initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }}
                transition={{ duration: 0.18 }} className="p-5 space-y-5">

                {/* Early warning if active */}
                {ph3?.weatherAlert.active && (
                  <div className={cn(
                    "flex items-start gap-2.5 p-3 rounded-xl border",
                    ph3.weatherAlert.severity === "High"
                      ? "bg-red-500/10 border-red-500/25" : "bg-amber-500/10 border-amber-500/22"
                  )}>
                    <AlertTriangle className={cn("w-4 h-4 flex-shrink-0 mt-0.5",
                      ph3.weatherAlert.severity === "High" ? "text-red-400" : "text-amber-400")} />
                    <div>
                      <p className={cn("text-[11px] font-bold mb-0.5",
                        ph3.weatherAlert.severity === "High" ? "text-red-300" : "text-amber-300")}>
                        {ph3.weatherAlert.title}
                      </p>
                      <p className="text-[10px] text-muted-foreground/70 font-arabic">{ph3.weatherAlert.cropImpact}</p>
                    </div>
                  </div>
                )}

                {ph3 ? (
                  <>
                    {/* Price Chart */}
                    <div className="glass-card rounded-2xl p-3.5 border border-white/[0.05]">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-1.5">
                          <TrendingUp className="w-3.5 h-3.5 text-emerald-400/70" />
                          <span className="text-[12px] font-bold text-foreground">حركة السعر — 30 يوم</span>
                        </div>
                        <span className={cn("text-[9px] font-bold border rounded-full px-2 py-0.5", TREND_CLS[crop.marketTrend])}>
                          {TREND_AR[crop.marketTrend]}
                        </span>
                      </div>
                      <PriceChart data={ph3.market.priceHistory} color={crop.color} label={ph3.market.currentPriceLabel} />
                    </div>

                    {/* Demand bars */}
                    <div className="space-y-3">
                      <p className="text-[11px] font-bold text-foreground">فرص التصدير والطلب المحلي</p>
                      {[
                        { label: "فرص التصدير",  val: ph3.market.exportPotential, color: "#10b981", icon: TrendingUp  },
                        { label: "الطلب المحلي",  val: ph3.market.localDemand,    color: "#f59e0b", icon: Star         },
                      ].map(({ label, val, color, icon: Icon }) => (
                        <div key={label}>
                          <div className="flex items-center justify-between mb-1.5">
                            <div className="flex items-center gap-1.5">
                              <Icon className="w-3 h-3 flex-shrink-0" style={{ color }} />
                              <span className="text-[11px] text-muted-foreground font-arabic">{label}</span>
                            </div>
                            <span className="text-[11px] font-bold font-numeric" style={{ color }}>{val}%</span>
                          </div>
                          <div className="h-2 rounded-full bg-white/[0.06] overflow-hidden">
                            <motion.div className="h-full rounded-full"
                              style={{ background: color }}
                              initial={{ width: 0 }}
                              animate={{ width: `${val}%` }}
                              transition={{ duration: 1, ease: EASE, delay: 0.1 }} />
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Market AI Insight */}
                    <div className="flex items-start gap-2.5 p-3 rounded-xl bg-emerald-500/6 border border-emerald-500/18">
                      <Bot className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0 mt-0.5" />
                      <p className="text-[10px] text-muted-foreground/80 leading-relaxed font-arabic">{ph3.market.marketInsight}</p>
                    </div>

                    {/* Yield Forecast 2026 */}
                    <div className="glass-card rounded-2xl p-4 border border-white/[0.05]">
                      <div className="flex items-center gap-1.5 mb-3">
                        <BarChart3 className="w-3.5 h-3.5 text-emerald-400/70" />
                        <span className="text-[12px] font-bold text-foreground">توقع الإنتاجية 2026</span>
                        <span className="text-[9px] font-numeric text-muted-foreground/50 ms-auto">دقة {ph3.yieldForecast.confidence}%</span>
                      </div>

                      <div className="grid grid-cols-3 gap-2 mb-3">
                        {[
                          { label: "متفائل",   val: ph3.yieldForecast.optimistic,  clr: "#10b981" },
                          { label: "قاعدي",    val: ph3.yieldForecast.base,         clr: crop.color },
                          { label: "متحفظ",    val: ph3.yieldForecast.pessimistic,  clr: "#f59e0b" },
                        ].map(({ label, val, clr }) => (
                          <div key={label} className="text-center p-2.5 rounded-xl border"
                            style={{ background: `${clr}10`, borderColor: `${clr}25` }}>
                            <p className="text-[8px] text-muted-foreground/55 mb-1 font-arabic">{label}</p>
                            <p className="text-[14px] font-bold font-numeric leading-none" style={{ color: clr }}>{val.toLocaleString()}</p>
                            <p className="text-[8px] text-muted-foreground/45 mt-0.5">كغ/دونم</p>
                          </div>
                        ))}
                      </div>

                      <div className="mb-2">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] text-muted-foreground/60">مستوى الثقة</span>
                          <span className="text-[10px] font-bold font-numeric" style={{ color: crop.color }}>{ph3.yieldForecast.confidence}%</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                          <motion.div className="h-full rounded-full" style={{ background: crop.color }}
                            initial={{ width: 0 }}
                            animate={{ width: `${ph3.yieldForecast.confidence}%` }}
                            transition={{ duration: 1, ease: EASE }} />
                        </div>
                      </div>

                      <div className="flex items-start gap-2 p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                        <Bot className="w-3 h-3 text-emerald-400 flex-shrink-0 mt-0.5" />
                        <p className="text-[9px] text-muted-foreground/65 font-arabic leading-relaxed">{ph3.yieldForecast.basis}</p>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-12 text-muted-foreground/50 font-arabic text-sm">
                    بيانات السوق غير متوفرة
                  </div>
                )}
              </motion.div>
            )}

            {/* ── محاكي المحاصيل ────────────────────────────── */}
            {tab === "simulator" && (
              <motion.div key="simulator"
                initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }}
                transition={{ duration: 0.18 }}>
                <WhatIfSimulator
                  crop={crop}
                  baseYield={ph3?.yieldForecast.base ?? crop.yieldPerDunum}
                  confidence={ph3?.yieldForecast.confidence ?? 75}
                />
              </motion.div>
            )}

          </AnimatePresence>
        </div>

        {/* ── Live Intelligence Stream ─────────────────────── */}
        <AgentActivityHub />

      </motion.div>
    </motion.div>
  );
}

/* ─── Main ───────────────────────────────────────────────────────────── */
function CropsContent() {
  const [search,      setSearch]      = useState("");
  const [season,      setSeason]      = useState<Season | "الكل">("الكل");
  const [water,       setWater]       = useState<WaterNeed | "الكل">("الكل");
  const [category,    setCategory]    = useState<Category | "الكل">("الكل");
  const [profitSort,  setProfitSort]  = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [selected,    setSelected]    = useState<Crop | null>(null);
  const [showYield,   setShowYield]   = useState(false);

  const handleSelect = useCallback((crop: Crop) => {
    setSelected(crop);
    setShowYield(false);
    try {
      if (typeof window !== "undefined") {
        const p3 = CROPS_PHASE3[crop.key];
        localStorage.setItem("agro_crop_context", JSON.stringify({
          cropId:              crop.key,
          cropName:            crop.name,
          variety:             crop.variety,
          category:            crop.category,
          marketTrend:         crop.marketTrend,
          currentSeasonStatus: crop.currentSeasonStatus,
          seasonalProgress:    crop.seasonalProgress,
          riskLevel:           crop.riskLevel,
          profitIndex:         crop.profitIndex,
          demandIndex:         crop.demandIndex,
          govs:                crop.govs,
          selectedAt:          Date.now(),
          nextMilestone:       p3?.lifecycle.nextMilestoneLabel,
          daysToNextMilestone: p3?.lifecycle.daysToNext,
          exportPotential:     p3?.market.exportPotential,
          localDemand:         p3?.market.localDemand,
          yieldForecast:       p3 ? { base: p3.yieldForecast.base, confidence: p3.yieldForecast.confidence } : undefined,
          weatherAlert:        p3?.weatherAlert.active ? { title: p3.weatherAlert.title, severity: p3.weatherAlert.severity } : null,
        }));
      }
    } catch { /* localStorage unavailable in some contexts */ }
  }, []);

  const filtered = useMemo(() => {
    let list = CROPS.filter(c =>
      (season   === "الكل" || c.season    === season) &&
      (water    === "الكل" || c.waterNeed === water) &&
      (category === "الكل" || c.category  === category) &&
      (!search || c.name.includes(search) || c.variety.includes(search) || c.description.includes(search))
    );
    if (profitSort) list = [...list].sort((a, b) => b.profitIndex - a.profitIndex);
    return list;
  }, [season, water, category, search, profitSort]);

  const closestMatch = useMemo(() => {
    if (!search || filtered.length > 0) return null;
    return CROPS.reduce((best, c) => {
      const score = [...search].filter(ch => c.name.includes(ch) || c.variety.includes(ch)).length;
      return score > best.score ? { crop: c, score } : best;
    }, { crop: CROPS[0], score: 0 });
  }, [search, filtered.length]);

  const hasFilters = season !== "الكل" || water !== "الكل" || category !== "الكل" || !!search || profitSort;

  return (
    <div className="flex-1 overflow-y-auto overflow-x-hidden" dir="rtl">
      <div className="p-6 max-w-7xl mx-auto w-full">

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }} className="mb-5">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/12 border border-emerald-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Leaf className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-foreground">الموسوعة الزراعية الاستراتيجية</h2>
              <p className="text-sm text-muted-foreground mt-0.5 font-arabic">
                {CROPS.length} محصولاً — بيانات GCSAR · وكيل الموثق · وكيل الإنتاج
              </p>
            </div>
          </div>
        </motion.div>

        {/* Seasonal AI Highlights */}
        <StrategicGuidanceCard onSelect={handleSelect} />
        <SeasonalHighlights onSelect={handleSelect} />

        {/* Search & Filters */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.35 }}
          className="glass-card rounded-2xl p-4 mb-5">

          <div className="flex gap-2 flex-wrap">
            <div className="relative flex-1 min-w-[180px]">
              <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/50" />
              <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                placeholder="ابحث بالاسم أو الصنف..."
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl ps-9 pe-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-emerald-500/40"
                dir="rtl" />
            </div>
            <button onClick={() => setProfitSort(v => !v)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2 rounded-xl border text-[11px] font-semibold transition-all",
                profitSort ? "bg-amber-500/15 border-amber-500/30 text-amber-400" : "bg-white/[0.04] border-white/[0.08] text-muted-foreground hover:text-foreground"
              )}>
              <TrendingUp className="w-3.5 h-3.5" /> الأعلى ربحية
            </button>
            <button onClick={() => setShowFilters(v => !v)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2 rounded-xl border text-[11px] font-semibold transition-all",
                showFilters ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400" : "bg-white/[0.04] border-white/[0.08] text-muted-foreground hover:text-foreground"
              )}>
              <SlidersHorizontal className="w-3.5 h-3.5" /> تصفية
            </button>
          </div>

          <AnimatePresence>
            {showFilters && (
              <motion.div
                initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.22 }}
                className="overflow-hidden"
              >
                <div className="pt-4 flex flex-wrap gap-5">
                  <div>
                    <p className="text-[9px] font-semibold text-muted-foreground/60 mb-2 uppercase tracking-wide">الموسم</p>
                    <div className="flex gap-1.5 flex-wrap">
                      {SEASONS.map(s => (
                        <button key={s} onClick={() => setSeason(s)}
                          className={cn("px-2.5 py-1 rounded-full text-[10px] font-semibold border transition-all",
                            season === s ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300" : "bg-white/[0.03] border-white/[0.06] text-muted-foreground hover:text-foreground"
                          )}>{s}</button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-[9px] font-semibold text-muted-foreground/60 mb-2 uppercase tracking-wide">الفئة</p>
                    <div className="flex gap-1.5 flex-wrap">
                      {CATEGORIES.map(c => (
                        <button key={c} onClick={() => setCategory(c)}
                          className={cn("px-2.5 py-1 rounded-full text-[10px] font-semibold border transition-all",
                            category === c ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300" : "bg-white/[0.03] border-white/[0.06] text-muted-foreground hover:text-foreground"
                          )}>{c}</button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-[9px] font-semibold text-muted-foreground/60 mb-2 uppercase tracking-wide">احتياج الري</p>
                    <div className="flex gap-1.5 flex-wrap">
                      {WATER_NEEDS.map(w => (
                        <button key={w} onClick={() => setWater(w)}
                          className={cn("px-2.5 py-1 rounded-full text-[10px] font-semibold border transition-all",
                            water === w ? "bg-sky-500/20 border-sky-500/40 text-sky-300" : "bg-white/[0.03] border-white/[0.06] text-muted-foreground hover:text-foreground"
                          )}>{w}</button>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Results count + clear */}
        <div className="flex items-center justify-between mb-4">
          <span className="text-[11px] text-muted-foreground">
            {filtered.length} محصول{profitSort && " · مرتب حسب الربحية"}
          </span>
          {hasFilters && (
            <button onClick={() => { setSeason("الكل"); setWater("الكل"); setCategory("الكل"); setSearch(""); setProfitSort(false); }}
              className="flex items-center gap-1 text-[11px] text-emerald-400/70 hover:text-emerald-400 transition-colors">
              <X className="w-3 h-3" /> مسح الكل
            </button>
          )}
        </div>

        {/* Grid */}
        {filtered.length > 0 ? (
          <motion.div variants={stagger} initial="hidden" animate="visible"
            className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {filtered.map(c => <CropCard key={c.key} crop={c} onClick={() => handleSelect(c)} />)}
          </motion.div>
        ) : (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="text-center py-20">
            <div className="w-16 h-16 rounded-2xl bg-emerald-500/8 border border-emerald-500/15 flex items-center justify-center mx-auto mb-4">
              <Leaf className="w-8 h-8 text-emerald-400/40" />
            </div>
            <p className="text-base font-semibold text-foreground mb-1 font-arabic">
              لم نجد محصولاً يطابق &ldquo;{search}&rdquo;
            </p>
            <p className="text-sm text-muted-foreground mb-4 font-arabic">
              جرّب تغيير معايير البحث أو التصفية
            </p>
            {closestMatch && closestMatch.score > 0 && (
              <div className="inline-flex flex-col items-center gap-2">
                <p className="text-[11px] text-muted-foreground/60 font-arabic">هل تقصد...</p>
                <button
                  onClick={() => { setSearch(""); handleSelect(closestMatch.crop); }}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/12 border border-emerald-500/25 text-emerald-400 text-sm font-semibold hover:bg-emerald-500/20 transition-all"
                >
                  <CropIcon cropKey={closestMatch.crop.key} color="#10b981" size={18} />
                  {closestMatch.crop.name}
                </button>
              </div>
            )}
          </motion.div>
        )}
      </div>

      <AnimatePresence>
        {selected && (
          <CropDrawerV2
            key={selected.key}
            crop={selected}
            onClose={() => setSelected(null)}
            onYieldCalc={() => setShowYield(true)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selected && showYield && (
          <YieldModal crop={selected} onClose={() => setShowYield(false)} />
        )}
      </AnimatePresence>
    </div>
  );
}

export default function CropsPage() {
  return (
    <WorkspaceLayout activeView="crops">
      <CropsContent />
    </WorkspaceLayout>
  );
}
