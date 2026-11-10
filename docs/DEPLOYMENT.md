# Deployment & Operasional Backend

## Urutan deploy (wajib)

Migrasi harus berjalan **sebelum** Edge Function baru di-deploy, karena fungsi
sudah membaca kolom/tabel baru.

1. **Backup** database (lihat `docs/BACKUP_RESTORE.md`).
2. **Migrasi** (SQL Editor atau `supabase db push`), urut:
   - `20261109010000_vault_media_50mb_and_video.sql`
   - `20261110000000_product_images_10mb.sql`
   - `20261111000000_vault_security_hardening.sql`
   - `20261112000000_database_integrity.sql`
   - `20261113000000_rate_limit_and_operations.sql`
3. **Edge Functions**:
   ```bash
   supabase functions deploy vault-otp
   supabase functions deploy vault-setup
   supabase functions deploy send-preorder
   supabase functions deploy notify-dp-confirmed
   ```
   Folder `_shared/` ikut ter-bundle otomatis; tidak perlu di-deploy sendiri.
4. **Vercel**: redeploy (termasuk `api/seo.ts`, `api/health.ts`).

## Secret Edge Function

```bash
supabase secrets set \
  RESEND_API_KEY=re_xxx \
  EMAIL_FROM="A Chapter <notify@achapter.my.id>" \
  ADMIN_NOTIFICATION_EMAILS="atelier@achapter.my.id" \
  VAULT_UNLOCK_SECRET="<random 32+ bytes>"
```

- `VAULT_UNLOCK_SECRET` dipakai untuk menandatangani token sesi vault 30 menit.
  Jika tidak diatur, fungsi memakai service role key sebagai fallback.
- Tanpa `RESEND_API_KEY`, email menjadi no-op; pemesanan & vault tetap jalan.
- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` sudah
  disediakan otomatis oleh Supabase.

## Env Vercel

| Variable | Fungsi |
| --- | --- |
| `VITE_SUPABASE_URL` | REST + build frontend |
| `VITE_SUPABASE_ANON_KEY` | REST + build frontend |
| `VITE_SUPABASE_FUNCTIONS_URL` | Opsional; default `/api` (rewrite) |
| `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` | Upload source map |

## Health check & monitoring

- `GET /api/health` → `200` jika PostgREST terjangkau, `503` jika tidak.
  Response berisi `latencyMs`, `commit`, dan status `database`.
- Pasang uptime monitor (Better Stack/UptimeRobot) ke endpoint tersebut,
  interval 5 menit, alert ke email/Telegram.
- Log Edge Function: Supabase Dashboard → **Edge Functions → Logs**.
  Cari prefix `[VAULT_PIN_ERROR]`, `[VAULT_SETUP_*]`, `[PREORDER_*]`,
  `[EMAIL_ERROR]`, `[RATE_LIMIT_ERROR]`.
- Frontend error: Sentry (jika DSN diatur).

## Rate limit

| Bucket | Batas | Window |
| --- | --- | --- |
| `send-preorder-ip` | 6 / IP | 10 menit |
| `vault-otp-ip` | 40 / IP | 10 menit |
| `vault-setup-ip` | 60 / IP | 10 menit |
| Percobaan PIN | 5 / produk | 15 menit (DB) |
| Pre-order per nomor WA | 3 / nomor | 24 jam (DB) |

Rate limit berbasis DB memakai RPC `check_rate_limit` dan fail-open jika RPC
belum tersedia, supaya pemesanan tidak ikut mati saat deploy bertahap.

## CI

`.github/workflows/ci.yml` menjalankan `pnpm install --frozen-lockfile`,
`pnpm typecheck`, dan `pnpm build` pada setiap push/PR ke `main`.

## Checklist setelah deploy

- [ ] `/api/health` mengembalikan `ok: true`.
- [ ] Katalog publik tampil dan produk `is_catalog = false` tidak bocor.
- [ ] Buka `/vault/<id>`: isi vault tidak muncul sebelum PIN.
- [ ] PIN salah 5x → terkunci 15 menit.
- [ ] `/vault-setup?token=...` bisa dibuka, lalu terkunci setelah simpan.
- [ ] Pre-order baru masuk dan email atelier terkirim (jika Resend aktif).
- [ ] Audit log bertambah saat produk/pesanan diubah.
