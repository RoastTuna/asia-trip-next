# Asia 2026 — live trip tracker

Next.js + Supabase. Anyone with the link can view + edit, changes sync live.

## Setup (one-time, ~10 min)

### 1. Supabase project
1. Sign up / log in at https://supabase.com (free).
2. **New project** → pick a name & strong DB password → wait ~1 min.
3. Open **SQL Editor** → New query → paste `supabase/schema.sql` → Run.
4. **Project Settings → API** → copy:
   - `Project URL`
   - `anon public` key

### 2. Local dev (optional — skip if you want to deploy straight to Vercel)
```bash
cp .env.local.example .env.local
# fill in NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY
npm install
npm run dev
```
Open http://localhost:3000 — first load seeds the trip data into Supabase.

### 3. Deploy to Vercel (free)
1. Push this folder to a GitHub repo.
2. https://vercel.com → **Add New → Project** → import the repo.
3. **Environment Variables**:
   - `NEXT_PUBLIC_SUPABASE_URL` = your project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = your anon key
   - `NEXT_PUBLIC_TRIP_ID` = `asia-2026` (or any slug; lets you reuse the app for other trips)
4. Deploy. Vercel gives you a `*.vercel.app` URL — that's your live site.

Share the URL with anyone who needs to view or edit.

## How it works

- One row in the `trips` table holds the whole trip as JSON.
- Edits update that row; Supabase Realtime broadcasts the change to every open browser.
- No auth — anyone with the link edits. The Postgres RLS policies in `schema.sql` allow anonymous read/write **only** on the `trips` table, so it's not a wide-open database.

## Security note

This setup intentionally has no login (you asked for "anyone with the link can edit"). The anon key is public — that's how Supabase is designed. If the URL leaks, anyone can edit your trip. To lock it down later, replace the RLS policies with auth-based ones and add `@supabase/ssr` for sign-in.
