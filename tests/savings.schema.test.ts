import { describe, expect, test } from "bun:test";
import {
  calculateRatioSchema,
  saveRatioSchema,
} from "../src/schemas/savings.schema";

const wrap = (body: unknown) => ({ body, params: {}, query: {} });

describe("calculateRatioSchema", () => {
  const valid = { amount: "100000", period: "WEEKLY" };

  test("menerima input minimal (tanpa rasio, pakai default/tersimpan)", () => {
    expect(calculateRatioSchema.safeParse(wrap(valid)).success).toBe(true);
  });

  test("menerima rasio kustom yang totalnya 100", () => {
    const result = calculateRatioSchema.safeParse(
      wrap({ ...valid, ratio: { needsPct: 50, savingsPct: 40, funPct: 10 } }),
    );
    expect(result.success).toBe(true);
  });

  test("menolak rasio yang totalnya bukan 100", () => {
    const result = calculateRatioSchema.safeParse(
      wrap({ ...valid, ratio: { needsPct: 60, savingsPct: 30, funPct: 20 } }),
    );
    expect(result.success).toBe(false);
  });

  test("menolak persentase pecahan", () => {
    const result = calculateRatioSchema.safeParse(
      wrap({ ...valid, ratio: { needsPct: 60.5, savingsPct: 29.5, funPct: 10 } }),
    );
    expect(result.success).toBe(false);
  });

  test("menolak persentase negatif", () => {
    const result = calculateRatioSchema.safeParse(
      wrap({ ...valid, ratio: { needsPct: 110, savingsPct: -10, funPct: 0 } }),
    );
    expect(result.success).toBe(false);
  });

  test("menerima presetId yang dikenal", () => {
    const result = calculateRatioSchema.safeParse(
      wrap({ ...valid, presetId: "50-30-20" }),
    );
    expect(result.success).toBe(true);
  });

  test("menolak presetId yang tidak dikenal", () => {
    const result = calculateRatioSchema.safeParse(
      wrap({ ...valid, presetId: "90-5-5" }),
    );
    expect(result.success).toBe(false);
  });

  test("menolak ratio dan presetId dikirim bersamaan", () => {
    const result = calculateRatioSchema.safeParse(
      wrap({
        ...valid,
        presetId: "50-30-20",
        ratio: { needsPct: 50, savingsPct: 40, funPct: 10 },
      }),
    );
    expect(result.success).toBe(false);
  });

  test("menolak periode tidak dikenal", () => {
    const result = calculateRatioSchema.safeParse(
      wrap({ ...valid, period: "YEARLY" }),
    );
    expect(result.success).toBe(false);
  });

  test.each([["0"], ["-5000"], ["abc"]])("menolak nominal %s", (amount) => {
    expect(calculateRatioSchema.safeParse(wrap({ ...valid, amount })).success).toBe(
      false,
    );
  });
});

describe("saveRatioSchema", () => {
  test("menerima rasio valid tanpa nominal", () => {
    const result = saveRatioSchema.safeParse(
      wrap({ needsPct: 60, savingsPct: 30, funPct: 10 }),
    );
    expect(result.success).toBe(true);
  });

  test("menerima rasio valid dengan nominal dan periode", () => {
    const result = saveRatioSchema.safeParse(
      wrap({
        needsPct: 60,
        savingsPct: 30,
        funPct: 10,
        incomeAmount: "100000",
        period: "WEEKLY",
      }),
    );
    expect(result.success).toBe(true);
  });

  test("menolak total bukan 100", () => {
    const result = saveRatioSchema.safeParse(
      wrap({ needsPct: 60, savingsPct: 30, funPct: 5 }),
    );
    expect(result.success).toBe(false);
  });

  test("menolak persentase tidak lengkap", () => {
    const result = saveRatioSchema.safeParse(
      wrap({ needsPct: 60, savingsPct: 40 }),
    );
    expect(result.success).toBe(false);
  });

  test("menerima 100:0:0 karena totalnya tetap 100", () => {
    const result = saveRatioSchema.safeParse(
      wrap({ needsPct: 100, savingsPct: 0, funPct: 0 }),
    );
    expect(result.success).toBe(true);
  });
});
