import { z } from "zod";
import { moneySchema, nonNegativeMoneySchema } from "./common.schema";
import { note, occurredAt } from "./transaction.schema";

const accountId = (field: string) => z.uuid(`Format ${field} tidak valid`);

const distinctAccounts = (data: {
  fromAccountId?: string;
  toAccountId?: string;
}) =>
  !data.fromAccountId ||
  !data.toAccountId ||
  data.fromAccountId !== data.toAccountId;

const DISTINCT_MESSAGE = "Akun asal dan tujuan harus berbeda";

export const createTransferSchema = z.object({
  body: z
    .object({
      fromAccountId: accountId("fromAccountId"),
      toAccountId: accountId("toAccountId"),
      amount: moneySchema,
      /** Biaya admin, dicatat sebagai pengeluaran dari akun asal. */
      fee: nonNegativeMoneySchema.optional(),
      note: note.optional(),
      occurredAt,
    })
    .refine(distinctAccounts, DISTINCT_MESSAGE),
});

export const updateTransferSchema = z.object({
  params: z.object({ id: z.uuid("Format id tidak valid") }),
  body: z
    .object({
      fromAccountId: accountId("fromAccountId").optional(),
      toAccountId: accountId("toAccountId").optional(),
      amount: moneySchema.optional(),
      /** 0 menghapus biaya admin. */
      fee: nonNegativeMoneySchema.optional(),
      note: note.optional(),
      occurredAt: occurredAt.optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
      message: "Minimal satu field harus diisi untuk memperbarui transfer.",
    })
    .refine(distinctAccounts, DISTINCT_MESSAGE),
});

export type CreateTransferInput = z.infer<typeof createTransferSchema>["body"];
export type UpdateTransferInput = z.infer<typeof updateTransferSchema>["body"];
