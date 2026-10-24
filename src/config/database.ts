import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../generated/prisma/client";
import { env } from "./env";

const adapter = new PrismaPg({
  connectionString: env.DATABASE_URL,
  // Default pg menutup koneksi idle setelah 10 detik, sehingga koneksi yang
  // dihangatkan saat boot (lihat server.ts) sudah hilang sebelum user selesai
  // mengisi form login. Disamakan dengan cooldown scale-to-zero (5 menit).
  idleTimeoutMillis: 5 * 60_000,
});

export const prisma = new PrismaClient({ adapter });
