import { prisma } from "../config/database";
import type {
  CalculateRatioInput,
  SaveRatioInput,
} from "../schemas/savings.schema";
import { AppError } from "../utils/app.error";
import { formatMoney } from "../utils/money";
import {
  allocate,
  buildTips,
  DEFAULT_RATIO,
  PERIOD_LABEL,
  RATIO_PRESETS,
  toMonthlyAmount,
  type RatioSplit,
} from "../utils/ratio";

const ratioSelect = {
  needsPct: true,
  savingsPct: true,
  funPct: true,
  incomeAmount: true,
  period: true,
  updatedAt: true,
} as const;

export const listPresets = () => ({
  data: RATIO_PRESETS,
  default: DEFAULT_RATIO,
});

/** Rasio tersimpan user, atau null kalau belum pernah menyimpan. */
export const getSavedRatio = async (userId: string) => {
  const saved = await prisma.savingRatio.findUnique({
    where: { userId },
    select: ratioSelect,
  });

  if (!saved) return null;

  return {
    needsPct: saved.needsPct,
    savingsPct: saved.savingsPct,
    funPct: saved.funPct,
    incomeAmount: saved.incomeAmount ? formatMoney(saved.incomeAmount) : null,
    period: saved.period,
    updatedAt: saved.updatedAt,
  };
};

/**
 * Menentukan rasio yang dipakai menghitung, sesuai prioritas:
 * rasio kustom di request > preset yang dipilih > rasio tersimpan > default.
 */
const resolveSplit = async (
  userId: string,
  input: CalculateRatioInput,
): Promise<{ split: RatioSplit; source: string }> => {
  if (input.ratio) {
    return { split: input.ratio, source: "custom" };
  }

  if (input.presetId) {
    const preset = RATIO_PRESETS.find((item) => item.id === input.presetId);
    if (!preset) {
      throw new AppError(400, "Preset tidak dikenal");
    }
    return {
      split: {
        needsPct: preset.needsPct,
        savingsPct: preset.savingsPct,
        funPct: preset.funPct,
      },
      source: `preset:${preset.id}`,
    };
  }

  const saved = await getSavedRatio(userId);
  if (saved) {
    return {
      split: {
        needsPct: saved.needsPct,
        savingsPct: saved.savingsPct,
        funPct: saved.funPct,
      },
      source: "saved",
    };
  }

  return { split: DEFAULT_RATIO, source: "default" };
};

export const calculate = async (
  userId: string,
  input: CalculateRatioInput,
) => {
  const { split, source } = await resolveSplit(userId, input);

  // Alokasi dihitung pada periode yang dimasukkan user. Seseorang dengan uang
  // jajan mingguan ingin tahu "tabung sekian tiap minggu", bukan angka bulanan.
  const perPeriod = allocate(input.amount, split);

  // Setara bulanan disertakan sebagai konteks, dan nanti dipakai F-04 untuk
  // menghitung gap terhadap target tabungan.
  const monthlyIncome = toMonthlyAmount(input.amount, input.period);
  const perMonth = allocate(monthlyIncome, split);

  return {
    input: {
      amount: formatMoney(input.amount),
      period: input.period,
      periodLabel: PERIOD_LABEL[input.period],
    },
    ratio: { ...split, source },
    allocation: {
      perPeriod,
      perMonth,
      monthlyIncome,
    },
    tips: buildTips(split, monthlyIncome),
  };
};

/** Menyimpan rasio pilihan user. Satu rasio per user, jadi upsert. */
export const saveRatio = async (userId: string, input: SaveRatioInput) => {
  const data = {
    needsPct: input.needsPct,
    savingsPct: input.savingsPct,
    funPct: input.funPct,
    ...(input.incomeAmount !== undefined && {
      incomeAmount: input.incomeAmount,
    }),
    ...(input.period !== undefined && { period: input.period }),
  };

  const saved = await prisma.savingRatio.upsert({
    where: { userId },
    create: { userId, ...data },
    update: data,
    select: ratioSelect,
  });

  return {
    needsPct: saved.needsPct,
    savingsPct: saved.savingsPct,
    funPct: saved.funPct,
    incomeAmount: saved.incomeAmount ? formatMoney(saved.incomeAmount) : null,
    period: saved.period,
    updatedAt: saved.updatedAt,
  };
};
