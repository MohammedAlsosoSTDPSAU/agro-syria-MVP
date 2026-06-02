import { GoogleGenerativeAI, Content, Part } from "@google/generative-ai";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

/* ─── System prompt ──────────────────────────────────────────────────── */
const SYSTEM_PROMPT = `أنت "وكيل أغرو-سيريا"، خبير زراعي متخصص في الزراعة السورية لعام 2026.

## هويتك وخبرتك
- متخصص في المحاصيل السورية وأصنافها المحلية (شام 1، دير الزور 22، بطيري...)
- تعرف المناخ الخاص بكل محافظة من المحافظات الـ14
- خبير في تقنيات الري وترشيد المياه في ظروف الجفاف السوري
- ملم بأسواق المحاصيل السورية وتوقيت البيع الأمثل

## أسلوب التواصل (مهم جداً)
- كن حوارياً (Conversational) كخبير بشري ودود — وليس تقنياً جامداً
- لا تكرر بيانات المزارع في بداية كل رد. استخدم البيانات (المحافظة، المحصول، الطقس) فقط للإجابة على سؤال المستخدم بذكاء وبشكل طبيعي
- إذا قال المستخدم "كيفك" أو "مرحبا"، رد كصديق خبير: "أهلا بك خي، أنا بخير وعم راقبلك حقل القمح بحمص، الأمور ممتازة اليوم" — اربط التحية بحالة حقله الفعلية
- لا تعرض قوائم الخدمات (الطقس، الري، الأسعار) إلا إذا طلب المستخدم المساعدة صراحةً
- أجب دائماً بالعربية — اللهجة الشامية أو الفصحى البسيطة مناسبة
- كن عملياً وتحديداً عند تقديم نصيحة — لكن ابدأ بجملة بشرية طبيعية وليس بقائمة
- احتفظ بالإجابات مختصرة ومفيدة (2-4 فقرات كحد أقصى)
- استخدم الأرقام الإنجليزية (123) مع الوحدات العربية

## السياق الزمني والموسمي
- اليوم 30 مايو 2026 — أواخر الربيع، اقتراب الانقلاب الصيفي
- الخمسينية في آخر أيامها (3 أيام متبقية)
- موسم حصاد القمح والشعير في أوجه في شمال سوريا
- بدء طور إنبات القطن في المناطق الشرقية
- الزيتون في مرحلة الإزهار في الساحل والمنطقة الوسطى

## مجالات الخبرة
1. جدولة الري وحساب التبخر-النتح (ET₀) وترشيد المياه
2. تشخيص أمراض المحاصيل ومكافحة الآفات (المكافحة المتكاملة)
3. برامج التسميد وصحة التربة
4. توقيت البيع وأسعار السوق
5. إدارة المخاطر المناخية في الظروف السورية
6. الأصناف المعتمدة من الهيئة العامة للبحوث العلمية الزراعية (GCSAR)

إذا لم تعرف إجابة محددة، قل ذلك بصراحة وقدّم بديلاً مفيداً.`;

/* ─── Types ───────────────────────────────────────────────────────────── */
interface AgroContext {
  province?: string;
  crop?: string;
  cropArea?: number;
  temperature?: number;
  humidity?: number;
  windSpeed?: number;
  precipitation?: number;
  fields?: Array<{ name?: string; crop?: string; area?: number }>;
}

type ImageMediaType = "image/jpeg" | "image/png" | "image/webp" | "image/gif";

interface ChatBody {
  message: string;
  history?: Array<{ role: "user" | "assistant"; text: string }>;
  context?: AgroContext;
  image_base64?: string;
  image_media_type?: ImageMediaType;
}

/* ─── Build context string injected into user turn ───────────────────── */
function buildContextBlock(ctx: AgroContext): string {
  if (!ctx || Object.keys(ctx).length === 0) return "";
  const lines: string[] = ["[سياق المزارع الحالي]"];
  if (ctx.province) lines.push(`المحافظة الجغرافية: ${ctx.province}`);
  if (ctx.crop) lines.push(`المحصول المستهدف: ${ctx.crop}`);
  if (ctx.cropArea) lines.push(`المساحة الإجمالية: ${ctx.cropArea} دونم`);
  if (ctx.temperature) lines.push(`درجة الحرارة الحالية: ${ctx.temperature}°م`);
  if (ctx.humidity) lines.push(`معدل الرطوبة: ${ctx.humidity}%`);
  if (ctx.windSpeed) lines.push(`سرعة الرياح: ${ctx.windSpeed} كم/س`);
  if (ctx.precipitation != null)
    lines.push(`احتمالية هطول الأمطار: ${ctx.precipitation}%`);
  if (ctx.fields?.length) {
    const fieldList = ctx.fields
      .slice(0, 3)
      .map((f) => `${f.name ?? "حقل"} (${f.crop ?? "-"}، ${f.area ?? "?"} د)`)
      .join("، ");
    lines.push(`توزيع الحقول النشطة: ${fieldList}`);
  }
  return lines.join("\n") + "\n\n";
}

/* ─── SSE helpers ─────────────────────────────────────────────────────── */
const enc = new TextEncoder();
function sseChunk(text: string): Uint8Array {
  return enc.encode(`data: ${JSON.stringify({ type: "text", text })}\n\n`);
}
function sseDone(): Uint8Array {
  return enc.encode("data: [DONE]\n\n");
}
function sseError(msg: string): Uint8Array {
  return enc.encode(
    `data: ${JSON.stringify({ type: "error", text: msg })}\n\n`,
  );
}

// دالة مساعدة لتحويل الـ base64 إلى بنية أجزاء متعدد الوسائط المتوافقة مع جوجل
function fileToGenerativePart(base64Str: string, mimeType: string): Part {
  return {
    inlineData: {
      data: base64Str,
      mimeType: mimeType,
    },
  };
}

/* ─── Route handler ───────────────────────────────────────────────────── */
export async function POST(req: NextRequest) {
  const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "GOOGLE_GEMINI_API_KEY not configured — see .env.local" },
      { status: 503 },
    );
  }

  let body: ChatBody;
  try {
    body = (await req.json()) as ChatBody;
  } catch {
    return NextResponse.json({ error: "طلب غير صالح" }, { status: 400 });
  }

  const {
    message,
    history = [],
    context = {},
    image_base64,
    image_media_type,
  } = body;

  // إعداد كائن الاتصال الأساسي بجوجل
  const genAI = new GoogleGenerativeAI(apiKey);

  // نستخدم gemini-2.0-flash لسرعة الاستجابة اللحظية ودعم تحليل الصور (تشخيص أمراض الأوراق) — وهو الأنسب للديمو الحية
  // ملاحظة: gemini-1.5-flash لم يعد مدعوماً (404)، و gemini-2.5-flash يرفض المشروع (403). gemini-2.0-flash متاح
  // لكنه يتطلب تفعيل الفوترة على مشروع Google AI (حصة الطبقة المجانية = 0 حالياً → خطأ 429)
  const model = genAI.getGenerativeModel({
    model: "gemini-2.0-flash",
    systemInstruction: SYSTEM_PROMPT,
    generationConfig: {
      maxOutputTokens: 1024,
      temperature: 0.3, // للحفاظ على دقة التوصيات الزراعية ومنع الهلوسة البرمجية
    },
  });

  // بناء تاريخ المحادثة متوافقاً مع هيكلية أدوار Gemini
  const formattedHistory: Content[] = history.map(
    (h): Content => ({
      role: h.role === "assistant" ? "model" : "user",
      parts: [{ text: h.text }],
    }),
  );

  // معالجة الرسالة الأخيرة المدمج بها السياق الحالي
  const contextBlock = buildContextBlock(context);
  const currentMessageParts: Part[] = [];

  // إذا تم رفع صورة (كفحص مرض ورقة شجر)، يتم حقنها فوراً كجزء من محتويات الرسالة المتعددة
  if (image_base64) {
    const mime = image_media_type ?? "image/jpeg";
    currentMessageParts.push(fileToGenerativePart(image_base64, mime));
  }

  // إضافة النص والسياق
  currentMessageParts.push({ text: contextBlock + message });

  const stream = new ReadableStream({
    async start(controller) {
      try {
        // بدء جلسة المحادثة مسبقة التاريخ
        const chat = model.startChat({
          history: formattedHistory,
        });

        // إرسال الأجزاء الجديدة بشكل بث دفق متواصل (Streaming)
        const resultStream = await chat.sendMessageStream(currentMessageParts);

        for await (const chunk of resultStream.stream) {
          const chunkText = chunk.text();
          if (chunkText) {
            controller.enqueue(sseChunk(chunkText));
          }
        }
        controller.enqueue(sseDone());
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "خطأ غير متوقع في محرك جوجل";
        console.error("[/api/ai/chat] Gemini stream error:", err);
        controller.enqueue(sseError(`عذراً، حدث خطأ تواصل ذكي: ${msg}`));
        controller.enqueue(sseDone());
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
