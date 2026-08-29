// Unified AI service — thin client over /api/agent/chat
// Used by AgentChat and Dashboard/Weather/Crops (one-shot insights).
// /api/agent/chat replies with a single JSON object (no SSE), so streamChat
// delivers the whole reply as one onChunk call rather than incremental chunks.

export interface AgroContext {
  province?: string;
  crop?: string;
  cropArea?: number;
  temperature?: number;
  humidity?: number;
  windSpeed?: number;
  precipitation?: number;
  fields?: Array<{ name?: string; crop?: string; area?: number }>;
}

export interface ChatHistoryItem {
  role: "user" | "assistant";
  text: string;
}

/* ─── Read user context from localStorage ────────────────────────────── */
export function buildContextFromStorage(): AgroContext {
  if (typeof window === "undefined") return {};
  const ctx: AgroContext = {};

  try {
    const settings = localStorage.getItem("agro_settings");
    if (settings) {
      const p = JSON.parse(settings) as { province?: string; region?: string };
      ctx.province = p.province ?? p.region;
    }
  } catch {}

  try {
    const cropCtx = localStorage.getItem("agro_crop_context");
    if (cropCtx) {
      const c = JSON.parse(cropCtx) as {
        cropId?: string; crop?: string; name?: string; cropName?: string;
        area?: number; region?: string;
      };
      ctx.crop = c.cropId ?? c.crop ?? c.name ?? c.cropName;
      if (c.area) ctx.cropArea = c.area;
      if (c.region && !ctx.province) ctx.province = c.region;
    }
  } catch {}

  try {
    const fields = localStorage.getItem("agro_fields");
    if (fields) {
      ctx.fields = (JSON.parse(fields) as Array<{ name?: string; crop?: string; area?: number }>)
        .slice(0, 3);
    }
  } catch {}

  return ctx;
}

/* ─── Streaming chat ─────────────────────────────────────────────────── */
export async function streamChat(
  message: string,
  options: {
    context?: AgroContext;
    history?: ChatHistoryItem[];
    image_base64?: string;
    image_media_type?: "image/jpeg" | "image/png" | "image/webp";
    onChunk: (text: string) => void;
    onDone: () => void;
    onError: (msg: string) => void;
    signal?: AbortSignal;
  }
): Promise<void> {
  const { context = {}, history = [], image_base64, image_media_type, onChunk, onDone, onError, signal } = options;

  let res: Response;
  try {
    res = await fetch("/api/agent/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, context, history, image_base64, image_media_type }),
      signal,
    });
  } catch (err) {
    if ((err as Error).name === "AbortError") return;
    console.error("[ai-service] fetch failed:", err);
    onError("تعذّر الاتصال بالخادم");
    return;
  }

  if (!res.ok) {
    console.error("[ai-service] /api/agent/chat returned", res.status, res.statusText);
    onError("خطأ في الخادم — جرّب مرة ثانية");
    return;
  }

  // /api/agent/chat replies with a single JSON object, not an SSE stream.
  try {
    const data = (await res.json()) as { reply?: string };
    const reply = data.reply ?? "";
    if (reply) onChunk(reply);
    onDone();
  } catch (err) {
    console.error("[ai-service] failed to parse /api/agent/chat response:", err);
    onError("خطأ في قراءة الرد");
  }
}

/* ─── One-shot insight (awaits full response) ────────────────────────── */
export async function getAgentInsight(
  prompt: string,
  context: AgroContext = {}
): Promise<string> {
  return new Promise((resolve) => {
    let full = "";
    streamChat(prompt, {
      context,
      onChunk: (text) => { full += text; },
      onDone:  () => resolve(full || "لا توجد بيانات متاحة حالياً"),
      onError: () => resolve(""),
    });
  });
}
