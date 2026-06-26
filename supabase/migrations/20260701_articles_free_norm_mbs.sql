-- Norm/MBS ook invulbaar bij vrije artikelen (wens Jos 2026-06-26). Voor
-- catalogusartikelen komen Norm/MBS uit products.standard/breaking_strength;
-- een vrij artikel had die velden nog niet. Deze kolommen vullen dat gat, zodat
-- de certificaat-kolommen Norm/MBS ook werken als een keurbedrijf vrije
-- artikelen keurt. De invoervelden verschijnen alleen als het keurbedrijf de
-- betreffende kolom heeft aangezet (cert_layout.columns.norm/mbs).

alter table public.articles
  add column if not exists free_norm text,
  add column if not exists free_mbs  text;
