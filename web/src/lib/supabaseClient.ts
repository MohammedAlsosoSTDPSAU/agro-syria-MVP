"use client";

/**
 * Supabase browser client (Next.js 16 App Router).
 *
 * Initialized from public env vars:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY
 *
 * SAFE BY DESIGN: if the env vars are not set (e.g. the current MVP/demo
 * deployment), `isSupabaseConfigured` is false and `getSupabase()` returns
 * null — callers then fall back to localStorage. Nothing throws at import
 * time, so the existing UI keeps working until the project is wired.
 */

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** True only when both public env vars are present. */
export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

let _client: SupabaseClient<Database> | null = null;

/** Returns the singleton browser client, or null when Supabase isn't configured. */
export function getSupabase(): SupabaseClient<Database> | null {
  if (!isSupabaseConfigured) return null;
  if (typeof window === "undefined") return null; // browser-only client
  if (!_client) {
    _client = createBrowserClient<Database>(SUPABASE_URL as string, SUPABASE_ANON_KEY as string);
  }
  return _client;
}
