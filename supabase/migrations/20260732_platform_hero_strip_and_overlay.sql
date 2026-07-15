-- Merkstrook op de subpagina's + instelbare overlay-donkering (UX-FLOW §7,
-- vervolg op 20260714). De hero-foto komt nu ook als smalle kopstrook achter
-- de paginakoppen van beide apps; die strook heeft een eigen (brede, lage)
-- uitsnede. De overlay-donkering is instelbaar zodat een drukke/lichte foto
-- leesbaar blijft zonder per foto de code aan te passen.
--
-- Table-grant loopt al via 20260731 (geldt voor alle kolommen); alleen de
-- kolommen erbij.

alter table public.platform_settings
  add column if not exists hero_photo_strip_path text;

alter table public.platform_settings
  add column if not exists hero_overlay real not null default 0.55;
