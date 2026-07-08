# Operasional Floramory

## Environment Vercel

Tambahkan variable berikut di Vercel Project Settings -> Environment Variables:

```text
VITE_SUPABASE_URL=https://fcevjiflawxmzrccramo.supabase.co
VITE_SUPABASE_ANON_KEY=isi_anon_public_key
VITE_WA_NUMBER=6281234567890
```

Redeploy project setelah environment variable diubah.

## Supabase

Tabel utama:

```text
products
```

Tabel pengaturan:

```sql
create table if not exists public.app_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

alter table public.app_settings enable row level security;

create policy "Pengaturan publik bisa dibaca"
on public.app_settings
for select
using (key in ('wa_number'));

create policy "Admin login bisa kelola pengaturan"
on public.app_settings
for all
to authenticated
using (true)
with check (true);

insert into public.app_settings (key, value)
values ('wa_number', '6281234567890')
on conflict (key) do nothing;
```

Kolom minimum:

```text
id, nama_produk, tier, harga, bunga, deskripsi, bahan, ukuran,
nama_pembeli, dari, pesan_personal, foto_produk, foto_qr, status,
created_at, updated_at
```

Status yang dipakai aplikasi:

```text
active   = tampil di halaman utama dan QR
archived = disembunyikan dari publik
```

Aktifkan Row Level Security. Policy yang dibutuhkan:

```sql
create policy "Produk aktif bisa dilihat publik"
on public.products
for select
using (status = 'active');

create policy "Admin login bisa kelola produk"
on public.products
for all
to authenticated
using (true)
with check (true);
```

## Admin Panel

Buka:

```text
https://domain-vercel.app/admin
```

Gunakan akun dari Supabase Authentication.

Alur kerja:

1. Isi Base URL dengan domain publik Vercel.
2. Tambahkan produk melalui form.
3. Klik Simpan Produk + Generate QR.
4. Klik Cek di daftar produk sebelum QR dicetak.
5. Gunakan Edit untuk memperbarui produk.
6. Gunakan Hapus untuk menyembunyikan produk dari publik.

## QR Produk

Format URL QR:

```text
https://domain-vercel.app/produk?id=ID_PRODUK
```

Jangan cetak QR dari URL localhost.

## Perawatan Rutin

- Cek halaman utama setelah menambah produk.
- Cek URL QR produk sebelum dicetak.
- Pastikan gambar `foto_produk` dan `foto_qr` memakai URL publik.
- Jangan membagikan Supabase service role key.
- Jika produk tidak muncul, cek `status` produk di Supabase harus `active`.
