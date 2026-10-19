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

type Amount = Money | string | number;

export type BalanceParts = {
  openingBalance: Amount;
  income: Amount;
  expense: Amount;
};

/**
 * Saldo = saldo awal + pemasukan - pengeluaran. Boleh negatif: pencatatan
 * mengikuti kenyataan, dan user sering belum mengisi saldo awal.
 */
export const computeBalance = (parts: BalanceParts): string =>
  new Prisma.Decimal(parts.openingBalance)
    .plus(new Prisma.Decimal(parts.income))
    .minus(new Prisma.Decimal(parts.expense))
    .toFixed(2);
