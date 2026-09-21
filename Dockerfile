# Bun di atas Debian slim. Bukan Alpine: Prisma CLI butuh OpenSSL glibc untuk
# menjalankan migrasi, dan menghindari musl menghemat banyak waktu debug.
FROM oven/bun:1-slim AS base
WORKDIR /app
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# --- Dependensi -------------------------------------------------------------
# Dipisah agar layer ini ikut cache selama package.json & schema tidak berubah.
FROM base AS deps
COPY package.json bun.lock ./
COPY prisma.config.ts ./
COPY prisma ./prisma
# postinstall menjalankan `prisma generate`; tidak butuh DATABASE_URL.
RUN bun install --frozen-lockfile

# --- Runtime ----------------------------------------------------------------
FROM base AS runtime
ENV NODE_ENV=production
# Port dikunci eksplisit agar selalu cocok dengan EXPOSE dan --target-port di
# Azure. Kalau nilai ini diubah, --target-port saat deploy WAJIB ikut diubah:
# kalau tidak cocok, container sehat di dalam tapi tidak bisa dijangkau dari
# luar, dan log tetap menunjukkan server berjalan normal.
ENV PORT=3001

COPY . .
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/generated ./generated

# Image oven/bun sudah menyediakan user non-root bernama "bun".
USER bun

EXPOSE 3001

# Migrasi dijalankan lebih dulu; kalau gagal, container berhenti dan versi lama
# tetap melayani. `exec` membuat bun menjadi PID 1 sehingga SIGTERM diterima
# dan graceful shutdown berjalan.
CMD ["sh", "-c", "bunx prisma migrate deploy && exec bun src/server.ts"]
