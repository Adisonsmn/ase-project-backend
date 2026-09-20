import { defineConfig } from "prisma/config";
import "dotenv/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "bun prisma/seed.ts",
  },
  datasource: {
    // Sengaja tidak memakai helper env() dari prisma/config, karena helper itu
    // melempar error saat DATABASE_URL belum ada. Akibatnya `prisma generate`
    // ikut gagal di clone baru yang belum punya .env, padahal generate hanya
    // butuh schema. Perintah yang benar-benar menyentuh database tetap gagal
    // dengan sendirinya kalau URL-nya kosong.
    url: process.env.DATABASE_URL ?? "",
  },
});
