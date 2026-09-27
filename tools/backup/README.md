# Weekbackup van de live gegevens (Windows)

Besluit van Jos (2026-09-27): Supabase blijft op het gratis abonnement, dat
geen downloadbare backups heeft. Daarom maakt Jos' eigen Windows-computer
elke week een versleutelde backup naar een externe SSD met de naam
`gearonimo`. Eén schijf, thuis. Een oude WD My Cloud-NAS is bewust niet
gebruikt: die krijgt geen beveiligingsupdates meer.

De code zelf staat al veilig op GitHub; deze backup gaat over de **inhoud**:
database en Storage-bestanden.

## Wat er in een backup zit

`gearonimo-backups\gearonimo-JJJJ-MM-DD.7z` op de schijf, 7-Zip met
AES-256 en verborgen bestandsnamen. Daarin:

| Bestand | Inhoud |
|---|---|
| `database-public.sql` | alle tabellen, functies en gegevens van schema `public` (`pg_dump -n public`) |
| `database-accounts.sql` | inlogaccounts: `auth.users` en `auth.identities` (alleen gegevens) |
| `bestanden\<bucket>\...` | alle bestanden uit **alle** Storage-buckets |
| `LEESMIJ.txt` | datum, aantallen en eventueel mislukte bestanden |

De laatste 8 backups blijven bewaard. Niet mee: Edge Functions (staan in de
code), instellingen in het Supabase-dashboard (auth-mails, secrets van
functies).

## Hoe het werkt

- Taakplanner-taak **Gearonimo backup**: elke avond om 20:00 en bij inloggen
  (gemist → zo snel mogelijk ingehaald). Het script maakt alleen een backup
  als de vorige minstens 6,5 dag oud is.
- Schijf niet aangesloten terwijl een backup nodig is → melding op het scherm.
- Snelkoppeling **Gearonimo backup nu maken** op het bureaublad: direct een
  backup, ongeacht de datum.
- Alles staat in `%LOCALAPPDATA%\GearonimoBackup`: het script, 7-Zip,
  `pg_dump` 17 (van EnterpriseDB, zonder installatie), `config.json`,
  `backup.log`.
- Geheimen (databasewachtwoord, secret key, backup-wachtwoord) staan in
  `config.json` versleuteld met Windows DPAPI: alleen leesbaar voor dat
  Windows-account op die computer.
- De onversleutelde tussenmap in `%TEMP%` wordt na afloop altijd gewist.

## Installeren

1. Map `tools/backup` op de computer zetten (Claude stuurt een zip).
2. Zip uitpakken, dubbelklikken op `INSTALLEREN.cmd`. Waarschuwt Windows
   ("Windows heeft uw pc beveiligd"): **Meer info** → **Toch uitvoeren**.
3. Het script vraagt om:
   - de **Session pooler**-verbinding: Supabase → knop **Connect** bovenaan →
     *Session pooler* → de regel die begint met `postgresql://`;
   - het **databasewachtwoord**. Onbekend? Supabase → Project Settings →
     Database → *Reset database password*. Dat raakt de app niet (die
     gebruikt API-sleutels);
   - de **secret key**: Project Settings → API Keys → *secret* (of de
     oude `service_role`-sleutel);
   - een zelfgekozen **backup-wachtwoord** (minstens 12 tekens). Opschrijven:
     zonder dit wachtwoord is een backup onbruikbaar.

Opnieuw draaien mag (bv. na een nieuw databasewachtwoord).

## Een backup openen

7-Zip installeren (7-zip.org), rechtermuisknop op het `.7z`-bestand →
7-Zip → Uitpakken, backup-wachtwoord invullen.

## Terugzetten (met Claude)

Getest op een lege Postgres-database (2026-09-27):

1. `auth.users`/`auth.identities`: `database-accounts.sql` inladen (in een
   nieuw Supabase-project bestaan die tabellen al).
2. `drop schema public cascade;` en dan `database-public.sql` inladen
   (het bestand maakt het schema zelf opnieuw aan).
3. Rechten en RLS komen uit `supabase/migrations` (de dump is gemaakt met
   `--no-privileges`): de `grant`-migraties opnieuw uitvoeren.
4. Bestanden per bucket terug uploaden.

## Weghalen

Taakplanner → taak *Gearonimo backup* verwijderen, map
`%LOCALAPPDATA%\GearonimoBackup` en de snelkoppeling verwijderen.

## Testen zonder Windows

`backup.ps1 -Target <map>` schrijft naar een map in plaats van de schijf;
met `"testPlainSecrets": true` in een test-`config.json` staan geheimen
onversleuteld. Zo is het script op Linux getest met `pwsh`, een lokale
Postgres en een nagebootste Storage-API.
