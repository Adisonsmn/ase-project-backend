import { z } from "zod";
import { nonNegativeMoneySchema } from "./common.schema";

const name = z
  .string()
  .trim()
  .min(2, "Nama akun minimal 2 karakter")
  .max(30, "Nama akun maksimal 30 karakter");

const accountType = z.enum(["CASH", "BANK", "EWALLET", "SAVINGS", "OTHER"], {
  message: "Tipe akun harus CASH, BANK, EWALLET, SAVINGS, atau OTHER",
});

const icon = z.string().trim().max(40);

export const listAccountQuerySchema = z.object({
  query: z.object({
    /** Akun yang diarsipkan disembunyikan kecuali diminta. */
    includeArchived: z.stringbool().default(false),
  }),
});

export const createAccountSchema = z.object({
  body: z.object({
    name,
    type: accountType,
    icon: icon.optional(),
    openingBalance: nonNegativeMoneySchema.optional(),
  }),
});

export const updateAccountSchema = z.object({
  params: z.object({ id: z.uuid("Format id tidak valid") }),
  body: z
    .object({
      name: name.optional(),
      type: accountType.optional(),
      icon: icon.optional(),
      openingBalance: nonNegativeMoneySchema.optional(),
      // Default hanya bisa dipindah, tidak bisa dikosongkan: selalu harus
      // ada satu akun untuk transaksi yang dicatat tanpa accountId.
      isDefault: z
        .literal(true, {
          message: "isDefault hanya bisa true. Jadikan akun lain default untuk menggantinya.",
        })
        .optional(),
      isArchived: z.boolean().optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
      message: "Minimal satu field harus diisi untuk memperbarui akun.",
    })
    .refine(
      (data) => !(data.isDefault && data.isArchived),
      "Akun default tidak bisa diarsipkan.",
    ),
});

export type ListAccountQuery = z.infer<typeof listAccountQuerySchema>["query"];
export type CreateAccountInput = z.infer<typeof createAccountSchema>["body"];
export type UpdateAccountInput = z.infer<typeof updateAccountSchema>["body"];
