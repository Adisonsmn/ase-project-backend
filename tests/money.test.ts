import { describe, expect, test } from "bun:test";
import {
  formatMoney,
  percentageOf,
  subtractMoney,
  sumMoney,
} from "../src/utils/money";

describe("formatMoney", () => {
  test("selalu dua desimal", () => {
    expect(formatMoney("15000")).toBe("15000.00");
    expect(formatMoney("15000.5")).toBe("15000.50");
    expect(formatMoney(15000.55)).toBe("15000.55");
  });

  test("null dianggap nol", () => {
    expect(formatMoney(null)).toBe("0.00");
  });
});

describe("sumMoney", () => {
  test("menjumlah tanpa galat pembulatan biner", () => {
    // 0.1 + 0.2 === 0.30000000000000004 kalau memakai Number
    expect(sumMoney(["0.10", "0.20"])).toBe("0.30");
  });

  test("menjumlah nominal rupiah besar", () => {
    expect(sumMoney(["999999999999.98", "0.01"])).toBe("999999999999.99");
  });

  test("daftar kosong menghasilkan nol", () => {
    expect(sumMoney([])).toBe("0.00");
  });
});

describe("subtractMoney", () => {
  test("selisih pemasukan dan pengeluaran", () => {
    expect(subtractMoney("100000.00", "42000.55")).toBe("57999.45");
  });

  test("hasil negatif tetap tepat", () => {
    expect(subtractMoney("10000", "25000")).toBe("-15000.00");
  });
});

describe("percentageOf", () => {
  test("porsi terhadap total", () => {
    expect(percentageOf("25000", "100000")).toBe(25);
  });

  test("dibulatkan dua desimal", () => {
    expect(percentageOf("1", "3")).toBe(33.33);
  });

  test("total nol tidak menyebabkan pembagian nol", () => {
    expect(percentageOf("5000", "0")).toBe(0);
  });
});
