import { z } from "zod";
import { moneySchema, paginationQuerySchema } from "./common.schema";

const instrumentTypeSchema = z.enum(["STOCK", "MUTUAL_FUND"], {
  message: "Tipe harus STOCK atau MUTUAL_FUND",
});

/**
 * Kode instrumen tidak dicocokkan dengan pola: kode yang bentuknya salah pasti
 * tidak ada, dan jawaban yang tepat untuk itu adalah 404, bukan 400.
 */
const instrumentCode = z.string().trim().min(1).max(20).toUpperCase();

export const listInstrumentQuerySchema = z.object({
  query: z.object({
    type: instrumentTypeSchema.optional(),
  }),
});

export const instrumentCodeParamSchema = z.object({
  params: z.object({ code: instrumentCode }),
});

export const instrumentHistorySchema = z.object({
  params: z.object({ code: instrumentCode }),
  query: z.object({
    range: z
      .enum(["WEEK", "MONTH", "YEAR"], {
        message: "Range harus WEEK, MONTH, atau YEAR",
      })
      .default("MONTH"),
  }),
});

/** Dipakai bersama oleh estimasi pembelian dan pembuatan sesi. */
export const purchaseSchema = z.object({
  body: z.object({
    instrumentCode,
    /** Batas atas (saldo virtual) dan minimal pembelian dicek di service. */
    amount: moneySchema,
  }),
});

export const listSessionQuerySchema = z.object({
  query: paginationQuerySchema.extend({
    status: z
      .enum(["RUNNING", "FINISHED"], {
        message: "Status harus RUNNING atau FINISHED",
      })
      .optional(),
  }),
});

export type ListInstrumentQuery = z.infer<
  typeof listInstrumentQuerySchema
>["query"];
export type InstrumentCodeParam = z.infer<
  typeof instrumentCodeParamSchema
>["params"];
export type InstrumentHistoryQuery = z.infer<
  typeof instrumentHistorySchema
>["query"];
export type PurchaseInput = z.infer<typeof purchaseSchema>["body"];
export type ListSessionQuery = z.infer<typeof listSessionQuerySchema>["query"];
