// Unified AI service — thin client over /api/agent/chat/stream (SSE).
// Used by AgentChat, Dashboard/Weather/Crops (one-shot insights), and
// CopilotWorkspace (which also wants live onThought updates).

import type { AgentThought, UserContext, VisualizationData } from "@/lib/api";

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

/* ─── Streaming chat (SSE over /api/agent/chat/stream) ───────────────── */

interface StreamChatDoneMeta {
  session_id: string;
  visualization?: VisualizationData | null;
}

export async function streamChat(
  message: string,
  options: {
    context?: AgroContext;
    history?: ChatHistoryItem[];
    image_base64?: string;
    image_media_type?: "image/jpeg" | "image/png" | "image/webp";
    session_id?: string;
    user_context?: UserContext;
    onChunk: (text: string) => void;
    onThought?: (thought: AgentThought) => void;
    onDone: (meta?: StreamChatDoneMeta) => void;
    onError: (msg: string) => void;
    signal?: AbortSignal;
  }
): Promise<void> {
  const { image_base64, session_id, user_context, onChunk, onThought, onDone, onError, signal } = options;

  let res: Response;
  try {
    res = await fetch("/api/agent/chat/stream", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, session_id, image_base64, user_context }),
      signal,
    });
  } catch (err) {
    if ((err as Error).name === "AbortError") return;
    console.error("[ai-service] fetch failed:", err);
    onError("تعذّر الاتصال بالخادم");
    return;
  }

  if (!res.ok || !res.body) {
    onError("خطأ في الخادم — جرّب مرة ثانية");
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let sepIdx: number;
      while ((sepIdx = buffer.indexOf("\n\n")) !== -1) {
        const rawEvent = buffer.slice(0, sepIdx);
        buffer = buffer.slice(sepIdx + 2);

        const line = rawEvent.split("\n").find((l) => l.startsWith("data:"));
        if (!line) continue;
        const jsonText = line.slice(5).trim();
        if (!jsonText) continue;

        let evt: Record<string, unknown>;
        try {
          evt = JSON.parse(jsonText);
        } catch {
          continue; // malformed chunk — skip rather than abort the whole stream
        }

        if (evt.type === "thought") {
          onThought?.(evt as unknown as AgentThought);
        } else if (evt.type === "final") {
          const reply = typeof evt.reply === "string" ? evt.reply : "";
          if (reply) onChunk(reply);
          onDone({
            session_id: (evt.session_id as string) ?? "",
            visualization: (evt.visualization as VisualizationData | null) ?? null,
          });
          return;
        } else if (evt.type === "error") {
          onError(typeof evt.message === "string" ? evt.message : "حدث خطأ أثناء المعالجة");
          return;
        }
      }
    }
    // Stream closed without a "final"/"error" event — treat as done with no reply.
    onDone();
  } catch (err) {
    if ((err as Error).name === "AbortError") return;
    console.error("[ai-service] stream read failed:", err);
    onError("انقطع الاتصال أثناء استقبال الرد");
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
