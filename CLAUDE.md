# Werkafspraken voor Claude in deze repo

Afgesproken met Jos (2026-07-15) na de styling-ronde. Doel: geen fragiele
bouwsels meer. Deze regels gelden voor elke sessie.

## Kwaliteitsprincipes

1. **Eén gedeelde bron boven herhaling.** Nooit hetzelfde patroon op N
   plekken plakken (zie: de 12 losse paginakoppen die uit de pas liepen).
   Gedeelde componenten in `packages/ui` of `src/components`.
2. **Geen `!important` om scoped styles te overrulen.** Dat is een teken dat
   de structuur fout zit — bouw dan het gedeelde component.
3. **Shortcuts altijd melden.** Een snelle route mag, maar alleen expliciet
   benoemd ("dit is de quick fix, het nette werk zou X zijn") zodat Jos kan
   kiezen.
4. **Visueel werk eerst zelf renderen en bekijken** (headless Chromium staat
   klaar: `/opt/pw-browsers/chromium-*/chrome-linux/chrome --headless
   --screenshot=...`) vóór het aan Jos te tonen. Geen giswerk over SVG's of
   layout.
5. **Databaseschema nooit aannemen.** Live kolomnamen verifiëren (vraag Jos
   om een query te draaien) vóór er migraties/policies op gebouwd worden.
   Bekend patroon hier: `user_id`-FK's die naar het lege `public.users`
   wezen i.p.v. `auth.users` (drie keer gebeurd: inspectors,
   customer_members, platform_admins).

## Technische landmijnen (echt gebeurd)

- **supabase-js: géén supabase-aanroepen binnen een
  `onAuthStateChange`-callback.** De callback draait terwijl de interne
  auth-vergrendeling vaststaat; elke query wacht daarop → hele app hangt op
  "Laden...". Plan met `setTimeout(fn, 0)` buiten de callback-tick.
- **RLS-policies alleen zijn niet genoeg**: een nieuwe tabel heeft ook een
  `grant ... to authenticated` nodig, anders "permission denied for table".
- **PWA + deploys**: pagina's zijn lazy chunks; na een deploy kan een oude
  cache een klik stil laten falen. `router.onError` + eenmalige reload vangt
  dit op (staat in beide `main.ts`) — niet verwijderen.
- **GitHub Pages**: inspector op `/`, klant-app op `/portal/` (hash-router,
  eigen service-worker-denylist).

## Projectconventies

- **Migraties** in `supabase/migrations/JJJJMMDD_naam.sql`, idempotent;
  Jos voert ze zelf uit in de Supabase SQL-editor. Vermeld in de commit en
  in chat welke migratie nog uitgevoerd moet worden.
- **Voortgang bijhouden in `BOUWPLAN.md`** (sectie Voortgang) — dit is de
  geheugenbron tussen sessies. `DATAMODEL.md` is de veldenbron; `UX-FLOW.md`
  de ontwerpbron. Besluiten van Jos dáár vastleggen, met datum.
- **Taal**: UI-teksten via i18n (nl + en bijhouden, `locales/*.json`);
  code/route-namen in het Engels; commits en documentatie in het Nederlands.
- **Verifiëren vóór afronden**: `npm run build --workspace=apps/inspector`
  én `--workspace=apps/customer` (vue-tsc + vite) plus
  `npm run test --workspaces --if-present` moeten groen zijn.
- **Push naar `main`** = live (GitHub Pages auto-deploy). Feature-branch
  meepushen zodat de sessie-branch gelijk blijft.

## Ontwerptaal (styling-ronde 2026-07-14/15)

- Sfeerfoto ("hero") platform-breed, instelbaar via Instellingen → Hero-foto
  (platform-admin): 3 crops (mobiel/desktop/kopstrook) + donkering-schuif,
  opgeslagen in `platform_settings` + Storage-bucket `branding` onder
  `platform/`.
- Glas-stijl voor tegels/kaarten: `rgba(255,255,255,0.14)` + blur + rand.
- Iconen: gedeeld `GIcon`-component (`packages/ui/src/GIcon.ts`), lijnstijl
  dun (1.5) + ronde hoeken. Geen emoji in knoppen/tegels; status-emoji op de
  stoplichtkaart mogen (voorlopig) blijven.
- Lettertype: systeem-sans-stack (geen webfonts — offline-first PWA + AVG).
- Kopbalk: gedeelde `AppHeader` (inspector) / `PageHeader` (klant) — nooit
  nieuwe losse paginakoppen bouwen.
