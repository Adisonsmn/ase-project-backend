import { Prisma } from "../../generated/prisma/client";
import { prisma } from "../config/database";
import type {
  CreateTransferInput,
  UpdateTransferInput,
} from "../schemas/transfer.schema";
import { AppError } from "../utils/app.error";
import {
  TRANSFER_FEE_CATEGORY_ID,
  findInsufficientAccount,
  transferBalanceChanges,
  type TransferEffect,
} from "../utils/account";
import { formatMoney, toDecimal } from "../utils/money";
import {
  getAccountBalances,
  getUsableAccount,
  lockAccounts,
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

/**
 * Tolak transfer yang membuat saldo akun mana pun di bawah nol. Dipanggil di
 * dalam transaksi database yang sama dengan penulisannya: akun yang saldonya
 * berkurang dikunci dulu, jadi request bersamaan menunggu lalu membaca saldo
 * terbaru.
 */
const assertSufficientBalance = async (
  tx: Prisma.TransactionClient,
  userId: string,
  before: TransferEffect | null,
  after: TransferEffect,
) => {
  const changes = transferBalanceChanges(before, after);
  const decreased = [...changes]
    .filter(([, change]) => change.lessThan(0))
    .map(([accountId]) => accountId);

  if (decreased.length === 0) return;

  await lockAccounts(tx, userId, decreased);
  const balances = await getAccountBalances(userId, decreased, tx);

  const shortfall = findInsufficientAccount(balances, changes);
  if (!shortfall) return;

  const account = await tx.account.findUniqueOrThrow({
    where: { id: shortfall.accountId },
    select: { name: true },
  });

  throw new AppError(
    400,
    `Saldo akun "${account.name}" tidak cukup: tersedia ${shortfall.available}, kurang ${shortfall.missing}.`,
  );
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
    await assertSufficientBalance(tx, userId, null, {
      fromAccountId: input.fromAccountId,
      toAccountId: input.toAccountId,
      amount: input.amount,
      fee,
    });

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

export const updateTransfer = async (
  userId: string,
  id: string,
  input: UpdateTransferInput,
) => {
  // Pembacaan, pengecekan saldo, dan penulisan dalam satu transaksi database,
  // supaya saldo dihitung dari nilai transfer yang terbaru.
  const transfer = await prisma.$transaction(async (tx) => {
    // Edit bersamaan pada transfer yang sama menunggu di sini.
    await tx.$queryRaw`
      SELECT id FROM "Transfer" WHERE id = ${id} AND "userId" = ${userId} FOR UPDATE
    `;
    const existing = await getOwnedTransfer(userId, id, tx);

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
      {
        fromAccountId: existing.fromAccountId,
        toAccountId: existing.toAccountId,
        amount: existing.amount,
        fee: existing.feeTransaction?.amount ?? 0,
      },
      {
        fromAccountId,
        toAccountId,
        amount: input.amount ?? existing.amount,
        fee,
      },
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
  await getOwnedTransfer(userId, id);

  // Transaksi biaya admin ikut terhapus lewat onDelete: Cascade.
  await prisma.transfer.delete({ where: { id } });

  return { message: "Transfer dihapus." };
};
