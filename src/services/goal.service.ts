import { Prisma } from "../../generated/prisma/client";
import type { AgeGroup, GoalStatus } from "../../generated/prisma/enums";
import { prisma } from "../config/database";
import type {
  CreateGoalInput,
  UpdateGoalInput,
  ListIncomeIdeaQuery,
} from "../schemas/goal.schema";
import { AppError } from "../utils/app.error";
import { formatMoney } from "../utils/money";
import { startOfLocalMonth } from "../utils/datetime";
import {
  analyzeGap,
  buildGapAdvice,
  resolveAgeGroup,
  type GapResult,
} from "../utils/goal";
import { DEFAULT_RATIO, toMonthlyAmount } from "../utils/ratio";

const goalSelect = {
  id: true,
  title: true,
  targetAmount: true,
  currentAmount: true,
  targetDate: true,
  status: true,
  isPrimary: true,
  createdAt: true,
  updatedAt: true,
} as const;

type GoalRow = {
  id: string;
  title: string;
  targetAmount: Prisma.Decimal;
  currentAmount: Prisma.Decimal;
  targetDate: Date;
  status: GoalStatus;
  isPrimary: boolean;
  createdAt: Date;
  updatedAt: Date;
};

const toResponse = (goal: GoalRow) => ({
  ...goal,
  targetAmount: formatMoney(goal.targetAmount),
  currentAmount: formatMoney(goal.currentAmount),
});

/**
 * Menjumlahkan transaksi yang ditautkan ke goal ini.
 *
 * Sumber kebenaran progress adalah tabel Transaction, bukan kolom
 * currentAmount. Kalau user menghapus atau mengubah transaksi tabungannya,
 * kolom yang di-update manual akan langsung melenceng tanpa ketahuan.
 */
const sumLinkedTransactions = async (userId: string, goalId: string) => {
  const result = await prisma.transaction.aggregate({
    where: { userId, goalId },
    _sum: { amount: true },
  });

  return new Prisma.Decimal(result._sum.amount ?? 0);
};

/**
 * Menyegarkan cache currentAmount dari transaksi, sekaligus menandai target
 * sebagai tercapai kalau nominalnya sudah terpenuhi.
 */
export const refreshProgress = async (userId: string, goalId: string) => {
  const goal = await prisma.savingGoal.findFirst({
    where: { id: goalId, userId },
  });

  if (!goal) {
    throw new AppError(404, "Target tidak ditemukan");
  }

  const collected = await sumLinkedTransactions(userId, goalId);
  const isAchieved = collected.greaterThanOrEqualTo(goal.targetAmount);

  // Status ABANDONED dihormati; hanya ACTIVE <-> ACHIEVED yang otomatis.
  const nextStatus: GoalStatus =
    goal.status === "ABANDONED"
      ? "ABANDONED"
      : isAchieved
        ? "ACHIEVED"
        : "ACTIVE";

  const needsUpdate =
    !collected.equals(goal.currentAmount) || nextStatus !== goal.status;

  if (!needsUpdate) {
    return toResponse(goal as GoalRow);
  }

  const updated = await prisma.savingGoal.update({
    where: { id: goalId },
    data: { currentAmount: collected, status: nextStatus },
    select: goalSelect,
  });

  return toResponse(updated as GoalRow);
};

/** Memastikan hanya satu goal yang ditandai utama. */
const clearOtherPrimary = async (userId: string, keepGoalId?: string) => {
  await prisma.savingGoal.updateMany({
    where: {
      userId,
      isPrimary: true,
      ...(keepGoalId && { id: { not: keepGoalId } }),
    },
    data: { isPrimary: false },
  });
};

export const createGoal = async (userId: string, input: CreateGoalInput) => {
  const goal = await prisma.savingGoal.create({
    data: {
      userId,
      title: input.title,
      targetAmount: input.targetAmount,
      targetDate: input.targetDate,
      isPrimary: input.isPrimary ?? false,
    },
    select: goalSelect,
  });

  if (input.isPrimary) {
    await clearOtherPrimary(userId, goal.id);
  }

  return toResponse(goal as GoalRow);
};

export const listGoals = async (userId: string, status?: GoalStatus) => {
  const goals = await prisma.savingGoal.findMany({
    where: { userId, ...(status && { status }) },
    select: goalSelect,
    orderBy: [{ isPrimary: "desc" }, { targetDate: "asc" }],
  });

  return goals.map((goal) => toResponse(goal as GoalRow));
};

export const getGoal = async (userId: string, goalId: string) => {
  // Sekalian menyegarkan progress, supaya angka yang dibaca selalu mutakhir.
  return refreshProgress(userId, goalId);
};

export const updateGoal = async (
  userId: string,
  goalId: string,
  input: UpdateGoalInput,
) => {
  const existing = await prisma.savingGoal.findFirst({
    where: { id: goalId, userId },
  });

  if (!existing) {
    throw new AppError(404, "Target tidak ditemukan");
  }

  const updated = await prisma.savingGoal.update({
    where: { id: goalId },
    data: {
      ...(input.title !== undefined && { title: input.title }),
      ...(input.targetAmount !== undefined && {
        targetAmount: input.targetAmount,
      }),
      ...(input.targetDate !== undefined && { targetDate: input.targetDate }),
      ...(input.status !== undefined && { status: input.status }),
      ...(input.isPrimary !== undefined && { isPrimary: input.isPrimary }),
    },
    select: goalSelect,
  });

  if (input.isPrimary) {
    await clearOtherPrimary(userId, goalId);
  }

  // Mengubah nominal target bisa mengubah status tercapai/belum.
  if (input.targetAmount !== undefined) {
    return refreshProgress(userId, goalId);
  }

  return toResponse(updated as GoalRow);
};

export const deleteGoal = async (userId: string, goalId: string) => {
  const existing = await prisma.savingGoal.findFirst({
    where: { id: goalId, userId },
  });

  if (!existing) {
    throw new AppError(404, "Target tidak ditemukan");
  }

  // onDelete: SetNull pada Transaction.goalId membuat transaksinya tetap ada,
  // hanya tautannya yang lepas. Catatan keuangan user tidak boleh hilang
  // gara-gara menghapus target.
  const unlinked = await prisma.transaction.count({
    where: { userId, goalId },
  });

  await prisma.savingGoal.delete({ where: { id: goalId } });

  return {
    message: "Target dihapus.",
    unlinkedTransactions: unlinked,
  };
};

/**
 * Pemasukan bulanan user: dari rasio tersimpan kalau ada, kalau tidak
 * dihitung dari rata-rata pemasukan tercatat 3 bulan terakhir.
 */
const resolveMonthlyIncome = async (userId: string) => {
  const ratio = await prisma.savingRatio.findUnique({ where: { userId } });

  if (ratio?.incomeAmount && ratio.period) {
    return {
      monthlyIncome: toMonthlyAmount(ratio.incomeAmount, ratio.period),
      savingsPct: ratio.savingsPct,
      source: "saved_ratio" as const,
    };
  }

  // Belum pernah menyimpan nominal: pakai rata-rata pemasukan tercatat.
  const threeMonthsAgo = startOfLocalMonth(new Date());
  threeMonthsAgo.setUTCMonth(threeMonthsAgo.getUTCMonth() - 2);

  const income = await prisma.transaction.aggregate({
    where: { userId, type: "INCOME", occurredAt: { gte: threeMonthsAgo } },
    _sum: { amount: true },
  });

  const total = new Prisma.Decimal(income._sum.amount ?? 0);

  return {
    monthlyIncome: total.dividedBy(3).toDecimalPlaces(2).toFixed(2),
    savingsPct: ratio?.savingsPct ?? DEFAULT_RATIO.savingsPct,
    source: total.isZero()
      ? ("unknown" as const)
      : ("transactions" as const),
  };
};

/** Mengurutkan ide income berdasarkan kecocokan dengan besar gap. */
const rankIdeas = (
  ideas: {
    id: string;
    title: string;
    description: string;
    ageGroup: AgeGroup;
    estMonthlyMin: Prisma.Decimal;
    estMonthlyMax: Prisma.Decimal;
    effortLevel: number;
  }[],
  gap: Prisma.Decimal,
) => {
  return ideas
    .map((idea) => {
      const min = new Prisma.Decimal(idea.estMonthlyMin);
      const max = new Prisma.Decimal(idea.estMonthlyMax);

      // Ide yang rentang pendapatannya sudah menutup gap dianggap paling cocok.
      // Di antara yang sama-sama menutup, yang effort-nya paling ringan menang.
      const coversGap = max.greaterThanOrEqualTo(gap);
      const comfortablyCovers = min.greaterThanOrEqualTo(gap);

      const score =
        (comfortablyCovers ? 200 : 0) +
        (coversGap ? 100 : 0) -
        idea.effortLevel * 10;

      return {
        id: idea.id,
        title: idea.title,
        description: idea.description,
        ageGroup: idea.ageGroup,
        estMonthlyMin: formatMoney(min),
        estMonthlyMax: formatMoney(max),
        effortLevel: idea.effortLevel,
        coversGap: coversGap,
        _score: score,
      };
    })
    .sort((a, b) => b._score - a._score)
    .map(({ _score, ...idea }) => idea);
};

export const listIncomeIdeas = async (
  userId: string,
  query: ListIncomeIdeaQuery,
) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { dateOfBirth: true },
  });

  const ageGroup = query.ageGroup ?? resolveAgeGroup(user?.dateOfBirth ?? null);

  const ideas = await prisma.incomeIdea.findMany({
    where: {
      isActive: true,
      // Ide GENERAL selalu ikut ditampilkan, berapa pun usianya.
      OR: [{ ageGroup }, { ageGroup: "GENERAL" }],
    },
  });

  const gap = new Prisma.Decimal(query.gap ?? 0);

  return {
    ageGroup,
    data: rankIdeas(ideas, gap),
  };
};

export const analyzeGoalGap = async (userId: string, goalId: string) => {
  const goal = await refreshProgress(userId, goalId);
  const income = await resolveMonthlyIncome(userId);

  const result: GapResult = analyzeGap({
    targetAmount: goal.targetAmount,
    currentAmount: goal.currentAmount,
    targetDate: goal.targetDate,
    monthlyIncome: income.monthlyIncome,
    savingsPct: income.savingsPct,
  });

  const ideas = result.isAchieved
    ? { ageGroup: "GENERAL" as AgeGroup, data: [] }
    : await listIncomeIdeas(userId, { gap: result.gapPerMonth });

  return {
    goal,
    income: {
      monthlyIncome: income.monthlyIncome,
      savingsPct: income.savingsPct,
      source: income.source,
    },
    analysis: result,
    advice: buildGapAdvice(result, goal.title),
    incomeIdeas: ideas.data,
    ageGroup: ideas.ageGroup,
  };
};
