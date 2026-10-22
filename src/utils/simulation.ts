import { Prisma } from "../../generated/prisma/client";
import type { SimInstrumentType } from "../../generated/prisma/enums";
import { toLocalDateString } from "./datetime";
import { percentageOf } from "./money";
import { templatesFor } from "./simulation-events";

/**
 * Mesin game simulasi investasi (F-10..F-13).
 *
 * Fungsi murni tanpa database supaya bisa diuji langsung. Semua angka acak
 * berasal dari RNG ber-seed, bukan Math.random, sehingga seed yang sama selalu
 * menghasilkan harga, event, dan nilai akhir yang sama. Ini yang membuat hasil
 * sesi bisa dihitung ulang dari database tanpa menyimpan setiap harga harian.
 *
 * Ada dua jenis harga:
 * - Harga pasar harian (layar daftar, detail, dan grafik instrumen). Sama untuk
 *   semua user pada hari yang sama, berubah setiap hari, dan tetap berada di
 *   sekitar harga acuan instrumen.
 * - Jalur harga sesi, dimulai dari harga beli dan berjalan 365 hari ke depan.
 *   Seluruh jalurnya sudah tertentu sejak sesi dibuat, tetapi server hanya
 *   mengirim bagian yang sudah dicapai user.
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const DAYS_PER_YEAR = 365;

/** Modal virtual setiap sesi. Tidak dibawa ke sesi berikutnya. */
export const STARTING_CASH = "1000000";

export const SIMULATION_DISCLAIMER =
  "Simulasi edukatif dengan uang virtual. Harga dan event bukan data pasar sebenarnya, dan hasilnya bukan rekomendasi investasi.";

export const CHECKPOINTS = [
  { key: "1D", label: "1 Hari", day: 1 },
  { key: "1M", label: "1 Bulan", day: 30 },
  { key: "6M", label: "6 Bulan", day: 182 },
  { key: "1Y", label: "1 Tahun", day: 365 },
] as const;

export const FINAL_STEP = CHECKPOINTS.length;

/** Peluang muncul event pada interval menuju checkpoint ke-1..4. */
export const EVENT_CHANCE = [0.05, 0.3, 0.5, 0.5];

// --- RNG deterministik --------------------------------------------------------

/** FNV-1a 32-bit: string seed -> state awal RNG. */
const hashSeed = (seed: string): number => {
  let hash = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
};

export type Rng = () => number;

/** mulberry32: bilangan acak [0, 1) yang sepenuhnya ditentukan seed. */
export const createRng = (seed: string): Rng => {
  let state = hashSeed(seed);

  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/**
 * Bilangan normal baku lewat Box–Muller. Selalu memakai tepat dua angka acak,
 * supaya urutan angka berikutnya tidak bergantung pada hasil sebelumnya.
 */
const randomNormal = (rng: Rng) => {
  const u1 = 1 - rng(); // (0, 1], log(0) tidak terdefinisi
  const u2 = rng();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
};

// --- Harga --------------------------------------------------------------------

/** Saham diperdagangkan dalam rupiah bulat; NAV reksa dana dua desimal. */
const roundPrice = (type: SimInstrumentType, price: number) =>
  type === "STOCK"
    ? Math.max(1, Math.round(price))
    : Math.max(0.01, Math.round(price * 100) / 100);

export const formatPrice = (type: SimInstrumentType, price: number) =>
  roundPrice(type, price).toFixed(2);

const round2 = (value: number) => Math.round(value * 100) / 100;

export type MarketInstrument = {
  code: string;
  type: SimInstrumentType;
  basePrice: string;
  annualDrift: number;
  annualVolatility: number;
};

/** Awal pasar sintetis. Harga hari ini dihitung berjalan dari tanggal ini. */
const MARKET_EPOCH = Date.UTC(2025, 0, 1);

/**
 * Seberapa kuat harga ditarik kembali ke acuannya setiap hari. Dengan nilai
 * ini, harga saham bervolatilitas 35% sebagian besar waktu berada dalam ±20%
 * harga acuan.
 */
const MEAN_REVERSION = 0.02;

/** Hari ke berapa sejak epoch, menurut tanggal lokal (WIB). */
export const marketDayIndex = (date: Date) => {
  const localMidnight = Date.parse(`${toLocalDateString(date)}T00:00:00Z`);
  return Math.max(0, Math.round((localMidnight - MARKET_EPOCH) / MS_PER_DAY));
};

const marketDate = (dayIndex: number) =>
  new Date(MARKET_EPOCH + dayIndex * MS_PER_DAY).toISOString().slice(0, 10);

/**
 * Harga penutupan harian dari epoch sampai `untilDay` (inklusif).
 *
 * Log-harga bergerak acak di sekitar garis acuan dan ditarik kembali ke garis
 * itu (Ornstein–Uhlenbeck), jadi harga tidak melayang jauh dari harga di
 * desain. Garis acuan saham datar; garis acuan reksa dana naik mengikuti
 * imbal hasilnya, karena NAV pasar uang memang tumbuh pelan setiap hari.
 * Setiap hari memakai jumlah angka acak yang sama, sehingga harga kemarin
 * tidak berubah saat hari bertambah.
 */
export const marketSeries = (
  instrument: MarketInstrument,
  untilDay: number,
): number[] => {
  const rng = createRng(`market:${instrument.code}`);
  const basePrice = Number(instrument.basePrice);
  const dailyVolatility = instrument.annualVolatility / Math.sqrt(DAYS_PER_YEAR);
  const dailyTrend =
    instrument.type === "MUTUAL_FUND" ? instrument.annualDrift / DAYS_PER_YEAR : 0;

  const prices: number[] = [];
  let deviation = 0;

  for (let day = 0; day <= untilDay; day++) {
    if (day > 0) {
      deviation =
        deviation * (1 - MEAN_REVERSION) + dailyVolatility * randomNormal(rng);
    }
    prices.push(roundPrice(instrument.type, basePrice * Math.exp(dailyTrend * day + deviation)));
  }

  return prices;
};

/** Harga hari ini dan perubahannya dibanding kemarin. */
export const marketQuote = (instrument: MarketInstrument, now = new Date()) => {
  const today = Math.max(1, marketDayIndex(now));
  const prices = marketSeries(instrument, today);
  const price = prices[today]!;
  const previous = prices[today - 1]!;

  return {
    price: formatPrice(instrument.type, price),
    changePct: round2(((price - previous) / previous) * 100),
  };
};

export const HISTORY_RANGES = {
  WEEK: { points: 7, everyDays: 1 },
  MONTH: { points: 30, everyDays: 1 },
  YEAR: { points: 52, everyDays: 7 },
} as const;

export type HistoryRange = keyof typeof HISTORY_RANGES;

/** Deret harga untuk grafik detail instrumen, berakhir di hari ini. */
export const marketHistory = (
  instrument: MarketInstrument,
  range: HistoryRange,
  now = new Date(),
) => {
  const today = marketDayIndex(now);
  const prices = marketSeries(instrument, today);
  const { points, everyDays } = HISTORY_RANGES[range];

  const history: { date: string; price: string }[] = [];
  for (let i = points - 1; i >= 0; i--) {
    const day = today - i * everyDays;
    if (day < 0) continue;
    history.push({
      date: marketDate(day),
      price: formatPrice(instrument.type, prices[day]!),
    });
  }

  return history;
};

// --- Pembelian ----------------------------------------------------------------

const rupiah = (value: Prisma.Decimal) =>
  `Rp ${value.toNumber().toLocaleString("id-ID")}`;

export type PurchaseInput = {
  type: SimInstrumentType;
  price: string;
  amount: string;
  minInvestment: string;
  cash?: string;
};

export type PurchaseResult =
  | { ok: true; units: string; investedAmount: string; cashLeft: string }
  | { ok: false; message: string };

/**
 * Saham dibeli per lembar bulat, jadi uang yang benar-benar terpakai bisa
 * lebih kecil dari nominal yang diketik dan sisanya kembali ke saldo. Lot
 * (100 lembar) sengaja tidak dipakai supaya nominal kecil tetap bisa membeli
 * saham. Reksa dana dibeli sebesar nominalnya, dengan unit pecahan.
 */
export const computePurchase = (input: PurchaseInput): PurchaseResult => {
  const cash = new Prisma.Decimal(input.cash ?? STARTING_CASH);
  const amount = new Prisma.Decimal(input.amount);
  const price = new Prisma.Decimal(input.price);
  const minInvestment = new Prisma.Decimal(input.minInvestment);

  if (amount.greaterThan(cash)) {
    return {
      ok: false,
      message: `Nominal melebihi saldo virtual ${rupiah(cash)}.`,
    };
  }

  if (amount.lessThan(minInvestment)) {
    return {
      ok: false,
      message: `Nominal minimal ${rupiah(minInvestment)}.`,
    };
  }

  let units: Prisma.Decimal;
  let invested: Prisma.Decimal;

  if (input.type === "STOCK") {
    units = amount.dividedToIntegerBy(price);
    if (units.isZero()) {
      return {
        ok: false,
        message: `Nominal belum cukup untuk membeli 1 lembar seharga ${rupiah(price)}.`,
      };
    }
    invested = units.times(price);
  } else {
    units = amount.dividedBy(price).toDecimalPlaces(6, Prisma.Decimal.ROUND_DOWN);
    invested = amount;
  }

  return {
    ok: true,
    units: units.toFixed(input.type === "STOCK" ? 0 : 6),
    investedAmount: invested.toFixed(2),
    cashLeft: cash.minus(invested).toFixed(2),
  };
};

// --- Sesi ---------------------------------------------------------------------

export type SessionParams = {
  seed: string;
  type: SimInstrumentType;
  buyPrice: string;
  annualDrift: number;
  annualVolatility: number;
};

export type PathEvent = {
  /** Checkpoint yang memunculkan event (1..4). */
  step: number;
  day: number;
  headline: string;
  explanation: string;
  /** Dalam persen, mis. -6 atau 0.3. */
  impactPct: number;
};

export type SessionPath = {
  /** Harga hari ke-0 (hari beli) sampai hari ke-365, belum dibulatkan. */
  prices: number[];
  events: PathEvent[];
};

/**
 * Event diundi dari aliran angka acak tersendiri, terpisah dari pergerakan
 * harga, dan setiap interval selalu memakai tiga angka acak. Dengan begitu
 * muncul atau tidaknya satu event tidak menggeser seluruh harga sesudahnya.
 */
const drawEvents = (seed: string, type: SimInstrumentType): PathEvent[] => {
  const rng = createRng(`${seed}:events`);
  const pool = [...templatesFor(type)];
  const events: PathEvent[] = [];
  let previousDay = 0;

  CHECKPOINTS.forEach((checkpoint, index) => {
    const roll = rng();
    const dayRoll = rng();
    const pick = rng();

    if (roll < EVENT_CHANCE[index]! && pool.length > 0) {
      // Satu template paling banyak muncul sekali per sesi.
      const [template] = pool.splice(Math.floor(pick * pool.length), 1);
      events.push({
        step: index + 1,
        day: previousDay + 1 + Math.floor(dayRoll * (checkpoint.day - previousDay)),
        headline: template!.headline,
        explanation: template!.explanation,
        impactPct: round2(template!.impact[type]! * 100),
      });
    }

    previousDay = checkpoint.day;
  });

  return events;
};

/**
 * Jalur harga satu sesi: gerak Brown geometris harian (Δt = 1/365) dengan
 * lonjakan pada hari terjadinya event. Hasilnya bisa untung atau rugi;
 * peluang rugi bergantung pada volatilitas instrumennya.
 */
export const buildSessionPath = (params: SessionParams): SessionPath => {
  const events = drawEvents(params.seed, params.type);
  const shocks = new Map(events.map((event) => [event.day, event.impactPct / 100]));

  const rng = createRng(`${params.seed}:path`);
  const dt = 1 / DAYS_PER_YEAR;
  const drift = (params.annualDrift - params.annualVolatility ** 2 / 2) * dt;
  const volatility = params.annualVolatility * Math.sqrt(dt);

  let price = Number(params.buyPrice);
  const prices = [price];

  for (let day = 1; day <= DAYS_PER_YEAR; day++) {
    price *= Math.exp(drift + volatility * randomNormal(rng));
    price *= 1 + (shocks.get(day) ?? 0);
    prices.push(price);
  }

  return { prices, events };
};

export type SessionState = SessionParams & {
  units: string;
  investedAmount: string;
  currentStep: number;
};

/** Hari yang sudah dicapai pada sebuah langkah; langkah 0 = hari beli. */
export const dayOfStep = (step: number) =>
  step === 0 ? 0 : CHECKPOINTS[step - 1]!.day;

/**
 * Hari yang ditampilkan di grafik sesi: harian sampai 1 bulan, lalu mingguan,
 * ditambah hari checkpoint. Cukup halus untuk grafik tanpa mengirim 365 titik.
 */
const seriesDays = (untilDay: number) => {
  const days = new Set<number>();
  for (let day = 0; day <= Math.min(untilDay, 30); day++) days.add(day);
  for (let day = 35; day <= untilDay; day += 7) days.add(day);
  for (const checkpoint of CHECKPOINTS) {
    if (checkpoint.day <= untilDay) days.add(checkpoint.day);
  }
  days.add(untilDay);
  return [...days].sort((a, b) => a - b);
};

/**
 * Keadaan sesi pada langkah sekarang, dihitung ulang dari seed. Nilai
 * investasi = unit x harga, tanpa sisa kas, sesuai "Nilai investasi saat ini"
 * di layar.
 */
export const describeSession = (state: SessionState) => {
  const path = buildSessionPath(state);
  const invested = new Prisma.Decimal(state.investedAmount);

  const valueOn = (day: number) => {
    const price = formatPrice(state.type, path.prices[day]!);
    const value = new Prisma.Decimal(state.units).times(price).toDecimalPlaces(2);
    return { price, value };
  };

  const performanceOn = (day: number) => {
    const { price, value } = valueOn(day);
    return {
      price,
      value: value.toFixed(2),
      profit: value.minus(invested).toFixed(2),
      returnPct: percentageOf(value.minus(invested), invested),
    };
  };

  const currentDay = dayOfStep(state.currentStep);

  return {
    currentDay,
    current: performanceOn(currentDay),
    checkpoints: CHECKPOINTS.map((checkpoint, index) => {
      const reached = index < state.currentStep;
      const performance = reached ? performanceOn(checkpoint.day) : null;
      return {
        key: checkpoint.key,
        label: checkpoint.label,
        day: checkpoint.day,
        reached,
        value: performance?.value ?? null,
        returnPct: performance?.returnPct ?? null,
      };
    }),
    series: seriesDays(currentDay).map((day) => {
      const { price, value } = valueOn(day);
      return { day, price, value: value.toFixed(2) };
    }),
    /** Hanya event yang sudah terjadi; event masa depan tidak boleh bocor. */
    events: path.events.filter((event) => event.step <= state.currentStep),
  };
};
