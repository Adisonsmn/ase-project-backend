import { Prisma } from "../../generated/prisma/client";

/** True kalau error berasal dari Prisma dengan kode tertentu, mis. P2002. */
export const isPrismaError = (error: unknown, code: string) =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === code;

/**
 * Pelanggaran constraint unik. Muncul saat dua request bersamaan sama-sama
 * lolos pengecekan duplikat, lalu yang kalah ditolak database.
 */
export const isUniqueViolation = (error: unknown) =>
  isPrismaError(error, "P2002");
