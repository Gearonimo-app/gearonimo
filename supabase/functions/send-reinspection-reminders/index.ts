// Maandelijkse herinneringsmail aan klant-beheerders: "binnen 30 dagen zijn
// er N artikelen aan herkeuring toe". Zie de migratie
// 20260921_customer_reminder_mail.sql voor de databasekant (wie is aan de
// beurt, en het logboek dat "max 1x per maand" afdwingt).
//
// Wordt elke nacht aangeroepen door een pg_cron-taak (zie diezelfde
// migratie) -- niet bedoeld om los aangeroepen te worden, maar kan wel
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
const PORTAL_URL = "https://gearonimo.net/portal/";
const DAYS_AHEAD = 30;

interface DueRow {
  customer_id: string;
  customer_name: string;
  admin_email: string;
  admin_name: string | null;
  due_count: number;
}

function buildHtml(row: DueRow): string {
  const naam = row.admin_name?.trim() || row.customer_name;
  return `
    <p>Beste ${escapeHtml(naam)},</p>
    <p>Binnen ${DAYS_AHEAD} dagen zijn er <strong>${row.due_count}</strong> artikel(en) van
    ${escapeHtml(row.customer_name)} aan herkeuring toe.</p>
    <p><a href="${PORTAL_URL}">Bekijk het overzicht in Gearonimo</a></p>
    <p style="color:#6b7280;font-size:0.85em">Deze e-mail wordt maximaal één keer per maand verstuurd.</p>
  `;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

Deno.serve(async (req: Request) => {
  // Supabase verifieert de Authorization-header al standaard (geldig JWT
  // vereist) vóór deze code draait -- geen los gedeeld geheim nodig, de
  // cron-taak stuurt de service-role-sleutel als Bearer-token mee.
  if (req.method !== "POST") {
    return new Response("method not allowed", { status: 405 });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  const { data: rows, error } = await supabase.rpc("customers_due_for_reminder", {
    p_days_ahead: DAYS_AHEAD,
  });
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const results: Array<{ customer_id: string; email: string; ok: boolean; error?: string }> = [];

  for (const row of (rows ?? []) as DueRow[]) {
    let ok = false;
    let providerMessageId: string | null = null;
    let errorText: string | undefined;
    try {
      const res = await fetch(ZEPTOMAIL_API_URL, {
        method: "POST",
        headers: {
          Authorization: `Zoho-enczapikey ${ZEPTOMAIL_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: { address: ZEPTOMAIL_FROM_EMAIL, name: "Gearonimo" },
          to: [{ email_address: { address: row.admin_email, name: row.admin_name ?? "" } }],
          subject: `${row.due_count} artikel(en) bijna aan herkeuring toe`,
          htmlbody: buildHtml(row),
        }),
      });
      const json = await res.json().catch(() => null);
      ok = res.ok;
      providerMessageId = json?.data?.[0]?.message_id ?? null;
      if (!res.ok) errorText = JSON.stringify(json);
    } catch (e) {
      errorText = String(e);
    }

    // Altijd loggen, ook bij een mislukte verzending -- zo blijft zichtbaar
    // dát er een poging was. De cooldown in customers_due_for_reminder kijkt
    // alleen naar status = 'sent', dus een mislukte poging (ZeptoMail-storing,
    // tijdelijk kapot adres) wordt de volgende nacht gewoon opnieuw geprobeerd.
    await supabase.from("customer_reminder_log").insert({
      customer_id: row.customer_id,
      due_count: row.due_count,
      recipient_email: row.admin_email,
      status: ok ? "sent" : "failed",
      provider_message_id: providerMessageId,
    });

    results.push({ customer_id: row.customer_id, email: row.admin_email, ok, error: errorText });
  }

  return new Response(JSON.stringify({ processed: results.length, results }), {
    headers: { "Content-Type": "application/json" },
  });
});
