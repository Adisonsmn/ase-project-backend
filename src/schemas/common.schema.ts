import { z } from "zod";

/** Parameter :id berupa UUID. */
export const idParamSchema = z.object({
  params: z.object({
    id: z.uuid("Format id tidak valid"),
  }),
});

export type IdParam = z.infer<typeof idParamSchema>["params"];

export const transactionTypeSchema = z.enum(["INCOME", "EXPENSE"], {
  message: "Tipe harus INCOME atau EXPENSE",
});

export const incomePeriodSchema = z.enum(["DAILY", "WEEKLY", "MONTHLY"], {
  message: "Periode harus DAILY, WEEKLY, atau MONTHLY",
});

/** Batas Decimal(14,2): 12 digit di depan koma. */
export const MAX_AMOUNT = 999_999_999_999.99;

/**
 * Nominal diterima sebagai string maupun number, lalu dinormalkan ke string
 * agar presisi tidak hilang sebelum masuk ke Decimal.
 */
export const moneySchema = z
  .union([z.string(), z.number()])
  .transform((value) => String(value).trim())
  .refine(
    (value) => /^\d+(\.\d{1,2})?$/.test(value),
    "Nominal harus angka positif dengan maksimal 2 angka desimal",
  )
  .refine((value) => Number(value) > 0, "Nominal harus lebih dari 0")
  .refine((value) => Number(value) <= MAX_AMOUNT, "Nominal terlalu besar");

/** Query pagination yang dipakai bersama oleh endpoint berdaftar. */
export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

export const buildMeta = (page: number, limit: number, total: number) => ({
  page,
  limit,
  total,
  totalPages: Math.max(1, Math.ceil(total / limit)),
});
