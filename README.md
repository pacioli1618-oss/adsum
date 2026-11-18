# Adsum

*Adsum* is Latin for "present!", the answer at roll call. A sign-up-free **attendance notebook**:
whoever provides a service notes their days on their own phone and sends the month's summary; the
client invites them, receives the summaries, checks them and downloads a spreadsheet to pay.
A GR1618 Labs Sidekick, licensed under AGPL-3.0, built on the same base as
[AmigoSecreto](https://github.com/pacioli1618-oss/amigosecreto).

**Not a time clock.** Adsum is a notebook agreed between the parties. It is not an electronic
working-time record (Portaria MTP 671/2021), the provider writes and can correct their own notes,
and the app never uses words like *ponto*, *jornada*, *empregador* or *funcionário*. Keep it that way.

- Next.js 16 (App Router, `cacheComponents`) + Supabase (Postgres, `ad_*` RPCs)
- Languages: pt-BR, es, en. See [docs/i18n.md](docs/i18n.md).
- Naming and code style: [docs/conventions.md](docs/conventions.md). **Read it before contributing.**
- Deliberately left for later: [docs/improvements.md](docs/improvements.md).
- Everything the app stores on the device goes through `src/lib/device-store.ts`.

## How it works

| Who | Link | What they do |
| --- | --- | --- |
| Client | `/` → `/w/<slug>` (backup: `/w/<slug>/manage#<clientToken>`) | Creates the workplace (name, rate, whether to ask for daily notices), invites people, sees today's notices, reviews each summary (*confere / não confere*), exports the month as CSV. |
| Provider, invited | `/w/<slug>/invite#<inviteToken>` | Sees exactly what is shared, accepts (opting in or out of the daily notice) or declines. The client then appears in their notebook. |
| Provider | `/notebook` | "Cheguei" / "Saí" for today, the month calendar per client, notes up to 500 characters, and the month's summary: to the client through Adsum when invited, or by WhatsApp text / CSV otherwise. |

**Where data lives.** The notebook (every day, time, note and client) exists only in the
provider's browser storage. The server keeps only what is shared: daily notices for the current
day (São Paulo time), and summary copies for 60 days after sending. Workplaces unused for 400 days
are erased. There is no cron: `adsum.purge_expired()` runs lazily inside the busiest RPCs.

**"Anotado depois".** A day written or whose times changed after the day itself is flagged
(`Entry.isLate`), and the flag travels with the summary, so the client sees it.

## Running

```bash
cp .env.example .env.local
npm install
npm run dev
```

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | Generates route types and runs TypeScript |
| `npm run i18n:check` | Checks translations: keys, ICU syntax and arguments |
| `npm test` | Unit tests (Node test runner + tsx): month arithmetic, CSV, links, RPC mapping |
| `npm run db:types` | Prints the generated database types to `/tmp` to compare with `src/lib/database.types.ts` |

Browser test of the whole loop (client creates, invites, provider accepts, marks, sends, client
reviews and exports), with the RPCs faked in memory so it runs without the database:
`python3 scripts/e2e/flow.py` against `npm start` on port 3100 (needs Playwright for Python).

## Database

Lives in the QuemLeva Supabase project, in its own `adsum` schema, which is not exposed through the
Data API: all access goes through the `public.ad_*` functions (security definer, RLS on with no
policies). Migrations live in `supabase/migrations/`. After applying one, update
`src/lib/database.types.ts` and the types in `src/lib/api-mappers.ts`, and `scripts/e2e/fake_db.py`
if a response changed.
