import { Prisma } from "../../generated/prisma/client";
import { prisma } from "../config/database";
import type {
  CreateTransferInput,
  UpdateTransferInput,
} from "../schemas/transfer.schema";
import { AppError } from "../utils/app.error";
import {
  TRANSFER_FEE_CATEGORY_ID,
  transferBalanceChanges,
} from "../utils/account";
import { formatMoney, toDecimal } from "../utils/money";
import {
  assertSufficientBalance,
  getAccountBalances,
  getUsableAccount,
} from "./account.service";

const accountSummary = {
  select: { id: true, name: true, icon: true, type: true },
} as const;

export const transferSelect = {
  id: true,
  amount: true,
  note: true,
  occurredAt: true,
  createdAt: true,
  fromAccount: accountSummary,
  toAccount: accountSummary,
  feeTransaction: { select: { id: true, amount: true } },
} as const;

type AccountSummary = {
  id: string;
  name: string;
  icon: string | null;
  type: string;
};

type RawTransfer = {
  id: string;
  amount: Prisma.Decimal;
  note: string | null;
  occurredAt: Date;
  createdAt: Date;
  fromAccount: AccountSummary;
  toAccount: AccountSummary;
  feeTransaction: { id: string; amount: Prisma.Decimal } | null;
};

/** Biaya admin ditampilkan sebagai bagian dari transfer, bukan item terpisah. */
export const toTransferResponse = (transfer: RawTransfer) => ({
  id: transfer.id,
  amount: formatMoney(transfer.amount),
  fee: formatMoney(transfer.feeTransaction?.amount ?? 0),
  note: transfer.note,
  occurredAt: transfer.occurredAt,
  createdAt: transfer.createdAt,
  fromAccount: transfer.fromAccount,
  toAccount: transfer.toAccount,
});

/** Respons tulis menyertakan saldo terbaru kedua akun. */
const withBalances = async (userId: string, transfer: RawTransfer) => {
  const response = toTransferResponse(transfer);
  const balances = await getAccountBalances(userId, [
    transfer.fromAccount.id,
    transfer.toAccount.id,
  ]);

  return {
    ...response,
    fromAccount: { ...response.fromAccount, balance: balances.get(transfer.fromAccount.id) },
    toAccount: { ...response.toAccount, balance: balances.get(transfer.toAccount.id) },
  };
};

const FEE_NOTE = "Biaya admin transfer";

const assertFeeCategoryExists = async () => {
  const category = await prisma.category.findFirst({
    where: { id: TRANSFER_FEE_CATEGORY_ID, isSystem: true },
    select: { id: true },
  });

  if (!category) {
    throw new AppError(
      500,
      "Kategori Biaya Admin tidak tersedia. Jalankan seed database.",
    );
  }
};

/** Data transaksi biaya admin: pengeluaran dari akun asal, di waktu yang sama. */
const feeTransactionData = (
  userId: string,
  fromAccountId: string,
  fee: Prisma.Decimal,
  occurredAt: Date,
) => ({
  userId,
  accountId: fromAccountId,
  categoryId: TRANSFER_FEE_CATEGORY_ID,
  type: "EXPENSE" as const,
  amount: fee,
  note: FEE_NOTE,
  occurredAt,
});

export const createTransfer = async (
  userId: string,
  input: CreateTransferInput,
) => {
  await Promise.all([
    getUsableAccount(userId, input.fromAccountId),
    getUsableAccount(userId, input.toAccountId),
  ]);

  const fee = toDecimal(input.fee ?? 0);
  if (fee.greaterThan(0)) await assertFeeCategoryExists();

  const transfer = await prisma.$transaction(async (tx) => {
    await assertSufficientBalance(
      tx,
      userId,
      transferBalanceChanges(null, {
        fromAccountId: input.fromAccountId,
        toAccountId: input.toAccountId,
        amount: input.amount,
        fee,
      }),
    );

    // Nested create: transfer dan biaya adminnya tersimpan bersama.
    return tx.transfer.create({
      data: {
        userId,
        fromAccountId: input.fromAccountId,
        toAccountId: input.toAccountId,
        amount: toDecimal(input.amount),
        note: input.note,
        occurredAt: input.occurredAt,
        ...(fee.greaterThan(0) && {
          feeTransaction: {
            create: feeTransactionData(
              userId,
              input.fromAccountId,
              fee,
              input.occurredAt,
            ),
          },
        }),
      },
      select: transferSelect,
    });
  });

  return withBalances(userId, transfer);
};

const getOwnedTransfer = async (
  userId: string,
  id: string,
  db: Prisma.TransactionClient = prisma,
) => {
  const transfer = await db.transfer.findFirst({
    where: { id, userId },
    select: {
      id: true,
      fromAccountId: true,
      toAccountId: true,
      amount: true,
      occurredAt: true,
      feeTransaction: { select: { id: true, amount: true } },
    },
  });

  if (!transfer) {
    throw new AppError(404, "Transfer tidak ditemukan");
  }

  return transfer;
};

/**
 * Kunci baris transfer lalu baca nilai terbarunya, supaya edit atau hapus
 * bersamaan pada transfer yang sama menunggu bergiliran.
 */
const lockOwnedTransfer = async (
  tx: Prisma.TransactionClient,
  userId: string,
  id: string,
) => {
  await tx.$queryRaw`
    SELECT id FROM "Transfer" WHERE id = ${id} AND "userId" = ${userId} FOR UPDATE
  `;
  return getOwnedTransfer(userId, id, tx);
};

const toTransferEffect = (
  transfer: Awaited<ReturnType<typeof getOwnedTransfer>>,
) => ({
  fromAccountId: transfer.fromAccountId,
  toAccountId: transfer.toAccountId,
  amount: transfer.amount,
  fee: transfer.feeTransaction?.amount ?? 0,
});

export const updateTransfer = async (
  userId: string,
  id: string,
  input: UpdateTransferInput,
) => {
  // Pembacaan, pengecekan saldo, dan penulisan dalam satu transaksi database,
  // supaya saldo dihitung dari nilai transfer yang terbaru.
  const transfer = await prisma.$transaction(async (tx) => {
    const existing = await lockOwnedTransfer(tx, userId, id);

    const fromAccountId = input.fromAccountId ?? existing.fromAccountId;
    const toAccountId = input.toAccountId ?? existing.toAccountId;
    const occurredAt = input.occurredAt ?? existing.occurredAt;

    // Schema hanya bisa membandingkan field yang dikirim; di sini dibandingkan
    // dengan nilai yang akan tersimpan.
    if (fromAccountId === toAccountId) {
      throw new AppError(400, "Akun asal dan tujuan harus berbeda");
    }

    // Sama seperti transaksi: hanya akun yang baru dipilih yang harus aktif.
    await Promise.all([
      input.fromAccountId && getUsableAccount(userId, input.fromAccountId),
      input.toAccountId && getUsableAccount(userId, input.toAccountId),
    ]);

    const fee =
      input.fee !== undefined
        ? toDecimal(input.fee)
        : new Prisma.Decimal(existing.feeTransaction?.amount ?? 0);
    const feeTransactionId = existing.feeTransaction?.id;

    if (fee.greaterThan(0) && !feeTransactionId) await assertFeeCategoryExists();

    await assertSufficientBalance(
      tx,
      userId,
      transferBalanceChanges(toTransferEffect(existing), {
        fromAccountId,
        toAccountId,
        amount: input.amount ?? existing.amount,
        fee,
      }),
    );

    await tx.transfer.update({
      where: { id },
      data: {
        ...(input.fromAccountId !== undefined && { fromAccountId }),
        ...(input.toAccountId !== undefined && { toAccountId }),
        ...(input.amount !== undefined && { amount: toDecimal(input.amount) }),
        ...(input.note !== undefined && { note: input.note }),
        ...(input.occurredAt !== undefined && { occurredAt }),
      },
    });

    // Biaya admin selalu mengikuti akun asal dan tanggal transfernya.
    if (fee.greaterThan(0) && feeTransactionId) {
      await tx.transaction.update({
        where: { id: feeTransactionId },
        data: { amount: fee, accountId: fromAccountId, occurredAt },
      });
    } else if (fee.greaterThan(0)) {
      await tx.transaction.create({
        data: {
          ...feeTransactionData(userId, fromAccountId, fee, occurredAt),
          transferId: id,
        },
      });
    } else if (feeTransactionId) {
      await tx.transaction.delete({ where: { id: feeTransactionId } });
    }

    return tx.transfer.findUniqueOrThrow({
      where: { id },
      select: transferSelect,
    });
  });

  return withBalances(userId, transfer);
};

export const deleteTransfer = async (userId: string, id: string) => {
  await prisma.$transaction(async (tx) => {
    const existing = await lockOwnedTransfer(tx, userId, id);

    // Akun tujuan kehilangan amount. Kalau uangnya sudah terpakai, menghapus
    // transfer ini membuat saldonya negatif.
    await assertSufficientBalance(
      tx,
      userId,
      transferBalanceChanges(toTransferEffect(existing), null),
    );

    // Transaksi biaya admin ikut terhapus lewat onDelete: Cascade.
    await tx.transfer.delete({ where: { id } });
  });

  return { message: "Transfer dihapus." };
};
