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

```bash
npm install
npm run dev:inspector
npm run dev:customer
```

## Tech stack

- Vue 3 + TypeScript + Vite
- Supabase (auth, database, storage)
- vue-i18n (NL + EN-GB)
- Capacitor (iOS / Android — phase 5)
