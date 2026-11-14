-- ============================================================
-- Memory Vault: DP 50% gate + photobooth strip + letter styling
-- ============================================================
-- 1) Konsol pengirim hanya boleh diisi setelah admin memverifikasi
--    DP 50%. Gate diterapkan di Edge Function DAN di RPC ini
--    (defense in depth), karena RPC bisa dipanggil service_role.
-- 2) Menyimpan sampai 4 foto photobooth + tema border + gaya surat
--    (font, ukuran, bold/italic/underline, perataan, warna tinta)
--    agar konsol pengirim sinkron dengan landing page.
-- ============================================================

-- ------------------------------------------------------------
-- 1) Kolom baru
-- ------------------------------------------------------------
alter table public.preorder_orders
  add column if not exists dp_verified_at timestamptz,
  add column if not exists vault_photos text[] not null default '{}'::text[],
  add column if not exists vault_photobooth_theme text not null default 'cream',
  add column if not exists vault_letter_style jsonb not null default '{}'::jsonb;

alter table public.products
  add column if not exists vault_photos text[] not null default '{}'::text[],
  add column if not exists vault_photobooth_theme text not null default 'cream',
  add column if not exists vault_letter_style jsonb not null default '{}'::jsonb;

-- Tema border yang diizinkan (whitelist).
alter table public.preorder_orders
  drop constraint if exists preorder_orders_photobooth_theme_check;
alter table public.preorder_orders
  add constraint preorder_orders_photobooth_theme_check
  check (vault_photobooth_theme in ('cream', 'wine', 'periwinkle', 'midnight', 'blossom'))
  not valid;

alter table public.products
  drop constraint if exists products_photobooth_theme_check;
alter table public.products
  add constraint products_photobooth_theme_check
  check (vault_photobooth_theme in ('cream', 'wine', 'periwinkle', 'midnight', 'blossom'))
  not valid;

-- Maksimal 4 foto per vault.
alter table public.preorder_orders
  drop constraint if exists preorder_orders_vault_photos_len;
alter table public.preorder_orders
  add constraint preorder_orders_vault_photos_len
  check (array_length(vault_photos, 1) is null or array_length(vault_photos, 1) <= 4)
  not valid;

alter table public.products
  drop constraint if exists products_vault_photos_len;
alter table public.products
  add constraint products_vault_photos_len
  check (array_length(vault_photos, 1) is null or array_length(vault_photos, 1) <= 4)
  not valid;

comment on column public.preorder_orders.dp_verified_at is
  'Diisi saat admin memverifikasi DP 50%. Sebelum ini, konsol vault pengirim terkunci.';
comment on column public.preorder_orders.vault_photos is
  'URL foto photobooth (maks. 4). Kolom foto_vault tetap menyimpan foto utama untuk kompatibilitas.';
comment on column public.preorder_orders.vault_letter_style is
  'Gaya surat: font, size, bold, italic, underline, align, color.';

-- ------------------------------------------------------------
-- 2) Gate DP di RPC simpan vault
-- ------------------------------------------------------------
-- Parameter baru diberi DEFAULT agar pemanggilan lama (7 argumen)
-- tetap valid selama masa transisi.
-- Signature 7 argumen lama dihapus agar tidak menjadi jalur bypass gate DP.
drop function if exists public.save_vault_setup(uuid, text, text, text, text, integer, text);

create or replace function public.save_vault_setup(
  p_order_id uuid,
  p_pin text,
  p_personal_message text,
  p_foto_vault text,
  p_audio_url text,
  p_audio_durasi integer,
  p_video_url text,
  p_photos text[] default '{}'::text[],
  p_photobooth_theme text default 'cream',
  p_letter_style jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.preorder_orders%rowtype;
  v_now timestamptz := now();
  v_status text;
  v_photos text[];
  v_theme text;
  v_style jsonb;
begin
  select *
    into v_order
    from public.preorder_orders
   where id = p_order_id
   for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;

  v_status := lower(coalesce(v_order.status, ''));

  if v_status = 'cancelled' then
    return jsonb_build_object('ok', false, 'code', 'cancelled');
  end if;

  -- Gate DP 50%: hanya pesanan yang sudah diverifikasi admin.
  if v_status not in ('dp_verified', 'in_production', 'in_progress', 'completed', 'paid') then
    return jsonb_build_object('ok', false, 'code', 'dp_required');
  end if;

  if v_order.vault_setup_expires_at is not null
     and v_order.vault_setup_expires_at < v_now then
    return jsonb_build_object('ok', false, 'code', 'expired');
  end if;

  if v_order.vault_locked_at is not null then
    return jsonb_build_object('ok', false, 'code', 'locked');
  end if;

  -- Sanitasi ringan: maksimal 4 foto, buang entri kosong.
  v_photos := coalesce(
    (
      select array_agg(photo)
      from (
        select btrim(unnest_item) as photo
        from unnest(coalesce(p_photos, '{}'::text[])) as unnest_item
        where btrim(coalesce(unnest_item, '')) <> ''
        limit 4
      ) as cleaned
    ),
    '{}'::text[]
  );

  -- Jika array kosong tetapi foto utama ada, gunakan foto utama.
  if coalesce(array_length(v_photos, 1), 0) = 0
     and btrim(coalesce(p_foto_vault, '')) <> '' then
    v_photos := array[btrim(p_foto_vault)];
  end if;

  v_theme := lower(btrim(coalesce(p_photobooth_theme, 'cream')));
  if v_theme not in ('cream', 'wine', 'periwinkle', 'midnight', 'blossom') then
    v_theme := 'cream';
  end if;

  v_style := case
    when p_letter_style is null or jsonb_typeof(p_letter_style) <> 'object' then '{}'::jsonb
    else p_letter_style
  end;

  update public.preorder_orders
     set personal_message = p_personal_message,
         foto_vault = p_foto_vault,
         vault_photos = v_photos,
         vault_photobooth_theme = v_theme,
         vault_letter_style = v_style,
         audio_url = p_audio_url,
         audio_durasi = p_audio_durasi,
         video_url = p_video_url,
         vault_submitted_at = v_now,
         vault_locked_at = v_now,
         vault_pin = p_pin
   where id = p_order_id;

  update public.products
     set pesan_personal = p_personal_message,
         foto_vault = p_foto_vault,
         vault_photos = v_photos,
         vault_photobooth_theme = v_theme,
         vault_letter_style = v_style,
         audio_url = p_audio_url,
         audio_durasi = p_audio_durasi,
         video_url = p_video_url,
         vault_pin = p_pin
   where order_id = p_order_id;

  return jsonb_build_object('ok', true, 'pin', p_pin, 'locked_at', v_now);
end;
$$;

revoke all on function public.save_vault_setup(uuid, text, text, text, text, integer, text, text[], text, jsonb)
  from public, anon, authenticated;
grant execute on function public.save_vault_setup(uuid, text, text, text, text, integer, text, text[], text, jsonb)
  to service_role;

comment on function public.save_vault_setup(uuid, text, text, text, text, integer, text, text[], text, jsonb) is
  'Simpan vault pengirim secara atomik. Hanya untuk service_role (Edge Function vault-setup) dan hanya setelah DP 50% terverifikasi.';
