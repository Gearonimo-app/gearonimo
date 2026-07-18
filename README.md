# Gearonimo

Inspection platform for climbing and arborist equipment.

## Structure

```
packages/core      → domain logic (status, next_due, regimes) + unit tests
packages/ui        → shared components and styles
apps/inspector     → inspector app (Gearonimo Pro)
apps/customer      → customer app (Gearonimo)
```

## Getting started

Each app needs an `.env.local` with the Supabase project URL and anon key
(Supabase dashboard → Project Settings → API). Not committed (see
`.gitignore`) — the anon key isn't secret, but keeping it out of git avoids
ever accidentally committing a real secret to this file later:

```bash
echo 'VITE_SUPABASE_URL=https://buitfeiclivzzldfdelp.supabase.co
VITE_SUPABASE_ANON_KEY=<anon key from Supabase dashboard>' > apps/inspector/.env.local
cp apps/inspector/.env.local apps/customer/.env.local

npm install
npm run dev:inspector
npm run dev:customer
```

## Tech stack

- Vue 3 + TypeScript + Vite
- Supabase (auth, database, storage)
- vue-i18n (NL + EN-GB)
- Capacitor (iOS / Android — phase 5)
