-- CreateEnum
CREATE TYPE "IncomePeriod" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY');

-- CreateTable
CREATE TABLE "SavingRatio" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "needsPct" INTEGER NOT NULL,
    "savingsPct" INTEGER NOT NULL,
    "funPct" INTEGER NOT NULL,
    "incomeAmount" DECIMAL(14,2),
    "period" "IncomePeriod",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SavingRatio_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SavingRatio_userId_key" ON "SavingRatio"("userId");

-- AddForeignKey
ALTER TABLE "SavingRatio" ADD CONSTRAINT "SavingRatio_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
