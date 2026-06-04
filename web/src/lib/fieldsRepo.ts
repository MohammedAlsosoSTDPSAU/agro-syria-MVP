"use client";

/**
 * Fields persistence repository — the single seam between the UI and storage.
 *
 * OFFLINE-FIRST strategy:
 *   • localStorage ("agro_fields") is always the fast local cache + offline source.
 *   • When Supabase is configured AND a user is signed in, the DB (table
 *     `agro_fields`, RLS-scoped to the user) becomes the source of truth and is
 *     mirrored back into the cache.
 *   • When Supabase is NOT configured (current demo deploy), everything runs on
 *     the cache exactly like before — no behaviour change, no UI break.
 *
 * This file is the foundation referenced in the P0 plan: migrating the page's
 * localStorage CRUD into real Supabase table references happens HERE, so the
 * page stays declarative (loadFields / saveField / deleteField / replaceAll).
 */

import { getSupabase, isSupabaseConfigured } from "./supabaseClient";
import { latLngToSvg } from "./geo";
import { migrateField, type Field } from "./fields";
import type { AgroFieldRow } from "./database.types";

export const FIELDS_STORAGE_KEY = "agro_fields";

// ── localStorage cache layer ────────────────────────────────────────────
export function readCache(): Field[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(FIELDS_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length) return parsed.map(migrateField);
  } catch { /* corrupt — ignore */ }
  return null;
}

export function writeCache(fields: Field[]): void {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(FIELDS_STORAGE_KEY, JSON.stringify(fields)); } catch { /* quota */ }
}

// ── DB row ⇄ front-end Field mapping ────────────────────────────────────
/** Deterministic uuid → 32-bit positive int, so the numeric-id UI keeps working. */
function hashId(uuid: string): number {
  let h = 0;
  for (let i = 0; i < uuid.length; i++) h = (Math.imul(31, h) + uuid.charCodeAt(i)) | 0;
  return Math.abs(h) || 1;
}

export function rowToField(row: AgroFieldRow): Field {
  const lat = row.latitude  ?? 34.8;
  const lng = row.longitude ?? 38.0;
  // migrateField fills derived fields (geoPin, stage from plantingDate, health, …).
  return migrateField({
    id: hashId(row.id),
    remoteId: row.id,
    name: row.name,
    crop: row.crop_type,
    province: row.province,
    areaHa: Number(row.area) || 0,
    soilType: row.soil_type ?? "طمية",
    plantingDate: row.planting_date ?? new Date().toISOString().slice(0, 10),
    latitude: lat,
    longitude: lng,
    geoPin: latLngToSvg(lat, lng),
  });
}

/** Extract the DB-persisted columns from a Field (Insert payload). */
export function fieldToInsert(field: Field, userId: string): Omit<AgroFieldRow, "id" | "created_at"> {
  return {
    user_id: userId,
    name: field.name,
    crop_type: field.crop,
    province: field.province,
    area: field.areaHa,
    soil_type: field.soilType,
    planting_date: field.plantingDate,
    latitude: field.latitude,
    longitude: field.longitude,
  };
}

// ── Public API used by the Fields page ──────────────────────────────────

/** Current signed-in user id, or null. */
async function currentUserId(): Promise<string | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data } = await sb.auth.getUser();
  return data.user?.id ?? null;
}

/**
 * Load fields. Prefers the DB (when configured + signed in), mirroring into the
 * cache; otherwise returns the localStorage cache (offline-first fallback).
 * Returns null when there is nothing stored anywhere (caller seeds defaults).
 */
export async function loadFields(): Promise<Field[] | null> {
  if (isSupabaseConfigured) {
    const sb = getSupabase();
    const uid = await currentUserId();
    if (sb && uid) {
      const { data, error } = await sb
        .from("agro_fields")
        .select("*")
        .eq("user_id", uid)
        .order("created_at", { ascending: false });
      if (!error && data) {
        const fields = data.map(rowToField);
        writeCache(fields);          // mirror DB → cache
        return fields;
      }
      // On error fall through to cache so the UI still renders.
    }
  }
  return readCache();
}

/**
 * Persist a single new field. Always write-through to cache; insert into the DB
 * when configured + signed in (returns the field with its remoteId populated).
 */
export async function saveField(field: Field): Promise<Field> {
  let saved = field;
  if (isSupabaseConfigured) {
    const sb = getSupabase();
    const uid = await currentUserId();
    if (sb && uid) {
      const { data, error } = await sb
        .from("agro_fields")
        .insert(fieldToInsert(field, uid))
        .select()
        .single();
      if (!error && data) saved = { ...field, remoteId: data.id, id: hashId(data.id) };
    }
  }
  return saved;
}

/** Delete a field by its Supabase remoteId (no-op remotely when not synced). */
export async function deleteField(field: Field): Promise<void> {
  if (isSupabaseConfigured && field.remoteId) {
    const sb = getSupabase();
    const uid = await currentUserId();
    if (sb && uid) {
      await sb.from("agro_fields").delete().eq("id", field.remoteId).eq("user_id", uid);
    }
  }
}

/** Mirror the full working set into the cache (called after any local mutation). */
export function persistCache(fields: Field[]): void {
  writeCache(fields);
}
