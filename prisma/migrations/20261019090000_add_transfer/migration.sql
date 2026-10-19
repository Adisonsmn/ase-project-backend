-- Transfer antar akun milik user yang sama. Biaya admin bukan kolom di sini,
-- melainkan Transaction EXPENSE yang menunjuk ke transfernya (transferId).

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "transferId" TEXT;

-- CreateTable
CREATE TABLE "Transfer" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fromAccountId" TEXT NOT NULL,
    "toAccountId" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "note" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Transfer_pkey" PRIMARY KEY ("id"),
    -- Pengaman lapisan database; validasi utamanya ada di schema Zod.
    CONSTRAINT "Transfer_distinct_accounts_check" CHECK ("fromAccountId" <> "toAccountId"),
    CONSTRAINT "Transfer_amount_positive_check" CHECK ("amount" > 0)
);

-- CreateIndex
CREATE INDEX "Transfer_userId_occurredAt_idx" ON "Transfer"("userId", "occurredAt");

-- CreateIndex
CREATE INDEX "Transfer_fromAccountId_idx" ON "Transfer"("fromAccountId");

-- CreateIndex
CREATE INDEX "Transfer_toAccountId_idx" ON "Transfer"("toAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_transferId_key" ON "Transaction"("transferId");

-- AddForeignKey
ALTER TABLE "Transfer" ADD CONSTRAINT "Transfer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: NO ACTION (bukan RESTRICT), lihat komentar di schema.prisma.
ALTER TABLE "Transfer" ADD CONSTRAINT "Transfer_fromAccountId_fkey" FOREIGN KEY ("fromAccountId") REFERENCES "Account"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transfer" ADD CONSTRAINT "Transfer_toAccountId_fkey" FOREIGN KEY ("toAccountId") REFERENCES "Account"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_transferId_fkey" FOREIGN KEY ("transferId") REFERENCES "Transfer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
