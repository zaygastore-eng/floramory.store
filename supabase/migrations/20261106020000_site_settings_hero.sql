-- Public storefront configuration for the editorial hero banner.
create table if not exists public.site_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.site_settings enable row level security;

drop policy if exists "Public read site_settings" on public.site_settings;
create policy "Public read site_settings"
  on public.site_settings for select
  to anon, authenticated
  using (true);

drop policy if exists "Admin manage site_settings" on public.site_settings;
create policy "Admin manage site_settings"
  on public.site_settings for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

insert into public.site_settings (key, value)
values (
  'hero_config',
  '{
    "eyebrow": "A CHAPTER · BOTANICAL ARTWARE",
    "headline": "Every flower holds a moment,\nevery life deserves an eternal chapter.",
    "description": "Karya seni botani asli yang dipreservasi abadi melalui standar laboratorium, dituangkan dalam kristal epoxy anti-UV bersama brankas kenangan digital untuk menyimpan suara, surat, dan rekaman foto orang terkasih selamanya.",
    "ctaText": "EXPLORE ALL CHAPTERS ↓",
    "ctaLink": "#chapters",
    "bgImageUrl": ""
  }'::jsonb
)
on conflict (key) do nothing;
