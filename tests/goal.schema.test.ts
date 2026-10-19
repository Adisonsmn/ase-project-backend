import { describe, expect, test } from "bun:test";
import { calculateGapSchema } from "../src/schemas/goal.schema";

const wrap = (body: unknown) => ({ body, params: {}, query: {} });

const nextYear = () => {
  const date = new Date();
  date.setUTCFullYear(date.getUTCFullYear() + 1);
  return date.toISOString().slice(0, 10);
};

describe("calculateGapSchema", () => {
  const valid = {
    targetAmount: "1000000",
    duration: { value: 10, unit: "WEEK" },
    income: { amount: "100000", period: "WEEKLY" },
  };

  const parse = (body: unknown) => calculateGapSchema.safeParse(wrap(body));

  test("menerima isian form Ide", () => {
    expect(parse(valid).success).toBe(true);
  });

  test("interval pemasukan default 1", () => {
    const result = parse(valid);
    expect(result.success && result.data.body.income?.every).toBe(1);
  });

  test("pemasukan dan savingsPct boleh kosong (diambil dari rasio tersimpan)", () => {
    expect(
      parse({ targetAmount: "1000000", duration: { value: 3, unit: "MONTH" } })
        .success,
    ).toBe(true);
  });

  test("menerima targetDate sebagai pengganti duration", () => {
    expect(
      parse({ targetAmount: "1000000", targetDate: nextYear() }).success,
    ).toBe(true);
  });

  test("menolak targetDate dan duration dikirim bersamaan", () => {
    expect(parse({ ...valid, targetDate: nextYear() }).success).toBe(false);
  });

  test("menolak kalau targetDate dan duration sama-sama kosong", () => {
    expect(parse({ targetAmount: "1000000" }).success).toBe(false);
  });

  test("menolak targetDate di masa lalu", () => {
    expect(
      parse({ targetAmount: "1000000", targetDate: "2020-01-01" }).success,
    ).toBe(false);
  });

  test.each([
    ["nol", { value: 0, unit: "MONTH" }],
    ["pecahan", { value: 1.5, unit: "MONTH" }],
    ["satuan tidak dikenal", { value: 1, unit: "DECADE" }],
    ["lebih dari 30 tahun", { value: 31, unit: "YEAR" }],
    ["hari setara lebih dari 30 tahun", { value: 10_951, unit: "DAY" }],
  ])("menolak duration %s", (_label, duration) => {
    expect(parse({ ...valid, duration }).success).toBe(false);
  });

  test("menerima duration tepat 30 tahun", () => {
    expect(parse({ ...valid, duration: { value: 360, unit: "MONTH" } }).success).toBe(
      true,
    );
  });

  test("saldo awal 0 diterima, negatif ditolak", () => {
    expect(parse({ ...valid, currentAmount: "0" }).success).toBe(true);
    expect(parse({ ...valid, currentAmount: "-1" }).success).toBe(false);
  });

  test.each([
    [0, true],
    [100, true],
    [101, false],
    [30.5, false],
  ])("savingsPct %p -> %p", (savingsPct, expected) => {
    expect(parse({ ...valid, savingsPct }).success).toBe(expected);
  });

  test("menolak interval pemasukan 0", () => {
    expect(
      parse({ ...valid, income: { ...valid.income, every: 0 } }).success,
    ).toBe(false);
  });

  test("menolak target 0", () => {
    expect(parse({ ...valid, targetAmount: "0" }).success).toBe(false);
  });
});
