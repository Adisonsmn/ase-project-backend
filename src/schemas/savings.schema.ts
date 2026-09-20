import { z } from "zod";
import { incomePeriodSchema, moneySchema } from "./common.schema";
import { RATIO_PRESETS } from "../utils/ratio";

const percentage = z
  .number()
  .int("Persentase harus bilangan bulat")
  .min(0, "Persentase minimal 0")
  .max(100, "Persentase maksimal 100");

/**
 * Tiga kategori tetap: kebutuhan, tabungan, hiburan.
 * Totalnya wajib 100 — tanpa ini alokasi tidak akan pernah menjumlah ke
 * nominal pemasukan dan hasilnya membingungkan user.
 */
const ratioSplit = z
  .object({
    needsPct: percentage,
    savingsPct: percentage,
    funPct: percentage,
  })
  .refine(
    (data) => data.needsPct + data.savingsPct + data.funPct === 100,
    "Total persentase harus tepat 100",
  );

const presetId = z.enum(
  RATIO_PRESETS.map((preset) => preset.id) as [string, ...string[]],
  { message: "Preset tidak dikenal" },
);

export const calculateRatioSchema = z.object({
  body: z
    .object({
      amount: moneySchema,
      period: incomePeriodSchema,
      // Rasio kustom dan preset saling meniadakan. Kalau keduanya kosong,
      // service memakai rasio tersimpan user, atau rasio default.
      ratio: ratioSplit.optional(),
      presetId: presetId.optional(),
    })
    .refine(
      (data) => !(data.ratio && data.presetId),
      "Pilih salah satu: ratio kustom atau presetId, tidak keduanya",
    ),
});

export const saveRatioSchema = z.object({
  body: z.object({
    needsPct: percentage,
    savingsPct: percentage,
    funPct: percentage,
    incomeAmount: moneySchema.optional(),
    period: incomePeriodSchema.optional(),
  }).refine(
    (data) => data.needsPct + data.savingsPct + data.funPct === 100,
    "Total persentase harus tepat 100",
  ),
});

export type CalculateRatioInput = z.infer<typeof calculateRatioSchema>["body"];
export type SaveRatioInput = z.infer<typeof saveRatioSchema>["body"];
