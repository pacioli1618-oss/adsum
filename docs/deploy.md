# Deploy

Production runs on **Vercel** (Next.js, no Vercel-specific code) with the **Supabase project
shared with QuemLeva** (sa-east-1), in its own `adsum` schema.

## 1. Database

Apply the files in `supabase/migrations/` in order (Supabase → SQL editor, or `supabase db push`).
They only create the `adsum` schema and the `public.ad_*` functions; they do not touch the other
apps' schemas. Then run the security and performance advisors: "anon can execute security definer
function" on the `ad_*` functions is expected (that is the API).

## 2. Vercel project

1. Import `pacioli1618-oss/adsum` in Vercel (framework preset: Next.js, default build and output).
2. Environment variables (Production and Preview):

   | Name | Value |
   | --- | --- |
   | `NEXT_PUBLIC_SUPABASE_URL` | `https://uqkyhzvdwynpkqdiuvyn.supabase.co` |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | the publishable key (`.env.example`) |
   | `NEXT_PUBLIC_SITE_URL` | `https://adsum.gr1618.io` |

   Both Supabase values are public by design: the browser calls the `ad_*` RPCs directly and the
   tables are not exposed.
3. Function region: **São Paulo (gru1)**, next to the database (`vercel.json`).

## 3. Domain

Pilot: `adsum.gr1618.io` (DNS for `gr1618.io` is managed at Hover).

1. Vercel → Project → Settings → Domains → add `adsum.gr1618.io`.
2. At Hover, add the `CNAME` record Vercel shows (name `adsum`).
3. Wait for Vercel to mark the domain valid; HTTPS is automatic.

## 4. Smoke test after each deploy

1. Phone A (client): create a workplace with a rate and the daily-notice wish; copy the admin link.
2. Phone A: invite "Ana" and send the invite on WhatsApp to phone B.
3. Phone B (provider): open the invite, turn on the daily notice, accept. Tap "Cheguei".
4. Phone A: "Hoje" shows Ana's arrival time.
5. Phone B: write a day of the previous month (it shows "anotado depois"), send that month with notes.
6. Phone A: open the days, mark "não confere" with a note, download the spreadsheet (opens in
   Excel with accents and columns).
7. Phone B: the client page shows "não confere" and the note. Stop sharing; phone A shows it.
8. Footer shows `versão 0.3.0 · <commit>`; `/version` lists the release.
