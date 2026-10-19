import { z } from "zod";
import { paginationQuerySchema } from "./common.schema";

export const listActivityQuerySchema = z.object({
  query: paginationQuerySchema
    .extend({
      from: z.iso.date().optional(),
      to: z.iso.date().optional(),
      /** Transaksi akun ini, atau transfer dari/ke akun ini. */
      accountId: z.uuid().optional(),
    })
    .refine(
      (data) => !data.from || !data.to || data.from <= data.to,
      "Tanggal 'from' tidak boleh melebihi 'to'",
    ),
});

export type ListActivityQuery = z.infer<typeof listActivityQuerySchema>["query"];
