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
