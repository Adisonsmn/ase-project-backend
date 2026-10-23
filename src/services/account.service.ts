import { Prisma } from "../../generated/prisma/client";
import type { AccountType } from "../../generated/prisma/enums";
import { prisma } from "../config/database";
import type {
  CreateAccountInput,
  UpdateAccountInput,
} from "../schemas/account.schema";
import { AppError } from "../utils/app.error";
import {
  MAX_ACCOUNTS_PER_USER,
  computeBalance,
  findInsufficientAccount,
  type BalanceChanges,
} from "../utils/account";
import { formatMoney, formatRupiah, toDecimal } from "../utils/money";

const accountSelect = {
  id: true,
  name: true,
  type: true,
  icon: true,
  openingBalance: true,
  isDefault: true,
  isArchived: true,
  createdAt: true,
  updatedAt: true,
} as const;

type AccountRow = {
  id: string;
  name: string;
  type: AccountType;
  icon: string | null;
  openingBalance: Prisma.Decimal;
  isDefault: boolean;
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
};

const isPrismaError = (error: unknown, code: string) =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === code;

/**
 * Saldo setiap akun, dihitung dari transaksi dan transfernya lewat query
 * agregat. Saldo tidak disimpan sebagai kolom supaya tidak bisa melenceng
 * dari catatan.
 */
const computeBalances = async (
  userId: string,
  accounts: Pick<AccountRow, "id" | "openingBalance">[],
  db: Prisma.TransactionClient = prisma,
) => {
  if (accounts.length === 0) return new Map<string, string>();

  const ids = accounts.map((a) => a.id);

  const [totals, outgoing, incoming] = await Promise.all([
    db.transaction.groupBy({
      by: ["accountId", "type"],
      where: { userId, accountId: { in: ids } },
      _sum: { amount: true },
    }),
    db.transfer.groupBy({
      by: ["fromAccountId"],
      where: { userId, fromAccountId: { in: ids } },
      _sum: { amount: true },
    }),
    db.transfer.groupBy({
      by: ["toAccountId"],
      where: { userId, toAccountId: { in: ids } },
      _sum: { amount: true },
    }),
  ]);

  const sumOf = (accountId: string, type: "INCOME" | "EXPENSE") =>
    totals.find((row) => row.accountId === accountId && row.type === type)
      ?._sum.amount ?? 0;

  return new Map(
    accounts.map((account) => [
      account.id,
      computeBalance({
        openingBalance: account.openingBalance,
        income: sumOf(account.id, "INCOME"),
        expense: sumOf(account.id, "EXPENSE"),
        transferOut:
          outgoing.find((row) => row.fromAccountId === account.id)?._sum
            .amount ?? 0,
        transferIn:
          incoming.find((row) => row.toAccountId === account.id)?._sum
            .amount ?? 0,
      }),
    ]),
  );
};

const withBalances = async (userId: string, accounts: AccountRow[]) => {
  const balances = await computeBalances(userId, accounts);

  return accounts.map((account) => ({
    ...account,
    openingBalance: formatMoney(account.openingBalance),
    balance: balances.get(account.id) ?? formatMoney(account.openingBalance),
  }));
};

const withBalance = async (userId: string, account: AccountRow) => {
  const [result] = await withBalances(userId, [account]);
  return result!;
};

/** Saldo terbaru beberapa akun, untuk disertakan di respons transaksi dan transfer. */
export const getAccountBalances = async (
  userId: string,
  accountIds: string[],
  db: Prisma.TransactionClient = prisma,
) => {
  const accounts = await db.account.findMany({
    where: { id: { in: accountIds }, userId },
    select: { id: true, openingBalance: true },
  });

  return computeBalances(userId, accounts, db);
};

/**
 * Kunci baris akun sampai transaksi database selesai, supaya dua request
 * bersamaan tidak memakai saldo yang sama. Diurutkan per id agar tidak
 * deadlock. NO KEY UPDATE, bukan UPDATE: insert transfer/transaksi yang
 * merujuk akun ini (cek foreign key) tetap jalan, jadi transfer A->B dan B->A
 * bersamaan tidak saling mengunci.
 */
export const lockAccounts = async (
  tx: Prisma.TransactionClient,
  userId: string,
  accountIds: string[],
) => {
  if (accountIds.length === 0) return;

  await tx.$queryRaw`
    SELECT id FROM "Account"
    WHERE "userId" = ${userId} AND id IN (${Prisma.join(accountIds)})
    ORDER BY id
    FOR NO KEY UPDATE
  `;
};

/**
 * Tolak penulisan yang membuat saldo akun mana pun di bawah nol. Dipanggil di
 * dalam transaksi database yang sama dengan penulisannya: akun yang saldonya
 * berkurang dikunci dulu, jadi request bersamaan menunggu lalu membaca saldo
 * terbaru.
 */
export const assertSufficientBalance = async (
  tx: Prisma.TransactionClient,
  userId: string,
  changes: BalanceChanges,
) => {
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
    `Saldo akun "${account.name}" tidak cukup (tersedia ${formatRupiah(shortfall.available)}, kurang ${formatRupiah(shortfall.missing)}). Catat pemasukan ke akun ini dulu, atau pilih akun lain.`,
  );
};

export const getAccountBalance = async (userId: string, accountId: string) => {
  const balance = (await getAccountBalances(userId, [accountId])).get(accountId);

  if (balance === undefined) {
    throw new AppError(404, "Akun tidak ditemukan");
  }

  return balance;
};

const getOwnedAccount = async (userId: string, accountId: string) => {
  const account = await prisma.account.findFirst({
    where: { id: accountId, userId },
    select: accountSelect,
  });

  // 404, bukan 403, supaya keberadaan akun milik user lain tidak bocor.
  if (!account) {
    throw new AppError(404, "Akun tidak ditemukan");
  }

  return account;
};

/** Akun milik user yang masih aktif, untuk dipakai mencatat transaksi baru. */
export const getUsableAccount = async (userId: string, accountId: string) => {
  const account = await getOwnedAccount(userId, accountId);

  if (account.isArchived) {
    throw new AppError(
      400,
      `Akun "${account.name}" sudah diarsipkan. Aktifkan lagi atau pilih akun lain.`,
    );
  }

  return account;
};

/** Akun yang diminta, atau akun default user kalau tidak disebutkan. */
export const resolveAccountId = async (
  userId: string,
  accountId: string | undefined,
) => {
  if (accountId) {
    return (await getUsableAccount(userId, accountId)).id;
  }

  const fallback = await prisma.account.findFirst({
    where: { userId, isDefault: true },
    select: { id: true },
  });

  // Setiap user mendapat akun default saat register (atau lewat migrasi).
  if (!fallback) {
    throw new AppError(500, "Akun default tidak tersedia.");
  }

  return fallback.id;
};

export const listAccounts = async (
  userId: string,
  includeArchived: boolean,
) => {
  const accounts = await prisma.account.findMany({
    where: { userId, ...(!includeArchived && { isArchived: false }) },
    select: accountSelect,
    orderBy: [{ isDefault: "desc" }, { isArchived: "asc" }, { createdAt: "asc" }],
  });

  return withBalances(userId, accounts);
};

const assertNameAvailable = async (
  userId: string,
  name: string,
  exceptId?: string,
) => {
  const duplicate = await prisma.account.findFirst({
    where: {
      userId,
      name: { equals: name, mode: "insensitive" },
      ...(exceptId && { id: { not: exceptId } }),
    },
    select: { id: true },
  });

  if (duplicate) {
    throw new AppError(409, "Anda sudah punya akun dengan nama itu.");
  }
};

export const createAccount = async (
  userId: string,
  input: CreateAccountInput,
) => {
  const count = await prisma.account.count({ where: { userId } });
  if (count >= MAX_ACCOUNTS_PER_USER) {
    throw new AppError(
      400,
      `Maksimal ${MAX_ACCOUNTS_PER_USER} akun. Hapus atau arsipkan akun yang tidak dipakai.`,
    );
  }

  await assertNameAvailable(userId, input.name);

  try {
    const account = await prisma.account.create({
      data: {
        userId,
        name: input.name,
        type: input.type,
        icon: input.icon,
        openingBalance: input.openingBalance ?? "0",
      },
      select: accountSelect,
    });

    return withBalance(userId, account);
  } catch (error) {
    // Dua request bersamaan dengan nama sama: yang kalah kena constraint unik.
    if (isPrismaError(error, "P2002")) {
      throw new AppError(409, "Anda sudah punya akun dengan nama itu.");
    }
    throw error;
  }
};

export const updateAccount = async (
  userId: string,
  accountId: string,
  input: UpdateAccountInput,
) => {
  const account = await getOwnedAccount(userId, accountId);

  if (input.name && input.name.toLowerCase() !== account.name.toLowerCase()) {
    await assertNameAvailable(userId, input.name, accountId);
  }

  if (input.isArchived && account.isDefault) {
    throw new AppError(
      400,
      "Akun default tidak bisa diarsipkan. Jadikan akun lain default dulu.",
    );
  }

  // Akun arsip yang dijadikan default harus diaktifkan di request yang sama.
  if (input.isDefault && account.isArchived && input.isArchived !== false) {
    throw new AppError(400, "Akun yang diarsipkan tidak bisa dijadikan default.");
  }

  try {
    const updated = await prisma.$transaction(async (tx) => {
      // Menurunkan saldo awal sama dengan mengurangi saldo. Saldo awal dibaca
      // ulang setelah akun dikunci, supaya selisihnya dari nilai terbaru.
      if (input.openingBalance !== undefined) {
        await lockAccounts(tx, userId, [accountId]);
        const current = await tx.account.findUniqueOrThrow({
          where: { id: accountId },
          select: { openingBalance: true },
        });

        await assertSufficientBalance(
          tx,
          userId,
          new Map([
            [
              accountId,
              toDecimal(input.openingBalance).minus(current.openingBalance),
            ],
          ]),
        );
      }

      // Default dipindah dalam satu transaksi, supaya tidak pernah ada
      // momen dengan nol atau dua akun default.
      if (input.isDefault) {
        await tx.account.updateMany({
          where: { userId, isDefault: true, id: { not: accountId } },
          data: { isDefault: false },
        });
      }

      return tx.account.update({
        where: { id: accountId },
        data: {
          ...(input.name !== undefined && { name: input.name }),
          ...(input.type !== undefined && { type: input.type }),
          ...(input.icon !== undefined && { icon: input.icon }),
          ...(input.openingBalance !== undefined && {
            openingBalance: input.openingBalance,
          }),
          ...(input.isDefault !== undefined && { isDefault: input.isDefault }),
          ...(input.isArchived !== undefined && {
            isArchived: input.isArchived,
          }),
        },
        select: accountSelect,
      });
    });

    return withBalance(userId, updated);
  } catch (error) {
    if (isPrismaError(error, "P2002")) {
      throw new AppError(409, "Anda sudah punya akun dengan nama itu.");
    }
    throw error;
  }
};

/**
 * Hanya akun tanpa riwayat yang bisa dihapus. Akun yang pernah dipakai
 * diarsipkan saja, supaya transaksi lamanya tetap punya akun.
 */
export const deleteAccount = async (userId: string, accountId: string) => {
  const account = await getOwnedAccount(userId, accountId);

  if (account.isDefault) {
    throw new AppError(
      400,
      "Akun default tidak bisa dihapus. Jadikan akun lain default dulu.",
    );
  }

  const historyMessage =
    "Akun ini masih punya riwayat transaksi atau transfer. Arsipkan saja supaya riwayatnya tetap ada.";

  const [transactions, transfers] = await Promise.all([
    prisma.transaction.count({ where: { accountId } }),
    prisma.transfer.count({
      where: { OR: [{ fromAccountId: accountId }, { toAccountId: accountId }] },
    }),
  ]);
  if (transactions + transfers > 0) {
    throw new AppError(409, historyMessage);
  }

  try {
    await prisma.account.delete({ where: { id: accountId } });
  } catch (error) {
    // Transaksi baru masuk di antara pengecekan dan penghapusan.
    if (isPrismaError(error, "P2003")) {
      throw new AppError(409, historyMessage);
    }
    throw error;
  }

  return { message: "Akun dihapus." };
};
