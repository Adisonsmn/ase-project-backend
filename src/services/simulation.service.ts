import type { Prisma } from "../../generated/prisma/client";
import type { SimInstrumentType } from "../../generated/prisma/enums";
import { prisma } from "../config/database";
import { buildMeta } from "../schemas/common.schema";
import type {
  InstrumentHistoryQuery,
  ListInstrumentQuery,
  ListSessionQuery,
  PurchaseInput,
} from "../schemas/simulation.schema";
import { AppError } from "../utils/app.error";
import { formatMoney } from "../utils/money";
import {
  CHECKPOINTS,
  FINAL_STEP,
  SIMULATION_DISCLAIMER,
  STARTING_CASH,
  computePurchase,
  describeSession,
  marketHistory,
  marketQuote,
} from "../utils/simulation";

// --- Instrumen ----------------------------------------------------------------

const instrumentSelect = {
  id: true,
  code: true,
  type: true,
  name: true,
  fundType: true,
  description: true,
  note: true,
  riskLevel: true,
  returnPotential: true,
  horizonText: true,
  minInvestment: true,
  basePrice: true,
  annualDrift: true,
  annualVolatility: true,
} as const;

type InstrumentRow = Prisma.SimInstrumentGetPayload<{
  select: typeof instrumentSelect;
}>;

const toMarket = (instrument: InstrumentRow) => ({
  code: instrument.code,
  type: instrument.type,
  basePrice: instrument.basePrice.toString(),
  annualDrift: instrument.annualDrift,
  annualVolatility: instrument.annualVolatility,
});

/** Parameter mesin (drift, volatilitas, harga acuan) tidak dikirim ke klien. */
const toInstrumentItem = (instrument: InstrumentRow, now: Date) => ({
  code: instrument.code,
  type: instrument.type,
  name: instrument.name,
  fundType: instrument.fundType,
  ...marketQuote(toMarket(instrument), now),
  riskLevel: instrument.riskLevel,
  returnPotential: instrument.returnPotential,
  minInvestment: formatMoney(instrument.minInvestment),
});

export const listInstruments = async (query: ListInstrumentQuery) => {
  const instruments = await prisma.simInstrument.findMany({
    where: { isActive: true, ...(query.type && { type: query.type }) },
    select: instrumentSelect,
    orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
  });

  const now = new Date();

  return {
    startingCash: formatMoney(STARTING_CASH),
    disclaimer: SIMULATION_DISCLAIMER,
    data: instruments.map((instrument) => toInstrumentItem(instrument, now)),
  };
};

const findActiveInstrument = async (code: string) => {
  const instrument = await prisma.simInstrument.findFirst({
    where: { code, isActive: true },
    select: instrumentSelect,
  });

  if (!instrument) {
    throw new AppError(404, "Instrumen tidak ditemukan");
  }

  return instrument;
};

export const getInstrument = async (code: string) => {
  const instrument = await findActiveInstrument(code);

  return {
    ...toInstrumentItem(instrument, new Date()),
    description: instrument.description,
    note: instrument.note,
    horizonText: instrument.horizonText,
    disclaimer: SIMULATION_DISCLAIMER,
  };
};

export const getInstrumentHistory = async (
  code: string,
  query: InstrumentHistoryQuery,
) => {
  const instrument = await findActiveInstrument(code);

  return {
    code: instrument.code,
    range: query.range,
    data: marketHistory(toMarket(instrument), query.range),
    disclaimer: SIMULATION_DISCLAIMER,
  };
};

// --- Pembelian ----------------------------------------------------------------

/**
 * Harga selalu diambil dari server, tidak pernah dari klien, supaya user tidak
 * bisa membeli dengan harga yang dikarang sendiri.
 */
const quotePurchase = async (input: PurchaseInput) => {
  const instrument = await findActiveInstrument(input.instrumentCode);
  const { price } = marketQuote(toMarket(instrument));

  const purchase = computePurchase({
    type: instrument.type,
    price,
    amount: input.amount,
    minInvestment: instrument.minInvestment.toString(),
  });

  if (!purchase.ok) {
    throw new AppError(400, purchase.message);
  }

  return { instrument, price, purchase };
};

/** Estimasi pembelian untuk form nominal, tanpa menyimpan apa pun. */
export const previewPurchase = async (input: PurchaseInput) => {
  const { instrument, price, purchase } = await quotePurchase(input);

  return {
    instrument: {
      code: instrument.code,
      type: instrument.type,
      name: instrument.name,
    },
    startingCash: formatMoney(STARTING_CASH),
    amount: formatMoney(input.amount),
    price,
    units: purchase.units,
    investedAmount: purchase.investedAmount,
    cashLeft: purchase.cashLeft,
    disclaimer: SIMULATION_DISCLAIMER,
  };
};

// --- Sesi ---------------------------------------------------------------------

const sessionSelect = {
  id: true,
  seed: true,
  annualDrift: true,
  annualVolatility: true,
  startingCash: true,
  investedAmount: true,
  cashLeft: true,
  units: true,
  buyPrice: true,
  currentStep: true,
  status: true,
  finalValue: true,
  finishedAt: true,
  createdAt: true,
  instrument: {
    select: { code: true, type: true, name: true, fundType: true },
  },
} as const;

const sessionDetailSelect = {
  ...sessionSelect,
  events: {
    select: {
      step: true,
      day: true,
      headline: true,
      explanation: true,
      impactPct: true,
    },
    orderBy: { day: "asc" },
  },
} as const;

type SessionRow = Prisma.SimulationSessionGetPayload<{
  select: typeof sessionSelect;
}>;

type SessionDetailRow = Prisma.SimulationSessionGetPayload<{
  select: typeof sessionDetailSelect;
}>;

const formatUnits = (type: SimInstrumentType, units: Prisma.Decimal) =>
  units.toFixed(type === "STOCK" ? 0 : 6);

const describe = (session: SessionRow, currentStep = session.currentStep) =>
  describeSession({
    seed: session.seed,
    type: session.instrument.type,
    buyPrice: session.buyPrice.toString(),
    annualDrift: session.annualDrift,
    annualVolatility: session.annualVolatility,
    units: session.units.toString(),
    investedAmount: session.investedAmount.toString(),
    currentStep,
  });

const checkpointOf = (step: number) => {
  const checkpoint = CHECKPOINTS[step - 1];
  return checkpoint
    ? { key: checkpoint.key, label: checkpoint.label, day: checkpoint.day }
    : null;
};

/** Ringkasan sesi untuk daftar riwayat. */
const toSessionSummary = (session: SessionRow) => {
  const state = describe(session);

  return {
    id: session.id,
    status: session.status,
    instrument: session.instrument,
    investedAmount: formatMoney(session.investedAmount),
    currentStep: session.currentStep,
    totalSteps: FINAL_STEP,
    currentCheckpoint: checkpointOf(session.currentStep),
    currentValue: state.current.value,
    profit: state.current.profit,
    returnPct: state.current.returnPct,
    createdAt: session.createdAt,
    finishedAt: session.finishedAt,
  };
};

const toSessionResponse = (session: SessionDetailRow) => {
  const state = describe(session);
  const finished = session.status === "FINISHED";

  return {
    id: session.id,
    status: session.status,
    instrument: session.instrument,
    startingCash: formatMoney(session.startingCash),
    investedAmount: formatMoney(session.investedAmount),
    cashLeft: formatMoney(session.cashLeft),
    units: formatUnits(session.instrument.type, session.units),
    buyPrice: formatMoney(session.buyPrice),
    currentStep: session.currentStep,
    totalSteps: FINAL_STEP,
    currentCheckpoint: checkpointOf(session.currentStep),
    nextCheckpoint: checkpointOf(session.currentStep + 1),
    currentValue: state.current.value,
    profit: state.current.profit,
    returnPct: state.current.returnPct,
    checkpoints: state.checkpoints,
    series: state.series,
    events: session.events,
    result: finished
      ? {
          investedAmount: formatMoney(session.investedAmount),
          finalValue: formatMoney(session.finalValue),
          profit: state.current.profit,
          returnPct: state.current.returnPct,
          periodLabel: checkpointOf(FINAL_STEP)!.label,
          instrumentType: session.instrument.type,
          fundType: session.instrument.fundType,
        }
      : null,
    createdAt: session.createdAt,
    finishedAt: session.finishedAt,
    disclaimer: SIMULATION_DISCLAIMER,
  };
};

const findSession = async (userId: string, sessionId: string) => {
  // Sesi milik user lain dijawab 404, sama seperti sesi yang tidak ada.
  const session = await prisma.simulationSession.findFirst({
    where: { id: sessionId, userId },
    select: sessionDetailSelect,
  });

  if (!session) {
    throw new AppError(404, "Sesi simulasi tidak ditemukan");
  }

  return session;
};

export const createSession = async (userId: string, input: PurchaseInput) => {
  const { instrument, price, purchase } = await quotePurchase(input);

  const session = await prisma.simulationSession.create({
    data: {
      userId,
      instrumentId: instrument.id,
      seed: crypto.randomUUID(),
      // Disalin supaya hasil sesi tidak berubah kalau instrumennya disetel ulang.
      annualDrift: instrument.annualDrift,
      annualVolatility: instrument.annualVolatility,
      startingCash: STARTING_CASH,
      investedAmount: purchase.investedAmount,
      cashLeft: purchase.cashLeft,
      units: purchase.units,
      buyPrice: price,
    },
    select: sessionDetailSelect,
  });

  return toSessionResponse(session);
};

export const getSession = async (userId: string, sessionId: string) =>
  toSessionResponse(await findSession(userId, sessionId));

/**
 * Maju ke checkpoint berikutnya. Checkpoint terakhir sekaligus menyelesaikan
 * sesi, jadi tidak ada endpoint "selesai" terpisah.
 */
export const advanceSession = async (userId: string, sessionId: string) => {
  const session = await findSession(userId, sessionId);

  if (session.status === "FINISHED") {
    throw new AppError(409, "Simulasi ini sudah selesai.");
  }

  const nextStep = session.currentStep + 1;
  const isFinal = nextStep === FINAL_STEP;
  const next = describe(session, nextStep);
  const newEvents = next.events.filter((event) => event.step === nextStep);

  await prisma.$transaction(async (tx) => {
    // Syarat currentStep memastikan hanya satu request yang menang kalau
    // "Lanjutkan" ditekan dua kali, sehingga sesi tidak melompat dua langkah
    // dan event tidak tercatat ganda.
    const { count } = await tx.simulationSession.updateMany({
      where: {
        id: sessionId,
        userId,
        currentStep: session.currentStep,
        status: "RUNNING",
      },
      data: {
        currentStep: nextStep,
        ...(isFinal && {
          status: "FINISHED",
          finalValue: next.current.value,
          finishedAt: new Date(),
        }),
      },
    });

    if (count === 0) {
      throw new AppError(
        409,
        "Simulasi sudah dilanjutkan dari permintaan lain. Muat ulang untuk melihat posisi terbaru.",
      );
    }

    if (newEvents.length > 0) {
      await tx.simEvent.createMany({
        data: newEvents.map((event) => ({ sessionId, ...event })),
      });
    }
  });

  return {
    ...toSessionResponse(await findSession(userId, sessionId)),
    /** Event yang baru terjadi di langkah ini, untuk pop-up edukasi. */
    newEvents,
  };
};

export const listSessions = async (userId: string, query: ListSessionQuery) => {
  const { page, limit, status } = query;
  const where: Prisma.SimulationSessionWhereInput = {
    userId,
    ...(status && { status }),
  };

  const [sessions, total] = await prisma.$transaction([
    prisma.simulationSession.findMany({
      where,
      select: sessionSelect,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.simulationSession.count({ where }),
  ]);

  return {
    data: sessions.map(toSessionSummary),
    meta: buildMeta(page, limit, total),
    disclaimer: SIMULATION_DISCLAIMER,
  };
};
