# Bouwplan — Gearonimo Pro (inspector app)

Status per 2026-06-26. Modeled op klimkeurpro, doorlopend redesign van de keuringsflow
(`apps/inspector/src/pages/InspectionWizard.vue`).

## Net afgerond

- **Zoek+toevoegrij boven de tabel** (invoer blijft altijd in beeld).
- **Eigen suggestielijst i.p.v. native `<datalist>`** (Optie A) — duwt de tabel naar
  beneden i.p.v. eroverheen te vallen.
  - Artikel zoekt in catalogus, optioneel genauwd door gekozen Merk/Categorie.
  - Merk zoekt alleen merken, Categorie alleen categorieën.
  - Serienummer zoekt alleen in artikelen die al op déze keuringslijst staan
    (niet in de catalogus).
  - Pijltjestoetsen (↑/↓) lopen door de lijst, Enter kiest, Escape sluit.
  - Lijst scrollt automatisch mee als je met de pijltjes buiten beeld komt.
- **Gebruiker-veld** (`assigned_user_name`) toegevoegd als kolom in de tabel, opslaan
  via `saveArticle()`.
- **Handleiding-link** (📖): toont link voor catalogusproducten (`products.manual_url`)
  of vrije artikelen (`articles.free_manual_url`); voor vrije artikelen zonder link een
  knop om er een toe te voegen (window.prompt).
- **Recall-waarschuwing** (🚩): automatisch zichtbaar voor catalogusproducten met
  `recall_url`; voor vrije artikelen een toggle-knop (`articles.free_recall_flag` +
  `articles.free_recall_url`).
- Eerdere ronde (al eerder gebouwd): merge van zoek+toevoegvelden, status instelbaar bij
  toevoegen, undo van goed/afkeur, comment-veld altijd zichtbaar, inline afvoeren
  (soft-delete), maand als dropdown, jaar zonder spinner-pijltjes, spiekbriefje
  dag-van-jaar/weeknummer → maand (weeknummer pakt altijd het laagste maandnummer),
  Artikel-dropdown gefilterd op Merk/Categorie, "⧉ Kopieer vorige" voor snelle
  identieke-items-invoer.

## Database

Bron van waarheid: `supabase/migrations/`. Laatste relevante migraties:
- `20260625_free_recall_manual_url.sql` — `articles.free_recall_flag`,
  `articles.free_recall_url`, `products.manual_url` (alle drie al uitgevoerd door
  gebruiker in productie-Supabase).
- Eerdere migraties (24/25/26 juni) — rejection codes, company defaults, RLS overal uit,
  diverse fixes (zie bestandsnamen voor volledige lijst).

Alle migraties zijn idempotent (`add column if not exists` e.d.) en worden door de
gebruiker zelf handmatig in de Supabase SQL-editor gedraaid — ik schrijf het SQL-bestand,
de gebruiker voert het uit.

## Workflow-afspraken (blijven gelden)

- Branch `claude/quirky-darwin-blp1o8` wordt gelijk gehouden met `main` (elke commit
  naar beide gepusht); gearonimo.net deployt automatisch vanaf `main`.
- Build altijd verifiëren met `cd apps/inspector && npx vite build` vóór elke commit.
- Bij grotere UX/structuur-wijzigingen: eerst overleggen, niet direct implementeren
  (expliciete herhaalde instructie van de gebruiker).
- Migraties: ik schrijf het SQL-bestand + print het commando voor de gebruiker, ik voer
  zelf niets uit op de productie-database.

## Open / nog niet opgepakt

- Geen settings-UI voor `default_interval_ppe_months` / `default_interval_rigging_months`
  (nu alleen via DB-default in te stellen).
- Geen logout-knop in de inspector-app.
- Geen UI om afkeurcodes (rejection codes) te beheren.
- `ArticleDetail.vue` toont nog geen handleiding-link (alleen de tabel in de wizard doet
  dit nu) — mogelijk wens om dit ook daar te tonen, nog niet besproken.
