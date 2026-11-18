# Naming conventions

English is the base language of the codebase. Everything a developer reads or types is in English: identifiers, files, folders, routes, database objects, error codes, commits, code comments and developer docs. Only **user-facing text** is translated, and it lives in `messages/<locale>.json`, never in code.

## 1. Domain glossary

One concept, one word, everywhere: database, TypeScript, i18n keys and docs. When a pt-BR UI word has no listed term, add it here before using it.

| pt-BR (UI) | Code term | Examples |
| --- | --- | --- |
| Local (o que o contratante cria) | `workplace` | `adsum.workplaces`, `ClientWorkplace`, `createWorkplace()` |
| Contratante, cliente | `client` | `client_tokens`, `ad_get_workplace_as_client`, `NotebookClient` |
| Link de administração | `client token` | `p_client_token`, `/w/[slug]/manage#<clientToken>` |
| Quem presta o serviço | `provider` | `adsum.providers`, `Provider`, `ad_remove_provider` |
| Convite / link do convite | `invite`, `invite token` | `ad_add_invite`, `p_invite_token`, `/w/[slug]/invite#<inviteToken>` |
| Caderno | `notebook` | `/notebook`, `src/lib/notebook.ts` |
| Dia anotado | `entry` | `Entry`, `saveEntry()` |
| Chegada / saída | `check-in` / `check-out` | `checkIn`, `check_in`, `markNow()` |
| Relato do dia | `note` | `Entry.note`, `include_notes` |
| Anotado depois | `late` | `Entry.isLate`, `late_days`, `is_late` |
| Aviso do dia (cheguei / saí) | `notice` | `adsum.notices`, `ad_add_notice`, `wants_daily_notice`, `shares_daily_notice` |
| Compartilhar / parar de compartilhar | `sharing` | `ad_set_sharing`, `SharingSection` |
| Resumo do mês | `summary` | `adsum.summaries`, `ad_send_summary`, `summarizeMonth()` |
| Confere / não confere | `review`: `confirmed` / `disputed` | `ad_review_summary`, `review_note` |
| Valor combinado | `rate` (`rate_amount`, `rate_unit` day/hour) | `rateAmount`, `rateUnit` |
| Aparelho | `device` | `deviceId`, `device-store.ts` |

Never in code or UI: *ponto*, *jornada*, *empregador*, *funcionário*, *employee*, *employer*,
*timesheet*, *clock in*. Adsum is a notebook between two parties, not a time clock.

## 2. Abbreviations

Write words out in full: `quantity`, not `qty`; `event`, not `evt`; `provider`, not `prov`.

These are the only allowed abbreviations: `id`, `url`, `api`, `db`, `rsvp`, `i18n`, `ui`, `pwa`, `og` (Open Graph), plus the SQL prefixes in section 4.

## 3. TypeScript and React

| Thing | Style | Example |
| --- | --- | --- |
| React component file | `PascalCase.tsx` | `LocaleSwitcher.tsx`, `ItemCard.tsx` |
| Any other module | `kebab-case.ts` | `device-store.ts`, `use-loader.ts` |
| Component, type, interface | `PascalCase`, no `I` prefix | `WorkplaceFields`, `ClientWorkplace`, `StoredWorkplace` |
| Function, variable | `camelCase`, verb first for functions | `createWorkplace()`, `parseAmount()` |
| Hook | `useCamelCase`, file `use-kebab.ts` | `useLoader()` in `use-loader.ts` |
| Boolean | `is`, `has`, `can` or `should` prefix | `isLate`, `hasArrived` |
| Event handler | `handleX` inside, `onX` as a prop | `onRemove={handleRemove}` |
| Module-level constant | `SCREAMING_SNAKE_CASE` for fixed scalars | `STORAGE_KEY`, `DEBOUNCE_MS` |
| Readonly list of codes | `camelCase` plural, with a singular type | `unitCodes` / `UnitCode` |
| Next.js special files | the framework's names | `page.tsx`, `layout.tsx`, `proxy.ts` |
| Test file | `tests/<module>.test.ts`;  | `tests/notebook.test.ts`, `tests/api-mappers.test.ts` |

**Database ↔ TypeScript boundary:** the database speaks `snake_case` and TypeScript speaks `camelCase`. The conversion happens only in `src/lib/api.ts` and `src/lib/api-mappers.ts`. Components never see `p_` parameters or snake_case fields.

## 4. Database (Postgres / Supabase)

| Thing | Style | Example |
| --- | --- | --- |
| Schema | app name | `adsum` |
| Table | `snake_case`, plural noun | `workplaces`, `client_tokens`, `summaries` |
| Column | `snake_case`, singular | `quantity_needed`, `plus_ones` |
| Primary key | `id uuid` | |
| Foreign key | `<singular table>_id` | `workplace_id`, `provider_id` |
| Timestamp | `<verb>_at` (`timestamptz`) | `created_at`, `revoked_at`, `rsvp_at` |
| Date-only, time-only | `<noun>_date`, `<noun>_time` | `exchange_date` |
| Boolean | `is_` / `has_`, or a past participle | `include_notes`, `wants_daily_notice` |
| Code-valued text | `text` + `check (... in (...))`, English codes | `kind in ('barbecue', ...)` |
| Public RPC | `ad_<verb>_<noun>` in `public` | `ad_create_workplace`, `ad_set_sharing`, `ad_get_workplace_as_client` |
| Internal helper | `<verb>_<noun>` in `adsum` | `require_provider`, `require_client_workplace`, `purge_expired` |
| Function parameter | `p_` + `snake_case` | `p_slug`, `p_client_token` |
| PL/pgSQL local variable | `v_` + `snake_case` | `v_slug`, `v_others` |
| Trigger | `<table>_<action>` | `claims_notify` |
| Index | `<table>_<columns>_idx` | `providers_workplace_id_idx` |
| Migration file | `<YYYYMMDDHHMMSS>_<snake_case_summary>.sql` | `20261108000300_naming_conventions.sql` |

Columns repeat the table name only when the bare word is a SQL type or keyword: `exchange_date`, not `date`.

**RPC verbs:** use `get`, `create`, `update`, `upsert`, `add` (in bulk), `delete` (a row), `remove` (a person from a workplace), `set` (replace a value that belongs to the caller), `accept`, `decline`, `send`, `review`.

## 5. Error codes

Errors raised by RPCs carry a fixed English code as the message, in `snake_case`: `<subject>_<problem>` (`invite_not_found`, `provider_name_taken`) or a generic state (`not_authorized`, `sharing_not_active`). Extra data goes in `DETAIL` (`provider_name_taken` → the name; `rate_limited` → `hour` or `day`). The `Errors` namespace in `messages/*.json` uses the **same codes as keys**. This is the one place where i18n keys are `snake_case`.

## 6. Realtime

Not used yet. If added, the channel topic is `<entity>:<key>` (`workplace:<slug>`) and broadcast event names are past-tense verbs (`changed`).

## 7. Routes and URLs

Paths are short, lowercase, kebab-case English. They never include the locale (see `docs/i18n.md`). Secrets go in the URL fragment (`#…`) so they never reach the server or its logs.

| Route | Screen |
| --- | --- |
| `/` | Two doors: create a workplace, or open the notebook. Lists workplaces managed on this device. |
| `/w/[slug]` | Client panel: today's notices, people and invites, month summaries, admin link |
| `/w/[slug]/manage#<clientToken>` | Admin link: stores the token on the device, then opens `/w/[slug]` |
| `/w/[slug]/invite#<inviteToken>` | Invite: what is shared, accept or decline; then the client is added to the notebook |
| `/notebook` | Today (Cheguei / Saí), month numbers, summaries to send, clients |
| `/notebook/new-client` | A client not on Adsum (kept only on the device) |
| `/notebook/[clientId]` | One client's month: calendar, day editor, sharing, settings |
| `/notebook/[clientId]/send/[month]` | Review and send the month's summary (Adsum, WhatsApp text or CSV) |
| `/version` | Version, commit and what changed |
| `/about`, `/privacy`, `/terms` | About, privacy policy, terms. Operator and contact in `src/lib/site.ts`. |

All pages are `noindex` during the pilot. The notebook is client-only: `[clientId]` is a local id,
never sent to the server.

## 8. i18n messages

- **Namespaces** are `PascalCase`, one per screen or shared area: `Home`, `Workplace`, `Notebook`, `Common`.
- **Keys** are `camelCase`, named for meaning, not wording: `missingItems`, not `itensFaltando`.
- **Code-valued keys** match the stored code exactly: `Errors.invite_not_found`.
- `pt-BR` is the source file; `npm run i18n:check` enforces the rest.

## 9. CSS and design tokens

- **Tokens:** custom properties use the Design System token names, in `kebab-case` English: `--surface`, `--brand-strong`, `--ember`, `--radius-md`. They are all declared in `src/app/globals.css`, kept in sync with the Design System.
- **Styling:** CSS Modules, one `Component.module.css` next to `Component.tsx`. Class names are `camelCase` (`styles.fullWidth`).
- **Colors and sizes** come only from tokens (`var(--…)`). No hex values or magic radii inside components.
- **Borders, not shadows.**

## 10. Folders

| Folder | What goes there |
| --- | --- |
| `src/app/[locale]/` | Routes (pages, layouts). Page-only components sit next to their `page.tsx`. |
| `src/components/brand/` | Logo and other brand marks |
| `src/components/ui/` | Design System primitives with no domain knowledge: `Button`, `TextField`, `SelectField`, `Stepper`, `Chip`, `Tag`, `ProgressBar`, `Card` |
| `src/components/workplace/`, `src/components/notebook/` | Components that know the domain: `WorkplaceFields`, `ClientFields` |
| `src/hooks/` | React hooks shared across screens: `use-loader.ts`, `use-device-store.ts`, `use-origin.ts` |
| `src/lib/` | Framework-free logic and the database door: `api.ts`, `api-mappers.ts`, `notebook.ts`, `notices.ts`, `csv.ts`, `share-links.ts`, `amount.ts`, `device-store.ts` |
| `src/i18n/` | Locales, routing, formatting helpers |

## 11. Environment variables

`SCREAMING_SNAKE_CASE`. The `NEXT_PUBLIC_` prefix only for values that are safe in the browser: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Server secrets have no prefix: `SUPABASE_SECRET_KEY`.

## 12. Git

- **Branches:** `<type>/<kebab-summary>`, as in `feat/notebook-backup` or `fix/late-flag`.
- **Commits:** [Conventional Commits](https://www.conventionalcommits.org) in English, imperative mood, as in `feat(notebook): flag days written after the fact`. Types: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `db` (migrations), `i18n`.

## 13. Comments and docs

- **Code comments** are in English and explain *why*, not *what*.
- **Developer docs** (`README.md`, `docs/`) are in English.
- **Product and business documents** for the team, outside the repository, may stay in pt-BR.
