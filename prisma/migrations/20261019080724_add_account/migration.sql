-- Akun (dompet, rekening, celengan) untuk setiap transaksi.
--
-- Transaksi lama belum punya akun, jadi kolom accountId tidak bisa langsung
-- NOT NULL. Urutannya: buat tabel, beri setiap user akun bawaan, pindahkan
-- transaksi lama ke akun "Tunai", baru setelah itu kolomnya dikunci NOT NULL.
-- Semua langkah berjalan dalam satu transaksi migrasi.

-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('CASH', 'BANK', 'EWALLET', 'SAVINGS', 'OTHER');

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "AccountType" NOT NULL,
    "icon" TEXT,
    "openingBalance" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Account_userId_isArchived_idx" ON "Account"("userId", "isArchived");

-- CreateIndex
CREATE UNIQUE INDEX "Account_userId_name_key" ON "Account"("userId", "name");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: akun bawaan untuk setiap user yang sudah ada. Nilainya HARUS sama
-- dengan DEFAULT_ACCOUNTS di src/utils/account.ts, yang dipakai saat register.
-- gen_random_uuid() bawaan PostgreSQL sejak versi 13.
INSERT INTO "Account" ("id", "userId", "name", "type", "icon", "isDefault", "updatedAt")
SELECT gen_random_uuid()::text, u."id", d."name", d."type"::"AccountType", d."icon", d."isDefault", CURRENT_TIMESTAMP
FROM "User" u
CROSS JOIN (
    VALUES
        ('Tunai', 'CASH', 'wallet', true),
        ('Kartu Bank', 'BANK', 'card', false),
        ('Tabungan', 'SAVINGS', 'piggy', false)
) AS d("name", "type", "icon", "isDefault");

-- AlterTable: nullable dulu supaya baris lama bisa diisi.
ALTER TABLE "Transaction" ADD COLUMN "accountId" TEXT;

-- Backfill: transaksi lama masuk ke akun default (Tunai) milik usernya.
UPDATE "Transaction" t
SET "accountId" = a."id"
FROM "Account" a
WHERE a."userId" = t."userId" AND a."isDefault" = true;

ALTER TABLE "Transaction" ALTER COLUMN "accountId" SET NOT NULL;

-- CreateIndex
CREATE INDEX "Transaction_accountId_idx" ON "Transaction"("accountId");

-- AddForeignKey: NO ACTION (bukan RESTRICT), lihat komentar di schema.prisma.
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
