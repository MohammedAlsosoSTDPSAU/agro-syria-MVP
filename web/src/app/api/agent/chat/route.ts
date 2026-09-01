import { NextRequest, NextResponse } from "next/server";

// ── Shared types (mirror api.ts) ────────────────────────────────────────

export interface AgentThought {
  agent: string;
  role_ar: string;
  thought: string;
  is_status: boolean;
}

interface VisualizationData {
  type: "map" | "bar_chart";
  title_ar: string;
  points?: { lat: number; lng: number; label_ar: string; intensity: number }[];
  bars?: { label_ar: string; value: number; color: "emerald" | "amber" | "red" }[];
  source_ar?: string;
}

export interface ChatResponse {
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

export interface ChatRequest {
  message: string;
  session_id?: string;
  image_base64?: string;
  user_context?: UserContext;
}

// ── FastAPI (LangGraph + RAG pipeline) — tried first ────────────────────
// Proxies to the Python backend's real multi-agent pipeline when FASTAPI_URL
// is set and it responds successfully; on any failure returns null and the
// handler falls through to the direct Groq call below.

async function callFastAPI(body: ChatRequest): Promise<ChatResponse | null> {
  const url = process.env.FASTAPI_URL;
  if (!url) return null;

  try {
    const res = await fetch(`${url}/api/agent/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: body.message,
        session_id: body.session_id,
        image_base64: body.image_base64,
        user_context: body.user_context,
      }),
      signal: AbortSignal.timeout(25_000),
    });

    if (!res.ok) return null;
    const data = await res.json();
    if (!data.reply) return null;
    return data as ChatResponse;
  } catch {
    return null;
  }
}

// ── Degraded-service fallback — no LLM call ───────────────────────────────
// When FastAPI can't be reached, we used to fall through to a direct Groq
// call with its own system prompt. That prompt had none of the real
// backend's safety constraints (Bug 2's ungrounded-generation gate) and, in
// live testing, fabricated a specific fertilizer name and dosage. Duplicating
// the safety prompt into a second copy was rejected — this codebase has
// already seen what happens when two copies of the same logic drift apart.
// The fix is to remove the second LLM call entirely: an honest "service is
// busy" message with zero technical/agricultural content, not a second
// opinion from an unconstrained model.

export const DEGRADED_REPLY_AR =
  "عذراً، النظام مشغول مؤقتاً 🙏 — جرّب تبعت سؤالك تاني بعد شوي.";

export function degradedServiceThought(): AgentThought {
  return {
    agent: "system",
    role_ar: "النظام",
    thought: "تعذّر الوصول للخادم الرئيسي حالياً",
    is_status: true,
  };
}

// ── Route handler ───────────────────────────────────────────────────────
// FastAPI pipeline, or an honest degraded-service message — no second LLM.

export async function POST(req: NextRequest) {
  let body: ChatRequest;
  try {
    body = (await req.json()) as ChatRequest;
  } catch {
    return NextResponse.json({ error: "طلب غير صالح" }, { status: 400 });
  }

  const fastApiReply = await callFastAPI(body);
  if (fastApiReply) {
    return NextResponse.json(fastApiReply, { headers: { "X-AI-Backend": "fastapi" } });
  }

  const degradedResponse: ChatResponse = {
    reply: DEGRADED_REPLY_AR,
    session_id: body.session_id ?? crypto.randomUUID(),
    chain_of_thought: [degradedServiceThought()],
    tokens_used: null,
    visualization: null,
  };
  return NextResponse.json(degradedResponse, { headers: { "X-AI-Backend": "degraded" } });
}
