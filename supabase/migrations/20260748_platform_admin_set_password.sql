-- Platform-admin kan een wachtwoord instellen voor een keurmeester (besluit
-- Jos 2026-07-21).
--
-- Aanleiding: de uitnodigingsmail (magic-link) komt lang niet altijd aan --
-- vooral Microsoft-365-postbussen houden 'm stil tegen (quarantaine, geen
-- bounce, niet in spam). Zoho levert 'm netjes af, maar de ontvangende kant
-- gooit 'm weg. Voor die gevallen wil Jos een keurmeester gewoon zelf een
-- (start)wachtwoord kunnen geven, zodat diegene direct met e-mail+wachtwoord
-- in de keurder-app kan (die login bestond al), zonder mail.
--
-- LET OP -- dit schrijft in `auth.users`, de interne auth-tabel van Supabase.
-- Dat is bewust en volgt het gangbare Supabase-patroon (bcrypt-hash via
-- pgcrypto). De account-rij moet al bestaan: het uitnodigen ("Uitnodigen en
-- koppelen") maakt die rij al aan via signInWithOtp, óók als de mail nooit
-- aankomt. We zetten hier alleen het wachtwoord + bevestigen het e-mailadres
-- (email_confirmed_at) zodat inloggen lukt ook als "Confirm email" aanstaat.
-- Test dit na het uitvoeren op één account (instellen -> uitloggen -> inloggen
-- met e-mail+wachtwoord) voordat je erop vertrouwt.
--
-- Beveiliging: security-definer + expliciete is_platform_admin()-check, zelfde
-- patroon als de andere platform_admin_*-RPC's (20260740). search_path leeg +
-- alles volledig gekwalificeerd, zodat niets via een gekaapt pad omgeleid kan
-- worden.

-- pgcrypto levert crypt()/gen_salt(); op Supabase in het schema `extensions`.
create extension if not exists pgcrypto with schema extensions;

create or replace function public.platform_admin_set_inspector_password(
  p_inspector_id uuid,
  p_password text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
begin
  if not public.is_platform_admin() then
    raise exception 'Alleen platform-admin mag een wachtwoord instellen.';
  end if;

  if p_password is null or length(p_password) < 8 then
    raise exception 'Wachtwoord moet minstens 8 tekens zijn.';
  end if;

  select user_id into v_user_id from public.inspectors where id = p_inspector_id;
  if v_user_id is null then
    raise exception 'Deze keurmeester heeft nog geen account. Nodig ze eerst uit via e-mail (dat maakt het account aan).';
  end if;

  update auth.users
    set encrypted_password = extensions.crypt(p_password, extensions.gen_salt('bf')),
        email_confirmed_at = coalesce(email_confirmed_at, now()),
        updated_at = now()
  where id = v_user_id;
end;
$$;

grant execute on function public.platform_admin_set_inspector_password(uuid, text) to authenticated;
