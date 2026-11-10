-- ============================================================
-- A Chapter — Migration: Database integrity & audit
-- ============================================================
-- Melengkapi hardening keamanan (20261111000000) dengan:
--
-- 1) Index untuk query panas (produk per pesanan, katalog aktif,
--    pesanan per nomor WA, pesanan per status).
-- 2) Trigger `updated_at` otomatis, sehingga timestamp tidak lagi
--    bergantung pada frontend.
-- 3) Constraint panjang pesan & URL media + rentang durasi audio.
--    Ditambahkan NOT VALID agar data lama tidak menggagalkan migrasi;
--    constraint tetap berlaku untuk semua baris baru/perubahan.
-- 4) Fungsi `save_vault_setup` agar penyimpanan vault (pesanan +
--    produk tertaut) berjalan dalam SATU transaksi, sekaligus
--    memeriksa ulang lock/kedaluwarsa secara atomik.
-- 5) Soft delete produk (`deleted_at`) + audit log tanpa menyimpan
--    isi pesan/PIN (hanya nama kolom yang berubah).
-- ============================================================

-- ------------------------------------------------------------
-- 1) Index query panas
-- ------------------------------------------------------------
create index if not exists products_order_id_idx
  on public.products (order_id);

create index if not exists products_status_catalog_idx
  on public.products (status, is_catalog);

create index if not exists preorder_orders_whatsapp_created_idx
  on public.preorder_orders (whatsapp, created_at desc);

create index if not exists preorder_orders_status_created_idx
  on public.preorder_orders (status, created_at desc);

-- ------------------------------------------------------------
-- 2) Trigger updated_at otomatis
-- ------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists tr_products_updated_at on public.products;
create trigger tr_products_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

drop trigger if exists tr_preorder_orders_updated_at on public.preorder_orders;
create trigger tr_preorder_orders_updated_at
  before update on public.preorder_orders
  for each row execute function public.set_updated_at();

drop trigger if exists tr_app_settings_updated_at on public.app_settings;
create trigger tr_app_settings_updated_at
  before update on public.app_settings
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- 3) Constraint integritas (NOT VALID untuk data lama)
-- ------------------------------------------------------------
alter table public.products
  drop constraint if exists products_pesan_personal_len;
alter table public.products
  add constraint products_pesan_personal_len
  check (char_length(pesan_personal) <= 4000) not valid;

alter table public.products
  drop constraint if exists products_media_url_len;
alter table public.products
  add constraint products_media_url_len
  check (
    char_length(foto_produk) <= 2048
    and char_length(foto_qr) <= 2048
    and char_length(foto_vault) <= 2048
    and char_length(audio_url) <= 2048
    and char_length(video_url) <= 2048
  ) not valid;

alter table public.products
  drop constraint if exists products_audio_durasi_range;
alter table public.products
  add constraint products_audio_durasi_range
  check (audio_durasi >= 0 and audio_durasi <= 86400) not valid;

-- PIN lama bisa 4–6 digit; penyimpanan baru selalu 6 digit.
-- String kosong diperlakukan seperti NULL (form admin mengirim '').
alter table public.products
  drop constraint if exists products_vault_pin_format;
alter table public.products
  add constraint products_vault_pin_format
  check (
    vault_pin is null
    or btrim(vault_pin) = ''
    or vault_pin ~ '^[0-9]{4,6}$'
  ) not valid;

alter table public.preorder_orders
  drop constraint if exists preorder_orders_personal_message_len;
alter table public.preorder_orders
  add constraint preorder_orders_personal_message_len
  check (char_length(personal_message) <= 4000) not valid;

alter table public.preorder_orders
  drop constraint if exists preorder_orders_media_url_len;
alter table public.preorder_orders
  add constraint preorder_orders_media_url_len
  check (
    char_length(foto_vault) <= 2048
    and char_length(audio_url) <= 2048
    and char_length(video_url) <= 2048
  ) not valid;

alter table public.preorder_orders
  drop constraint if exists preorder_orders_audio_durasi_range;
alter table public.preorder_orders
  add constraint preorder_orders_audio_durasi_range
  check (audio_durasi >= 0 and audio_durasi <= 86400) not valid;

alter table public.preorder_orders
  drop constraint if exists preorder_orders_vault_pin_format;
alter table public.preorder_orders
  add constraint preorder_orders_vault_pin_format
  check (
    vault_pin is null
    or btrim(vault_pin) = ''
    or vault_pin ~ '^[0-9]{4,6}$'
  ) not valid;

-- ------------------------------------------------------------
-- 4) Simpan vault secara atomik
-- ------------------------------------------------------------
-- Dipanggil HANYA oleh Edge Function vault-setup (service_role).
-- Fungsi ini mengunci baris pesanan (FOR UPDATE) lalu memeriksa
-- status/expiry/lock di dalam transaksi, sehingga dua permintaan
-- yang bersamaan tidak bisa menimpa vault yang sudah dikunci.
create or replace function public.save_vault_setup(
  p_order_id uuid,
  p_pin text,
  p_personal_message text,
  p_foto_vault text,
  p_audio_url text,
  p_audio_durasi integer,
  p_video_url text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.preorder_orders%rowtype;
  v_now timestamptz := now();
begin
  select *
    into v_order
    from public.preorder_orders
   where id = p_order_id
   for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;

  if lower(coalesce(v_order.status, '')) = 'cancelled' then
    return jsonb_build_object('ok', false, 'code', 'cancelled');
  end if;

  if v_order.vault_setup_expires_at is not null
     and v_order.vault_setup_expires_at < v_now then
    return jsonb_build_object('ok', false, 'code', 'expired');
  end if;

  if v_order.vault_locked_at is not null then
    return jsonb_build_object('ok', false, 'code', 'locked');
  end if;

  update public.preorder_orders
     set personal_message = p_personal_message,
         foto_vault = p_foto_vault,
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
         audio_url = p_audio_url,
         audio_durasi = p_audio_durasi,
         video_url = p_video_url,
         vault_pin = p_pin
   where order_id = p_order_id;

  return jsonb_build_object('ok', true, 'pin', p_pin, 'locked_at', v_now);
end;
$$;

revoke all on function public.save_vault_setup(uuid, text, text, text, text, integer, text)
  from public, anon, authenticated;
grant execute on function public.save_vault_setup(uuid, text, text, text, text, integer, text)
  to service_role;

comment on function public.save_vault_setup(uuid, text, text, text, text, integer, text) is
  'Simpan vault pengirim secara atomik. Hanya untuk service_role (Edge Function vault-setup).';

-- ------------------------------------------------------------
-- 5) Soft delete produk
-- ------------------------------------------------------------
alter table public.products
  add column if not exists deleted_at timestamptz;

create index if not exists products_deleted_at_idx
  on public.products (deleted_at)
  where deleted_at is not null;

-- Produk yang dihapus tidak boleh muncul di katalog publik.
drop policy if exists "Public can read active products" on public.products;
create policy "Public can read active products"
  on public.products for select
  to anon
  using (
    status = 'active'
    and coalesce(is_catalog, true) = true
    and deleted_at is null
  );

-- ------------------------------------------------------------
-- 6) Audit log (tanpa menyimpan nilai sensitif)
-- ------------------------------------------------------------
create table if not exists public.audit_log (
  id              bigint generated always as identity primary key,
  table_name      text not null,
  record_id       text,
  action          text not null check (action in ('insert', 'update', 'delete')),
  actor_id        uuid,
  changed_columns text[],
  created_at      timestamptz not null default now()
);

create index if not exists audit_log_created_idx
  on public.audit_log (created_at desc);

create index if not exists audit_log_table_record_idx
  on public.audit_log (table_name, record_id, created_at desc);

create or replace function public.audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_action  text;
  v_id      text;
  v_changed text[];
begin
  if tg_op = 'INSERT' then
    v_action := 'insert';
    v_id := coalesce(new.id::text, '');
  elsif tg_op = 'UPDATE' then
    v_action := 'update';
    v_id := coalesce(new.id::text, old.id::text, '');

    -- Hanya nama kolom yang berubah — tidak pernah nilainya, agar
    -- isi surat/PIN/kontak tidak tersalin ke tabel audit.
    select array_agg(n.key order by n.key)
      into v_changed
      from jsonb_each(to_jsonb(new)) as n
     where n.value is distinct from (to_jsonb(old) -> n.key);
  else
    v_action := 'delete';
    v_id := coalesce(old.id::text, '');
  end if;

  insert into public.audit_log (table_name, record_id, action, actor_id, changed_columns)
  values (tg_table_name, v_id, v_action, auth.uid(), v_changed);

  return null;
end;
$$;

drop trigger if exists tr_products_audit on public.products;
create trigger tr_products_audit
  after insert or update or delete on public.products
  for each row execute function public.audit_row_change();

drop trigger if exists tr_preorder_orders_audit on public.preorder_orders;
create trigger tr_preorder_orders_audit
  after insert or update or delete on public.preorder_orders
  for each row execute function public.audit_row_change();

alter table public.audit_log enable row level security;

revoke all on public.audit_log from anon, authenticated;
grant select on public.audit_log to authenticated;

drop policy if exists "Admins can read audit log" on public.audit_log;
create policy "Admins can read audit log"
  on public.audit_log for select
  to authenticated
  using (public.is_admin());

comment on table public.audit_log is
  'Jejak perubahan produk & pesanan. Hanya nama kolom yang dicatat, bukan nilai, untuk melindungi isi vault dan data pribadi.';

-- ------------------------------------------------------------
-- 7) Verifikasi cepat
-- ------------------------------------------------------------
-- select indexname from pg_indexes
--  where schemaname = 'public' and tablename in ('products','preorder_orders');
--
-- select id, updated_at from public.products order by created_at desc limit 1;
--   -> updated_at berubah otomatis setiap update.
--
-- select table_name, action, changed_columns, created_at
--   from public.audit_log order by created_at desc limit 10;
--
-- select public.save_vault_setup(
--   (select id from public.preorder_orders limit 1),
--   '123456', 'test', '', '', 0, ''
-- );  -- hanya bisa dijalankan sebagai service_role
