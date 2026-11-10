# Backup & Pemulihan

Dokumen ini menjelaskan cara menjaga data A Chapter (Supabase Postgres +
Storage) dan langkah pemulihan jika terjadi kesalahan.

## 1. Yang perlu dibackup

| Aset | Lokasi | Frekuensi |
| --- | --- | --- |
| Database Postgres | Supabase project `fcevjiflawxmzrccramo` | Harian (otomatis) + mingguan (artifact) |
| Storage `product-images` | Supabase Storage | Mingguan |
| Storage `vault-media` | Supabase Storage | Mingguan |
| Secret & env | Vercel + Supabase Dashboard | Saat berubah |

## 2. Backup otomatis Supabase

- **Plan Free**: backup harian terbatas, retensi ±7 hari. Tidak ada PITR.
- **Plan Pro**: daily backup + opsi Point-in-Time Recovery (PITR).
- Aktifkan PITR di Dashboard → **Database → Backups** jika anggaran
  memungkinkan. PITR adalah satu-satunya cara pulih dari `DELETE`/`UPDATE`
  yang tidak disengaja tanpa kehilangan data harian.

## 3. Backup mingguan via GitHub Actions

Workflow `.github/workflows/backup.yml` menjalankan `pg_dump` setiap
Minggu 18:00 UTC dan menyimpan artifact selama 30 hari.

Aktifkan dengan menambahkan repository secret:

```text
SUPABASE_DB_URL = postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres?sslmode=require
```

Gunakan connection string **Session/Direct** (bukan transaction pooler) agar
`pg_dump` berjalan normal. Workflow akan skip otomatis jika secret kosong.

## 4. Backup manual (sebelum migrasi besar)

```bash
# Database
pg_dump "$SUPABASE_DB_URL" \
  --no-owner --no-privileges \
  --format=custom \
  --file="achapter-$(date +%F).dump"

# Storage (butuh Supabase CLI yang berfungsi + akses project)
supabase storage cp -r ss:///product-images ./backup/product-images
supabase storage cp -r ss:///vault-media ./backup/vault-media
```

Simpan file `.dump` di tempat aman (bukan di repo). File ini berisi data
pribadi pelanggan dan isi vault — perlakukan sebagai rahasia.

## 5. Restore database

1. **Buat project Supabase baru** (jangan restore ke produksi yang sedang
   melayani pengguna).
2. Restore dump:

   ```bash
   pg_restore \
     --no-owner --no-privileges \
     --dbname="$TARGET_DB_URL" \
     achapter-YYYY-MM-DD.dump
   ```

3. Jalankan ulang migrasi yang belum ada (urutan nama file):
   ```bash
   supabase db push
   ```
4. Verifikasi:
   ```sql
   select count(*) from public.products;
   select count(*) from public.preorder_orders;
   select id, vault_setup_token is not null, vault_locked_at
     from public.preorder_orders order by created_at desc limit 5;
   ```
5. Uji alur: buka `/produk?id=...`, preview vault, dan `/vault-setup?token=...`
   di project baru sebelum mengarahkan DNS/env Vercel.

## 6. Restore satu baris (tanpa full restore)

Untuk kesalahan pada satu produk/pesanan, gunakan data dari dump:

```bash
pg_restore --data-only --table=public.products \
  --dbname="$TARGET_DB_URL" achapter-YYYY-MM-DD.dump
```

Atau pulihkan lewat panel Admin:

- Produk yang tidak sengaja dihapus → tombol **Pulihkan** (soft delete).
- Produk yang dihapus permanen → restore dari dump/PITR.

## 7. Uji restore berkala

Minimal setiap kuartal:

1. Restore dump terbaru ke project staging.
2. Jalankan checklist verifikasi di atas.
3. Catat waktu restore (target < 30 menit untuk dataset saat ini).

## 8. Audit log

Tabel `public.audit_log` mencatat perubahan produk & pesanan (aksi, aktor,
nama kolom yang berubah — tanpa nilai). Gunakan untuk menelusuri kapan suatu
data berubah sebelum memutuskan restore:

```sql
select created_at, table_name, record_id, action, changed_columns
from public.audit_log
order by created_at desc
limit 50;
```
