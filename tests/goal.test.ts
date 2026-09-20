import { describe, expect, test } from "bun:test";
import {
  analyzeGap,
  buildGapAdvice,
  calculateAge,
  monthsUntil,
  resolveAgeGroup,
} from "../src/utils/goal";

const NOW = new Date("2026-09-20T05:00:00Z"); // 12:00 WIB
const inDays = (days: number) =>
  new Date(NOW.getTime() + days * 24 * 60 * 60 * 1000);

describe("calculateAge", () => {
  test("usia penuh setelah ulang tahun", () => {
    expect(calculateAge(new Date("2011-01-15"), NOW)).toBe(15);
  });

  test("belum ulang tahun tahun ini", () => {
    expect(calculateAge(new Date("2011-12-15"), NOW)).toBe(14);
  });

  test("tepat di hari ulang tahun", () => {
    expect(calculateAge(new Date("2011-09-20"), NOW)).toBe(15);
  });
});

describe("resolveAgeGroup", () => {
  test.each([
    ["13 tahun", "2013-01-01", "TEEN"],
    ["15 tahun", "2011-01-01", "TEEN"],
    ["19 tahun", "2007-01-01", "TEEN"],
    ["20 tahun", "2006-01-01", "YOUNG_ADULT"],
    ["24 tahun", "2002-01-01", "YOUNG_ADULT"],
    ["25 tahun", "2001-01-01", "GENERAL"],
    ["12 tahun", "2014-01-01", "GENERAL"],
  ])("%s -> %s", (_label, dob, expected) => {
    expect(resolveAgeGroup(new Date(dob), NOW)).toBe(expected as never);
  });

  test("tanpa tanggal lahir memakai GENERAL, bukan menebak", () => {
    expect(resolveAgeGroup(null, NOW)).toBe("GENERAL");
  });
});

describe("monthsUntil", () => {
  test("setahun ke depan kira-kira 12 bulan", () => {
    expect(monthsUntil(inDays(365), NOW)).toBeCloseTo(12, 1);
  });

  test("tenggat hari ini dibatasi minimal 1 bulan, bukan nol", () => {
    // Tanpa batas ini, pembagian menghasilkan Infinity.
    expect(monthsUntil(NOW, NOW)).toBe(1);
  });

  test("tenggat sudah lewat tetap minimal 1", () => {
    expect(monthsUntil(inDays(-30), NOW)).toBe(1);
  });
});

describe("analyzeGap — kasus utama dari PRD", () => {
  // Anak SMP: target 5 juta setahun, uang mingguan 100rb, tabungan 30%
  const result = analyzeGap({
    targetAmount: "5000000",
    currentAmount: "0",
    targetDate: inDays(365),
    monthlyIncome: "434523.81", // 100rb/minggu
    savingsPct: 30,
    now: NOW,
  });

  test("kebutuhan per bulan = 5 juta dibagi 12 bulan", () => {
    expect(result.requiredPerMonth).toBe("416666.67");
  });

  test("kemampuan per bulan 30% dari pemasukan", () => {
    expect(result.capablePerMonth).toBe("130357.14");
  });

  test("ada gap karena kemampuan di bawah kebutuhan", () => {
    expect(Number(result.gapPerMonth)).toBeGreaterThan(0);
    expect(result.isOnTrack).toBe(false);
  });

  test("gap = kebutuhan - kemampuan", () => {
    const expected =
      Number(result.requiredPerMonth) - Number(result.capablePerMonth);
    expect(Number(result.gapPerMonth)).toBeCloseTo(expected, 1);
  });

  test("belum dianggap mustahil: gap masih di bawah 3x pemasukan", () => {
    expect(result.isUnrealistic).toBe(false);
  });
});

describe("analyzeGap — target yang tidak realistis", () => {
  test("target 100 juta setahun dengan uang jajan kecil ditandai mustahil", () => {
    const result = analyzeGap({
      targetAmount: "100000000",
      currentAmount: "0",
      targetDate: inDays(365),
      monthlyIncome: "434523.81",
      savingsPct: 30,
      now: NOW,
    });

    expect(result.isUnrealistic).toBe(true);
  });

  test("tanpa data pemasukan tidak menyimpulkan apa pun", () => {
    const result = analyzeGap({
      targetAmount: "100000000",
      currentAmount: "0",
      targetDate: inDays(365),
      monthlyIncome: "0",
      savingsPct: 30,
      now: NOW,
    });

    // Tidak ada dasar untuk menyebut mustahil kalau pemasukannya belum diketahui.
    expect(result.isUnrealistic).toBe(false);
  });
});

describe("analyzeGap — kasus tepi", () => {
  test("target sudah tercapai", () => {
    const result = analyzeGap({
      targetAmount: "1000000",
      currentAmount: "1000000",
      targetDate: inDays(90),
      monthlyIncome: "2000000",
      savingsPct: 30,
      now: NOW,
    });

    expect(result.isAchieved).toBe(true);
    expect(result.remainingAmount).toBe("0.00");
    expect(result.progressPercentage).toBe(100);
    expect(result.isOnTrack).toBe(true);
  });

  test("terkumpul melebihi target tidak menghasilkan sisa negatif", () => {
    const result = analyzeGap({
      targetAmount: "1000000",
      currentAmount: "1500000",
      targetDate: inDays(90),
      monthlyIncome: "2000000",
      savingsPct: 30,
      now: NOW,
    });

    expect(result.remainingAmount).toBe("0.00");
    expect(result.progressPercentage).toBe(100);
  });

  test("tenggat hari ini tidak menyebabkan pembagian nol", () => {
    const result = analyzeGap({
      targetAmount: "1000000",
      currentAmount: "0",
      targetDate: NOW,
      monthlyIncome: "2000000",
      savingsPct: 30,
      now: NOW,
    });

    expect(Number.isFinite(Number(result.requiredPerMonth))).toBe(true);
    expect(result.requiredPerMonth).toBe("1000000.00");
  });

  test("tenggat sudah lewat ditandai overdue", () => {
    const result = analyzeGap({
      targetAmount: "1000000",
      currentAmount: "200000",
      targetDate: inDays(-10),
      monthlyIncome: "2000000",
      savingsPct: 30,
      now: NOW,
    });

    expect(result.isOverdue).toBe(true);
    expect(result.daysRemaining).toBeLessThan(0);
  });

  test("tenggat lewat tapi sudah tercapai bukan overdue", () => {
    const result = analyzeGap({
      targetAmount: "1000000",
      currentAmount: "1000000",
      targetDate: inDays(-10),
      monthlyIncome: "2000000",
      savingsPct: 30,
      now: NOW,
    });

    expect(result.isOverdue).toBe(false);
    expect(result.isAchieved).toBe(true);
  });

  test("tabungan 0% tidak menghasilkan proyeksi tanggal", () => {
    const result = analyzeGap({
      targetAmount: "1000000",
      currentAmount: "0",
      targetDate: inDays(365),
      monthlyIncome: "2000000",
      savingsPct: 0,
      now: NOW,
    });

    expect(result.capablePerMonth).toBe("0.00");
    expect(result.projectedDate).toBeNull();
  });

  test("gap tidak pernah negatif walau kemampuan melebihi kebutuhan", () => {
    const result = analyzeGap({
      targetAmount: "100000",
      currentAmount: "0",
      targetDate: inDays(365),
      monthlyIncome: "10000000",
      savingsPct: 30,
      now: NOW,
    });

    expect(result.gapPerMonth).toBe("0.00");
    expect(result.isOnTrack).toBe(true);
    expect(result.projectedDate).not.toBeNull();
  });
});

describe("analyzeGap — progress", () => {
  test.each([
    ["0", 0],
    ["250000", 25],
    ["500000", 50],
    ["1000000", 100],
  ])("terkumpul %s -> %s%%", (current, expected) => {
    const result = analyzeGap({
      targetAmount: "1000000",
      currentAmount: current,
      targetDate: inDays(90),
      monthlyIncome: "2000000",
      savingsPct: 30,
      now: NOW,
    });

    expect(result.progressPercentage).toBe(expected);
  });
});

describe("buildGapAdvice", () => {
  const base = {
    targetAmount: "5000000",
    currentAmount: "0",
    targetDate: inDays(365),
    savingsPct: 30,
    now: NOW,
  };

  test("target tercapai memberi pesan sukses", () => {
    const result = analyzeGap({
      ...base,
      currentAmount: "5000000",
      monthlyIncome: "2000000",
    });
    const advice = buildGapAdvice(result, "Sepeda");

    expect(advice[0]?.level).toBe("success");
    expect(advice[0]?.message).toContain("Sepeda");
  });

  test("target mustahil memberi peringatan dan berhenti di situ", () => {
    const result = analyzeGap({
      ...base,
      targetAmount: "100000000",
      monthlyIncome: "434523.81",
    });
    const advice = buildGapAdvice(result, "Motor");

    expect(advice.some((a) => a.level === "warning")).toBe(true);
    expect(advice.some((a) => a.message.includes("perpanjang") || a.message.includes("turunkan"))).toBe(true);
  });

  test("ada gap memberi angka kebutuhan dan kemampuan", () => {
    const result = analyzeGap({ ...base, monthlyIncome: "434523.81" });
    const advice = buildGapAdvice(result, "Sepeda");

    expect(advice.some((a) => a.message.includes("Kekurangannya"))).toBe(true);
  });

  test("selalu mengembalikan minimal satu saran", () => {
    const result = analyzeGap({ ...base, monthlyIncome: "10000000" });
    expect(buildGapAdvice(result, "Sepeda").length).toBeGreaterThan(0);
  });
});
