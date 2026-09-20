-- CreateEnum
CREATE TYPE "GoalStatus" AS ENUM ('ACTIVE', 'ACHIEVED', 'ABANDONED');

-- CreateEnum
CREATE TYPE "AgeGroup" AS ENUM ('TEEN', 'YOUNG_ADULT', 'GENERAL');

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "goalId" TEXT;

-- CreateTable
CREATE TABLE "SavingGoal" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "targetAmount" DECIMAL(14,2) NOT NULL,
    "targetDate" TIMESTAMP(3) NOT NULL,
    "currentAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "status" "GoalStatus" NOT NULL DEFAULT 'ACTIVE',
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SavingGoal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IncomeIdea" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "ageGroup" "AgeGroup" NOT NULL,
    "estMonthlyMin" DECIMAL(14,2) NOT NULL,
    "estMonthlyMax" DECIMAL(14,2) NOT NULL,
    "effortLevel" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IncomeIdea_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SavingGoal_userId_status_idx" ON "SavingGoal"("userId", "status");

-- CreateIndex
CREATE INDEX "IncomeIdea_ageGroup_isActive_idx" ON "IncomeIdea"("ageGroup", "isActive");

-- CreateIndex
CREATE INDEX "Transaction_goalId_idx" ON "Transaction"("goalId");

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "SavingGoal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavingGoal" ADD CONSTRAINT "SavingGoal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
