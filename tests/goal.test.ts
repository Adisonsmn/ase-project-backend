import { describe, expect, test } from "bun:test";
import {
  addDuration,
  analyzeGap,
  buildGapAdvice,
  calculateAge,
  monthsUntil,
  perIncomeBreakdown,
  resolveAgeGroup,
} from "../src/utils/goal";
import { startOfLocalDay, toLocalDateString } from "../src/utils/datetime";
import { toMonthlyAmount } from "../src/utils/ratio";

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

  test("tanpa judul (kalkulator) tetap memberi pesan yang wajar", () => {
    const result = analyzeGap({
      ...base,
      currentAmount: "5000000",
      monthlyIncome: "2000000",
    });
    const advice = buildGapAdvice(result);

    expect(advice[0]?.message).toStartWith("Target ini sudah tercapai");
  });
});

describe("addDuration", () => {
  const local = (date: Date) => toLocalDateString(date);

  test.each([
    [{ value: 10, unit: "DAY" }, "2026-09-30"],
    [{ value: 10, unit: "WEEK" }, "2026-11-29"],
    [{ value: 3, unit: "MONTH" }, "2026-12-20"],
    [{ value: 1, unit: "YEAR" }, "2027-09-20"],
  ] as const)("%o dari 20 Sep 2026 -> %s", (duration, expected) => {
    expect(local(addDuration(NOW, duration))).toBe(expected);
  });

  test("bulan memakai kalender dan dijepit ke akhir bulan", () => {
    const jan31 = new Date("2026-01-31T05:00:00Z");
    expect(local(addDuration(jan31, { value: 1, unit: "MONTH" }))).toBe(
      "2026-02-28",
    );
  });

  test("tahun kabisat: 31 Jan 2028 + 1 bulan = 29 Feb", () => {
    const jan31 = new Date("2028-01-31T05:00:00Z");
    expect(local(addDuration(jan31, { value: 1, unit: "MONTH" }))).toBe(
      "2028-02-29",
    );
  });

  test("29 Feb + 1 tahun jatuh ke 28 Feb, bukan 1 Maret", () => {
    const feb29 = new Date("2028-02-29T05:00:00Z");
    expect(local(addDuration(feb29, { value: 1, unit: "YEAR" }))).toBe(
      "2029-02-28",
    );
  });

  test("melewati pergantian tahun", () => {
    const nov15 = new Date("2026-11-15T05:00:00Z");
    expect(local(addDuration(nov15, { value: 3, unit: "MONTH" }))).toBe(
      "2027-02-15",
    );
  });

  test("dihitung dari tanggal WIB, bukan UTC", () => {
    // 01:00 WIB 1 Oktober masih 30 September menurut UTC.
    const earlyOct1 = new Date("2026-09-30T18:00:00Z");
    expect(local(addDuration(earlyOct1, { value: 1, unit: "MONTH" }))).toBe(
      "2026-11-01",
    );
    expect(local(addDuration(earlyOct1, { value: 1, unit: "DAY" }))).toBe(
      "2026-10-02",
    );
  });

  test("hasilnya selalu awal hari lokal", () => {
    const result = addDuration(NOW, { value: 2, unit: "MONTH" });
    expect(result.getTime()).toBe(startOfLocalDay(result).getTime());
  });
});

describe("perIncomeBreakdown", () => {
  test("mingguan: kebutuhan bulanan dibagi ~4,345 penerimaan", () => {
    const result = perIncomeBreakdown("434523.81", {
      amount: "100000",
      period: "WEEKLY",
      every: 1,
    });

    expect(result.receiptsPerMonth).toBe(4.35);
    expect(result.requiredPerReceipt).toBe("100000.00");
    expect(result.requiredPctOfIncome).toBe(100);
  });

  test("setiap 2 minggu: penerimaannya setengah lebih jarang", () => {
    const result = perIncomeBreakdown("434523.81", {
      amount: "200000",
      period: "WEEKLY",
      every: 2,
    });

    expect(result.receiptsPerMonth).toBe(2.17);
    expect(result.requiredPerReceipt).toBe("200000.00");
    expect(result.requiredPctOfIncome).toBe(100);
  });

  test("bulanan", () => {
    const result = perIncomeBreakdown("150000", {
      amount: "1000000",
      period: "MONTHLY",
      every: 1,
    });

    expect(result.requiredPerReceipt).toBe("150000.00");
    expect(result.requiredPctOfIncome).toBe(15);
  });

  test("porsi boleh melebihi 100% kalau targetnya terlalu berat", () => {
    const result = perIncomeBreakdown("600000", {
      amount: "10000",
      period: "DAILY",
      every: 1,
    });

    expect(result.requiredPerReceipt).toBe("20000.00");
    expect(result.requiredPctOfIncome).toBe(200);
  });
});

describe("kalkulator gap — contoh form Ide di frontend", () => {
  // Target 1 juta dalam 10 minggu, uang jajan 100rb/minggu, tabungan 30%.
  // Frontend lama menyebut ini "cukup" karena menganggap seluruh uang jajan
  // ditabung; menurut PRD, kemampuan menabung hanya 30% dari pemasukan.
  const income = { amount: "100000", period: "WEEKLY", every: 1 } as const;
  const analysis = analyzeGap({
    targetAmount: "1000000",
    currentAmount: "0",
    targetDate: addDuration(NOW, { value: 10, unit: "WEEK" }),
    monthlyIncome: toMonthlyAmount(income.amount, income.period, income.every),
    savingsPct: 30,
    now: NOW,
  });

  test("masih ada kekurangan", () => {
    expect(Number(analysis.gapPerMonth)).toBeGreaterThan(0);
    expect(analysis.isOnTrack).toBe(false);
  });

  test("harus menyisihkan seluruh uang jajan setiap minggu", () => {
    const breakdown = perIncomeBreakdown(analysis.requiredPerMonth, income);
    expect(breakdown.requiredPctOfIncome).toBeCloseTo(100, 0);
  });
});
