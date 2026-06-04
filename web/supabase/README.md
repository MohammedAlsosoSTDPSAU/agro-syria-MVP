# Agro-Syria · Supabase Infrastructure (P0)

This folder holds the production database blueprint. The app is **offline-first**:
without the env vars below it runs entirely on `localStorage` (current demo
behaviour). With them set, it uses Supabase for auth + persistence.

## 1. Create the project
1. Create a project at https://supabase.com.
2. Enable **Phone (SMS) auth** under *Authentication → Providers* and connect an
   SMS provider (Twilio / MessageBird) — required for the phone OTP login.

## 2. Apply the schema
Run `migrations/0001_init_core_schema.sql` in the Supabase **SQL Editor**, or via CLI:

```bash
supabase link --project-ref <your-ref>
supabase db push
```

This creates `profiles`, `agro_fields`, `community_posts`, enables **Row-Level
Security** (each farmer sees only their own fields), and auto-provisions a
profile row on signup via the `on_auth_user_created` trigger.

## 3. Wire the env vars
Add to `web/.env.local` (local) and to the Vercel project (production):

```
NEXT_PUBLIC_SUPABASE_URL=https://<your-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
```

The anon key is safe to expose to the browser — RLS is what protects the data.

## 4. (Optional) regenerate types
```bash
supabase gen types typescript --linked > src/lib/database.types.ts
```

## Code map
| File | Role |
|---|---|
| `src/lib/supabaseClient.ts` | Browser client + `isSupabaseConfigured` guard |
| `src/lib/database.types.ts` | Typed table rows (Row/Insert/Update) |
| `src/lib/fieldsRepo.ts` | Offline-first fields CRUD (cache ⇄ DB) |
| `src/components/auth/PhoneLogin.tsx` | Phone OTP request + verify |
