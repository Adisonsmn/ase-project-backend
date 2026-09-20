import { describe, expect, test } from "bun:test";
import {
  allocate,
  buildTips,
  DEFAULT_RATIO,
  isRatioValid,
  MONTHLY_FACTOR,
  RATIO_PRESETS,
  toMonthlyAmount,
} from "../src/utils/ratio";

const sum = (a: string, b: string, c: string) =>
  (Number(a) + Number(b) + Number(c)).toFixed(2);

describe("allocate — hasil dasar", () => {
  test("60:30:10 atas 100.000", () => {
    expect(allocate("100000", DEFAULT_RATIO)).toEqual({
      needs: "60000.00",
      savings: "30000.00",
      fun: "10000.00",
    });
  });

  test("uang mingguan 100.000 milik anak SMP", () => {
    const result = allocate("100000", { needsPct: 60, savingsPct: 30, funPct: 10 });
    expect(result.savings).toBe("30000.00");
  });
});

describe("allocate — total selalu sama dengan pemasukan", () => {
  // Bagian paling rawan: user langsung sadar kalau totalnya meleset serupiah.
  test.each([
    ["100000", { needsPct: 33, savingsPct: 33, funPct: 34 }],
    ["100000", { needsPct: 34, savingsPct: 33, funPct: 33 }],
    ["99999", { needsPct: 33, savingsPct: 33, funPct: 34 }],
    ["1", { needsPct: 33, savingsPct: 33, funPct: 34 }],
    ["7", { needsPct: 60, savingsPct: 30, funPct: 10 }],
    ["12345", { needsPct: 55, savingsPct: 27, funPct: 18 }],
    ["333", { needsPct: 33, savingsPct: 33, funPct: 34 }],
    ["100000.55", { needsPct: 60, savingsPct: 30, funPct: 10 }],
  ])("%s dengan rasio %o", (amount, split) => {
    const { needs, savings, fun } = allocate(amount, split);
    expect(sum(needs, savings, fun)).toBe(Number(amount).toFixed(2));
  });

  test("nominal ganjil kecil tidak menghasilkan alokasi negatif", () => {
    const { needs, savings, fun } = allocate("1", {
      needsPct: 0,
      savingsPct: 50,
      funPct: 50,
    });

    expect(Number(needs)).toBeGreaterThanOrEqual(0);
    expect(Number(savings)).toBeGreaterThanOrEqual(0);
    expect(Number(fun)).toBeGreaterThanOrEqual(0);
    expect(sum(needs, savings, fun)).toBe("1.00");
  });

  test("sisa pembulatan masuk ke kebutuhan, bukan hilang", () => {
    // 33% dari 100 = 33, 34% = 34; sisa 0 di kasus ini, jadi dipakai 10 rupiah
    const { needs, savings, fun } = allocate("10", {
      needsPct: 33,
      savingsPct: 33,
      funPct: 34,
    });

    // savings = floor(3.3) = 3, fun = floor(3.4) = 3, needs = 10 - 3 - 3 = 4
    expect(savings).toBe("3.00");
    expect(fun).toBe("3.00");
    expect(needs).toBe("4.00");
  });

  test("100% tabungan tidak menyisakan apa pun di kategori lain", () => {
    const { needs, savings, fun } = allocate("50000", {
      needsPct: 0,
      savingsPct: 100,
      funPct: 0,
    });

    expect(savings).toBe("50000.00");
    expect(fun).toBe("0.00");
    expect(needs).toBe("0.00");
  });
});

describe("toMonthlyAmount", () => {
  test("bulanan tidak berubah", () => {
    expect(toMonthlyAmount("1000000", "MONTHLY")).toBe("1000000.00");
  });

  test("harian dikali 30", () => {
    expect(toMonthlyAmount("10000", "DAILY")).toBe("300000.00");
  });

  test("mingguan memakai 4,345 sehingga setahun tetap 52 minggu", () => {
    // 100.000 x 365 / 7 / 12 = 434.523,81
    expect(toMonthlyAmount("100000", "WEEKLY")).toBe("434523.81");
  });

  test("faktor mingguan bukan 4 — kalau 4, setahun kehilangan ~1 bulan", () => {
    const setahunPakaiFaktor = MONTHLY_FACTOR.WEEKLY * 12;
    expect(setahunPakaiFaktor).toBeCloseTo(52.14, 1);
  });
});

describe("isRatioValid", () => {
  test("total 100 diterima", () => {
    expect(isRatioValid({ needsPct: 60, savingsPct: 30, funPct: 10 })).toBe(true);
  });

  test.each([
    [{ needsPct: 60, savingsPct: 30, funPct: 20 }],
    [{ needsPct: 50, savingsPct: 30, funPct: 10 }],
    [{ needsPct: 0, savingsPct: 0, funPct: 0 }],
  ])("total bukan 100 ditolak: %o", (split) => {
    expect(isRatioValid(split)).toBe(false);
  });
});

describe("preset", () => {
  test("semua preset totalnya 100", () => {
    for (const preset of RATIO_PRESETS) {
      expect(isRatioValid(preset)).toBe(true);
    }
  });

  test("preset default 60:30:10 tersedia", () => {
    expect(RATIO_PRESETS.some((p) => p.id === "60-30-10")).toBe(true);
  });

  test("id preset unik", () => {
    const ids = RATIO_PRESETS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("buildTips", () => {
  test("memperingatkan kalau tabungan nol", () => {
    const tips = buildTips(
      { needsPct: 70, savingsPct: 0, funPct: 30 },
      "1000000",
    );
    expect(tips.some((t) => t.level === "warning")).toBe(true);
  });

  test("memperingatkan kalau tabungan di bawah 10%", () => {
    const tips = buildTips({ needsPct: 85, savingsPct: 5, funPct: 10 }, "1000000");
    expect(tips.some((t) => t.message.includes("5%"))).toBe(true);
  });

  test("memuji kalau tabungan 30% ke atas", () => {
    const tips = buildTips(DEFAULT_RATIO, "1000000");
    expect(tips.some((t) => t.level === "success")).toBe(true);
  });

  test("menyoroti porsi hiburan di atas 30%", () => {
    const tips = buildTips({ needsPct: 40, savingsPct: 20, funPct: 40 }, "1000000");
    expect(tips.some((t) => t.message.includes("hiburan"))).toBe(true);
  });

  test("memberi saran khusus untuk pemasukan kecil", () => {
    const tips = buildTips(DEFAULT_RATIO, "200000");
    expect(tips.some((t) => t.message.includes("konsistensi"))).toBe(true);
  });

  test("selalu mengembalikan minimal satu tip", () => {
    const tips = buildTips({ needsPct: 55, savingsPct: 25, funPct: 20 }, "1000000");
    expect(tips.length).toBeGreaterThan(0);
  });
});
