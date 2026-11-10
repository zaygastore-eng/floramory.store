-- ============================================================
-- A Chapter — Migration: Database-backed rate limiting
-- ============================================================
-- Rate limit in-memory pada Edge Function hanya berlaku per
-- instance. Tabel + fungsi di bawah membuat batas fixed-window
-- yang konsisten lintas instance (dan lintas deploy).
--
-- Hanya service_role yang boleh memanggil fungsi ini; anon dan
-- authenticated tidak punya akses ke tabel maupun fungsi.
-- ============================================================

create table if not exists public.rate_limits (
  bucket        text not null,
  key           text not null,
  window_start  timestamptz not null,
  count         integer not null default 0,
  primary key (bucket, key)
);

create index if not exists rate_limits_window_idx
  on public.rate_limits (window_start);

alter table public.rate_limits enable row level security;

revoke all on public.rate_limits from anon, authenticated;

create or replace function public.check_rate_limit(
  p_bucket text,
  p_key text,
  p_limit integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_window_start timestamptz;
  v_count integer;
begin
  if p_bucket is null or p_key is null or p_limit <= 0 or p_window_seconds <= 0 then
    return true;
  end if;

  -- Fixed window yang sejajar dengan kelipatan p_window_seconds.
  v_window_start := to_timestamp(
    floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds
  );

  insert into public.rate_limits (bucket, key, window_start, count)
  values (p_bucket, p_key, v_window_start, 1)
  on conflict (bucket, key) do update
    set count = case
          when public.rate_limits.window_start = excluded.window_start
            then public.rate_limits.count + 1
          else 1
        end,
        window_start = excluded.window_start
  returning count into v_count;

  -- Bersihkan baris lama sesekali agar tabel tidak tumbuh tanpa batas.
  if random() < 0.01 then
    delete from public.rate_limits
     where window_start < now() - interval '1 day';
  end if;

  return v_count <= p_limit;
end;
$$;

revoke all on function public.check_rate_limit(text, text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.check_rate_limit(text, text, integer, integer)
  to service_role;

comment on table public.rate_limits is
  'Fixed-window rate limit lintas instance untuk Edge Functions. Hanya diakses service_role.';
comment on function public.check_rate_limit(text, text, integer, integer) is
  'Kembalikan true jika permintaan masih di bawah batas. Panggil dari Edge Function dengan service_role.';

-- Verifikasi:
-- select public.check_rate_limit('test', 'ip-1', 2, 60);
-- select * from public.rate_limits order by window_start desc limit 5;
