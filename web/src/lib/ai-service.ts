// Unified AI service — thin client over /api/ai/chat
// Used by AgentChat (streaming) and Dashboard/Weather/Crops (one-shot insights)

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
    res = await fetch("/api/ai/chat", {
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

  // 503 = API key not configured
  if (res.status === 503) {
    console.error("[ai-service] /api/ai/chat returned 503 — GOOGLE_GEMINI_API_KEY missing");
    onError("__NO_KEY__");
    return;
  }

  if (!res.ok) {
    console.error("[ai-service] /api/ai/chat returned", res.status, res.statusText);
    onError("خطأ في الخادم — جرّب مرة ثانية");
    return;
  }

  const reader = res.body?.getReader();
  if (!reader) { onError("خطأ في القراءة"); return; }

  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const payload = line.slice(6).trim();
        if (payload === "[DONE]") { onDone(); return; }
        try {
          const parsed = JSON.parse(payload) as { type: string; text: string };
          if (parsed.type === "text")  onChunk(parsed.text);
          if (parsed.type === "error") onError(parsed.text);
        } catch {}
      }
    }
  } finally {
    reader.releaseLock();
    onDone();
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
