-- ============================================================
-- A Chapter — Migration: Align photobooth themes (crimson, sage)
-- ============================================================
-- Menyelaraskan constraint database dan RPC save_vault_setup dengan
-- 7 pilihan tema di frontend (cream, wine, periwinkle, crimson,
-- blossom, midnight, sage).
-- ============================================================

alter table public.preorder_orders
  drop constraint if exists preorder_orders_photobooth_theme_check;
alter table public.preorder_orders
  add constraint preorder_orders_photobooth_theme_check
  check (vault_photobooth_theme in ('cream', 'wine', 'periwinkle', 'crimson', 'blossom', 'midnight', 'sage'))
  not valid;

alter table public.products
  drop constraint if exists products_photobooth_theme_check;
alter table public.products
  add constraint products_photobooth_theme_check
  check (vault_photobooth_theme in ('cream', 'wine', 'periwinkle', 'crimson', 'blossom', 'midnight', 'sage'))
  not valid;

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
set search_path = public, extensions, pg_catalog
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
  v_pin_encrypted text;
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

  select id, vault_pin_encrypted
    into v_product_id, v_pin_encrypted
    from public.products
   where order_id = p_order_id
     and coalesce(btrim(vault_pin_encrypted), '') <> ''
   order by case when coalesce(is_catalog, false) then 1 else 0 end,
            created_at nulls last
   limit 1;

  if found then
    v_pin := public.decrypt_vault_pin(v_pin_encrypted);
  elsif v_order.vault_pin_encrypted is not null
        and btrim(v_order.vault_pin_encrypted) <> '' then
    v_pin_encrypted := v_order.vault_pin_encrypted;
    v_pin := public.decrypt_vault_pin(v_pin_encrypted);
  else
    v_pin := btrim(coalesce(p_pin, ''));
    if v_pin !~ '^[0-9]{6}$' then
      return jsonb_build_object('ok', false, 'code', 'invalid_pin');
    end if;
    v_pin_encrypted := public.encrypt_vault_pin(v_pin);
  end if;

  if v_pin is null or v_pin !~ '^[0-9]{6}$' then
    return jsonb_build_object('ok', false, 'code', 'invalid_pin');
  end if;

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

  if coalesce(array_length(v_photos, 1), 0) = 0
     and btrim(coalesce(p_foto_vault, '')) <> '' then
    v_photos := array[btrim(p_foto_vault)];
  end if;

  v_theme := lower(btrim(coalesce(p_photobooth_theme, 'cream')));
  if v_theme not in ('cream', 'wine', 'periwinkle', 'crimson', 'blossom', 'midnight', 'sage') then
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
         vault_pin_encrypted = v_pin_encrypted
   where id = p_order_id;

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
      vault_pin_encrypted,
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
      v_pin_encrypted,
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
         vault_pin_encrypted = case
           when coalesce(btrim(vault_pin_encrypted), '') = '' then v_pin_encrypted
           else vault_pin_encrypted
         end
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
