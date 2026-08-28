# Operasional Floramory

## Struktur Monorepo

Proyek dipisah menjadi dua package dalam satu workspace (pnpm):

```text
FLORAMORY REALL/          # root workspace (repo)
├── package.json          # workspace root (script delegasi: dev, build, start)
├── pnpm-workspace.yaml   # mencakup frontend & backend
├── frontend/             # React + Vite (src, public, dist build)
│   ├── .env.local        # variabel VITE_* (dibaca Vite)
│   └── package.json      # dependency frontend
└── backend/              # Node API murni (hanya /api/*)
    ├── .env              # variabel SHEETS_* / ADMIN_API_TOKEN / PORT
    ├── index.mjs         # server HTTP API
    ├── db/migrations/    # SQL migrasi
    └── docs/             # dokumentasi operasional
```

Perintah:

```text
pnpm install            # install workspace di root
pnpm dev                # jalankan frontend (Vite) di port 3000
pnpm dev:api            # jalankan backend (API) di port 3001
pnpm build              # build frontend -> frontend/dist
pnpm start              # jalankan backend API production
```

Frontend memanggil backend lewat proxy `/api` (saat dev menuju `http://localhost:3001`).
Untuk production terpisah, set `VITE_API_BASE_URL` di `frontend/.env.local`.

## Environment Vercel

Frontend dideploy sebagai static site (Spa). Tambahkan variable berikut di
Vercel Project Settings -> Environment Variables:

```text
VITE_SUPABASE_URL=https://fcevjiflawxmzrccramo.supabase.co
VITE_SUPABASE_ANON_KEY=isi_anon_public_key
VITE_WA_NUMBER=6281234567890
```

Redeploy project setelah environment variable diubah. Konfigurasi build ada di
`vercel.json` (buildCommand memakai pnpm workspace, outputDirectory `frontend/dist`).

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

Tabel pre-order:

```sql
create table if not exists public.preorder_orders (
  id uuid primary key default gen_random_uuid(),
  customer_name text not null,
  whatsapp text not null,
  product_id text,
  product_name text,
  custom_request text,
  recipient_name text,
  sender_name text,
  personal_message text,
  status text not null default 'new',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.preorder_orders enable row level security;

create policy "Publik bisa mengirim pre-order"
on public.preorder_orders
for insert
with check (true);

create policy "Admin login bisa melihat pre-order"
on public.preorder_orders
for select
to authenticated
using (true);

create policy "Admin login bisa mengubah pre-order"
on public.preorder_orders
for update
to authenticated
using (true)
with check (true);
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
2. Lihat pesanan pelanggan di kartu Pre-order masuk.
3. Klik Pakai pada pre-order untuk memasukkan data Memory Vault ke form produk.
4. Lengkapi data produk dan foto.
5. Klik Simpan Produk + Generate QR.
6. Klik Cek di daftar produk sebelum QR dicetak.
7. Gunakan Edit untuk memperbarui produk.
8. Gunakan Hapus untuk menyembunyikan produk dari publik.

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
