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
   - `RATE_LIMIT_GLOBAL_MAX`, `RATE_LIMIT_AUTH_MAX`, `RATE_LIMIT_REGISTER_MAX` opsional; default-nya nilai production. `RATE_LIMIT_AUTH_MAX` dipakai login (dihitung per IP + email) dan refresh (per IP), masing-masing dengan counter sendiri. Naikkan hanya di staging/QA untuk automation testing. Saat `NODE_ENV=test` rate limit dimatikan, dan `/health` tidak pernah dibatasi.
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

## ☁️ Deploy & CI/CD

Setiap push ke `main` otomatis di-deploy ke Azure Container Apps oleh
[.github/workflows/deploy.yml](.github/workflows/deploy.yml):

1. Typecheck dan test dijalankan lebih dulu; kalau gagal, deploy dibatalkan.
2. Image dibangun dari `Dockerfile`, diberi tag commit SHA, lalu didorong ke ACR.
3. Container app diperbarui ke image tersebut.
4. `/health/ready` dipanggil sampai membalas 200. Container app melaporkan
   "berhasil" begitu revisi diterima, bukan begitu aplikasinya siap melayani —
   tanpa langkah ini, deploy yang crash saat migrasi Prisma tetap terlihat hijau.

Pull request hanya menjalankan tes ([ci.yml](.github/workflows/ci.yml)). Definisi
tesnya dipakai bersama lewat [tests.yml](.github/workflows/tests.yml) supaya
gerbang sebelum deploy tidak pernah menyimpang dari yang diperiksa saat review.

| Sumber daya    | Nilai                                                          |
| -------------- | -------------------------------------------------------------- |
| Resource group | `ase-backend-rg` (East Asia)                                    |
| Container app  | `ase-backend`                                                   |
| Environment    | `ase-backend-env-wp`                                            |
| Registry       | `asebackendacr01.azurecr.io`                                    |
| URL            | <https://ase-backend.lemonplant-9c3a5aca.eastasia.azurecontainerapps.io> |

GitHub Actions login ke Azure lewat OIDC (federated credential), jadi **tidak ada
password Azure yang tersimpan di GitHub**. Tiga secret repo yang dipakai
(`AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID`) hanyalah
identifier, bukan kredensial. Container app menarik image dari ACR memakai
managed identity, juga tanpa password.

### Konfigurasi runtime

Secret aplikasi disimpan sebagai secret Container Apps, tidak pernah masuk repo:

```bash
az containerapp secret set -n ase-backend -g ase-backend-rg --secrets database-url="postgresql://..."
```

`CORS_ORIGIN` wajib menunjuk ke origin frontend produksi (server menolak start
kalau kosong saat `NODE_ENV=production`). Nilainya sekarang
`http://localhost:3000`; ganti saat frontend sudah punya domain.

Tulis origin **tanpa garis miring di akhir**: browser mengirim header `Origin`
berbentuk `https://contoh.com`, dan daftar ini dicocokkan persis sama, sehingga
`https://contoh.com/` tidak akan pernah cocok.

```bash
az containerapp update -n ase-backend -g ase-backend-rg --set-env-vars CORS_ORIGIN=https://domain-frontend-anda
```

### Skala & biaya

`min-replicas` diset **0**, jadi container tidur saat tidak ada permintaan dan
nyaris tidak memakan kredit. Konsekuensinya request pertama setelah idle butuh
sekitar 10-15 detik: container start ulang dan menjalankan `prisma migrate
deploy` lebih dulu. Ini perilaku normal, bukan gangguan. Kalau butuh respons
cepat setiap saat (misalnya saat demo), nyalakan terus:

```bash
az containerapp update -n ase-backend -g ase-backend-rg --min-replicas 1
```

### Operasi harian

```bash
# Log berjalan
az containerapp logs show -n ase-backend -g ase-backend-rg --follow

# Daftar revisi beserta image-nya
az containerapp revision list -n ase-backend -g ase-backend-rg --query '[].{revisi:name,image:properties.template.containers[0].image,aktif:properties.active}' -o table

# Rollback: pasang kembali image dari commit sebelumnya
az containerapp update -n ase-backend -g ase-backend-rg --image asebackendacr01.azurecr.io/ase-backend:<sha-lama>
```

## 📜 Skrip

| Perintah              | Keterangan                            |
| --------------------- | ------------------------------------- |
| `bun dev`             | Jalankan server dengan auto-reload    |
| `bun start`           | Jalankan server                       |
| `bun test`            | Jalankan test                         |
| `bun run typecheck`   | Cek tipe TypeScript                   |
| `bun run db:migrate`  | Buat & terapkan migrasi (development) |
| `bun run db:seed`     | Isi kategori bawaan, ide income, kategori artikel, & instrumen simulasi (idempotent) |
| `bun run db:seed:demo` | Reset & isi data demo (akun `demo@example.com`, transaksi 3 bulan, target, rasio, bookmark, sesi simulasi). Jalankan setelah `db:seed`; tidak bisa dijalankan saat `NODE_ENV=production` |
| `bun run db:set-role -- <email> <USER\|ADMIN>` | Ubah role user, misalnya menjadikan admin |
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
| GET    | `/api/v1/accounts`              | ✔    | Akun (Tunai, Kartu Bank, ...) beserta saldo      |
| POST   | `/api/v1/accounts`              | ✔    | Tambah akun                                      |
| PATCH  | `/api/v1/accounts/:id`          | ✔    | Ubah, jadikan default, atau arsipkan akun        |
| DELETE | `/api/v1/accounts/:id`          | ✔    | Hapus akun yang belum pernah dipakai             |
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
| POST   | `/api/v1/goals/gap/calculate`   | ✔    | Hitung gap dari isian form (tidak disimpan)      |
| PATCH  | `/api/v1/goals/:id`             | ✔    | Ubah target                                      |
| DELETE | `/api/v1/goals/:id`             | ✔    | Hapus target (transaksi tetap ada)               |
| GET    | `/api/v1/income-ideas`          | ✔    | Ide penambahan income per kelompok usia          |
| POST   | `/api/v1/transactions`          | ✔    | Catat transaksi                                  |
| GET    | `/api/v1/transactions`          | ✔    | Riwayat + filter + pagination                    |
| GET    | `/api/v1/transactions/summary`  | ✔    | Ringkasan & data grafik                          |
| GET    | `/api/v1/transactions/:id`      | ✔    | Detail transaksi                                 |
| PATCH  | `/api/v1/transactions/:id`      | ✔    | Ubah transaksi                                   |
| DELETE | `/api/v1/transactions/:id`      | ✔    | Hapus transaksi                                  |
| POST   | `/api/v1/transfers`             | ✔    | Transfer antar akun (+ biaya admin opsional)     |
| PATCH  | `/api/v1/transfers/:id`         | ✔    | Ubah transfer                                    |
| DELETE | `/api/v1/transfers/:id`         | ✔    | Hapus transfer beserta biaya adminnya            |
| GET    | `/api/v1/activities`            | ✔    | Timeline transaksi + transfer (untuk beranda)    |
| GET    | `/api/v1/articles`              | –    | Daftar artikel terbit, filter `?category=<slug>` |
| GET    | `/api/v1/articles/:slug`        | –    | Detail artikel terbit                            |
| GET    | `/api/v1/article-categories`    | –    | Kategori artikel + jumlah artikel terbit         |
| POST   | `/api/v1/articles`              | ADMIN | Buat artikel (default `DRAFT`)                  |
| PATCH  | `/api/v1/articles/:id`          | ADMIN | Ubah artikel / terbitkan                        |
| DELETE | `/api/v1/articles/:id`          | ADMIN | Hapus artikel                                   |
| GET    | `/api/v1/admin/articles`        | ADMIN | Semua artikel termasuk draft                    |
| GET    | `/api/v1/admin/articles/:id`    | ADMIN | Detail artikel berdasarkan id                   |
| POST   | `/api/v1/articles/:id/bookmark` | ✔    | Tandai artikel (idempotent)                      |
| DELETE | `/api/v1/articles/:id/bookmark` | ✔    | Hapus tanda (idempotent)                         |
| GET    | `/api/v1/bookmarks`             | ✔    | Artikel yang ditandai                            |
| GET    | `/api/v1/simulation/instruments` | –   | Instrumen simulasi + harga hari ini, filter `?type=STOCK\|MUTUAL_FUND` |
| GET    | `/api/v1/simulation/instruments/:code` | – | Detail instrumen (risiko, potensi, minimal)  |
| GET    | `/api/v1/simulation/instruments/:code/history` | – | Grafik harga `?range=WEEK\|MONTH\|YEAR` |
| POST   | `/api/v1/simulation/sessions/preview` | ✔ | Estimasi pembelian (tidak disimpan)            |
| POST   | `/api/v1/simulation/sessions`   | ✔    | Mulai sesi simulasi (beli dengan modal virtual)  |
| GET    | `/api/v1/simulation/sessions`   | ✔    | Riwayat sesi simulasi                            |
| GET    | `/api/v1/simulation/sessions/:id` | ✔  | State sesi, grafik, event, dan hasil             |
| POST   | `/api/v1/simulation/sessions/:id/advance` | ✔ | Maju ke checkpoint berikutnya              |

### Artikel & admin

Artikel dikurasi manual oleh user ber-role `ADMIN`. Belum ada endpoint untuk
memberi hak admin, dan itu disengaja; promosikan lewat skrip:

```bash
bun run db:set-role -- email@contoh.com ADMIN
```

Role baru berlaku setelah user tersebut me-refresh token (atau login ulang).

- Hanya artikel `PUBLISHED` yang tampil ke publik. Draft dijawab `404`.
- Slug dibuat otomatis dari judul kalau tidak diisi, dan **tidak ikut berubah**
  saat judul diubah supaya tautan yang sudah dibagikan tidak putus.
- `publishedAt` diisi sekali saat pertama terbit. Menurunkan ke draft lalu
  menerbitkan ulang tidak memindahkan artikel ke urutan teratas.
- `content` disimpan apa adanya. Frontend **jangan** merendernya sebagai HTML
  mentah; perlakukan sebagai teks atau Markdown yang disanitasi.

**Setelah deploy pertama fitur ini**, jalankan `bun run db:seed` sekali ke
database produksi. Container hanya menerapkan migrasi saat start, tidak
menjalankan seed, sehingga tanpa langkah ini kategori artikel kosong dan
setiap pembuatan artikel ditolak `404`.

### Game simulasi investasi

Satu sesi = satu instrumen dan satu kali beli dengan modal virtual
Rp 1.000.000, lalu `advance` memajukan waktu ke 1 Hari → 1 Bulan → 6 Bulan →
1 Tahun. Checkpoint terakhir menyelesaikan sesi dan mengisi `result`.

- Harga dan instrumennya sintetis. Setiap respons membawa `disclaimer` yang
  wajib ditampilkan permanen di layar simulasi.
- Harga beli selalu diambil server, tidak bisa dikirim klien. Hasil sesi bisa
  rugi; itu disengaja.
- Seluruh perjalanan harga ditentukan `seed` sesi, tetapi respons hanya berisi
  harga dan event sampai checkpoint yang sudah dicapai.
- `advance` yang ditekan dua kali dijawab `409` untuk request kedua, bukan
  melompati checkpoint.
- Instrumen diisi lewat `bun run db:seed`, jadi jalankan seed itu setelah
  deploy pertama fitur ini.

