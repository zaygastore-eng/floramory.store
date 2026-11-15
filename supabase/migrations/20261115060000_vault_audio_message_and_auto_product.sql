-- ============================================================
-- Memory Vault: pesan pengantar audio + produk otomatis
-- ============================================================
-- 1) Kolom `vault_audio_message` menyimpan catatan/pesan yang
--    ditulis pengirim bersamaan saat mengunggah audio, sehingga
--    penerima mendengar suara dan membaca konteksnya.
-- 2) `save_vault_setup` membuat produk privat (`is_catalog = false`)
--    secara otomatis bila belum ada. Dengan begitu QR Vault bisa
--    dicetak langsung dari data pesanan tanpa harus lebih dulu
--    mengonversi pesanan menjadi produk lewat panel Admin.
-- ============================================================

alter table public.preorder_orders
  add column if not exists vault_audio_message text not null default '';

alter table public.products
  add column if not exists vault_audio_message text not null default '';

comment on column public.preorder_orders.vault_audio_message is
  'Pesan/catatan pengantar yang tampil bersama pemutar audio di brankas penerima.';
comment on column public.products.vault_audio_message is
  'Salinan pesan pengantar audio untuk produk privat yang dipindai lewat QR.';

-- Signature lama (10 argumen) dihapus agar tidak menjadi jalur bypass.
drop function if exists public.save_vault_setup(uuid, text, text, text, text, integer, text, text[], text, jsonb);

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
  p_letter_style jsonb default '{}'::jsonb
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
         vault_audio_message = p_audio_message,
         video_url = p_video_url,
         vault_submitted_at = v_now,
         vault_locked_at = v_now,
         vault_pin = p_pin
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
      p_audio_url,
      p_audio_durasi,
      p_audio_message,
      p_video_url,
      p_pin,
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
         audio_url = p_audio_url,
         audio_durasi = p_audio_durasi,
         vault_audio_message = p_audio_message,
         video_url = p_video_url,
         vault_pin = p_pin
   where order_id = p_order_id;

  return jsonb_build_object('ok', true, 'pin', p_pin, 'locked_at', v_now);
end;
$$;

revoke all on function public.save_vault_setup(uuid, text, text, text, text, integer, text, text, text[], text, jsonb)
  from public, anon, authenticated;
grant execute on function public.save_vault_setup(uuid, text, text, text, text, integer, text, text, text[], text, jsonb)
  to service_role;

comment on function public.save_vault_setup(uuid, text, text, text, text, integer, text, text, text[], text, jsonb) is
  'Simpan vault pengirim secara atomik + buat produk privat otomatis. Hanya untuk service_role (Edge Function vault-setup) dan hanya setelah DP 50% terverifikasi.';
