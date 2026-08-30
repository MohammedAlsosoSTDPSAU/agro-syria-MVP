import { NextRequest } from "next/server";
import { callGroq, type ChatRequest } from "../route";

// ── SSE proxy for the FastAPI streaming pipeline ─────────────────────────
// Relays FastAPI's /api/agent/chat/stream byte-for-byte to the browser — no
// buffering, no re-parsing here, just piping the ReadableStream through.
//
// If the initial connection to FastAPI fails (network error, or a non-2xx
// status before any bytes arrive), falls back to the existing callGroq(...)
// from the sibling route and synthesizes an equivalent two-event SSE stream
// (one "thought" using the same hardcoded synthesizer placeholder already
// used today, then one "final" with the Groq reply) — so the frontend
// consumer never needs to know which backend actually served the request.

const SSE_HEADERS = {
  "Content-Type": "text/event-stream",
  "Cache-Control": "no-cache",
  "X-Accel-Buffering": "no",
} as const;

function sseLine(payload: Record<string, unknown>): string {
  return `data: ${JSON.stringify(payload)}\n\n`;
}

function groqFallbackStream(body: ChatRequest): ReadableStream<Uint8Array> {
  return new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder();
      try {
        const groqReply = await callGroq(body);
        if (!groqReply) {
          controller.enqueue(enc.encode(sseLine({
            type: "error",
            message: "عذراً، تعذّر تجهيز الرد حالياً. يرجى المحاولة مرة أخرى بعد قليل.",
          })));
          controller.close();
          return;
        }

        const thought = groqReply.chain_of_thought[0];
        if (thought) {
          controller.enqueue(enc.encode(sseLine({ type: "thought", ...thought })));
        }

        controller.enqueue(enc.encode(sseLine({
          type: "final",
          reply: groqReply.reply,
          visualization: groqReply.visualization ?? null,
          session_id: groqReply.session_id,
        })));
        controller.close();
      } catch (err) {
        console.error("[chat/stream] groq fallback threw:", err);
        controller.enqueue(enc.encode(sseLine({
          type: "error",
          message: "عذراً، تعذّر تجهيز الرد حالياً. يرجى المحاولة مرة أخرى بعد قليل.",
        })));
        controller.close();
      }
    },
  });
}

export async function POST(req: NextRequest) {
  let body: ChatRequest;
  try {
    body = (await req.json()) as ChatRequest;
  } catch {
    return new Response(JSON.stringify({ error: "طلب غير صالح" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const url = process.env.FASTAPI_URL;
  if (url) {
    try {
      const upstream = await fetch(`${url}/api/agent/chat/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: body.message,
          session_id: body.session_id,
          image_base64: body.image_base64,
          user_context: body.user_context,
        }),
        // Streaming responses run longer than the one-shot 25s budget.
        signal: AbortSignal.timeout(60_000),
      });

      if (upstream.ok && upstream.body) {
        return new Response(upstream.body, { headers: SSE_HEADERS });
      }
    } catch {
      // Network error / timeout before any bytes arrived — fall through.
    }
  }

  return new Response(groqFallbackStream(body), { headers: SSE_HEADERS });
}
