import { z } from "zod";
import { moneySchema } from "./common.schema";

const title = z
  .string()
  .trim()
  .min(3, "Judul target minimal 3 karakter")
  .max(60, "Judul target maksimal 60 karakter");

/**
 * Tenggat target. Harus di masa depan saat dibuat — target yang tenggatnya
 * sudah lewat tidak bisa direncanakan, hanya bisa dievaluasi.
 */
const futureDate = z
  .union([z.iso.date(), z.iso.datetime({ offset: true })])
  .transform((value) => new Date(value))
  .refine(
    (date) => date.getTime() > Date.now(),
    "Tanggal target harus di masa depan",
  );

export const createGoalSchema = z.object({
  body: z.object({
    title,
    targetAmount: moneySchema,
    targetDate: futureDate,
    isPrimary: z.boolean().optional(),
  }),
});

export const updateGoalSchema = z.object({
  params: z.object({ id: z.uuid("Format id tidak valid") }),
  body: z
    .object({
      title: title.optional(),
      targetAmount: moneySchema.optional(),
      // Saat mengubah, tenggat boleh di masa lalu supaya target lama masih
      // bisa dirapikan datanya.
      targetDate: z
        .union([z.iso.date(), z.iso.datetime({ offset: true })])
        .transform((value) => new Date(value))
        .optional(),
      status: z.enum(["ACTIVE", "ACHIEVED", "ABANDONED"]).optional(),
      isPrimary: z.boolean().optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
      message: "Minimal satu field harus diisi untuk memperbarui target.",
    }),
});

export const listGoalQuerySchema = z.object({
  query: z.object({
    status: z.enum(["ACTIVE", "ACHIEVED", "ABANDONED"]).optional(),
  }),
});

export const listIncomeIdeaQuerySchema = z.object({
  query: z.object({
    ageGroup: z.enum(["TEEN", "YOUNG_ADULT", "GENERAL"]).optional(),
    /** Kalau diisi, ide diurutkan berdasarkan kecocokan dengan nominal ini. */
    gap: moneySchema.optional(),
  }),
});

export type CreateGoalInput = z.infer<typeof createGoalSchema>["body"];
export type UpdateGoalInput = z.infer<typeof updateGoalSchema>["body"];
export type ListGoalQuery = z.infer<typeof listGoalQuerySchema>["query"];
export type ListIncomeIdeaQuery = z.infer<
  typeof listIncomeIdeaQuerySchema
>["query"];
