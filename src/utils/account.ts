import { Prisma } from "../../generated/prisma/client";
import type { AccountType } from "../../generated/prisma/enums";
import type { Money } from "./money";

/**
 * Akun bawaan setiap user, dibuat saat register. Ikonnya sesuai nama ikon di
 * frontend. Nilainya HARUS sama dengan yang di-backfill migrasi add_account
 * untuk user lama.
 */
export const DEFAULT_ACCOUNTS: {
  name: string;
  type: AccountType;
  icon: string;
  isDefault: boolean;
}[] = [
  { name: "Tunai", type: "CASH", icon: "wallet", isDefault: true },
  { name: "Kartu Bank", type: "BANK", icon: "card", isDefault: false },
  { name: "Tabungan", type: "SAVINGS", icon: "piggy", isDefault: false },
];

/** Batas wajar supaya daftar akun tetap muat di layar ponsel. */
export const MAX_ACCOUNTS_PER_USER = 20;

/** Kategori sistem "Biaya Admin" (prisma/seed.ts) untuk biaya transfer. */
export const TRANSFER_FEE_CATEGORY_ID = "00000000-0000-4000-8000-000000000008";

type Amount = Money | string | number;

export type BalanceParts = {
  openingBalance: Amount;
  income: Amount;
  /** Termasuk biaya admin transfer, yang dicatat sebagai pengeluaran. */
  expense: Amount;
  transferIn?: Amount;
  transferOut?: Amount;
};

/**
 * Saldo = saldo awal + pemasukan - pengeluaran + transfer masuk - transfer
 * keluar. Pengeluaran boleh membuat saldo negatif: pencatatan mengikuti
 * kenyataan, dan user sering belum mengisi saldo awal. Transfer tidak boleh
 * (lihat findInsufficientAccount).
 */
export const computeBalance = (parts: BalanceParts): string =>
  new Prisma.Decimal(parts.openingBalance)
    .plus(new Prisma.Decimal(parts.income))
    .minus(new Prisma.Decimal(parts.expense))
    .plus(new Prisma.Decimal(parts.transferIn ?? 0))
    .minus(new Prisma.Decimal(parts.transferOut ?? 0))
    .toFixed(2);

export type TransferEffect = {
  fromAccountId: string;
  toAccountId: string;
  amount: Amount;
  /** Biaya admin, ikut mengurangi saldo akun asal. */
  fee?: Amount;
};

/**
 * Perubahan saldo setiap akun bila transfer `before` diganti `after` (saat
 * membuat transfer, `before` null). Akun asal berkurang amount + fee, akun
 * tujuan bertambah amount.
 */
export const transferBalanceChanges = (
  before: TransferEffect | null,
  after: TransferEffect,
) => {
  const changes = new Map<string, Prisma.Decimal>();

  const apply = (transfer: TransferEffect, sign: 1 | -1) => {
    const amount = new Prisma.Decimal(transfer.amount).times(sign);
    const fee = new Prisma.Decimal(transfer.fee ?? 0).times(sign);
    const add = (accountId: string, value: Prisma.Decimal) =>
      changes.set(
        accountId,
        (changes.get(accountId) ?? new Prisma.Decimal(0)).plus(value),
      );

    add(transfer.fromAccountId, amount.plus(fee).negated());
    add(transfer.toAccountId, amount);
  };

  if (before) apply(before, -1);
  apply(after, 1);

  return changes;
};

export type BalanceShortfall = {
  accountId: string;
  available: string;
  /** Kekurangan agar saldo akhirnya tepat 0. */
  missing: string;
};

/**
 * Akun pertama yang saldonya berkurang sampai di bawah nol. Akun yang
 * saldonya tidak berkurang dilewati, walau sudah negatif karena pengeluaran,
 * supaya mengubah catatan transfer lama tetap bisa.
 */
export const findInsufficientAccount = (
  balances: Map<string, Amount>,
  changes: Map<string, Prisma.Decimal>,
): BalanceShortfall | undefined => {
  for (const [accountId, change] of changes) {
    // lessThan, bukan isNegative: hasil 0 bisa bertanda -0.
    if (!change.lessThan(0)) continue;

    const available = new Prisma.Decimal(balances.get(accountId) ?? 0);
    const after = available.plus(change);
    if (after.lessThan(0)) {
      return {
        accountId,
        available: available.toFixed(2),
        missing: after.negated().toFixed(2),
      };
    }
  }

  return undefined;
};
