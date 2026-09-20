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

2. **Setup environment**

   Salin `.env.example` menjadi `.env`, lalu sesuaikan isinya.

   ```bash
   cp .env.example .env
   ```

   Catatan penting:
   - `JWT_ACCESS_SECRET` dan `JWT_REFRESH_SECRET` minimal 32 karakter dan **harus berbeda**.
   - `CORS_ORIGIN` wajib diisi saat `NODE_ENV=production`; server menolak start jika kosong.
   - **Supabase:** gunakan connection string **Session Pooler**, bukan Direct connection (lihat Troubleshooting).

3. **Migrasi database**

   ```bash
   bun run db:migrate     # development
   bun run db:deploy      # production
   ```

4. **Jalankan server**

   ```bash
   bun dev                # development, auto-reload
   bun start              # production
   ```

## 📜 Skrip

| Perintah | Keterangan |
|---|---|
| `bun dev` | Jalankan server dengan auto-reload |
| `bun start` | Jalankan server |
| `bun test` | Jalankan test |
| `bun run typecheck` | Cek tipe TypeScript |
| `bun run db:migrate` | Buat & terapkan migrasi (development) |
| `bun run db:deploy` | Terapkan migrasi (production) |
| `bun run db:generate` | Generate Prisma Client |
| `bun run db:studio` | Buka Prisma Studio |

## 📁 Struktur

```
src/
├── config/       # env, database
├── controllers/  # HTTP layer
├── middlewares/  # auth, role, validate, rate-limit, request-id, error
├── routes/       # definisi endpoint
├── schemas/      # Zod schema
├── services/     # business logic (satu-satunya lapisan yang menyentuh prisma)
├── utils/        # jwt, password, logger, error
├── types/        # deklarasi tipe global
├── app.ts
└── server.ts
tests/            # bun test
```

Aturan: **controller tidak memanggil `prisma` langsung.** Semua akses database lewat service.

## 🔌 Endpoint

Base path: `/api/v1`. Autentikasi memakai header `Authorization: Bearer <accessToken>`.

| Method | Endpoint | Auth | Keterangan |
|---|---|---|---|
| GET | `/health` | – | Liveness probe |
| GET | `/health/ready` | – | Readiness probe (cek koneksi database) |
| POST | `/api/v1/auth/register` | – | Daftar akun baru |
| POST | `/api/v1/auth/login` | – | Login |
| POST | `/api/v1/auth/refresh` | – | Tukar refresh token (dengan rotasi) |
| POST | `/api/v1/auth/logout` | – | Cabut sesi |
| GET | `/api/v1/users/me` | ✔ | Profil sendiri |
| PATCH | `/api/v1/users/me` | ✔ | Ubah profil sendiri |

Format error konsisten:

```json
{
  "message": "Data request tidak valid.",
  "errors": { "email": ["Format email tidak valid"] },
  "requestId": "0f6a...-..."
}
```

## 🔐 Catatan Keamanan

- Password di-hash dengan **Argon2id**.
- Refresh token disimpan sebagai hash, bukan plaintext, dan **dirotasi** setiap kali dipakai.
- Penggunaan ulang refresh token yang sudah dicabut dianggap indikasi kebocoran: seluruh sesi user otomatis dicabut.
- Rate limit: 100 req/15 menit global, 10 percobaan gagal/15 menit untuk login & refresh, 5 pendaftaran/jam.
- Setiap request mendapat `X-Request-Id` yang ikut tercatat di log error 5xx.

## 📌 Status

Fondasi (auth, profil user, middleware, health check) sudah selesai.
Fitur domain F-01 s/d F-16 belum dikerjakan. Urutan prioritas ada di PRD (bagian 8):
F-07..F-09 catatan transaksi → F-01..F-03 rasio menabung → F-04..F-06 goal & income → F-14..F-16 artikel → F-10..F-13 simulasi investasi.

## 🧯 Troubleshooting

### `P1001: Can't reach database server at db.<ref>.supabase.co:5432`

Muncul meskipun project Supabase sedang aktif. Penyebabnya bukan database mati, tapi **IPv6**.

Host direct connection Supabase (`db.<ref>.supabase.co`) hanya punya record DNS `AAAA` — IPv6-only, tanpa IPv4:

```bash
nslookup -type=A    db.<ref>.supabase.co   # kosong
nslookup -type=AAAA db.<ref>.supabase.co   # ada
```

Kalau jaringan Anda tidak punya konektivitas IPv6 (umum di ISP rumahan dan jaringan kampus di Indonesia), host itu tidak akan pernah bisa dihubungi.

**Solusi:** pakai **Session Pooler** yang punya alamat IPv4. Di dashboard Supabase: tombol **Connect** → **Session pooler**.

```
# Direct connection — IPv6-only, hindari
postgresql://postgres:<password>@db.<ref>.supabase.co:5432/postgres

# Session pooler — IPv4, pakai ini
postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres
```

Perhatikan dua perbedaannya: **username** menjadi `postgres.<project-ref>`, dan **host** menjadi `aws-0-<region>.pooler.supabase.com`.

Cek konektivitas IPv6 Anda dengan:

```bash
curl -6 -m 8 -o /dev/null -w "%{http_code}" https://ipv6.google.com
```

Kalau hasilnya `000`, jaringan Anda memang tanpa IPv6.

> **Catatan port.** Gunakan port **5432** (session mode) karena mendukung migrasi Prisma dan prepared statement.
> Port **6543** adalah transaction mode — lebih hemat koneksi untuk serverless, tapi **tidak bisa menjalankan migrasi**
> dan perlu tambahan `?pgbouncer=true&connection_limit=1`.
