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
// The ONLY reply path. Calls Groq via its OpenAI-compatible endpoint when
// GROQ_API_KEY is present; on any failure returns null and the handler
// replies with a simple Arabic error message (no templates, no fallback).

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
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return null;
  if (!req.message?.trim() && !req.image_base64) return null; // nothing to answer

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
    if (!res.ok) return null; // quota / auth / server error

    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };

    const reply = (data.choices?.[0]?.message?.content ?? "").trim();
    if (!reply) return null; // empty

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
  } catch {
    return null;
  }
}

// ── Route handler ───────────────────────────────────────────────────────
// Groq, or a simple Arabic error. No templates, no intent detection.

export async function POST(req: NextRequest) {
  let body: ChatRequest;
  try {
    body = (await req.json()) as ChatRequest;
  } catch {
    return NextResponse.json({ error: "طلب غير صالح" }, { status: 400 });
  }

  const reply = await callGroq(body);
  if (reply) return NextResponse.json(reply);

  // Groq unavailable (missing key / quota / network / empty response).
  const errorResponse: ChatResponse = {
    reply: "عذراً، تعذّر تجهيز الرد حالياً. يرجى المحاولة مرة أخرى بعد قليل.",
    session_id: body.session_id ?? crypto.randomUUID(),
    chain_of_thought: [],
    tokens_used: null,
    visualization: null,
  };
  return NextResponse.json(errorResponse);
}
