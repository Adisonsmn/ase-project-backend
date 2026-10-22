import { describe, expect, test } from "bun:test";
import {
  CHECKPOINTS,
  FINAL_STEP,
  buildSessionPath,
  computePurchase,
  createRng,
  describeSession,
  marketHistory,
  marketQuote,
  type MarketInstrument,
  type SessionParams,
} from "../src/utils/simulation";
import { SIM_EVENT_TEMPLATES } from "../src/utils/simulation-events";

const NOW = new Date("2026-10-22T05:00:00Z"); // 12:00 WIB

const NUSA: MarketInstrument = {
  code: "NUSA",
  type: "STOCK",
  basePrice: "2500",
  annualDrift: 0.1,
  annualVolatility: 0.35,
};

const RDPU: MarketInstrument = {
  code: "RDPU",
  type: "MUTUAL_FUND",
  basePrice: "1000",
  annualDrift: 0.045,
  annualVolatility: 0.01,
};

const sessionOf = (
  instrument: MarketInstrument,
  seed: string,
): SessionParams => ({
  seed,
  type: instrument.type,
  buyPrice: instrument.basePrice,
  annualDrift: instrument.annualDrift,
  annualVolatility: instrument.annualVolatility,
});

const yearReturn = (params: SessionParams) => {
  const { prices } = buildSessionPath(params);
  return prices[365]! / prices[0]! - 1;
};

describe("createRng", () => {
  test("seed sama menghasilkan urutan sama", () => {
    const a = createRng("abc");
    const b = createRng("abc");
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });

  test("seed berbeda menghasilkan urutan berbeda", () => {
    expect(createRng("abc")()).not.toBe(createRng("abd")());
  });

  test("selalu di rentang [0, 1)", () => {
    const rng = createRng("rentang");
    for (let i = 0; i < 10_000; i++) {
      const value = rng();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });
});

describe("computePurchase", () => {
  const stock = { type: "STOCK" as const, price: "2500", minInvestment: "1" };

  test("500.000 untuk saham Rp2.500 = 200 lembar, sisa 500.000", () => {
    expect(computePurchase({ ...stock, amount: "500000" })).toEqual({
      ok: true,
      units: "200",
      investedAmount: "500000.00",
      cashLeft: "500000.00",
    });
  });

  test("saham dibeli per lembar bulat, sisa nominal kembali ke saldo", () => {
    expect(computePurchase({ ...stock, amount: "100000", price: "3200" })).toEqual({
      ok: true,
      units: "31",
      investedAmount: "99200.00",
      cashLeft: "900800.00",
    });
  });

  test("seluruh modal boleh dipakai", () => {
    const result = computePurchase({ ...stock, amount: "1000000" });
    expect(result.ok && result.cashLeft).toBe("0.00");
  });

  test("melebihi saldo virtual ditolak", () => {
    const result = computePurchase({ ...stock, amount: "2000000" });
    expect(result.ok).toBe(false);
    expect(!result.ok && result.message).toContain("saldo virtual");
  });

  test("kurang dari harga 1 lembar ditolak", () => {
    const result = computePurchase({ ...stock, amount: "1000" });
    expect(result.ok).toBe(false);
    expect(!result.ok && result.message).toContain("1 lembar");
  });

  test("di bawah minimal reksa dana ditolak", () => {
    const result = computePurchase({
      type: "MUTUAL_FUND",
      price: "1000",
      amount: "5000",
      minInvestment: "10000",
    });
    expect(result.ok).toBe(false);
    expect(!result.ok && result.message).toContain("minimal");
  });

  test("reksa dana dibeli sebesar nominal dengan unit 6 desimal", () => {
    expect(
      computePurchase({
        type: "MUTUAL_FUND",
        price: "1083.87",
        amount: "1000000",
        minInvestment: "10000",
      }),
    ).toEqual({
      ok: true,
      units: "922.619871",
      investedAmount: "1000000.00",
      cashLeft: "0.00",
    });
  });
});

describe("harga pasar", () => {
  test("stabil dalam satu hari", () => {
    const evening = new Date("2026-10-22T15:00:00Z"); // 22:00 WIB
    expect(marketQuote(NUSA, NOW)).toEqual(marketQuote(NUSA, evening));
  });

  test("berganti mengikuti tanggal WIB, bukan UTC", () => {
    const afterMidnightWib = new Date("2026-10-22T17:30:00Z"); // 00:30 WIB tgl 23
    expect(marketQuote(NUSA, afterMidnightWib)).not.toEqual(
      marketQuote(NUSA, NOW),
    );
  });

  test("harga saham berupa rupiah bulat", () => {
    expect(marketQuote(NUSA, NOW).price).toMatch(/^\d+\.00$/);
  });

  test("harga kemarin tidak berubah saat hari bertambah", () => {
    const today = marketHistory(NUSA, "WEEK", NOW);
    const tomorrow = marketHistory(
      NUSA,
      "WEEK",
      new Date(NOW.getTime() + 24 * 60 * 60 * 1000),
    );
    expect(tomorrow.slice(0, 6)).toEqual(today.slice(1));
  });

  test.each([
    ["WEEK", 7],
    ["MONTH", 30],
    ["YEAR", 52],
  ] as const)("panjang history %s = %d titik", (range, points) => {
    const history = marketHistory(NUSA, range, NOW);
    expect(history).toHaveLength(points);
    expect(history.at(-1)!.date).toBe("2026-10-22");
  });

  test("YEAR berupa titik mingguan", () => {
    const history = marketHistory(NUSA, "YEAR", NOW);
    expect(history.at(-2)!.date).toBe("2026-10-15");
  });

  test("harga tetap di sekitar harga acuan", () => {
    for (const point of marketHistory(NUSA, "YEAR", NOW)) {
      expect(Number(point.price)).toBeGreaterThan(2500 * 0.6);
      expect(Number(point.price)).toBeLessThan(2500 * 1.6);
    }
  });

  test("NAV reksa dana pasar uang tumbuh pelan", () => {
    const history = marketHistory(RDPU, "YEAR", NOW);
    expect(Number(history.at(-1)!.price)).toBeGreaterThan(
      Number(history[0]!.price),
    );
  });
});

describe("buildSessionPath", () => {
  test("seed sama menghasilkan jalur dan event yang sama", () => {
    expect(buildSessionPath(sessionOf(NUSA, "seed-1"))).toEqual(
      buildSessionPath(sessionOf(NUSA, "seed-1")),
    );
  });

  test("seed berbeda menghasilkan jalur berbeda", () => {
    expect(buildSessionPath(sessionOf(NUSA, "seed-1")).prices[365]).not.toBe(
      buildSessionPath(sessionOf(NUSA, "seed-2")).prices[365],
    );
  });

  test("jalur dimulai dari harga beli dan berjalan 365 hari", () => {
    const { prices } = buildSessionPath(sessionOf(NUSA, "seed-1"));
    expect(prices).toHaveLength(366);
    expect(prices[0]).toBe(2500);
  });

  test("event berada di interval checkpoint-nya dan tidak berulang", () => {
    for (let i = 0; i < 500; i++) {
      const { events } = buildSessionPath(sessionOf(NUSA, `event-${i}`));
      const headlines = events.map((event) => event.headline);
      expect(new Set(headlines).size).toBe(headlines.length);

      for (const event of events) {
        const from = event.step === 1 ? 0 : CHECKPOINTS[event.step - 2]!.day;
        expect(event.day).toBeGreaterThan(from);
        expect(event.day).toBeLessThanOrEqual(CHECKPOINTS[event.step - 1]!.day);
      }
    }
  });

  test("reksa dana hanya mendapat event yang berlaku untuknya", () => {
    const allowed = new Set(
      SIM_EVENT_TEMPLATES.filter((t) => t.impact.MUTUAL_FUND !== undefined).map(
        (t) => t.headline,
      ),
    );
    for (let i = 0; i < 300; i++) {
      for (const event of buildSessionPath(sessionOf(RDPU, `rdpu-${i}`)).events) {
        expect(allowed.has(event.headline)).toBe(true);
      }
    }
  });

  test("dampak event saham seimbang antara naik dan turun", () => {
    const total = SIM_EVENT_TEMPLATES.reduce(
      (sum, template) => sum + (template.impact.STOCK ?? 0),
      0,
    );
    expect(Math.abs(total)).toBeLessThan(1e-9);
  });
});

describe("sebaran hasil 1 tahun", () => {
  const SESSIONS = 1000;
  const returnsOf = (instrument: MarketInstrument) =>
    Array.from({ length: SESSIONS }, (_, i) =>
      yearReturn(sessionOf(instrument, `dist-${i}`)),
    );

  test("saham berisiko tinggi tidak selalu untung", () => {
    const returns = returnsOf(NUSA);
    const lossRate = returns.filter((r) => r < 0).length / SESSIONS;
    const mean = returns.reduce((sum, r) => sum + r, 0) / SESSIONS;

    expect(lossRate).toBeGreaterThan(0.25);
    expect(lossRate).toBeLessThan(0.6);
    expect(mean).toBeGreaterThan(0);
    expect(mean).toBeLessThan(0.25);
  });

  test("reksa dana pasar uang hampir tidak pernah rugi", () => {
    const returns = returnsOf(RDPU);
    const lossRate = returns.filter((r) => r < 0).length / SESSIONS;
    const mean = returns.reduce((sum, r) => sum + r, 0) / SESSIONS;

    expect(lossRate).toBeLessThan(0.01);
    expect(mean).toBeGreaterThan(0.03);
    expect(mean).toBeLessThan(0.07);
  });
});

describe("describeSession", () => {
  const state = (currentStep: number) => ({
    ...sessionOf(NUSA, "describe"),
    units: "200",
    investedAmount: "500000",
    currentStep,
  });

  test("langkah 0: nilai sama dengan modal, belum ada checkpoint", () => {
    const result = describeSession(state(0));
    expect(result.current).toEqual({
      price: "2500.00",
      value: "500000.00",
      profit: "0.00",
      returnPct: 0,
    });
    expect(result.checkpoints.every((c) => !c.reached)).toBe(true);
    expect(result.series).toEqual([
      { day: 0, price: "2500.00", value: "500000.00" },
    ]);
  });

  test("nilai = unit x harga hari itu", () => {
    const result = describeSession(state(2));
    const { prices } = buildSessionPath(sessionOf(NUSA, "describe"));
    expect(result.current.value).toBe((Math.round(prices[30]!) * 200).toFixed(2));
    expect(result.currentDay).toBe(30);
  });

  test("hanya data sampai checkpoint sekarang yang dikirim", () => {
    const result = describeSession(state(2));
    expect(result.checkpoints.map((c) => c.reached)).toEqual([
      true,
      true,
      false,
      false,
    ]);
    expect(result.checkpoints[2]!.value).toBeNull();
    expect(Math.max(...result.series.map((point) => point.day))).toBe(30);
    expect(result.events.every((event) => event.step <= 2)).toBe(true);
  });

  test("checkpoint terakhir sama dengan nilai sekarang di akhir sesi", () => {
    const result = describeSession(state(FINAL_STEP));
    expect(result.checkpoints.at(-1)!.value).toBe(result.current.value);
    expect(result.series.at(-1)!.day).toBe(365);
  });

  test("hasil bisa dihitung ulang dari seed", () => {
    expect(describeSession(state(FINAL_STEP))).toEqual(
      describeSession(state(FINAL_STEP)),
    );
  });
});
