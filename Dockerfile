# Bun di atas Debian slim. Bukan Alpine: Prisma CLI butuh OpenSSL glibc, dan
# menghindari musl menghemat banyak waktu debug.
FROM oven/bun:1-slim AS base
WORKDIR /app
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# --- Dependensi build -------------------------------------------------------
# Dipisah agar layer ini ikut cache selama package.json & schema tidak berubah.
# Hanya dipakai untuk menghasilkan Prisma Client; isinya tidak ikut ke runtime.
FROM base AS deps
COPY package.json bun.lock ./
COPY prisma.config.ts ./
COPY prisma ./prisma
# postinstall menjalankan `prisma generate`; tidak butuh DATABASE_URL.
RUN bun install --frozen-lockfile

# --- Dependensi runtime -----------------------------------------------------
# Tanpa devDependencies dan peer dependency (Prisma CLI beserta engine-nya,
# TypeScript), yang memangkas image hampir separuhnya. Image yang lebih kecil
# lebih cepat ditarik saat container bangun dari scale-to-zero. --ignore-scripts
# karena postinstall butuh Prisma CLI; client-nya sudah dibuat di stage deps.
FROM base AS prod-deps
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production --omit=peer --ignore-scripts

# --- Runtime ----------------------------------------------------------------
FROM base AS runtime
ENV NODE_ENV=production
# Port dikunci eksplisit agar selalu cocok dengan EXPOSE dan --target-port di
# Azure. Kalau nilai ini diubah, --target-port saat deploy WAJIB ikut diubah:
# kalau tidak cocok, container sehat di dalam tapi tidak bisa dijangkau dari
# luar, dan log tetap menunjukkan server berjalan normal.
ENV PORT=3001

COPY . .
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=deps /app/generated ./generated

# Image oven/bun sudah menyediakan user non-root bernama "bun".
USER bun

EXPOSE 3001

# Migrasi TIDAK dijalankan di sini, melainkan di workflow Deploy sebelum revisi
# baru dibuat. Kalau di sini, setiap cold start ikut membayar waktu menjalankan
# Prisma CLI padahal migrasi cukup sekali per deploy. Bentuk exec membuat bun
# menjadi PID 1 sehingga SIGTERM diterima dan graceful shutdown berjalan.
CMD ["bun", "src/server.ts"]
