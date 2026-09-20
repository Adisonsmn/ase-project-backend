import { prisma } from "../config/database";
import type {
  CreateTransactionInput,
  UpdateTransactionInput,
  ListTransactionQuery,
} from "../schemas/transaction.schema";
import { buildMeta } from "../schemas/common.schema";
import { AppError } from "../utils/app.error";
import { formatMoney, toDecimal } from "../utils/money";
import { endOfLocalDay, startOfLocalDay } from "../utils/datetime";
import { getUsableCategory } from "./category.service";

const transactionSelect = {
  id: true,
  type: true,
  amount: true,
  note: true,
  occurredAt: true,
  createdAt: true,
  goalId: true,
  category: {
    select: { id: true, name: true, icon: true, type: true },
  },
} as const;

type RawTransaction = {
  id: string;
  type: "INCOME" | "EXPENSE";
  amount: unknown;
  note: string | null;
  occurredAt: Date;
  createdAt: Date;
  goalId: string | null;
  category: {
    id: string;
    name: string;
    icon: string | null;
    type: "INCOME" | "EXPENSE";
  } | null;
};

/** amount diubah ke string agar presisi Decimal tidak hilang di JSON. */
const toResponse = (transaction: RawTransaction) => ({
  ...transaction,
  amount: formatMoney(transaction.amount as never),
});

/**
 * Kategori harus dapat dipakai user DAN tipenya cocok dengan tipe transaksi.
 * Tanpa cek ini, pengeluaran bisa dicatat berkategori "Gaji" dan membuat
 * laporan per kategori jadi tidak masuk akal.
 */
const resolveCategoryId = async (
  userId: string,
  categoryId: string | undefined,
  type: "INCOME" | "EXPENSE",
) => {
  if (!categoryId) return null;

  const category = await getUsableCategory(userId, categoryId);

  if (category.type !== type) {
    throw new AppError(
      400,
      `Kategori "${category.name}" hanya untuk transaksi ${category.type === "INCOME" ? "pemasukan" : "pengeluaran"}.`,
    );
  }

  return category.id;
};

/**
 * Memastikan target ada dan milik user. Hanya pengeluaran yang boleh ditautkan
 * ke target: menautkan pemasukan akan membuat progress tabungan terhitung dua
 * kali, sekali saat uang masuk dan sekali saat ditabung.
 */
const resolveGoalId = async (
  userId: string,
  goalId: string | null | undefined,
  type: "INCOME" | "EXPENSE",
) => {
  if (goalId === undefined) return undefined;
  if (goalId === null) return null;

  if (type !== "EXPENSE") {
    throw new AppError(
      400,
      "Hanya transaksi pengeluaran (menyisihkan uang) yang bisa ditautkan ke target tabungan.",
    );
  }

  const goal = await prisma.savingGoal.findFirst({
    where: { id: goalId, userId },
    select: { id: true },
  });

  if (!goal) {
    throw new AppError(404, "Target tidak ditemukan");
  }

  return goal.id;
};

/** Memastikan transaksi ada DAN milik user yang meminta. */
const getOwnedTransaction = async (userId: string, id: string) => {
  const transaction = await prisma.transaction.findFirst({
    where: { id, userId },
  });

  if (!transaction) {
    throw new AppError(404, "Transaksi tidak ditemukan");
  }

  return transaction;
};

export const createTransaction = async (
  userId: string,
  input: CreateTransactionInput,
) => {
  const categoryId = await resolveCategoryId(
    userId,
    input.categoryId,
    input.type,
  );

  const goalId = await resolveGoalId(userId, input.goalId, input.type);

  const transaction = await prisma.transaction.create({
    data: {
      userId,
      categoryId,
      goalId,
      type: input.type,
      amount: toDecimal(input.amount),
      note: input.note,
      occurredAt: input.occurredAt,
    },
    select: transactionSelect,
  });

  return toResponse(transaction as RawTransaction);
};

export const listTransactions = async (
  userId: string,
  query: ListTransactionQuery,
) => {
  const { page, limit, from, to, categoryId, type } = query;

  const where = {
    userId,
    ...(type && { type }),
    ...(categoryId && { categoryId }),
    ...((from || to) && {
      occurredAt: {
        ...(from && { gte: startOfLocalDay(new Date(from)) }),
        ...(to && { lte: endOfLocalDay(new Date(to)) }),
      },
    }),
  };

  const [items, total] = await prisma.$transaction([
    prisma.transaction.findMany({
      where,
      select: transactionSelect,
      orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.transaction.count({ where }),
  ]);

  return {
    data: items.map((item) => toResponse(item as RawTransaction)),
    meta: buildMeta(page, limit, total),
  };
};

export const getTransaction = async (userId: string, id: string) => {
  await getOwnedTransaction(userId, id);

  const transaction = await prisma.transaction.findUnique({
    where: { id },
    select: transactionSelect,
  });

  return toResponse(transaction as RawTransaction);
};

export const updateTransaction = async (
  userId: string,
  id: string,
  input: UpdateTransactionInput,
) => {
  const existing = await getOwnedTransaction(userId, id);

  const nextType = input.type ?? existing.type;

  // Kalau tipe berubah tanpa kategori baru, kategori lama bisa jadi tidak
  // cocok lagi. Validasi ulang memakai kategori yang akan dipakai.
  const categoryIdToCheck =
    input.categoryId ?? (input.type ? (existing.categoryId ?? undefined) : undefined);

  const categoryId =
    categoryIdToCheck === undefined
      ? undefined
      : await resolveCategoryId(userId, categoryIdToCheck, nextType);

  const goalId = await resolveGoalId(userId, input.goalId, nextType);

  const transaction = await prisma.transaction.update({
    where: { id },
    data: {
      ...(input.type !== undefined && { type: input.type }),
      ...(input.amount !== undefined && { amount: toDecimal(input.amount) }),
      ...(input.note !== undefined && { note: input.note }),
      ...(input.occurredAt !== undefined && { occurredAt: input.occurredAt }),
      ...(categoryId !== undefined && { categoryId }),
      ...(goalId !== undefined && { goalId }),
    },
    select: transactionSelect,
  });

  return toResponse(transaction as RawTransaction);
};

export const deleteTransaction = async (userId: string, id: string) => {
  await getOwnedTransaction(userId, id);

  await prisma.transaction.delete({ where: { id } });

  return { message: "Transaksi dihapus." };
};
