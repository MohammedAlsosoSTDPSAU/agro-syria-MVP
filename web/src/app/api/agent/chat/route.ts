import { NextRequest, NextResponse } from "next/server";

// ── Shared types (mirror api.ts) ────────────────────────────────────────

interface AgentThought {
  agent: string;
  role_ar: string;
  thought: string;
  is_status: boolean;
}

interface VisualizationData {
  type: "map" | "bar_chart";
  title_ar: string;
  bars?: { label_ar: string; value: number; color: "emerald" | "amber" | "red" }[];
  source_ar?: string;
}

interface ChatResponse {
  reply: string;
  session_id: string;
  chain_of_thought: AgentThought[];
  tokens_used: number | null;
  visualization?: VisualizationData | null;
}

interface UserField {
  nameAr: string;
  cropAr: string;
  areaHa: number;
  provinceAr: string;
}

interface UserContext {
  fields?: UserField[];
  active_crops?: string[];
  preferred_province?: string;
}

interface ChatRequest {
  message: string;
  session_id?: string;
  image_base64?: string;
  user_context?: UserContext;
}

// ── Groq (OpenAI-compatible) direct call ────────────────────────────────
// Primary LLM path: runs when GROQ_API_KEY is present. Calls Groq via its
// OpenAI-compatible endpoint; on any failure returns null so the caller
// falls through to the local template engine (last-resort fallback).

const GROQ_MODEL = "llama-3.1-8b-instant"; // fast/cheap tier via OpenAI-compatible API
const GROQ_BASE_URL = "https://api.groq.com/openai/v1";

const GROQ_SYSTEM_PROMPT = `أنت "أغرو-سيريا"، مستشار زراعي ذكي متخصص في الزراعة السورية.

- أجب دائماً باللغة العربية الفصحى المعيارية بأسلوب واضح ومهني.
- اجعل إجاباتك دقيقة وعمليّة وقابلة للتطبيق، ومخصّصة للزراعة السورية ومحافظاتها (حلب، الحسكة، دير الزور، حمص، حماة، إدلب، اللاذقية، طرطوس، دمشق وريفها، درعا، الرقة، السويداء، القنيطرة)، مع مراعاة مناخ كل منطقة وتربتها ومحاصيلها.
- عند الحاجة قدّم أرقاماً تقريبية واقعية (احتياجات الري، الأسعار، المواعيد الزراعية) ووضّح أنها تقديرية.
- اجعل الرد مختصراً تحت 300 كلمة، ونظّم الإجابة بما يناسب السؤال — لا تلتزم بقالب ثابت أو هيكل جامد.
- إن كان السؤال مجرد تحية أو سؤال عام، رحّب بالمزارع بدفء واسأله كيف يمكنك مساعدته دون إطالة.`;

// Accepts a raw base64 string or a full data URL; normalises to a data URL
// suitable for the OpenAI-compatible `image_url` content part.
function toImageDataUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (/^data:image\/[a-z]+;base64,/i.test(trimmed)) return trimmed;
  // Raw base64 with no data-URL prefix — assume JPEG.
  return `data:image/jpeg;base64,${trimmed}`;
}

function buildUserText(req: ChatRequest): string {
  const ctx = req.user_context;
  const fields = ctx?.fields ?? [];
  const hasMsg = !!req.message?.trim();
  const hasCtx = fields.length > 0 || !!ctx?.active_crops?.length;

  // Image-only request → give the vision model an explicit agronomy instruction.
  const question = hasMsg
    ? req.message
    : "حلّل هذه الصورة الزراعية وبيّن إن كان هناك أي أعراض مرضية أو نقص غذائي أو آفات، ثم قدّم توصيات عملية للمزارع.";

  if (!hasCtx) return question;

  const lines: string[] = ["[سياق حقول المزارع المسجّلة]"];
  fields.slice(0, 5).forEach((f) => {
    lines.push(`• ${f.nameAr} (${f.provinceAr}) — ${f.cropAr}، ${f.areaHa} هكتار`);
  });
  if (ctx?.active_crops?.length) {
    lines.push(`المحاصيل النشطة: ${ctx.active_crops.join("، ")}`);
  }
  lines.push("", `سؤال المزارع: ${question}`);
  return lines.join("\n");
}

type GroqContent =
  | string
  | Array<
      | { type: "text"; text: string }
      | { type: "image_url"; image_url: { url: string } }
    >;

// Builds the user turn content — a plain string, or a [image, text] parts array
// when an image is attached so the model performs real vision analysis.
function buildUserContent(req: ChatRequest): GroqContent {
  const text = buildUserText(req);
  const url = req.image_base64 ? toImageDataUrl(req.image_base64) : null;
  if (!url) return text;

  return [
    { type: "image_url", image_url: { url } },
    { type: "text", text },
  ];
}

async function callGroq(req: ChatRequest): Promise<ChatResponse | null> {
  console.log("[chat] callGroq called");
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) { console.log("[chat] callGroq: no GROQ_API_KEY → null"); return null; }
  if (!req.message?.trim() && !req.image_base64) { console.log("[chat] callGroq: empty input → null"); return null; }

  try {
    const res = await fetch(`${GROQ_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        max_tokens: 800,
        messages: [
          { role: "system", content: GROQ_SYSTEM_PROMPT },
          { role: "user", content: buildUserContent(req) },
        ],
      }),
      signal: AbortSignal.timeout(25_000),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.log("[chat] callGroq: Groq HTTP", res.status, "→ null |", errText.slice(0, 200));
      return null; // quota / auth / server error → fall through to local engine
    }

    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };

    const reply = (data.choices?.[0]?.message?.content ?? "").trim();
    if (!reply) { console.log("[chat] callGroq: empty reply → null"); return null; }
    console.log("[chat] callGroq: success");

    const usage = data.usage;
    return {
      reply,
      session_id: req.session_id ?? crypto.randomUUID(),
      chain_of_thought: [
        {
          agent: "synthesizer",
          role_ar: "المُجمِّع الاستراتيجي",
          thought: "أحلّل سؤالك وأصيغ إجابة زراعية مخصّصة للسياق السوري...",
          is_status: false,
        },
      ],
      tokens_used: usage
        ? (usage.prompt_tokens ?? 0) + (usage.completion_tokens ?? 0)
        : null,
      visualization: null,
    };
  } catch (e) {
    console.log("[chat] callGroq: threw →", e instanceof Error ? e.message : String(e));
    return null;
  }
}

// ── Province intelligence database ──────────────────────────────────────

interface ProvinceProfile {
  tempC: number;
  weatherAr: string;
  humidityPct: number;
  windKmh: number;
  mainCrops: string;
  topCrop: string;
  soilNote: string;
  irrigationM3: number;
  marketNote: string;
  marketPrice: string;
  season: string;
  threat: string | null;
  productionScore: number;
}

const PROVINCES: Record<string, ProvinceProfile> = {
  "حلب": {
    tempC: 28, weatherAr: "مشمس جزئياً مع رياح شمالية معتدلة",
    humidityPct: 52, windKmh: 18, mainCrops: "القمح والشعير والفستق الحلبي",
    topCrop: "القمح", soilNote: "تربة طينية-رملية pH 7.4، مناسبة للحبوب الاستراتيجية",
    irrigationM3: 225, marketNote: "طلب تصديري مرتفع، نافذة بيع مثالية",
    marketPrice: "420 ل.س/كغ ارتفع 3.7% أسبوعياً",
    season: "حصاد القمح يبدأ خلال 3 أسابيع",
    threat: "رصد بؤر صدأ أصفر شمالي حلب — متابعة فورية مطلوبة",
    productionScore: 82,
  },
  "حمص": {
    tempC: 31, weatherAr: "حار وجاف، سماء صافية",
    humidityPct: 40, windKmh: 12, mainCrops: "القطن والزيتون والشوندر السكري",
    topCrop: "القطن", soilNote: "تربة ثقيلة تحتاج ري موزع، رطوبة 34%",
    irrigationM3: 310, marketNote: "القطن مستقر مع توقعات ارتفاع موسمي",
    marketPrice: "1850 ل.س/كغ قطن",
    season: "زراعة القطن في ذروتها، الزيتون أكتوبر",
    threat: null, productionScore: 62,
  },
  "دمشق": {
    tempC: 29, weatherAr: "معتدل وصافٍ، مثالي للزراعة",
    humidityPct: 42, windKmh: 10, mainCrops: "الخضراوات والفواكه وزيت الزيتون",
    topCrop: "الخضراوات", soilNote: "تربة الغوطة الخصبة، نسبة عضوية 3.2%",
    irrigationM3: 180, marketNote: "طلب محلي مرتفع على الخضار الطازجة",
    marketPrice: "الطماطم 540 ل.س/كغ مع ضغط عرض",
    season: "موسم صيفي نشط لكافة الخضراوات",
    threat: null, productionScore: 52,
  },
  "الحسكة": {
    tempC: 38, weatherAr: "حار جداً، رياح شرقية جافة",
    humidityPct: 28, windKmh: 22, mainCrops: "القمح والشعير والقطن والذرة",
    topCrop: "القمح", soilNote: "تربة طينية عميقة، خصبة جداً، تحتاج ري وفير في درجات الحرارة المرتفعة",
    irrigationM3: 380, marketNote: "الحسكة تمثل 45% من إنتاج القمح السوري هذا الموسم",
    marketPrice: "420 ل.س/كغ قمح — السوق في ذروة النشاط",
    season: "حصاد القمح جارٍ بكثافة — ذروة الإنتاج الوطني",
    threat: null, productionScore: 92,
  },
  "دير الزور": {
    tempC: 40, weatherAr: "شديد الحرارة وجاف، رياح صحراوية",
    humidityPct: 25, windKmh: 20, mainCrops: "القطن والسمسم والأرز",
    topCrop: "السمسم", soilNote: "تربة طينية فراتية غنية بالمعادن على الضفاف",
    irrigationM3: 420, marketNote: "السمسم يُحقق أعلى هامش ربح هذا الموسم",
    marketPrice: "2200 ل.س/كغ سمسم — طلب مرتفع من مصافي الزيت",
    season: "إعداد أراضي القطن، السمسم يُحصد سبتمبر",
    threat: null, productionScore: 58,
  },
  "إدلب": {
    tempC: 24, weatherAr: "معتدل، احتمال أمطار خفيفة مساءً",
    humidityPct: 60, windKmh: 14, mainCrops: "الزيتون والفستق الحلبي والأعشاب الطبية",
    topCrop: "الزيتون", soilNote: "تربة كلسية صخرية مثالية لأشجار الزيتون المعمرة",
    irrigationM3: 70, marketNote: "زيت الزيتون الإدلبي — طلب تصديري أوروبي مرتفع",
    marketPrice: "9600 ل.س/كغ زيت زيتون — ارتفع 3.2% شهرياً",
    season: "صيانة بساتين الزيتون، حصاد أكتوبر-نوفمبر",
    threat: null, productionScore: 42,
  },
  "اللاذقية": {
    tempC: 24, weatherAr: "رطب وضبابي، غيوم متفرقة",
    humidityPct: 76, windKmh: 12, mainCrops: "الحمضيات والزيتون والتبغ والتين",
    topCrop: "الحمضيات", soilNote: "تربة ساحلية رطبة، مراقبة عفن الجذور ضرورية",
    irrigationM3: 60, marketNote: "الحمضيات ذات جودة تصديرية، التبغ مُدار تعاقدياً",
    marketPrice: "350 ل.س/كغ حمضيات، 2800 ل.س/كغ تبغ",
    season: "موسم العناية والتقليم، حصاد الحمضيات نوفمبر-مارس",
    threat: "إشارات بياض دقيقي في مزارع الزيتون الساحلية — رش وقائي موصى به",
    productionScore: 48,
  },
  "طرطوس": {
    tempC: 23, weatherAr: "ساحلي رطب، ضباب صباحي",
    humidityPct: 82, windKmh: 10, mainCrops: "الحمضيات والزيتون والموز",
    topCrop: "الحمضيات", soilNote: "تربة مشبعة، صرف جيد أولوية قصوى",
    irrigationM3: 50, marketNote: "الحمضيات الطرطوسية تُصدَّر لأسواق الخليج",
    marketPrice: "حمضيات 350 ل.س/كغ، زيتون 1200 ل.س/كغ",
    season: "موسم البساتين الساحلية، عناية مكثفة",
    threat: null, productionScore: 40,
  },
  "حماة": {
    tempC: 27, weatherAr: "معتدل مع نسيم غربي لطيف",
    humidityPct: 48, windKmh: 16, mainCrops: "القمح والشوندر والخيار والخضراوات",
    topCrop: "القمح", soilNote: "تربة سهل حماة الخصبة pH 7.2، نسبة عضوية 2.8%",
    irrigationM3: 200, marketNote: "الخيار 320 ل.س/كغ مع ارتفاع موسمي متوقع 15%",
    marketPrice: "قمح 420 ل.س/كغ، خيار 320 ل.س/كغ",
    season: "ذروة الخضار الصيفي، قمح يقترب من الحصاد",
    threat: null, productionScore: 76,
  },
  "الرقة": {
    tempC: 36, weatherAr: "حار وجاف، رياح صحراوية متقطعة",
    humidityPct: 30, windKmh: 24, mainCrops: "القمح والشعير والذرة البيضاء",
    topCrop: "القمح", soilNote: "أراضٍ واسعة تحتاج مشاريع ري منظمة لتعظيم الإنتاج",
    irrigationM3: 300, marketNote: "الذرة البيضاء 310 ل.س/كغ — إمكانات توسع كبيرة",
    marketPrice: "قمح 420 ل.س/كغ، ذرة بيضاء 310 ل.س/كغ",
    season: "انتهاء حصاد الشعير، القمح يقترب",
    threat: null, productionScore: 68,
  },
  "درعا": {
    tempC: 30, weatherAr: "دافئ ومشمس، جيد للزراعة",
    humidityPct: 44, windKmh: 14, mainCrops: "الطماطم والباذنجان والقمح",
    topCrop: "الطماطم", soilNote: "تربة حوران الجيدة الصرف، مناسبة للخضراوات",
    irrigationM3: 190, marketNote: "تحذير: عرض الطماطم مرتفع، الأسعار تضغط",
    marketPrice: "طماطم 540 ل.س/كغ — انخفض 11%، تنويع موصى به",
    season: "ذروة موسم الخضار الصيفي في حوران",
    threat: null, productionScore: 30,
  },
  "السويداء": {
    tempC: 22, weatherAr: "جبلي معتدل، هواء بازلتي نقي",
    humidityPct: 55, windKmh: 12, mainCrops: "العنب والتفاح والمشمش واللوز والكرز",
    topCrop: "العنب", soilNote: "تربة بازلتية خصبة مثالية لأشجار الفاكهة المعمرة",
    irrigationM3: 120, marketNote: "العنب السويداوي يُحقق أسعاراً استثنائية هذا الموسم",
    marketPrice: "عنب 760 ل.س/كغ ارتفع 10%، كرز 1800 ل.س/كغ",
    season: "الكرز في ذروته، العنب يبدأ أغسطس",
    threat: null, productionScore: 35,
  },
  "القنيطرة": {
    tempC: 20, weatherAr: "جبلي معتدل ورطب",
    humidityPct: 60, windKmh: 10, mainCrops: "القمح والشوفان والمراعي",
    topCrop: "القمح", soilNote: "أراضٍ في مرحلة تعافٍ، تربة خصبة متوسطة",
    irrigationM3: 140, marketNote: "الإنتاج في تصاعد، نسبة التعافي الزراعي 68%",
    marketPrice: "قمح 420 ل.س/كغ",
    season: "موسم ربيعي قصير، تعافٍ زراعي مستمر",
    threat: null, productionScore: 20,
  },
};

// ── Intent detection ────────────────────────────────────────────────────

type Intent = "greeting" | "province_overview" | "weather" | "market" | "irrigation" | "disease" | "trends" | "emergency" | "general";

// Short, greeting-only messages → Liaison short-circuit (no agronomy needed).
// Note: avoid the ASCII \b word boundary — it does not match after Arabic letters.
function isGreeting(msg: string): boolean {
  const t = msg.trim().replace(/[!.؟?,،]/g, "").toLowerCase();
  if (!t || t.split(/\s+/).length > 4) return false;
  return /^(مرحبا|مرحبتين|اهلا|أهلا|أهلاً|اهلين|أهلين|هلا|سلام|السلام عليكم|صباح الخير|مساء الخير|هاي|hi|hello|hey)(\s|$)/.test(t);
}

function detectIntent(msg: string): Intent {
  if (isGreeting(msg))                                                       return "greeting";
  if (/\[URGENT REPORT\]|\[بلاغ طارئ\]/.test(msg))                          return "emergency";
  if (/صدأ|بياض دقيق|لفح|أمراض|آفة|حشر|بق|عفن/.test(msg))                 return "disease";
  if (/خطة ري|جدول ري|مياه الري|رطوبة التربة|احتياج.*مياه|برنامج.*ري|ري.*محصول|محصول.*ري/.test(msg)) return "irrigation";
  if (/سعر|سوق|بيع|شراء|ليرة|ل\.س|تسويق/.test(msg))                        return "market";
  if (/طقس|حرارة|مطر|رياح|توقعات جوية/.test(msg))                          return "weather";
  if (/يزرع|توجه.*موسم|ما يزرع|المزارعون|تشبّع السوق/.test(msg))           return "trends";
  if (/الوضع الزراعي|محافظة|أخبرني عن|تقرير/.test(msg))                    return "province_overview";
  return "general";
}

function detectProvince(msg: string): string | null {
  for (const name of Object.keys(PROVINCES)) {
    if (msg.includes(name)) return name;
  }
  return null;
}

function detectCrop(msg: string): string | null {
  const map: [RegExp, string][] = [
    [/قمح/, "القمح"], [/قطن/, "القطن"], [/زيتون/, "الزيتون"],
    [/شعير/, "الشعير"], [/ذرة/, "الذرة"], [/سمسم/, "السمسم"],
    [/طماطم|طماطه/, "الطماطم"], [/بطاطا/, "البطاطا"],
    [/عنب/, "العنب"], [/تفاح/, "التفاح"], [/فستق/, "الفستق الحلبي"],
    [/حمضيات/, "الحمضيات"], [/كرز/, "الكرز"], [/مشمش/, "المشمش"],
  ];
  for (const [rx, name] of map) if (rx.test(msg)) return name;
  return null;
}

// ── Agent thoughts by intent ────────────────────────────────────────────

const THOUGHTS: Record<Intent, AgentThought[]> = {
  greeting: [
    { agent: "liaison", role_ar: "وكيل التواصل", thought: "أرحّب بالمزارع وأهيّئ الجلسة للمساعدة...", is_status: false },
  ],
  province_overview: [
    { agent: "weather",  role_ar: "وكيل الطقس",    thought: "أقرأ بيانات المحطات الجوية الإقليمية ومؤشرات الرياح...", is_status: false },
    { agent: "soil",     role_ar: "وكيل التربة",    thought: "أحلل نسب رطوبة التربة ومستويات pH ومؤشرات الخصوبة...", is_status: false },
    { agent: "market",   role_ar: "وكيل السوق",     thought: "أرصد أسعار المحاصيل الرئيسية وحجم التداول في الأسواق...", is_status: false },
    { agent: "system",   role_ar: "المنسق الزراعي", thought: "تجميع التقرير الزراعي الشامل للمحافظة المحددة...", is_status: true },
  ],
  weather: [
    { agent: "weather",  role_ar: "وكيل الطقس",    thought: "أربط مع محطات القياس الجوي الإقليمية...", is_status: false },
    { agent: "weather",  role_ar: "وكيل الطقس",    thought: "أحسب درجات الحرارة القصوى والدنيا ومعدلات الهطول...", is_status: false },
    { agent: "system",   role_ar: "النظام",          thought: "إعداد توقعات الطقس الزراعي للأيام الثلاثة القادمة...", is_status: true },
  ],
  market: [
    { agent: "market",   role_ar: "وكيل السوق",     thought: "أفحص أسعار الجملة في أسواق دمشق وحلب والحسكة...", is_status: false },
    { agent: "market",   role_ar: "وكيل السوق",     thought: "أحلل اتجاهات الأسعار خلال الأسابيع السبعة الماضية...", is_status: false },
    { agent: "system",   role_ar: "النظام",          thought: "صياغة توصية تسويقية بناءً على بيانات العرض والطلب...", is_status: true },
  ],
  irrigation: [
    { agent: "soil",     role_ar: "وكيل التربة",    thought: "أقرأ بيانات مستشعرات رطوبة التربة في الحقول...", is_status: false },
    { agent: "soil",     role_ar: "وكيل التربة",    thought: "أحسب الاحتياجات المائية اليومية بدلالة الطقس والمحصول...", is_status: false },
    { agent: "system",   role_ar: "النظام",          thought: "إعداد جدول الري الآلي المُحسَّن...", is_status: true },
  ],
  disease: [
    { agent: "disease",  role_ar: "كاشف الأمراض",  thought: "أبحث في قاعدة بيانات AVRDC للأمراض النباتية المتطابقة...", is_status: false },
    { agent: "disease",  role_ar: "كاشف الأمراض",  thought: "أحلل الظروف البيئية المواتية لنمو الممرض...", is_status: false },
    { agent: "system",   role_ar: "النظام",          thought: "إعداد بروتوكول العلاج الكيميائي والعضوي...", is_status: true },
  ],
  trends: [
    { agent: "market",   role_ar: "وكيل السوق",     thought: "أحلل أنماط الزراعة الإقليمية وبيانات التسجيل الزراعي...", is_status: false },
    { agent: "market",   role_ar: "وكيل السوق",     thought: "أكشف عن مخاطر تشبّع العرض في المحاصيل المُزدحمة...", is_status: false },
    { agent: "system",   role_ar: "النظام",          thought: "صياغة توصية تنويع المحاصيل لهذا الموسم...", is_status: true },
  ],
  emergency: [
    { agent: "disease",  role_ar: "كاشف الأمراض",  thought: "تفعيل بروتوكول الطوارئ — أولوية قصوى...", is_status: false },
    { agent: "weather",  role_ar: "وكيل الطقس",    thought: "مراجعة الظروف الجوية المرتبطة بالبلاغ الطارئ...", is_status: false },
    { agent: "system",   role_ar: "مركز العمليات",  thought: "تجميع استجابة طارئة فورية...", is_status: true },
  ],
  general: [
    { agent: "system",   role_ar: "المساعد الزراعي", thought: "أعالج استفسارك وأبحث في قاعدة المعرفة الزراعية...", is_status: false },
    { agent: "system",   role_ar: "النظام",          thought: "جارٍ تجميع أفضل إجابة متاحة...", is_status: true },
  ],
};

// ── Dynamic value helpers ───────────────────────────────────────────────

function jitter(base: number, range: number): number {
  return Math.round(base + (Math.random() * range * 2 - range));
}

function jitterF(base: number, range: number, decimals = 1): number {
  const v = base + (Math.random() * range * 2 - range);
  return parseFloat(v.toFixed(decimals));
}

// Province-specific openers — feel alive, not templated
const PROVINCE_OPENERS: Record<string, string[]> = {
  "حلب": [
    "بناءً على آخر البيانات الواردة من محافظة حلب،",
    "الوضع الزراعي في حلب يُظهر",
    "وكيل الطقس يرصد في حلب:",
  ],
  "حمص": [
    "بناءً على الوضع الراهن في محافظة حمص،",
    "التحليل الزراعي لحمص يُشير إلى",
    "من مركز البيانات في حمص:",
  ],
  "دمشق": [
    "بناءً على المعطيات الحالية في دمشق وريفها،",
    "الوضع الزراعي في منطقة دمشق يُبيّن",
    "وكيل السوق يرصد في الغوطة:",
  ],
  "الحسكة": [
    "بناءً على بيانات الموسم الحالي في الحسكة،",
    "سلة سوريا الغذائية — الحسكة — تُظهر:",
    "المنطقة الأولى في إنتاج القمح السوري تُشير إلى",
  ],
  "دير الزور": [
    "بناءً على البيانات الفراتية في دير الزور،",
    "وكيل التربة يُحلل بيانات ضفاف الفرات:",
    "الوضع الزراعي في دير الزور يُظهر",
  ],
  "إدلب": [
    "بناءً على الوضع الراهن في محافظة إدلب،",
    "بساتين الزيتون في إدلب تُشير إلى",
    "التحليل الزراعي لإدلب يُبيّن:",
  ],
  "اللاذقية": [
    "بناءً على البيانات الساحلية في اللاذقية،",
    "وكيل الطقس يرصد الرطوبة في اللاذقية:",
    "الوضع الساحلي الزراعي في اللاذقية يُشير إلى",
  ],
};

function provinceOpener(province: string | null): string {
  if (!province) return "بناءً على البيانات الزراعية المتاحة،";
  const opts = PROVINCE_OPENERS[province];
  if (!opts) return `بناءً على الوضع الراهن في محافظة ${province}،`;
  return opts[Math.floor(Math.random() * opts.length)];
}

// ── Context-aware response prefix ──────────────────────────────────────

function buildContextPrefix(ctx: UserContext): string {
  if (!ctx.fields?.length && !ctx.active_crops?.length) return "";
  const lines: string[] = ["بناءً على بيانات حقولك المسجلة:"];
  ctx.fields?.slice(0, 3).forEach((f) => {
    lines.push(`• ${f.nameAr} (${f.provinceAr}) — ${f.cropAr}، ${f.areaHa} هكتار`);
  });
  return lines.join("\n") + "\n\n";
}

// ── Reply builders (dynamic + province-specific) ─────────────────────────

function buildProvinceOverview(p: string, profile: ProvinceProfile, ctx: UserContext): { reply: string; viz: VisualizationData } {
  const ctxPrefix = buildContextPrefix(ctx);
  const opener    = provinceOpener(p);

  // Randomize live values within realistic bounds
  const temp      = jitter(profile.tempC, 2);
  const humidity  = jitter(profile.humidityPct, 5);
  const wind      = jitter(profile.windKmh, 4);
  const moisture  = jitter(68, 8);
  const m3        = jitter(profile.irrigationM3, 20);
  const prodScore = jitter(profile.productionScore, 7);
  const riskScore = profile.threat ? jitter(65, 8) : jitter(18, 6);

  const threatSection = profile.threat
    ? `\n\n⚠ **تحذير وكيل الأمراض:** ${profile.threat}`
    : "";

  const reply = `${ctxPrefix}${opener} إليك التقرير الزراعي الشامل.

**الطقس الزراعي اليوم — ${p}:**
درجة الحرارة ${temp}°م · ${profile.weatherAr} · رطوبة ${humidity}% · رياح ${wind} كم/س
الغد: ${temp + jitter(2, 1)}°م — ${humidity > 70 ? "رطوبة مرتفعة، انتبه لتهوية المحاصيل" : "مستقر مع ارتفاع طفيف في الحرارة"}

**المحاصيل الرئيسية في ${p}:**
${profile.mainCrops} — المحصول الأبرز: **${profile.topCrop}**
${profile.season}

**التربة والري:**
${profile.soilNote}
رطوبة التربة الحالية: **${moisture}%** · الاحتياج اليومي: **${m3} م³/هكتار**

**السوق والتسويق:**
${profile.marketNote}
${profile.marketPrice}${threatSection}

**توصية وكيل التربة:** ${moisture < 50 ? "مستوى الرطوبة دون المعدل — ابدأ ري استباقي اليوم." : "الرطوبة ضمن النطاق المثالي، حافظ على الجدول الحالي."}`;

  const irrigReadiness = Math.min(100, Math.round(m3 / 4));

  const viz: VisualizationData = {
    type: "bar_chart",
    title_ar: `مؤشر الأداء الزراعي — ${p}`,
    bars: [
      { label_ar: "مؤشر الإنتاج", value: prodScore,    color: prodScore > 70 ? "emerald" : prodScore > 45 ? "amber" : "red" },
      { label_ar: "جاهزية الري",  value: irrigReadiness, color: irrigReadiness > 60 ? "emerald" : "amber" },
      { label_ar: "درجة الخطر",   value: riskScore,    color: profile.threat ? "red" : "emerald" },
    ],
    source_ar: `وكلاء الطقس والتربة والسوق · ${p} · بيانات حية`,
  };

  return { reply, viz };
}

function buildWeatherReply(province: string | null, profile: ProvinceProfile | null): string {
  const p    = province ?? "سوريا";
  const t    = jitter(profile?.tempC ?? 28, 2);
  const h    = jitter(profile?.humidityPct ?? 45, 4);
  const wind = jitter(profile?.windKmh ?? 15, 3);
  const w    = profile?.weatherAr ?? "متقلب موسمياً";
  const opener = provinceOpener(province);

  const irrigAdvice = t > 34
    ? "الحرارة الشديدة تستدعي ري فجري (05:00–06:30) وتجنب أي ري نهاري تاماً."
    : h > 70
      ? "الرطوبة المرتفعة تُقلل الاحتياج للري — خفّض الجرعة 20% اليوم."
      : "ري صباحي مبكر (06:00–07:30) مناسب، وتجنب الري في ذروة الظهيرة.";

  return `${opener} التقرير المناخي الزراعي لـ${p}.

**الطقس اليوم:**
${t}°م · ${w} · رطوبة ${h}% · رياح ${wind} كم/س

**التوقعات الثلاثية:**
• **اليوم:** ${t}°م · ${w}
• **الغد:** ${t + jitter(2, 1)}°م · ${h > 65 ? "رطوبة عالية، احتمال ضباب صباحي" : "مشمس جزئياً مع ارتفاع طفيف"}
• **بعد غد:** ${t + jitter(3, 2)}°م · ${t + 3 > 35 ? "موجة حر متوقعة — تأهب مبكر" : "جاف مع احتمال غيوم متفرقة"}

**التأثير الزراعي:**
${irrigAdvice}
مؤشر إجهاد الحرارة: **${t > 36 ? "مرتفع — خطر" : t > 30 ? "متوسط" : "منخفض"}**`;
}

function buildMarketReply(crop: string | null, province: string | null, profile: ProvinceProfile | null): string {
  const c      = crop ?? "القمح";
  const p      = province ?? "سوريا";
  const opener = provinceOpener(province);
  const note   = profile?.marketNote ?? "السوق في حالة نشاط معتدل";
  const price  = profile?.marketPrice ?? "420 ل.س/كغ";
  const weekChg = jitterF(3.7, 2);
  const fwdChg  = jitterF(2.1, 1.5);

  return `${opener} تقرير السوق لمحصول ${c}.

**السعر الحالي في ${p}:** ${price}
${note}

**حركة الأسبوع الماضي:** ${weekChg > 0 ? "+" : ""}${weekChg}% — ${weekChg > 3 ? "ارتفاع ملحوظ يعكس ضغط الطلب" : "حركة هادئة ضمن النطاق الموسمي"}
**توقعات الأسبوع القادم:** ${fwdChg > 0 ? "+" : ""}${fwdChg}% — ${fwdChg > 1.5 ? "الاتجاه صعودي مع اقتراب موسم الحصاد" : "استقرار نسبي متوقع"}

**توصية وكيل السوق:** ${weekChg > 4
    ? "النافذة التسويقية مثالية الآن — تفاوض على عقود بيع فورية."
    : "يُفضَّل الانتظار أسبوعاً إضافياً وانتهاز ذروة الطلب."
}`;
}

function buildIrrigationReply(crop: string | null, province: string | null, profile: ProvinceProfile | null): string {
  const c       = crop ?? "القمح";
  const m3Base  = profile?.irrigationM3 ?? 225;
  const m3      = jitter(m3Base, 18);
  const main    = Math.round(m3 * 0.6);
  const comp    = Math.round(m3 * 0.4);
  const opener  = provinceOpener(province);
  const moisture = jitter(62, 10);
  const heatHigh = (profile?.tempC ?? 28) > 34;

  return `${opener} خطة الري المُحسَّبة لمحصول ${c}${province ? " في " + province : ""}.

**الاحتياج اليومي المحسوب:** ${m3} م³/هكتار
رطوبة التربة الحالية: **${moisture}%** ${moisture < 50 ? "— منخفضة، ري فوري مطلوب" : moisture > 75 ? "— مرتفعة، أخّر الري" : "— ضمن النطاق المثالي"}

**جدول الري الموصى به:**
• **06:00 صباحاً** — الري الرئيسي · ${main} م³ · أمثل وقت لامتصاص الجذور
• **12:00 ظهراً** — توقف إجباري · ${heatHigh ? "حرارة 35°م+ تُبخّر 40% من المياه" : "تبخر مفرط في الذروة"}
• **18:30 مساءً** — الري التكميلي · ${comp} م³ · ${heatHigh ? "تبريد التربة ضروري اليوم" : "تبريد وترطيب آمن"}

**تنبيه وكيل التربة:** ${heatHigh
    ? "موجة الحر الحالية تستدعي زيادة الجرعة 15% وإضافة مُلطّف حموضة للمياه."
    : moisture < 50
      ? "المستوى دون المعدل — ابدأ دورة الري الاستباقية اليوم."
      : "المستويات مثالية — حافظ على الجدول الحالي."
}`;
}

function buildDiseaseReply(msg: string, province: string | null): string {
  const isRust    = /صدأ|rust/i.test(msg);
  const isBlight  = /لفح|blight/i.test(msg);
  const isPowdery = /بياض دقيق|powdery/i.test(msg);
  const opener    = provinceOpener(province);
  const risk      = jitter(78, 6);
  const conf      = jitter(84, 5);

  if (isRust) return `${opener} كاشف الأمراض رصد علامات صدأ القمح الأصفر.

**تشخيص: صدأ القمح الأصفر** (Puccinia striiformis)
**مستوى الخطر:** ${risk}% · ثقة التشخيص ${conf}%

**بروتوكول العلاج الفوري${province ? " — " + province : ""}:**
• **كيميائي:** Propiconazole 25% EC — رش ${jitterF(0.5, 0.05)} لتر/دونم، كل 14 يوماً
• **عضوي:** مستخلص الثوم المخفف + Bacillus subtilis — رش وقائي كل أسبوع

**توصية عاجلة:** ابدأ العلاج خلال 48 ساعة. عزل المناطق المُصابة فوراً.`;

  if (isBlight) return `${opener} كاشف الأمراض يُشير إلى مؤشرات اللفحة المتأخرة.

**تشخيص: اللفحة المتأخرة** (Phytophthora infestans)
**مستوى الخطر:** ${jitter(65, 5)}% · ثقة التشخيص ${jitter(77, 4)}%

**بروتوكول العلاج:**
• **كيميائي:** Mancozeb 80% WP — رش ${jitterF(2.0, 0.2)} كغ/دونم
• **عضوي:** مستخلص النيم 2% + كاولين 5% كطبقة وقائية`;

  if (isPowdery) return `${opener} تحليل الأعراض يُشير إلى البياض الدقيقي.

**تشخيص: البياض الدقيقي** (Erysiphe graminis)
**مستوى الخطر:** ${jitter(42, 5)}% · ثقة التشخيص ${jitter(80, 4)}%

**بروتوكول العلاج:**
• **كيميائي:** Tebuconazole 25% EW — رش ${jitterF(0.4, 0.05)} لتر/دونم
• **عضوي:** بيكربونات الصوديوم 1% + كبريت 80% WP`;

  return `${opener} كاشف الأمراض يُرصد نشاطاً غير طبيعي.

**إجراءات وقائية فورية:**
• افحص الأوراق السفلية بحثاً عن بقع بودرية أو صدئية أو بنية
• قلّل الرطوبة الورقية وتجنب الري الرأسي المساء
• سجّل موقع الإصابة وأخبر وكيل الأمراض بالتفاصيل

كاشف الأمراض سيُرسل تنبيهاً نهائياً فور اكتمال التحليل.`;
}

function buildTrendsReply(province: string | null): string {
  const p       = province ?? "سوريا";
  const opener  = provinceOpener(province);
  const wheat   = jitter(42, 5);
  const vegs    = jitter(22, 4);
  const cotton  = jitter(18, 4);
  const other   = 100 - wheat - vegs - cotton;

  return `${opener} تحليل أنماط الزراعة الإقليمية لموسم 2026.

**ما يزرعه مزارعو ${p} هذا الموسم:**
• **القمح:** ${wheat}% من المساحات ${wheat > 45 ? "— خطر تشبّع السوق عند الحصاد، تحذير" : "— نسبة صحية"}
• **الخضراوات:** ${vegs}% — ${vegs > 25 ? "ارتفاع ملحوظ في عرض الطماطم والخيار" : "نسبة متوازنة"}
• **القطن والمحاصيل الزيتية:** ${cotton}%
• **محاصيل أخرى:** ${other}%

**تحذير وكيل السوق:** ${wheat > 44
    ? `المحافظة تُجاوزت نسبة القمح الآمنة — تنويع جزء من المساحة في ${p} ضروري لتجنب ضغط الأسعار.`
    : "التوزيع المحصولي معقول مع فرصة للتوسع في المحاصيل ذات الهامش الأعلى."
}

**محاصيل الفرصة الموسمية:** السمسم والفستق الحلبي — هامش ربح 40% أعلى من القمح مع طلب تصديري متنامٍ.`;
}

function buildEmergencyReply(msg: string, province: string | null): string {
  const p = province ?? "منطقتك";
  return `**[استجابة طارئة] — بروتوكول الطوارئ الزراعية · ${p}**

بلاغك الطارئ وصل ووُضع على رأس الأولويات. جميع الوكلاء في وضع تأهب.

**الإجراءات الفورية:**
1. **توثيق:** التقط صوراً واضحة للأضرار بإضاءة جيدة
2. **عزل:** امنع الوصول الفوري إلى المنطقة المُصابة
3. **إبلاغ:** تواصل مع مديرية الزراعة في ${p} (+963-XX-XXXXXX)
4. **حفظ العينات:** احتفظ بعينات نباتية مُبردة للتحليل المختبري

**تقدير وكيل الطوارئ:** ${/آفة|مرض|صدأ/.test(msg)
    ? "مؤشرات إصابة مرضية — كاشف الأمراض يُحلل البيانات الآن."
    : /جفاف|ري|مياه/.test(msg)
      ? "أزمة مائية محتملة — وكيل التربة يُحضّر خطة طوارئ الري."
      : "جارٍ تحليل نوع الطارئ وتحديد الوكيل المختص..."
}`;
}

function buildGreetingReply(ctx: UserContext): string {
  const ctxPrefix = buildContextPrefix(ctx);
  return `${ctxPrefix}أهلاً وسهلاً بك! 🌿 أنا مساعدك الزراعي الذكي في أغرو-سوريا، جاهز لخدمتك في كل ما يخص أرضك ومحصولك.

كيف أقدر أساعدك اليوم؟ تقدر تسألني عن:
• **الطقس الزراعي** وتوقعاته القريبة
• **خطط الري** المُحسَّبة لمحصولك
• **أسعار الأسواق** وأفضل وقت للبيع
• **تشخيص الأمراض** والوقاية منها

تفضّل، شو بتحب نبلّش فيه؟`;
}

function buildGeneralReply(msg: string, province: string | null, crop: string | null, ctx: UserContext): string {
  const ctxPrefix = buildContextPrefix(ctx);
  const opener    = province ? provinceOpener(province) + " " : "";
  const cNote     = crop ? `محصول ${crop}` : "";
  const focus     = [province, cNote].filter(Boolean).join(" · ");

  return `${ctxPrefix}${opener}المساعد الزراعي الوطني الذكي جاهز${focus ? ` للإجابة حول ${focus}` : ""}.

أستطيع مساعدتك فوراً في:
• **الطقس الزراعي** — توقعات ثلاثية تؤثر مباشرة على قراراتك
• **خطط الري** — جداول مُحسَّبة آلياً تُقلل الهدر 30%
• **أسعار الأسواق** — رصد لحظي وتوصيات توقيت البيع
• **تشخيص الأمراض** — كشف مبكر قبل انتشار الإصابة

**جرّب:** اضغط على أي محافظة في الخريطة للحصول على تقرير زراعي شامل فوري.`;
}

// ── Main response builder ───────────────────────────────────────────────

function buildLocalResponse(req: ChatRequest): ChatResponse {
  console.log("[chat] falling to templates");
  const msg    = req.message;
  const intent = detectIntent(msg);
  const pName  = detectProvince(msg);
  const crop   = detectCrop(msg);
  const ctx    = req.user_context ?? {};
  const profile = pName ? PROVINCES[pName] : null;

  let reply: string;
  let viz: VisualizationData | null = null;

  switch (intent) {
    case "greeting":
      reply = buildGreetingReply(ctx);
      break;
    case "province_overview": {
      const result = buildProvinceOverview(
        pName ?? "سوريا",
        profile ?? PROVINCES["حلب"],
        ctx,
      );
      reply = result.reply;
      viz   = result.viz;
      break;
    }
    case "weather":
      reply = buildWeatherReply(pName, profile);
      break;
    case "market":
      reply = buildMarketReply(crop, pName, profile);
      break;
    case "irrigation":
      reply = buildIrrigationReply(crop, pName, profile);
      break;
    case "disease":
      reply = buildDiseaseReply(msg, pName);
      break;
    case "trends":
      reply = buildTrendsReply(pName);
      break;
    case "emergency":
      reply = buildEmergencyReply(msg, pName);
      break;
    default:
      reply = buildGeneralReply(msg, pName, crop, ctx);
  }

  return {
    reply,
    session_id: req.session_id ?? crypto.randomUUID(),
    chain_of_thought: THOUGHTS[intent],
    tokens_used: null,
    visualization: viz,
  };
}

// ── Route handler ───────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  console.log("[chat] handler called, GROQ_API_KEY present:", !!process.env.GROQ_API_KEY);
  let body: ChatRequest;
  try {
    body = (await req.json()) as ChatRequest;
  } catch {
    return NextResponse.json({ error: "طلب غير صالح" }, { status: 400 });
  }

  // 1. Primary LLM path — Groq (real, dynamic replies)
  const llm = await callGroq(body);
  if (llm) return NextResponse.json(llm);

  // 2. Local template engine — last-resort fallback only (missing key / error)
  const response = buildLocalResponse(body);
  return NextResponse.json(response);
}
