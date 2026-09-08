# ASE Project Backend

Backend API modern menggunakan Express.js, TypeScript, Bun, dan Prisma ORM.

## 🚀 Tech Stack
- **Runtime:** Bun
- **Framework:** Express.js (TypeScript)
- **Database & ORM:** PostgreSQL + Prisma ORM
- **Authentication & Validation:** JWT, Argon2, Zod

## 🛠️ Cara Menjalankan

1. **Install Dependensi:**
   ```bash
   bun install
   ```

2. **Setup Environment:**
   Buat file `.env` dan sesuaikan konfigurasi database serta JWT secret.

3. **Database Migration:**
   ```bash
   bun run db:migrate
   ```

4. **Jalankan Server (Development):**
   ```bash
   bun dev
   ```
