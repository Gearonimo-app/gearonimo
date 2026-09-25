// Herinneringsmail aan klant-beheerders: "deze keuringen verlopen binnenkort".
// Regels (wanneer, welke artikelen, elk artikel maar één keer) staan in de
// migratie 20260925_reminder_per_article.sql; de mailtekst staat hieronder.
//
// Wordt elke nacht aangeroepen door een pg_cron-taak (zie
// 20260921_customer_reminder_mail.sql) -- niet bedoeld om los aangeroepen te worden, maar kan wel
// handmatig getest worden vanuit de Supabase dashboard "Edge Functions"-tab.
//
// Verzending via Zoho ZeptoMail (besloten met Jos, 2026-09-21: betrouwbaarder
// dan de gewone Zoho Mail-mailbox voor automatisch verstuurde mail).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ZEPTOMAIL_TOKEN = Deno.env.get("ZEPTOMAIL_TOKEN")!;
// "no-reply" i.p.v. het eerder gebruikte "meldingen": internationaal
// begrijpelijke conventie (dit is een Nederlands woord, klanten zijn niet
// allemaal Nederlandstalig) en zegt meteen dat er niemand op dit postvak
// leest (besluit Jos 2026-09-24).
const ZEPTOMAIL_FROM_EMAIL = Deno.env.get("ZEPTOMAIL_FROM_EMAIL") ?? "no-reply@gearonimo.net";
// Jos' account loopt via "Zoho CPaaS" (een gebundelde Zoho-omgeving met
// ZeptoMail erin, niet de losse ZeptoMail-losse-app) -- vandaar cpaas.zoho.eu
// i.p.v. het "kale" api.zeptomail.eu. Live geverifieerd met een testmail
// vanuit de Zoho-dashboard (2026-09-24): kwam meteen in de inbox, niet bij
// spam.
const ZEPTOMAIL_API_URL = Deno.env.get("ZEPTOMAIL_API_URL") ?? "https://cpaas.zoho.eu/v1.1/email";
// ─── Mailtekst ───────────────────────────────────────────────────────────────
// Opbouw van de herinneringsmail (onderwerp + HTML) in de taal van de
// ontvanger. Bewust in hetzelfde bestand als de functie: Jos deployt via het
// dashboard (één bestand plakken).
//
// Opzet (besloten met Jos, 2026-09-25): gegroepeerd per keuring, niet per
// artikel -- een klant denkt in "de keuring van november", niet in 200 losse
// artikelen. Groep met hooguit SMALL_GROUP artikelen: namen tonen (zo vallen
// afwijkers op, bv. een touw met een korter keuringsinterval). Grotere groep:
// alleen het aantal + link naar het materiaaloverzicht.
//
// Toon: vriendelijk, en met de waarschuwing dat deze melding per artikel maar
// één keer komt (dedupe in customer_reminder_items, zie migratie
// 20260925_reminder_per_article.sql). "je" in nl zoals de klant-app, "Sie" /
// "vous" in de/fr zoals de klant-app.

type MailLocale = "nl" | "en" | "fr" | "de";

interface DueArticle {
  article_id: string;
  article_name: string | null;
  serial_number: string | null;
  inspection_id: string;
  inspection_date: string; // YYYY-MM-DD
  next_due: string; // YYYY-MM-DD
}

interface MailInput {
  locale: MailLocale;
  recipientName: string | null;
  customerName: string;
  articles: DueArticle[];
  portalUrl: string;
}

const SMALL_GROUP = 5;

interface Texts {
  subject: (company: string) => string;
  greeting: (name: string) => string;
  intro: (company: string) => string;
  heading: string;
  group: (inspected: string, count: number) => string;
  expires: (date: string) => string;
  unnamed: string;
  serial: string;
  button: string;
  onceOnly: string;
  signoff: string;
  noReply: string;
}

const TEXTS: Record<MailLocale, Texts> = {
  nl: {
    subject: (c) => `Herinnering: herkeuring binnenkort nodig – ${c}`,
    greeting: (n) => `Beste ${n},`,
    intro: (c) =>
      `Een vriendelijke herinnering: de keuring van een deel van de uitrusting van ${c} verloopt binnenkort. ` +
      `Plan de herkeuring op tijd in, dan blijft alles veilig en goedgekeurd in gebruik.`,
    heading: "Binnenkort verlopen",
    group: (d, n) => `Gekeurd op ${d} – ${n} ${n === 1 ? "artikel" : "artikelen"}`,
    expires: (d) => `verloopt op ${d}`,
    unnamed: "Artikel zonder naam",
    serial: "serienr.",
    button: "Bekijk het materiaaloverzicht",
    onceOnly:
      "Let op: je krijgt deze herinnering maar één keer per artikel. " +
      "Zet de datum in je agenda of bewaar deze e-mail.",
    signoff: "Met vriendelijke groet,",
    noReply: "Dit is een automatisch bericht; op deze e-mail kan niet worden gereageerd.",
  },
  en: {
    subject: (c) => `Reminder: re-inspection due soon – ${c}`,
    greeting: (n) => `Dear ${n},`,
    intro: (c) =>
      `A friendly reminder: the inspection of some of ${c}'s equipment expires soon. ` +
      `Please schedule the re-inspection in good time, so everything stays safe and approved for use.`,
    heading: "Expiring soon",
    group: (d, n) => `Inspected on ${d} – ${n} ${n === 1 ? "item" : "items"}`,
    expires: (d) => `expires on ${d}`,
    unnamed: "Unnamed item",
    serial: "serial no.",
    button: "View the equipment overview",
    onceOnly:
      "Please note: you will receive this reminder only once per item. " +
      "Add the date to your calendar or keep this email.",
    signoff: "Kind regards,",
    noReply: "This is an automated message; replies to this email are not read.",
  },
  fr: {
    subject: (c) => `Rappel : contrôle périodique bientôt nécessaire – ${c}`,
    greeting: (n) => `Bonjour ${n},`,
    intro: (c) =>
      `Petit rappel : le contrôle d'une partie de l'équipement de ${c} arrive bientôt à échéance. ` +
      `Pensez à planifier le prochain contrôle à temps, afin que tout reste sûr et conforme.`,
    heading: "Échéances proches",
    group: (d, n) => `Contrôlé le ${d} – ${n} ${n === 1 ? "article" : "articles"}`,
    expires: (d) => `expire le ${d}`,
    unnamed: "Article sans nom",
    serial: "n° de série",
    button: "Voir l'aperçu du matériel",
    onceOnly:
      "Attention : vous ne recevrez ce rappel qu'une seule fois par article. " +
      "Notez la date dans votre agenda ou conservez cet e-mail.",
    signoff: "Cordialement,",
    noReply: "Ceci est un message automatique ; il n'est pas possible d'y répondre.",
  },
  de: {
    subject: (c) => `Erinnerung: Wiederholungsprüfung bald fällig – ${c}`,
    greeting: (n) => `Hallo ${n},`,
    intro: (c) =>
      `Eine freundliche Erinnerung: Die Prüfung eines Teils der Ausrüstung von ${c} läuft bald ab. ` +
      `Bitte planen Sie die Wiederholungsprüfung rechtzeitig ein, damit alles sicher und geprüft im Einsatz bleibt.`,
    heading: "Läuft bald ab",
    group: (d, n) => `Geprüft am ${d} – ${n} Artikel`,
    expires: (d) => `läuft ab am ${d}`,
    unnamed: "Artikel ohne Namen",
    serial: "Seriennr.",
    button: "Materialübersicht ansehen",
    onceOnly:
      "Bitte beachten Sie: Diese Erinnerung erhalten Sie pro Artikel nur einmal. " +
      "Tragen Sie das Datum in Ihren Kalender ein oder bewahren Sie diese E-Mail auf.",
    signoff: "Mit freundlichen Grüßen",
    noReply: "Dies ist eine automatische Nachricht; Antworten auf diese E-Mail werden nicht gelesen.",
  },
};

const DATE_LOCALE: Record<MailLocale, string> = { nl: "nl-NL", en: "en-GB", fr: "fr-FR", de: "de-DE" };

function isMailLocale(value: string | null | undefined): value is MailLocale {
  return value === "nl" || value === "en" || value === "fr" || value === "de";
}

function formatDate(iso: string, locale: MailLocale): string {
  // Middag-UTC: geen verspringing naar de vorige dag door tijdzones.
  const d = new Date(`${iso}T12:00:00Z`);
  return d.toLocaleDateString(DATE_LOCALE[locale], { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

interface Group {
  inspection_date: string;
  next_due: string;
  articles: DueArticle[];
}

// Eén groep per (keuring, verloopdatum): artikelen uit dezelfde keuring met
// een afwijkend interval komen zo als aparte, kleine groep met namen in beeld.
function groupArticles(articles: DueArticle[]): Group[] {
  const map = new Map<string, Group>();
  for (const a of articles) {
    const key = `${a.inspection_id}|${a.next_due}`;
    let g = map.get(key);
    if (!g) {
      g = { inspection_date: a.inspection_date, next_due: a.next_due, articles: [] };
      map.set(key, g);
    }
    g.articles.push(a);
  }
  return [...map.values()].sort(
    (a, b) => a.next_due.localeCompare(b.next_due) || a.inspection_date.localeCompare(b.inspection_date),
  );
}

function buildMail(input: MailInput): { subject: string; html: string } {
  const t = TEXTS[input.locale];
  const naam = input.recipientName?.trim() || input.customerName;
  const groups = groupArticles(input.articles);

  const groupHtml = groups
    .map((g) => {
      const title =
        `<strong>${escapeHtml(t.expires(formatDate(g.next_due, input.locale)))}</strong><br>` +
        `<span style="color:#4b5563">${escapeHtml(t.group(formatDate(g.inspection_date, input.locale), g.articles.length))}</span>`;
      const names =
        g.articles.length <= SMALL_GROUP
          ? `<ul style="margin:0.35em 0 0;padding-left:1.2em">` +
            g.articles
              .map((a) => {
                const name = escapeHtml(a.article_name?.trim() || t.unnamed);
                const serial = a.serial_number?.trim()
                  ? ` <span style="color:#6b7280">(${escapeHtml(t.serial)} ${escapeHtml(a.serial_number.trim())})</span>`
                  : "";
                return `<li>${name}${serial}</li>`;
              })
              .join("") +
            `</ul>`
          : "";
      return `<li style="margin:0 0 0.9em">${title}${names}</li>`;
    })
    .join("");

  const html = `<!doctype html>
<html lang="${input.locale}">
<body style="margin:0;padding:0;background:#f3f4f6">
<div style="max-width:560px;margin:0 auto;padding:24px 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.5;color:#111827">
  <div style="background:#ffffff;border-radius:12px;padding:24px">
    <p style="margin:0 0 1em">${escapeHtml(t.greeting(naam))}</p>
    <p style="margin:0 0 1.2em">${escapeHtml(t.intro(input.customerName))}</p>
    <h2 style="font-size:16px;margin:0 0 0.6em">${escapeHtml(t.heading)}</h2>
    <ul style="margin:0 0 1.2em;padding-left:1.2em">${groupHtml}</ul>
    <p style="margin:0 0 1.4em">
      <a href="${input.portalUrl}" style="display:inline-block;background:#1f4d3a;color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:600">${escapeHtml(t.button)}</a>
    </p>
    <p style="margin:0 0 1.2em;padding:10px 12px;background:#fef3c7;border-radius:8px;color:#78350f">${escapeHtml(t.onceOnly)}</p>
    <p style="margin:0">${escapeHtml(t.signoff)}<br>Gearonimo</p>
  </div>
  <p style="margin:12px 4px 0;color:#6b7280;font-size:12px">${escapeHtml(t.noReply)}</p>
</div>
</body>
</html>`;

  return { subject: t.subject(input.customerName), html };
}

// ─── Verzending ──────────────────────────────────────────────────────────────
// Materiaaloverzicht: de klant-app heeft geen aparte pagina per keuring,
// en dit overzicht toont per artikel de verloopdatum (besluit Jos 2026-09-25).
const PORTAL_URL = "https://gearonimo.net/portal/#/materials";
const TRIGGER_DAYS = 30;
const BUNDLE_DAYS = 60;
const COOLDOWN_DAYS = 7;

interface DueRow extends DueArticle {
  customer_id: string;
  customer_name: string;
}

interface Recipient {
  customer_id: string;
  email: string;
  name: string | null;
  locale: string | null;
}

async function sendMail(to: Recipient, subject: string, html: string) {
  const res = await fetch(ZEPTOMAIL_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Zoho-enczapikey ${ZEPTOMAIL_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: { address: ZEPTOMAIL_FROM_EMAIL, name: "Gearonimo" },
      to: [{ email_address: { address: to.email, name: to.name ?? "" } }],
      subject,
      htmlbody: html,
    }),
  });
  const json = await res.json().catch(() => null);
  return {
    ok: res.ok,
    providerMessageId: (json?.data?.[0]?.message_id ?? null) as string | null,
    errorText: res.ok ? undefined : JSON.stringify(json),
  };
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

Deno.serve(async (req: Request) => {
  // Supabase verifieert de Authorization-header al standaard (geldig JWT
  // vereist) vóór deze code draait -- geen los gedeeld geheim nodig, de
  // cron-taak stuurt de service-role-sleutel als Bearer-token mee.
  if (req.method !== "POST") {
    return new Response("method not allowed", { status: 405 });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  const { data: rows, error } = await supabase.rpc("reminder_due_articles", {
    p_trigger_days: TRIGGER_DAYS,
    p_bundle_days: BUNDLE_DAYS,
    p_cooldown_days: COOLDOWN_DAYS,
  });
  if (error) return json({ error: error.message }, 500);

  const byCustomer = new Map<string, { name: string; articles: DueRow[] }>();
  for (const row of (rows ?? []) as DueRow[]) {
    let c = byCustomer.get(row.customer_id);
    if (!c) {
      c = { name: row.customer_name, articles: [] };
      byCustomer.set(row.customer_id, c);
    }
    c.articles.push(row);
  }
  if (byCustomer.size === 0) return json({ processed: 0, results: [] });

  const { data: recData, error: recError } = await supabase.rpc("reminder_recipients", {
    p_customer_ids: [...byCustomer.keys()],
  });
  if (recError) return json({ error: recError.message }, 500);
  const recipients = (recData ?? []) as Recipient[];

  const results: Array<{ customer_id: string; email: string; ok: boolean; articles: number; error?: string }> = [];

  for (const [customerId, customer] of byCustomer) {
    let anySent = false;
    for (const to of recipients.filter((r) => r.customer_id === customerId)) {
      const { subject, html } = buildMail({
        locale: isMailLocale(to.locale) ? to.locale : "nl",
        recipientName: to.name,
        customerName: customer.name,
        articles: customer.articles,
        portalUrl: PORTAL_URL,
      });
      let ok = false;
      let providerMessageId: string | null = null;
      let errorText: string | undefined;
      try {
        ({ ok, providerMessageId, errorText } = await sendMail(to, subject, html));
      } catch (e) {
        errorText = String(e);
      }
      anySent ||= ok;

      // Altijd loggen, ook bij een mislukte verzending -- zo blijft zichtbaar
      // dát er een poging was. De 7-dagen-cooldown kijkt alleen naar
      // status = 'sent', dus een mislukte poging wordt de volgende nacht
      // gewoon opnieuw geprobeerd.
      await supabase.from("customer_reminder_log").insert({
        customer_id: customerId,
        due_count: customer.articles.length,
        recipient_email: to.email,
        status: ok ? "sent" : "failed",
        provider_message_id: providerMessageId,
      });
      results.push({ customer_id: customerId, email: to.email, ok, articles: customer.articles.length, error: errorText });
    }

    // Pas na minstens één geslaagde mail onthouden dat deze artikelen genoemd
    // zijn -- anders zou een ZeptoMail-storing een artikel stil laten
    // verdwijnen uit de herinneringen.
    if (anySent) {
      const { error: itemsError } = await supabase.from("customer_reminder_items").upsert(
        customer.articles.map((a) => ({ customer_id: customerId, article_id: a.article_id, next_due: a.next_due })),
        { onConflict: "customer_id,article_id,next_due", ignoreDuplicates: true },
      );
      if (itemsError) results.push({ customer_id: customerId, email: "", ok: false, articles: 0, error: itemsError.message });
    }
  }

  return json({ processed: results.length, results });
});
