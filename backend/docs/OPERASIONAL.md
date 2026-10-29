# Operasional Floramory

## Struktur Monorepo

Proyek memakai pnpm workspace. Supabase adalah satu-satunya penyimpan data;
tidak ada server Node terpisah.

```text
FLORAMORY REALL/          # root workspace (repo)
├── package.json          # workspace root (script delegasi: dev, build, serve)
├── pnpm-workspace.yaml   # mencakup frontend
├── frontend/             # React + Vite (src, public, dist build) -> Supabase langsung
│   ├── .env.local        # variabel VITE_* (dibaca Vite)
│   └── package.json      # dependency frontend
└── backend/              # lapisan data Supabase (bukan server Node)
    ├── .env.example      # panduan variabel Supabase untuk frontend
    ├── functions/        # Supabase Edge Function: send-preorder + admin
    ├── db/migrations/    # SQL skema Supabase (satu-satunya sumber skema)
    └── docs/             # dokumentasi operasional
```

Perintah:

```text
pnpm install            # install workspace di root
pnpm dev                # jalankan frontend (Vite, proxy /api -> Supabase functions)
pnpm build              # build frontend -> frontend/dist
pnpm serve              # preview hasil build
```

Frontend memanggil Supabase untuk baca data (REST via anon key) di
`frontend/src/lib/sheets.ts`. Dua jalur yang SARAT aturan keamanan melewati
Supabase Edge Function (lihat "Edge Function" di bawah) dengan prefix
same-origin `/api` (Vercel rewrite di production / Vite proxy saat dev):

- **send-preorder** — pengiriman pre-order (anti-spam: rate limit, honeypot,
  validasi server). Jalur insert langsung ke `preorder_orders` sudah DITUTUP
  dari publik.
- **admin** — login, status, dan semua operasi admin (CRUD produk, pre-order,
  nomor WA). Sesi admin disimpan dalam **cookie HttpOnly** (bukan localStorage),
  sehingga token Supabase tidak pernah terlihat oleh JavaScript/XSS.

Tidak ada backend API lokal maupun fallback Google Sheets.

## Environment Vercel

Frontend dideploy sebagai static site (Spa). Tambahkan variable berikut di
Vercel Project Settings -> Environment Variables:

```text
VITE_SUPABASE_URL=https://fcevjiflawxmzrccramo.supabase.co
VITE_SUPABASE_ANON_KEY=isi_anon_public_key
VITE_WA_NUMBER=6281234567890
VITE_SENTRY_DSN=isi_sentry_dsn
```

Sentry hanya diinisialisasi pada build production. Untuk upload source map,
tambahkan `SENTRY_ORG`, `SENTRY_PROJECT`, dan `SENTRY_AUTH_TOKEN` sebagai
environment variable build yang privat di Vercel. Jangan beri prefix `VITE_`
pada token autentikasi.

Konfigurasi di `vercel.json`:
- `rewrites`: `/api/admin` -> `https://fcevjiflawxmzrccramo.supabase.co/functions/v1/admin` dan
  `/api/send-preorder` -> `https://fcevjiflawxmzrccramo.supabase.co/functions/v1/send-preorder`
  (daftar eksplisit, bukan `:path*` generik — supaya tidak membajak fungsi
  prerender `/api/produk`). URL ini harus sesuai dengan `VITE_SUPABASE_URL`.
  Proxy ini yang membuat cookie sesi admin same-origin sehingga
  bisa memakai `SameSite=Strict` (aman dari CSRF) sekaligus `HttpOnly` (aman dari XSS).
- `rewrites`: `/produk` -> `/api/produk` (prerender SEO, lihat "SEO halaman detail"),
  lalu SPA fallback ke `index.html`.
- `headers`: Content-Security-Policy, `X-Frame-Options: DENY`, `nosniff`,
  `Referrer-Policy`, `Permissions-Policy`, HSTS (defense in depth terhadap XSS
  & clickjacking).

Atur environment variables untuk **Production**, **Preview**, dan **Development**
sesuai kebutuhan di Vercel Project Settings -> Environment Variables. `VITE_*`
dibundel ke frontend saat build; redeploy setelah mengubah nilainya. Jangan
menambahkan `SUPABASE_SERVICE_ROLE_KEY` ke Vercel frontend atau variabel `VITE_*`.

## Supabase

Supabase adalah satu-satunya sumber data. Skema lengkap (tabel + RLS + policy +
grant + constraint tier + seed) tersedia di
`backend/db/migrations/0001_schema.sql` — satu-satunya sumber skema.

### Setup awal (dijalankan sekali)

1. Jalankan `backend/db/migrations/0001_schema.sql` di Supabase SQL Editor.
2. Jalankan `backend/db/migrations/0004_preorder_edge_function.sql`
   (menutup jalur insert publik — lihat catatan di file tersebut).
3. Deploy kedua Supabase Edge Function: `send-preorder` dan `admin`
   (detail: "Edge Function").
4. Buat 1 akun admin di Supabase Authentication -> Users (email + sandi).
5. Daftarkan akun admin tersebut agar bisa mengakses admin panel (wajib):

   ```sql
   insert into public.admin_users (id)
   select id from auth.users where email = 'EMAIL_ADMIN_KAMU';
   ```

6. Set `VITE_SUPABASE_URL` dan `VITE_SUPABASE_ANON_KEY` di `frontend/.env.local`
   (dan di Vercel Environment Variables untuk production). Ganti URL proyek
   pada rewrite `/api` di `vercel.json`.
7. Redeploy frontend, lalu buka `/admin` dan masuk dengan akun admin.

> Akses kelola di database dibatasi hanya untuk user di `public.admin_users`
> (duji lewat `public.is_admin()`, yang memeriksa `auth.uid()`). User login
> biasa yang tidak terdaftar tidak dapat membaca/mengubah/menghapus data.

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

create policy "Public can read app settings"
on public.app_settings
for select
to anon, authenticated
using (key = 'wa_number');

-- Hanya admin tersimpan (admin_users) yang boleh mengubah pengaturan.
create policy "Authenticated admin can manage app settings"
on public.app_settings
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

insert into public.app_settings (key, value)
values ('wa_number', '6281234567890')
on conflict (key) do nothing;
```

Tabel pre-order — PRIVASI & anti-spam:

```sql
create table if not exists public.preorder_orders (
  id uuid primary key default gen_random_uuid(),
  customer_name text not null default '',
  whatsapp text not null default '',
  product_id text not null default '',
  product_name text not null default '',
  custom_request text not null default '',
  recipient_name text not null default '',
  sender_name text not null default '',
  personal_message text not null default '',
  status text not null default 'new',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.preorder_orders enable row level security;

-- PRIVASI: anon tanpa grant apa pun (tidak bisa membaca/menulis).
-- authenticated hanya punya SELECT & UPDATE, DAN policy di bawah
-- memakai is_admin() -> baris hanya terbuka untuk admin tersimpan.
-- User biasa yang login tetap mendapat 0 baris: whatsapp, pesan
-- personal, dst. tidak pernah bocor.
grant select, update on public.preorder_orders to authenticated;
revoke insert, delete on public.preorder_orders from authenticated;
revoke all on public.preorder_orders from anon;

-- TIDAK ada policy insert untuk anon/authenticated:
-- semua baris hanya masuk lewat edge function send-preorder.
create policy "Authenticated admin can manage preorder"
on public.preorder_orders
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- Batas panjang field di level database (defense in depth).
alter table public.preorder_orders drop constraint if exists preorder_orders_field_lengths;
alter table public.preorder_orders
  add constraint preorder_orders_field_lengths check (
    length(customer_name)     <= 120
    and length(whatsapp)      <= 20
    and length(product_id)    <= 120
    and length(product_name)  <= 160
    and length(custom_request)  <= 2000
    and length(recipient_name)  <= 120
    and length(sender_name)     <= 120
    and length(personal_message) <= 2000
  ) not valid;
```

## Edge Function — send-preorder

Lokasi: `supabase/functions/send-preorder/index.ts`.

Fungsi ini satu-satunya jalur masuk pre-order (berjalan dengan
`service_role`, jadi melewati RLS). Ia menerapkan lapisan proteksi anti-spam:

1. **JWT** — request wajib membawa JWT proyek yang valid (browser mengirim
   anon key sebagai Bearer token). Request tanpa JWT ditolak di gateway.
2. **Bot** — menolak user-agent bot/script, field **honeypot** (`website`)
   yang hanya diisi bot, dan **time-trap** (form dikirim < 1,2 detik
   dianggap bot).
3. **Rate limit** — maks. 6 request per IP per 10 menit (in-memory) dan
   maks. 3 pre-order per nomor WhatsApp per 24 jam (lewat DB).
4. **Validasi server** — panjang field dibatasi, nomor WA dinormalisasi
   dan diperiksa format `62xxxxxxxxxx`, serta produk harus ada dan
   berstatus `active` (nama produk diambil dari database, tidak percaya
   input client).

Deploy:

```bash
supabase functions deploy send-preorder
```

Env yang dipakai runtime (otomatis tersedia di Supabase):
`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`. Jangan pernah membagikan
`SUPABASE_SERVICE_ROLE_KEY` ke frontend/Vercel.

## Edge Function — admin (sesi & operasi admin)

Lokasi: `supabase/functions/admin/index.ts`.

Melayani login, logout, cek status sesi, dan PROXY semua operasi admin
ke PostgREST. Token Supabase **tidak pernah disimpan di `localStorage`**
— itu celah XSS. Sebagai gantinya:

- Sesi disimpan dalam **cookie `HttpOnly`**: `fm_at` (access token, 1 jam)
  dan `fm_rt` (refresh token, 30 hari). Cookie `Secure` + `SameSite=Strict`,
  di-set oleh fungsi lewat respons `/api/admin` sehingga host-nya = domain
  frontend (bukan `supabase.co`) — berkat proxy `/api` di `vercel.json` /
  Vite. JavaScript tidak bisa membaca cookie ini.
- Karena `SameSite=Strict`, cookie tidak dikirim oleh situs lain (tahan
  CSRF). Ditambah lagi **anti-CSRF double-submit**: cookie `fm_csrf`
  (dibaca JS) harus dikembalikan sebagai header `X-CSRF-Token` di tiap
  operasi; fungsi membandingkannya.
- **Login**: fungsilah yang melakukan `grant_type=password` ke Supabase
  Auth (kredensial tidak lewat PostgREST), lalu memvalidasi `is_admin()`
  sebelum mengeluarkan cookie. Ada rate limit login per-IP (5×/15 mnt).
- **Proxy**: hanya path PostgREST tertentu yang diizinkan
  (`/rest/v1/products`, `/rest/v1/preorder_orders`, `/rest/v1/app_settings`),
  sesi harus valid + `is_admin()`, dan request diteruskan memakai token
  PENGUNJUNG asli -> **RLS tetap berlaku**. Saat token akses kedaluwarsa,
  fungsi menukar refresh token lalu menerbitkan cookie baru.

Frontend `frontend/src/lib/sheets.ts` memanggil fungsi ini via
`POST /api/admin` (`credentials: include`) dan memakai
`statusAdminSession()` untuk cek sesi di awal render.

Deploy (JWT gateway tetap aktif — frontend mengirim anon key sebagai JWT):

```bash
supabase functions deploy admin
```

Env yang dipakai runtime (otomatis tersedia): `SUPABASE_URL`,
`SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.

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

create policy "Hanya admin terdaftar bisa kelola produk"
on public.products
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());
```

Fungsi `public.is_admin()` memeriksa apakah `auth.uid()` terdaftar di
`public.admin_users` (exact sama seperti di `0001_schema.sql`).

Grant privilege (PENTING — proxy admin berjalan dengan TOKEN PENGUNJUNG,
dan PostgREST mengecek privilege tabel di luar RLS):

```sql
-- products
grant select on public.products to anon, authenticated;           -- katalog publik
grant select, insert, update on public.products to authenticated; -- kelola (RLS is_admin)

-- app_settings
grant select on public.app_settings to anon, authenticated;          -- HANYA key wa_number via policy
grant select, insert, update on public.app_settings to authenticated;

-- preorder_orders (PRIVASI — anon tanpa akses; baca admin via RLS is_admin)
grant select, update on public.preorder_orders to authenticated;
revoke insert, delete on public.preorder_orders from authenticated;
revoke all on public.preorder_orders from anon;
```

Tanpa grant `select/update` di `preorder_orders`, panel admin tidak bisa
membaca/update pre-order (error 42501 permission denied). Non-admin yang
login tetap mendapat 0 baris karena policy `using (is_admin())`.

## Admin Panel

Buka:

```text
https://domain-vercel.app/admin
```

Gunakan akun dari Supabase Authentication.

Sesi admin berupa cookie HttpOnly (`fm_at`/`fm_rt`) di domain website,
dikelola oleh Edge Function `admin` lewat `/api/admin`. Di browser baru,
login sekali lalu sesi tersimpan 30 hari (refresh token dirotasi otomatis);
logout menghapus cookie.

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

## Foto Produk & QR (Storage)

Foto `foto_produk` / `foto_qr` sebaiknya berupa URL **Supabase Storage**
(`.../storage/v1/object/public/product-images/...`), bukan URL eksternal:

- Panel admin menyediakan tombol **Unggah & Optimasi**: file dikompresi &
  di-resize ke WebP di browser (maks. 5 MB), lalu dikirim lewat sesi admin
  (cookie HttpOnly) ke storage bucket `product-images`.
- Saat ditampilkan, URL storage otomatis di-optimasi **CDN Image Transform**
  (`?width=&height=&format=auto` -> WebP/AVIF): katalog memakai thumbnail
  600px, modal/halaman scan QR memakai 1200px.
- URL eksternal (imgbb, Drive, dll.) tetap tampil, tapi tidak di-optimasi
  CDN; unggah lewat tombol di atas untuk hasil terbaik.
- Bucket dibatasi: publik hanya bisa baca; upload/update/hapus hanya sesi
  admin (`is_admin()`); ukuran max 5 MB & hanya tipe gambar (migrasi
  `0005_product_images_storage.sql`).

## SEO halaman detail (prerender)

Halaman `/produk?id=...` dirender di browser. Untuk preview media sosial
(Facebook, X/Twitter, LinkedIn, WhatsApp) yang tidak menjalankan JavaScript,
tersedia fungsi serverless Vercel `api/produk.ts`:

- Request `GET /produk?id=X` di-rewrite ke `/api/produk`, fungsi mengambil
  shell `frontend/dist/index.html` dari filesystem (file disertakan dalam bundle
  fungsi), membaca produk dari PostgREST (observasi RLS: hanya `status='active'`
  yang terbaca anon), lalu menyuntikkan `og:title`,
  `og:description`, `og:image` (foto produk atau `opengraph.jpg`), `og:url`,
  `twitter:*`, dan `canonical` sebelum mengirim HTML.
- React tetap memuat normal untuk interaktivitas; SEO browser (Google/Bing yang
  menjalankan JS) tetap memakai tag yang di-set runtime dari `src/lib/seo.ts`.
- Env yang dibutuhkan: `VITE_SUPABASE_URL` & `VITE_SUPABASE_ANON_KEY` (sudah ada
  utk build). Tanpa keduanya, fungsi mengirim shell apa adanya.
- Catatan: `/api/:path*` generik sudah diganti daftar eksplisit (`/api/admin`,
  `/api/send-preorder`). Jika menambah Supabase Edge Function baru, tambahkan
  baris rewrite-nya.
- Uji setelah deploy (baca hasil header awal yang terlihat crawler):
  `curl -s https://domain-vercel.app/produk?id=ID_PRODUK | Select-String "og:title|og:image|canonical"`

## Perawatan Rutin

- Cek halaman utama setelah menambah produk.
- Cek URL QR produk sebelum dicetak.
- Pastikan gambar `foto_produk` dan `foto_qr` dipakai dari Supabase Storage
  (hasil unggah otomatis), bukan URL eksternal besar.
- Jangan membagikan Supabase service role key.
- Jika produk tidak muncul, cek `status` produk di Supabase harus `active`.
- Jika admin tiba-tiba logout / gagal, cek console: fungsi `admin` harus
  ter-deploy dan rewrite `/api` di `vercel.json` menunjuk URL proyek yang benar.
