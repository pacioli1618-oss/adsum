<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Adsum project rules

- Follow `docs/conventions.md`: English for every identifier, file, route, database object, error code, commit, comment and developer doc. Use the domain glossary in section 1. One concept, one word.
- User-facing text only through `messages/<locale>.json` (`docs/i18n.md`). Run `npm run i18n:check` after editing messages.
- Database access only through the `public.ad_*` RPCs, wrapped in `src/lib/api.ts`. Response types and snake_case → camelCase conversion live in `src/lib/api-mappers.ts`. Schema changes go in a new migration in `supabase/migrations/`; never edit an applied migration. After a migration: update `src/lib/database.types.ts`, `tests/api-mappers.test.ts` and `scripts/e2e/fake_db.py` if a response changed.
- The provider's notebook never goes to the server. Only what the provider chooses to share (daily notices, month summaries) does.
- Adsum is not a time clock: never use *ponto*, *jornada*, *empregador*, *funcionário* (or their translations) in code or copy, except in the disclaimer that says so.
- Device storage only through `src/lib/device-store.ts`.
- Keep the app minimal. Items in `docs/improvements.md` are not built until the roadmap says so.
- Bump `package.json` version, `CHANGELOG.md` and `Version.releases` in `messages/*.json` together.
- Before finishing: `npm run lint`, `npm run typecheck`, `npm run i18n:check`, `npm test`, `npm run build`.
