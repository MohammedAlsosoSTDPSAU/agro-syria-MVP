/**
 * Agro-Syria API client
 *
 * Typed fetch wrapper for the FastAPI backend.
 * All functions throw on network error or non-2xx status so callers
 * can distinguish "offline" from "data error" with a single try/catch.
 */

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const DEFAULT_TIMEOUT_MS = 5_000;

// ── Response types (mirror app/schema/*.py exactly) ──────────────────

export interface HealthResponse {
  status: string;
  system: string;
  version: string;
  environment: string;
  message_ar: string;
}

export interface SoilReading {
  field_id: string;
  field_name_ar: string;
  moisture_pct: number;
  ph: number;
  nitrogen_level: string;
  phosphorus_level: string;
  depth_cm: number;
  agent_comment_ar: string;
}

export interface SoilResponse {
  readings: SoilReading[];
  average_moisture: number;
  system_note_ar: string;
}

// Context bridge — populated by حقولي / المحاصيل pages in future phases
export interface UserField {
  nameAr: string;
  cropAr: string;
  areaHa: number;
  provinceAr: string;
}

export interface UserContext {
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

export interface AgentThought {
  agent: string;
  role_ar: string;
  thought: string;
  is_status: boolean;
}

// ── Visualization types ───────────────────────────────────────────────

export interface VisualizationPoint {
  lat: number;
  lng: number;
  label_ar: string;
  intensity: number; // 0–1
}

export interface ChartBar {
  label_ar: string;
  value: number;
  color: "emerald" | "amber" | "red";
}

export interface VisualizationData {
  type: "map" | "bar_chart";
  title_ar: string;
  points?: VisualizationPoint[];
  bars?: ChartBar[];
  source_ar?: string;
}

export interface ChatResponse {
  reply: string;
  session_id: string;
  chain_of_thought: AgentThought[];
  tokens_used: number | null;
  visualization?: VisualizationData | null;
}

// ── Core fetcher ──────────────────────────────────────────────────────

async function apiFetch<T>(
  path: string,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
  init: RequestInit = {},
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${API_BASE}${path}`, {
      ...init,
      signal: controller.signal,
      headers: { Accept: "application/json", ...(init.headers as Record<string, string>) },
      cache: "no-store",
    });

    if (!res.ok) {
      throw new Error(`API ${res.status}: ${res.statusText} — ${path}`);
    }

    return res.json() as Promise<T>;
  } finally {
    clearTimeout(timer);
  }
}

// ── Public API functions ──────────────────────────────────────────────

export function fetchHealth(): Promise<HealthResponse> {
  return apiFetch<HealthResponse>("/api/health");
}

export function fetchSoilData(): Promise<SoilResponse> {
  return apiFetch<SoilResponse>("/api/fields/soil");
}

export async function sendChatMessage(req: ChatRequest): Promise<ChatResponse> {
  // Hits the Next.js API route (/api/agent/chat) which proxies to FastAPI
  // when FASTAPI_URL is set, or falls back to the built-in intelligence engine.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);
  try {
    const res = await fetch("/api/agent/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(req),
      signal: controller.signal,
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`Chat ${res.status}`);
    return res.json() as Promise<ChatResponse>;
  } finally {
    clearTimeout(timer);
  }
}
