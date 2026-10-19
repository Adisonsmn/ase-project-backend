import { z } from "zod";
import {
  incomePeriodSchema,
  moneySchema,
  nonNegativeMoneySchema,
  percentageSchema,
} from "./common.schema";

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

/** Batas jangka waktu per satuan, semuanya setara 30 tahun. */
const MAX_DURATION = { DAY: 10_950, WEEK: 1_560, MONTH: 360, YEAR: 30 };

const durationSchema = z
  .object({
    value: z
      .number()
      .int("Jangka waktu harus bilangan bulat")
      .min(1, "Jangka waktu minimal 1"),
    unit: z.enum(["DAY", "WEEK", "MONTH", "YEAR"], {
      message: "Satuan harus DAY, WEEK, MONTH, atau YEAR",
    }),
  })
  .refine(
    (duration) => duration.value <= MAX_DURATION[duration.unit],
    "Jangka waktu maksimal 30 tahun",
  );

/** Pemasukan rutin, mis. "100.000 setiap 2 minggu" = WEEKLY dengan every 2. */
const incomeScheduleSchema = z.object({
  amount: moneySchema,
  period: incomePeriodSchema,
  every: z
    .number()
    .int("Interval harus bilangan bulat")
    .min(1, "Interval minimal 1")
    .max(365, "Interval maksimal 365")
    .default(1),
});

/**
 * Kalkulator gap tanpa menyimpan target (form "Ide" di frontend). Pemasukan
 * dan persentase tabungan boleh kosong; service lalu memakai rasio tersimpan
 * user, sama seperti analisis gap untuk target tersimpan.
 */
export const calculateGapSchema = z.object({
  body: z
    .object({
      title: title.optional(),
      targetAmount: moneySchema,
      /** Tabungan yang sudah terkumpul. */
      currentAmount: nonNegativeMoneySchema.optional(),
      // Tenggat bisa berupa tanggal atau jangka waktu, tidak keduanya.
      targetDate: futureDate.optional(),
      duration: durationSchema.optional(),
      income: incomeScheduleSchema.optional(),
      savingsPct: percentageSchema.optional(),
    })
    .refine(
      (data) => (data.targetDate === undefined) !== (data.duration === undefined),
      "Isi salah satu: targetDate atau duration, tidak keduanya",
    ),
});

export type CreateGoalInput = z.infer<typeof createGoalSchema>["body"];
export type UpdateGoalInput = z.infer<typeof updateGoalSchema>["body"];
export type ListGoalQuery = z.infer<typeof listGoalQuerySchema>["query"];
export type ListIncomeIdeaQuery = z.infer<
  typeof listIncomeIdeaQuerySchema
>["query"];
export type CalculateGapInput = z.infer<typeof calculateGapSchema>["body"];
