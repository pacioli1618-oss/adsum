# Changelog

Versions follow `package.json` (shown in the app footer and on `/version`, with the deployed
commit). The user-facing version of this list is `Version.releases` in `messages/*.json`.

## 0.3.0 — 2026-11-18

First pilot version.

- Client: create a workplace (name, rate per day or hour, daily-notice wish) after accepting the
  terms; admin link in the URL fragment; edit and delete.
- Invites: one per person, sent on WhatsApp; accept (with or without daily notice) or decline;
  the client can cancel an invite or remove a person.
- Notebook on the device: "Cheguei" / "Saí", month calendar, times and a note per day,
  "anotado depois" for days written after the fact, clients not on Adsum.
- Month summary: preview, choose to include times and notes, send through Adsum (replaces the
  previous send of the same month), or WhatsApp text and CSV.
- Client review per summary (confere / não confere with a note), visible in the provider's
  notebook; month export as CSV (UTF-8 BOM, `;`).
- Daily notices only on the day itself; stop and resume sharing.
- Retention: notices until midnight (São Paulo), summaries 60 days, idle workplaces 400 days,
  rate-limit log 2 days.
- pt-BR, es, en; light and dark theme; installable (PWA manifest); `/version` page.
