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
 * keluar. Boleh negatif: pencatatan mengikuti kenyataan, dan user sering
 * belum mengisi saldo awal.
 */
export const computeBalance = (parts: BalanceParts): string =>
  new Prisma.Decimal(parts.openingBalance)
    .plus(new Prisma.Decimal(parts.income))
    .minus(new Prisma.Decimal(parts.expense))
    .plus(new Prisma.Decimal(parts.transferIn ?? 0))
    .minus(new Prisma.Decimal(parts.transferOut ?? 0))
    .toFixed(2);
