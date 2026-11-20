-- ============================================================
-- Memory Vault: PIN privacy (DB + UI)
-- ============================================================
-- PIN tidak lagi disimpan sebagai angka asli. Nilai PIN dienkripsi
-- dengan AES-256 memakai kunci yang disimpan di Supabase Vault.
-- Operator tidak melihat PIN di dashboard; satu-satunya jalur resmi
-- adalah RPC admin_reveal_vault_pin yang selalu menulis log akses.
-- Hash PIN tetap digunakan untuk verifikasi penerima.
-- ============================================================

create extension if not exists pgcrypto with schema extensions;

-- ------------------------------------------------------------
-- 1) Kunci enkripsi di Supabase Vault
-- ------------------------------------------------------------
do $$
declare
  v_key text;
begin
  select decrypted_secret
    into v_key
    from vault.decrypted_secrets
   where name = 'vault_pin_encryption_key'
   limit 1;

  if v_key is null or btrim(v_key) = '' then
    v_key := md5(gen_random_uuid()::text || clock_timestamp()::text)
          || md5(gen_random_uuid()::text || random()::text);

    -- Versi Vault terbaru punya argumen key_id; versi lama tidak.
    if to_regprocedure('vault.create_secret(text, text, text, uuid)') is not null then
      perform vault.create_secret(
        v_key,
        'vault_pin_encryption_key',
        'Kunci AES-256 untuk PIN kartu fisik Memory Vault',
        null::uuid
      );
    elsif to_regprocedure('vault.create_secret(text, text, text)') is not null then
      perform vault.create_secret(
        v_key,
        'vault_pin_encryption_key',
        'Kunci AES-256 untuk PIN kartu fisik Memory Vault'
      );
    else
      raise exception 'Supabase Vault tidak tersedia (vault.create_secret tidak ditemukan)';
    end if;
  end if;
end $$;

create or replace function public.vault_pin_key()
returns text
language sql
stable
security definer
set search_path = public, vault
as $$
  select decrypted_secret
    from vault.decrypted_secrets
   where name = 'vault_pin_encryption_key'
   limit 1;
$$;

revoke all on function public.vault_pin_key() from public, anon, authenticated;

create or replace function public.encrypt_vault_pin(p_pin text)
returns text
language plpgsql
volatile
security definer
set search_path = public, extensions, pg_catalog
as $$
begin
  if p_pin is null or btrim(p_pin) = '' then
    return null;
  end if;
  return encode(
    pgp_sym_encrypt(btrim(p_pin), public.vault_pin_key(), 'cipher-algo=aes256, compress-algo=none'),
    'base64'
  );
end;
$$;

create or replace function public.decrypt_vault_pin(p_cipher text)
returns text
language plpgsql
volatile
security definer
set search_path = public, extensions, pg_catalog
as $$
begin
  if p_cipher is null or btrim(p_cipher) = '' then
    return null;
  end if;
  return pgp_sym_decrypt(decode(p_cipher, 'base64'), public.vault_pin_key());
end;
$$;

revoke all on function public.encrypt_vault_pin(text) from public, anon, authenticated;
revoke all on function public.decrypt_vault_pin(text) from public, anon, authenticated;
grant execute on function public.encrypt_vault_pin(text) to service_role;
grant execute on function public.decrypt_vault_pin(text) to service_role;

-- ------------------------------------------------------------
-- 2) Kolom terenkripsi + penanda aman "PIN sudah diset"
-- ------------------------------------------------------------
alter table public.products
  add column if not exists vault_pin_encrypted text;

alter table public.preorder_orders
  add column if not exists vault_pin_encrypted text;

-- Kolom turunan ini hanya boolean, aman dibaca admin/UI tanpa
-- membuka ciphertext atau angka PIN.
alter table public.products
  drop column if exists vault_pin_set,
  add column vault_pin_set boolean
    generated always as (coalesce(btrim(vault_pin_encrypted), '') <> '') stored;

alter table public.preorder_orders
  drop column if exists vault_pin_set,
  add column vault_pin_set boolean
    generated always as (coalesce(btrim(vault_pin_encrypted), '') <> '') stored;

-- Backfill dari data lama sebelum kolom plaintext dihapus.
update public.products
   set vault_pin_encrypted = public.encrypt_vault_pin(vault_pin)
 where vault_pin_encrypted is null
   and vault_pin is not null
   and btrim(vault_pin) <> '';

update public.preorder_orders
   set vault_pin_encrypted = public.encrypt_vault_pin(vault_pin)
 where vault_pin_encrypted is null
   and vault_pin is not null
   and btrim(vault_pin) <> '';

-- Pastikan hash verifikasi selalu sinkron dengan PIN terenkripsi.
update public.products
   set vault_pin_hash = encode(
     sha256(convert_to(public.decrypt_vault_pin(vault_pin_encrypted) || ':' || id, 'UTF8')),
     'hex'
   )
 where vault_pin_encrypted is not null
   and btrim(vault_pin_encrypted) <> '';

-- ------------------------------------------------------------
-- 3) Trigger: hash & larangan perubahan PIN
-- ------------------------------------------------------------
drop trigger if exists tr_sync_product_vault_pin_hash on public.products;
create or replace function public.sync_product_vault_pin_hash()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, pg_catalog
as $$
declare
  v_pin text;
begin
  v_pin := public.decrypt_vault_pin(new.vault_pin_encrypted);

  if v_pin is null or btrim(v_pin) = '' then
    new.vault_pin_hash := null;
  else
    new.vault_pin_hash := encode(
      sha256(convert_to(btrim(v_pin) || ':' || new.id, 'UTF8')),
      'hex'
    );
  end if;
  return new;
end;
$$;

create trigger tr_sync_product_vault_pin_hash
  before insert or update of vault_pin_encrypted, id on public.products
  for each row
  execute function public.sync_product_vault_pin_hash();

drop trigger if exists tr_prevent_product_vault_pin_change on public.products;
drop trigger if exists tr_prevent_order_vault_pin_change on public.preorder_orders;

create or replace function public.prevent_vault_pin_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(btrim(old.vault_pin_encrypted), '') <> ''
     and new.vault_pin_encrypted is distinct from old.vault_pin_encrypted then
    raise exception 'PIN Memory Vault tidak dapat diubah setelah ditetapkan';
  end if;
  return new;
end;
$$;

create trigger tr_prevent_product_vault_pin_change
  before update of vault_pin_encrypted on public.products
  for each row
  execute function public.prevent_vault_pin_change();

create trigger tr_prevent_order_vault_pin_change
  before update of vault_pin_encrypted on public.preorder_orders
  for each row
  execute function public.prevent_vault_pin_change();

-- ------------------------------------------------------------
-- 4) Audit akses PIN
-- ------------------------------------------------------------
create table if not exists public.vault_pin_access_log (
  id           bigint generated always as identity primary key,
  actor_id     uuid references auth.users(id) on delete set null,
  actor_email  text,
  order_id     uuid,
  product_id   text,
  reason       text not null default 'print',
  created_at   timestamptz not null default now()
);

alter table public.vault_pin_access_log enable row level security;
revoke all on public.vault_pin_access_log from public, anon, authenticated;
grant select on public.vault_pin_access_log to authenticated;

drop policy if exists "Admins can read vault pin access log" on public.vault_pin_access_log;
create policy "Admins can read vault pin access log"
  on public.vault_pin_access_log for select
  to authenticated
  using (public.is_admin());

-- ------------------------------------------------------------
-- 5) RPC admin: baca PIN hanya untuk cetak, selalu diaudit
-- ------------------------------------------------------------
create or replace function public.admin_reveal_vault_pin(
  p_order_id uuid,
  p_reason text default 'print'
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_catalog
as $$
declare
  v_cipher text;
  v_pin text;
  v_product_id text;
  v_actor_id uuid;
  v_actor_email text;
  v_reason text;
begin
  if not public.is_admin() then
    raise exception 'Akses ditolak: bukan admin';
  end if;

  select vault_pin_encrypted into v_cipher
    from public.preorder_orders
   where id = p_order_id;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;

  if v_cipher is null or btrim(v_cipher) = '' then
    select vault_pin_encrypted into v_cipher
      from public.products
     where order_id = p_order_id
     limit 1;
  end if;

  if v_cipher is null or btrim(v_cipher) = '' then
    return jsonb_build_object('ok', false, 'code', 'no_pin');
  end if;

  v_pin := public.decrypt_vault_pin(v_cipher);
  if v_pin is null or v_pin !~ '^[0-9]{6}$' then
    return jsonb_build_object('ok', false, 'code', 'invalid_pin');
  end if;

  v_actor_id := auth.uid();
  select email into v_actor_email from auth.users where id = v_actor_id;
  select id into v_product_id from public.products where order_id = p_order_id limit 1;
  v_reason := left(btrim(coalesce(p_reason, 'print')), 40);

  insert into public.vault_pin_access_log (
    actor_id, actor_email, order_id, product_id, reason
  ) values (
    v_actor_id, v_actor_email, p_order_id, v_product_id, v_reason
  );

  return jsonb_build_object('ok', true, 'pin', v_pin);
end;
$$;

revoke all on function public.admin_reveal_vault_pin(uuid, text) from public, anon;
grant execute on function public.admin_reveal_vault_pin(uuid, text) to authenticated;

-- RPC untuk PIN yang dibuat manual dari panel Admin. Tetap terenkripsi
-- dan tidak pernah dikembalikan sebagai teks ke UI setelah disimpan.
create or replace function public.admin_set_vault_pin(
  p_product_id text,
  p_pin text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_catalog
as $$
declare
  v_cipher text;
  v_actor_id uuid;
  v_actor_email text;
begin
  if not public.is_admin() then
    raise exception 'Akses ditolak: bukan admin';
  end if;

  if p_pin is null or p_pin !~ '^[0-9]{6}$' then
    return jsonb_build_object('ok', false, 'code', 'invalid_pin');
  end if;

  select vault_pin_encrypted into v_cipher
    from public.products
   where id = p_product_id
   for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;

  -- PIN yang sudah tercetak tidak bisa ditimpa, walau dari panel admin.
  if v_cipher is not null and btrim(v_cipher) <> '' then
    return jsonb_build_object('ok', true, 'locked', true);
  end if;

  update public.products
     set vault_pin_encrypted = public.encrypt_vault_pin(p_pin)
   where id = p_product_id;

  v_actor_id := auth.uid();
  select email into v_actor_email from auth.users where id = v_actor_id;

  insert into public.vault_pin_access_log (
    actor_id, actor_email, product_id, reason
  ) values (
    v_actor_id, v_actor_email, p_product_id, 'set'
  );

  return jsonb_build_object('ok', true, 'locked', false);
end;
$$;

revoke all on function public.admin_set_vault_pin(text, text) from public, anon;
grant execute on function public.admin_set_vault_pin(text, text) to authenticated;

-- ------------------------------------------------------------
-- 6) save_vault_setup: tulis ciphertext, kembalikan PIN ke pengirim
-- ------------------------------------------------------------
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

  -- PIN yang sudah diset selalu dipakai ulang; klien tidak bisa
  -- menggantinya lewat payload kedua kalinya.
  if v_order.vault_pin_encrypted is not null and btrim(v_order.vault_pin_encrypted) <> '' then
    v_pin := public.decrypt_vault_pin(v_order.vault_pin_encrypted);
    v_pin_encrypted := v_order.vault_pin_encrypted;
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
         vault_pin_encrypted = v_pin_encrypted
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
  'Simpan vault pengirim secara atomik dengan PIN terenkripsi di Supabase Vault. Hanya service_role (Edge Function vault-setup).';

-- ------------------------------------------------------------
-- 7) Hapus kolom plaintext setelah semua jalur aman
-- ------------------------------------------------------------
alter table public.products
  drop constraint if exists products_vault_pin_format;
alter table public.preorder_orders
  drop constraint if exists preorder_orders_vault_pin_format;

alter table public.products drop column if exists vault_pin;
alter table public.preorder_orders drop column if exists vault_pin;

comment on column public.products.vault_pin_encrypted is
  'PIN kartu fisik (AES-256 + kunci Supabase Vault). Tidak pernah dikembalikan ke UI admin.';
comment on column public.preorder_orders.vault_pin_encrypted is
  'PIN kartu fisik (AES-256 + kunci Supabase Vault). Sumber cetak ulang oleh admin.';
comment on column public.vault_pin_access_log.reason is
  'Alasan akses PIN, misalnya print atau set.';
