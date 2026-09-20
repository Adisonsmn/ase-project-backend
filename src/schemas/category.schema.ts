import { z } from "zod";
import { transactionTypeSchema } from "./common.schema";

const name = z
  .string()
  .trim()
  .min(2, "Nama kategori minimal 2 karakter")
  .max(30, "Nama kategori maksimal 30 karakter");

export const listCategoryQuerySchema = z.object({
  query: z.object({
    type: transactionTypeSchema.optional(),
  }),
});

export const createCategorySchema = z.object({
  body: z.object({
    name,
    type: transactionTypeSchema,
    icon: z.string().trim().max(40).optional(),
  }),
});

export const updateCategorySchema = z.object({
  params: z.object({ id: z.uuid("Format id tidak valid") }),
  body: z
    .object({
      name: name.optional(),
      icon: z.string().trim().max(40).optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
      message: "Minimal satu field harus diisi untuk memperbarui kategori.",
    }),
});

export type ListCategoryQuery = z.infer<
  typeof listCategoryQuerySchema
>["query"];
export type CreateCategoryInput = z.infer<typeof createCategorySchema>["body"];
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>["body"];
