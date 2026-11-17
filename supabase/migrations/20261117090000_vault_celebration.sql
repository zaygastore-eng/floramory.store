-- ============================================================
-- Memory Vault: Celebration mode
-- ============================================================
-- Setiap vault BARU membawa momen perayaan (ulang tahun, anniversary,
-- wisuda, atau custom), satu skin, dan satu hook animasi. Vault lama
-- dibiarkan `vault_moment = null` sehingga tetap dirender sebagai
-- arsip memoar (mode legacy) tanpa perubahan visual.
--
-- `vault_moment` sengaja nullable dan tidak di-backfill: null adalah
-- penanda arsip, bukan nilai default. Kolom lain punya default aman
-- agar produk yang dibuat manual lewat Admin tetap valid.
-- ============================================================

alter table public.preorder_orders
  add column if not exists vault_moment text,
  add column if not exists vault_moment_label text not null default '',
  add column if not exists vault_skin text not null default 'noir',
  add column if not exists vault_hook_id text not null default 'gift-box';

alter table public.products
  add column if not exists vault_moment text,
  add column if not exists vault_moment_label text not null default '',
  add column if not exists vault_skin text not null default 'noir',
  add column if not exists vault_hook_id text not null default 'gift-box';

comment on column public.products.vault_moment is
  'Momen perayaan vault. NULL = vault arsip lama (mode legacy).';
comment on column public.products.vault_moment_label is
  'Label bebas untuk vault_moment = custom, maksimal 40 karakter.';
comment on column public.products.vault_skin is
  'Skin pengalaman penerima: noir, crayon, atau romance.';
comment on column public.products.vault_hook_id is
  'Hook animasi Lottie yang dipilih dari galeri kurasi.';
comment on column public.preorder_orders.vault_moment is
  'Salinan momen perayaan untuk konsol pengirim dan panel Admin.';
comment on column public.preorder_orders.vault_moment_label is
  'Salinan label momen custom pada pesanan.';
comment on column public.preorder_orders.vault_skin is
  'Salinan skin perayaan pada pesanan.';
comment on column public.preorder_orders.vault_hook_id is
  'Salinan hook animasi pada pesanan.';

-- Whitelist nilai. NULL tetap diizinkan untuk vault arsip.
alter table public.products
  drop constraint if exists products_vault_moment_valid;
alter table public.products
  add constraint products_vault_moment_valid
  check (vault_moment is null or vault_moment in ('birthday', 'anniversary', 'graduation', 'custom'));

alter table public.products
  drop constraint if exists products_vault_skin_valid;
alter table public.products
  add constraint products_vault_skin_valid
  check (vault_skin in ('noir', 'crayon', 'romance'));

alter table public.products
  drop constraint if exists products_vault_hook_valid;
alter table public.products
  add constraint products_vault_hook_valid
  check (vault_hook_id in ('cake', 'rose', 'graduation', 'gift-box', 'bouquet', 'envelope', 'celebration', 'confetti'));

alter table public.preorder_orders
  drop constraint if exists preorder_orders_vault_moment_valid;
alter table public.preorder_orders
  add constraint preorder_orders_vault_moment_valid
  check (vault_moment is null or vault_moment in ('birthday', 'anniversary', 'graduation', 'custom'));

alter table public.preorder_orders
  drop constraint if exists preorder_orders_vault_skin_valid;
alter table public.preorder_orders
  add constraint preorder_orders_vault_skin_valid
  check (vault_skin in ('noir', 'crayon', 'romance'));

alter table public.preorder_orders
  drop constraint if exists preorder_orders_vault_hook_valid;
alter table public.preorder_orders
  add constraint preorder_orders_vault_hook_valid
  check (vault_hook_id in ('cake', 'rose', 'graduation', 'gift-box', 'bouquet', 'envelope', 'celebration', 'confetti'));

-- PIN tidak boleh direset. Setelah vault_pin terisi, nilainya tidak dapat
-- diganti atau dikosongkan; atelier hanya boleh mencetak ulang PIN yang sama.
-- Trigger ini melindungi produk (sumber verifikasi) dan pesanan (sumber cetak).
create or replace function public.prevent_vault_pin_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(btrim(old.vault_pin), '') <> ''
     and new.vault_pin is distinct from old.vault_pin then
    raise exception 'PIN Memory Vault tidak dapat diubah setelah ditetapkan';
  end if;
  return new;
end;
$$;

drop trigger if exists tr_prevent_product_vault_pin_change on public.products;
create trigger tr_prevent_product_vault_pin_change
  before update of vault_pin on public.products
  for each row
  execute function public.prevent_vault_pin_change();

drop trigger if exists tr_prevent_order_vault_pin_change on public.preorder_orders;
create trigger tr_prevent_order_vault_pin_change
  before update of vault_pin on public.preorder_orders
  for each row
  execute function public.prevent_vault_pin_change();

-- Signature lama dihapus agar tidak menjadi jalur bypass yang melewati
-- validasi momen/PIN. Ada dua versi historis: 7 argumen (sebelum
-- photobooth) dan 11 argumen (sebelum celebration).
drop function if exists public.save_vault_setup(uuid, text, text, text, text, integer, text);
drop function if exists public.save_vault_setup(uuid, text, text, text, text, integer, text, text, text[], text, jsonb);

create or replace function public.save_vault_setup(
  p_order_id uuid,
  p_pin text,
  p_personal_message text,
  p_foto_vault text,
  p_audio_url text,
  p_audio_durasi integer,
  p_video_url text,
  p_audio_message text default '',
  p_photos text[] default '{}'::text[],
  p_photobooth_theme text default 'cream',
  p_letter_style jsonb default '{}'::jsonb,
  p_moment text default null,
  p_moment_label text default '',
  p_skin text default 'noir',
  p_hook_id text default 'gift-box'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.preorder_orders%rowtype;
  v_catalog public.products%rowtype;
  v_now timestamptz := now();
  v_status text;
  v_photos text[];
  v_theme text;
  v_style jsonb;
  v_product_id text;
  v_suffix integer := 0;
  v_pin text;
  v_moment text;
  v_moment_label text;
  v_skin text;
  v_hook text;
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

  -- PIN wajib 6 digit. Tidak ada vault perayaan tanpa PIN karena
  -- PIN fisik ikut dicetak dan dikirim bersama karya botani.
  v_pin := btrim(coalesce(p_pin, ''));
  if v_pin !~ '^[0-9]{6}$' then
    return jsonb_build_object('ok', false, 'code', 'invalid_pin');
  end if;

  -- Momen wajib eksplisit untuk vault baru. Null/kosong bukan
  -- "mode arsip" di jalur tulis; arsip hanya untuk data lama.
  v_moment := lower(btrim(coalesce(p_moment, '')));
  if v_moment not in ('birthday', 'anniversary', 'graduation', 'custom') then
    return jsonb_build_object('ok', false, 'code', 'invalid_moment');
  end if;

  v_moment_label := case
    when v_moment = 'custom' then left(btrim(coalesce(p_moment_label, '')), 40)
    else ''
  end;

  v_skin := lower(btrim(coalesce(p_skin, 'noir')));
  if v_skin not in ('noir', 'crayon', 'romance') then
    v_skin := 'noir';
  end if;

  v_hook := lower(btrim(coalesce(p_hook_id, 'gift-box')));
  if v_hook not in ('cake', 'rose', 'graduation', 'gift-box', 'bouquet', 'envelope', 'celebration', 'confetti') then
    v_hook := 'gift-box';
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
         vault_audio_message = p_audio_message,
         video_url = p_video_url,
         vault_moment = v_moment,
         vault_moment_label = v_moment_label,
         vault_skin = v_skin,
         vault_hook_id = v_hook,
         vault_submitted_at = v_now,
         vault_locked_at = v_now,
         vault_pin = v_pin
   where id = p_order_id;

  -- Produk privat otomatis: QR Vault dapat langsung dicetak dari
  -- pesanan tanpa menunggu admin mengonversi pesanan menjadi produk.
  if not exists (select 1 from public.products where order_id = p_order_id) then
    select * into v_catalog
      from public.products
     where id = v_order.product_id
       and coalesce(is_catalog, false) = true
     limit 1;

    v_product_id := 'ORD-' || upper(substr(replace(p_order_id::text, '-', ''), 1, 8));
    while exists (select 1 from public.products where id = v_product_id) loop
      v_suffix := v_suffix + 1;
      v_product_id := 'ORD-' || upper(substr(replace(p_order_id::text, '-', ''), 1, 8)) || '-' || v_suffix::text;
    end loop;

    insert into public.products (
      id,
      order_id,
      nama_produk,
      kategori,
      tier,
      harga,
      bunga,
      deskripsi,
      bahan,
      ukuran,
      nama_pembeli,
      dari,
      pesan_personal,
      foto_produk,
      foto_vault,
      vault_photos,
      vault_photobooth_theme,
      vault_letter_style,
      vault_moment,
      vault_moment_label,
      vault_skin,
      vault_hook_id,
      audio_url,
      audio_durasi,
      vault_audio_message,
      video_url,
      vault_pin,
      recipient_whatsapp,
      is_catalog,
      status
    ) values (
      v_product_id,
      p_order_id,
      coalesce(nullif(btrim(v_catalog.nama_produk), ''), nullif(btrim(v_order.product_name), ''), 'Kado Botani A Chapter'),
      coalesce(v_catalog.kategori, ''),
      case
        when lower(coalesce(v_catalog.tier, '')) in ('classic', 'signature', 'masterpiece')
          then lower(v_catalog.tier)
        else 'classic'
      end,
      coalesce(v_catalog.harga, ''),
      coalesce(v_catalog.bunga, ''),
      coalesce(v_catalog.deskripsi, ''),
      coalesce(v_catalog.bahan, ''),
      coalesce(v_catalog.ukuran, ''),
      coalesce(nullif(btrim(v_order.recipient_name), ''), v_order.customer_name),
      coalesce(nullif(btrim(v_order.sender_name), ''), v_order.customer_name),
      p_personal_message,
      coalesce(v_catalog.foto_produk, ''),
      p_foto_vault,
      v_photos,
      v_theme,
      v_style,
      v_moment,
      v_moment_label,
      v_skin,
      v_hook,
      p_audio_url,
      p_audio_durasi,
      p_audio_message,
      p_video_url,
      v_pin,
      coalesce(nullif(btrim(v_order.recipient_whatsapp), ''), v_order.whatsapp),
      false,
      'active'
    );
  end if;

  update public.products
     set pesan_personal = p_personal_message,
         foto_vault = p_foto_vault,
         vault_photos = v_photos,
         vault_photobooth_theme = v_theme,
         vault_letter_style = v_style,
         vault_moment = v_moment,
         vault_moment_label = v_moment_label,
         vault_skin = v_skin,
         vault_hook_id = v_hook,
         audio_url = p_audio_url,
         audio_durasi = p_audio_durasi,
         vault_audio_message = p_audio_message,
         video_url = p_video_url,
         vault_pin = v_pin
   where order_id = p_order_id;

  return jsonb_build_object(
    'ok', true,
    'pin', v_pin,
    'moment', v_moment,
    'skin', v_skin,
    'hook_id', v_hook,
    'locked_at', v_now
  );
end;
$$;

revoke all on function public.save_vault_setup(uuid, text, text, text, text, integer, text, text, text[], text, jsonb, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.save_vault_setup(uuid, text, text, text, text, integer, text, text, text[], text, jsonb, text, text, text, text)
  to service_role;

comment on function public.save_vault_setup(uuid, text, text, text, text, integer, text, text, text[], text, jsonb, text, text, text, text) is
  'Simpan vault pengirim secara atomik (termasuk momen, skin, hook perayaan) + buat produk privat otomatis. Hanya untuk service_role (Edge Function vault-setup) dan hanya setelah DP 50% terverifikasi.';
