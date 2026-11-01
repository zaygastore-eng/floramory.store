# Floramory

Website Floramory untuk katalog preserved flower, halaman produk Smart QR,
Memory Vault, dan formulir Pre-Order. Aplikasi frontend menggunakan React dan
Vite, dengan Supabase sebagai sumber data dan backend.

## Struktur Proyek

- `frontend/` — aplikasi React, halaman, dan aset publik.
- `supabase/migrations/` — skema dan migrasi database Supabase.
- `supabase/functions/` — Supabase Edge Functions untuk pre-order dan admin.
- `api/` — fungsi Vercel untuk halaman detail produk dan preview SEO.
- `docs/OPERASIONAL.md` — setup Supabase, deployment, pengaturan admin,
  alur operasional pre-order, dan QR produk.

## Menjalankan Secara Lokal

Pasang dependencies dari root proyek:

```bash
pnpm install
```

Buat `frontend/.env.local` dan isi konfigurasi Supabase:

```dotenv
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<supabase-anon-key>
```

Variabel opsional:

```dotenv
VITE_WA_NUMBER=6285235242425
VITE_SUPABASE_FUNCTIONS_URL=
VITE_SENTRY_DSN=
```

`VITE_WA_NUMBER` adalah nomor WhatsApp fallback; nomor yang dikonfigurasi di
`app_settings` Supabase digunakan jika tersedia. `VITE_SUPABASE_FUNCTIONS_URL`
mengatur base URL Edge Functions jika tidak memakai endpoint default. Jangan
menaruh service-role key atau rahasia server dalam variabel `VITE_*`.

Perintah utama (dijalankan dari root):

```bash
pnpm dev
pnpm typecheck
pnpm build
pnpm serve
```

`pnpm dev` dan `pnpm serve` menjalankan server lokal. Gunakan `pnpm typecheck`
untuk pemeriksaan TypeScript tanpa menjalankan server.

## Fitur Utama

- Katalog produk dan formulir Pre-Order.
- Pilihan tanggal acara/dibutuhkan dengan buffer produksi minimal tiga hari.
- Setelah pengiriman pre-order berhasil, konfirmasi dibuka di WhatsApp agar
  pelanggan dapat melanjutkan konfirmasi detail dan DP.
- Halaman detail Smart QR dengan Memory Vault untuk pesan personal.

## Dokumentasi

Lihat [panduan operasional](docs/OPERASIONAL.md) untuk petunjuk setup
Supabase dan Edge Functions, environment deployment, admin, dan operasional
website.
