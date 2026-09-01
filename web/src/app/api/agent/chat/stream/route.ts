import { NextRequest } from "next/server";
import { DEGRADED_REPLY_AR, degradedServiceThought, type ChatRequest } from "../route";

// ── SSE proxy for the FastAPI streaming pipeline ─────────────────────────
// Relays FastAPI's /api/agent/chat/stream byte-for-byte to the browser — no
// buffering, no re-parsing here, just piping the ReadableStream through.
//
// If the initial connection to FastAPI fails (network error, or a non-2xx
// status before any bytes arrive), synthesizes an honest two-event SSE
// stream instead of calling a second, unconstrained LLM (see the sibling
// route's comment for why the old Groq fallback was removed entirely) — the
// frontend consumer never needs to know which case it is, since the event
// shape matches the real backend's exactly.

const SSE_HEADERS = {
  "Content-Type": "text/event-stream",
  "Cache-Control": "no-cache",
  "X-Accel-Buffering": "no",
} as const;

function sseLine(payload: Record<string, unknown>): string {
  return `data: ${JSON.stringify(payload)}\n\n`;
}

function degradedServiceStream(body: ChatRequest): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      const enc = new TextEncoder();
      controller.enqueue(enc.encode(sseLine({ type: "thought", ...degradedServiceThought() })));
      controller.enqueue(enc.encode(sseLine({
        type: "final",
        reply: DEGRADED_REPLY_AR,
        visualization: null,
        session_id: body.session_id ?? crypto.randomUUID(),
        intent: null,
        tool_used: null,
      })));
      controller.close();
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

  return new Response(degradedServiceStream(body), { headers: SSE_HEADERS });
}
