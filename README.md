# ASE Project Backend — Edukasi Literasi Keuangan

Backend API untuk aplikasi edukasi literasi keuangan.

> Spesifikasi produk (PRD) dan SRS disimpan terpisah dari repo ini. Minta aksesnya ke tim.

## 🚀 Tech Stack

- **Runtime:** Bun
- **Framework:** Express 5 (TypeScript)
- **Database & ORM:** PostgreSQL + Prisma ORM 7
- **Authentication & Validation:** JWT, Argon2id, Zod

## 🛠️ Cara Menjalankan

1. **Install dependensi**

   ```bash
   bun install
   ```

   Prisma Client ikut di-generate otomatis lewat `postinstall`, jadi
   `bun test` dan `bun run typecheck` sudah bisa dijalankan tanpa setup lain.
   Langkah berikutnya hanya diperlukan kalau Anda mau menjalankan servernya.

2. **Setup environment**

   Salin `.env.example` menjadi `.env`, lalu sesuaikan isinya.

   ```bash
   cp .env.example .env
   ```

   Catatan penting:
   - `JWT_ACCESS_SECRET` dan `JWT_REFRESH_SECRET` minimal 32 karakter dan **harus berbeda**.
   - `CORS_ORIGIN` wajib diisi saat `NODE_ENV=production`; server menolak start jika kosong.
   - **Supabase:** gunakan connection string **Session Pooler**, bukan Direct connection (lihat Troubleshooting).

3. **Migrasi database & isi kategori bawaan**

   ```bash
   bun run db:migrate     # development
   bun run db:deploy      # production
   bun run db:seed        # kategori bawaan, aman dijalankan berulang
   ```

4. **Jalankan server**

   ```bash
   bun dev                # development, auto-reload
   bun start              # production
   ```

## 📜 Skrip

| Perintah              | Keterangan                            |
| --------------------- | ------------------------------------- |
| `bun dev`             | Jalankan server dengan auto-reload    |
| `bun start`           | Jalankan server                       |
| `bun test`            | Jalankan test                         |
| `bun run typecheck`   | Cek tipe TypeScript                   |
| `bun run db:migrate`  | Buat & terapkan migrasi (development) |
| `bun run db:seed`     | Isi kategori bawaan & ide income (idempotent) |
| `bun run db:deploy`   | Terapkan migrasi (production)         |
| `bun run db:generate` | Generate Prisma Client                |
| `bun run db:studio`   | Buka Prisma Studio                    |

## 📁 Struktur

```
src/
├── config/       # env, database
├── docs/         # generator dokumen OpenAPI
├── controllers/  # HTTP layer
├── middlewares/  # auth, role, validate, rate-limit, request-id, error
├── routes/       # definisi endpoint
├── schemas/      # Zod schema
├── services/     # business logic (satu-satunya lapisan yang menyentuh prisma)
├── utils/        # jwt, password, logger, money, datetime, error
├── types/        # deklarasi tipe global
├── app.ts
└── server.ts
tests/            # bun test
```

Aturan: **controller tidak memanggil `prisma` langsung.** Semua akses database lewat service.

## 🔌 Endpoint

Base path: `/api/v1`. Autentikasi memakai header `Authorization: Bearer <accessToken>`.

**Dokumentasi interaktif:** jalankan server lalu buka <http://localhost:3000/api/v1/docs>
(spesifikasi mentah di `/api/v1/docs/openapi.json`). Dokumen itu dibangun langsung
dari schema Zod yang dipakai untuk validasi, jadi tidak bisa melenceng dari perilaku API.

| Method | Endpoint                        | Auth | Keterangan                                       |
| ------ | ------------------------------- | ---- | ------------------------------------------------ |
| GET    | `/health`                       | –    | Liveness probe                                   |
| GET    | `/health/ready`                 | –    | Readiness probe (cek koneksi database)           |
| GET    | `/api/v1/docs`                  | –    | Dokumentasi API interaktif                       |
| POST   | `/api/v1/auth/register`         | –    | Daftar akun baru                                 |
| POST   | `/api/v1/auth/login`            | –    | Login                                            |
| POST   | `/api/v1/auth/refresh`          | –    | Tukar refresh token (dengan rotasi)              |
| POST   | `/api/v1/auth/logout`           | –    | Cabut sesi                                       |
| GET    | `/api/v1/users/me`              | ✔    | Profil sendiri                                   |
| PATCH  | `/api/v1/users/me`              | ✔    | Ubah profil sendiri                              |
| GET    | `/api/v1/categories`            | ✔    | Kategori bawaan + milik sendiri                  |
| POST   | `/api/v1/categories`            | ✔    | Tambah kategori kustom                           |
| PATCH  | `/api/v1/categories/:id`        | ✔    | Ubah kategori sendiri                            |
| DELETE | `/api/v1/categories/:id`        | ✔    | Hapus kategori; transaksinya pindah ke Lain-lain |
| GET    | `/api/v1/savings/ratio/presets` | –    | Preset rasio 60:30:10, 50:30:20, 70:20:10        |
| POST   | `/api/v1/savings/ratio/calculate` | ✔  | Hitung alokasi dana (tidak disimpan)             |
| GET    | `/api/v1/savings/ratio`         | ✔    | Rasio tersimpan milik user                       |
| PUT    | `/api/v1/savings/ratio`         | ✔    | Simpan/ubah rasio kustom                         |
| POST   | `/api/v1/goals`                 | ✔    | Buat target tabungan                             |
| GET    | `/api/v1/goals`                 | ✔    | Daftar target                                    |
| GET    | `/api/v1/goals/:id`             | ✔    | Detail + progress terbaru                        |
| GET    | `/api/v1/goals/:id/gap`         | ✔    | Analisis gap + rekomendasi income                |
| PATCH  | `/api/v1/goals/:id`             | ✔    | Ubah target                                      |
| DELETE | `/api/v1/goals/:id`             | ✔    | Hapus target (transaksi tetap ada)               |
| GET    | `/api/v1/income-ideas`          | ✔    | Ide penambahan income per kelompok usia          |
| POST   | `/api/v1/transactions`          | ✔    | Catat transaksi                                  |
| GET    | `/api/v1/transactions`          | ✔    | Riwayat + filter + pagination                    |
| GET    | `/api/v1/transactions/summary`  | ✔    | Ringkasan & data grafik                          |
| GET    | `/api/v1/transactions/:id`      | ✔    | Detail transaksi                                 |
| PATCH  | `/api/v1/transactions/:id`      | ✔    | Ubah transaksi                                   |
| DELETE | `/api/v1/transactions/:id`      | ✔    | Hapus transaksi                                  |

### Konvensi penting

**Nominal uang dikirim sebagai string**, bukan number:

```json
{ "type": "EXPENSE", "amount": "15000.55", "occurredAt": "2026-09-18" }
```

Disimpan sebagai `DECIMAL(14,2)`. `Number` JavaScript tidak dapat merepresentasikan
pecahan desimal secara tepat (`0.1 + 0.2 !== 0.3`), sehingga agregasi lewat `Number`
bisa menghasilkan selisih rupiah pada laporan.

**Laporan dikelompokkan menurut waktu Asia/Jakarta**, bukan UTC. Transaksi jam
23:30 WIB masuk ke hari itu juga, bukan hari berikutnya. Nilai tetap disimpan
dalam UTC; konversi dilakukan saat agregasi.

**Filter tanggal bersifat inklusif** — `?from=2026-09-19&to=2026-09-19` mencakup
seluruh hari tersebut dalam waktu WIB.

**Alokasi rasio selalu berjumlah persis sama dengan pemasukan.** Tiap bagian
dibulatkan ke bawah ke rupiah penuh, lalu sisa pembulatan diberikan ke kategori
kebutuhan. Tanpa ini, rasio seperti 33:33:34 atas Rp 100.000 bisa menghasilkan
total Rp 99.999.

**Konversi ke bulanan** memakai faktor harian × 30 dan mingguan × 4,345
(= 365 ÷ 7 ÷ 12). Memakai 4 untuk mingguan akan kehilangan sekitar satu bulan
pemasukan per tahun.

**Progress target dihitung dari transaksi**, bukan dari kolom yang di-update
manual. Kolom `currentAmount` hanya cache yang disegarkan setiap progress
dibaca. Menghapus transaksi tabungan otomatis menurunkan progress — kalau
angkanya disimpan manual, ia akan melenceng tanpa ketahuan.

**Menghapus target tidak menghapus transaksinya.** Tautan `goalId` dilepas
(`onDelete: SetNull`), catatan keuangan user tetap utuh.

**Hanya transaksi pengeluaran yang bisa ditautkan ke target.** Menautkan
pemasukan akan membuat progress terhitung dua kali: sekali saat uang masuk,
sekali saat disisihkan.

Format error konsisten:

```json
{
  "message": "Data request tidak valid.",
  "errors": { "email": ["Format email tidak valid"] },
  "requestId": "0f6a...-..."
}
```
