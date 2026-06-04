/**
 * Supabase schema types — mirrors web/supabase/migrations/0001_init_core_schema.sql.
 *
 * Hand-authored for now; once the project is linked you can regenerate with:
 *   supabase gen types typescript --linked > src/lib/database.types.ts
 */

export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

// NOTE: these are `type` aliases (not `interface`) on purpose — Supabase's
// GenericTable constraint requires Row/Insert/Update to satisfy
// `Record<string, unknown>`, which interfaces do not (no implicit index sig).
export type ProfileRow = {
  id: string;            // == auth.users.id
  phone: string | null;
  full_name: string | null;
  province: string | null;
  created_at: string;
};

export type AgroFieldRow = {
  id: string;            // uuid
  user_id: string;
  name: string;
  crop_type: string;
  province: string;
  area: number;          // hectares
  soil_type: string | null;
  planting_date: string | null; // ISO date
  latitude: number | null;
  longitude: number | null;
  created_at: string;
};

export type CommunityPostRow = {
  id: string;            // uuid
  user_id: string;
  title: string;
  content: string;
  tags: string[];
  created_at: string;
};

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: ProfileRow;
        Insert: Omit<ProfileRow, "created_at"> & { created_at?: string };
        Update: Partial<ProfileRow>;
        Relationships: [];
      };
      agro_fields: {
        Row: AgroFieldRow;
        Insert: Omit<AgroFieldRow, "id" | "created_at"> & { id?: string; created_at?: string };
        Update: Partial<AgroFieldRow>;
        Relationships: [];
      };
      community_posts: {
        Row: CommunityPostRow;
        Insert: Omit<CommunityPostRow, "id" | "created_at"> & { id?: string; created_at?: string };
        Update: Partial<CommunityPostRow>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
