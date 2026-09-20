import { z } from "zod";
import { transactionTypeSchema, moneySchema } from "./common.schema";
import { endOfToday } from "../utils/datetime";

const amount = moneySchema;

/** Terima "YYYY-MM-DD" maupun ISO datetime lengkap. */
const occurredAt = z
  .union([z.iso.date(), z.iso.datetime({ offset: true })])
  .transform((value) => new Date(value))
  .refine(
    (date) => date.getTime() <= endOfToday().getTime(),
    "Tanggal transaksi tidak boleh di masa depan",
  );

const note = z.string().trim().max(255, "Catatan maksimal 255 karakter");

export const createTransactionSchema = z.object({
  body: z.object({
    type: transactionTypeSchema,
    amount,
    categoryId: z.uuid("Format categoryId tidak valid").optional(),
    /** Tautkan transaksi tabungan ke sebuah target (F-04). */
    goalId: z.uuid("Format goalId tidak valid").nullable().optional(),
    note: note.optional(),
    occurredAt,
  }),
});

export const updateTransactionSchema = z.object({
  params: z.object({ id: z.uuid("Format id tidak valid") }),
  body: z
    .object({
      type: transactionTypeSchema.optional(),
      amount: amount.optional(),
      categoryId: z.uuid("Format categoryId tidak valid").optional(),
      // null dipakai untuk melepas tautan ke target.
      goalId: z.uuid("Format goalId tidak valid").nullable().optional(),
      note: note.optional(),
      occurredAt: occurredAt.optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
      message: "Minimal satu field harus diisi untuk memperbarui transaksi.",
    }),
});

export const listTransactionQuerySchema = z.object({
  query: z
    .object({
      from: z.iso.date().optional(),
      to: z.iso.date().optional(),
      categoryId: z.uuid().optional(),
      type: transactionTypeSchema.optional(),
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce
        .number()
        .int()
        .min(1)
        .max(100, "limit maksimal 100")
        .default(20),
    })
    .refine(
      (data) => !data.from || !data.to || data.from <= data.to,
      "Tanggal 'from' tidak boleh melebihi 'to'",
    ),
});

export const summaryQuerySchema = z.object({
  query: z.object({
    period: z.enum(["daily", "weekly", "monthly"]).default("monthly"),
    from: z.iso.date().optional(),
    to: z.iso.date().optional(),
  }),
});

export type CreateTransactionInput = z.infer<
  typeof createTransactionSchema
>["body"];
export type UpdateTransactionInput = z.infer<
  typeof updateTransactionSchema
>["body"];
export type ListTransactionQuery = z.infer<
  typeof listTransactionQuerySchema
>["query"];
export type SummaryQuery = z.infer<typeof summaryQuerySchema>["query"];
