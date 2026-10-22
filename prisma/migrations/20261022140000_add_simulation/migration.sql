-- CreateEnum
CREATE TYPE "SimInstrumentType" AS ENUM ('STOCK', 'MUTUAL_FUND');

-- CreateEnum
CREATE TYPE "SimLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "SimStatus" AS ENUM ('RUNNING', 'FINISHED');

-- CreateTable
CREATE TABLE "SimInstrument" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" "SimInstrumentType" NOT NULL,
    "name" TEXT NOT NULL,
    "fundType" TEXT,
    "description" TEXT NOT NULL,
    "note" TEXT,
    "riskLevel" "SimLevel" NOT NULL,
    "returnPotential" "SimLevel" NOT NULL,
    "horizonText" TEXT,
    "minInvestment" DECIMAL(14,2) NOT NULL,
    "basePrice" DECIMAL(14,2) NOT NULL,
    "annualDrift" DOUBLE PRECISION NOT NULL,
    "annualVolatility" DOUBLE PRECISION NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SimInstrument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SimulationSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "instrumentId" TEXT NOT NULL,
    "seed" TEXT NOT NULL,
    "annualDrift" DOUBLE PRECISION NOT NULL,
    "annualVolatility" DOUBLE PRECISION NOT NULL,
    "startingCash" DECIMAL(14,2) NOT NULL,
    "investedAmount" DECIMAL(14,2) NOT NULL,
    "cashLeft" DECIMAL(14,2) NOT NULL,
    "units" DECIMAL(18,6) NOT NULL,
    "buyPrice" DECIMAL(14,2) NOT NULL,
    "currentStep" INTEGER NOT NULL DEFAULT 0,
    "status" "SimStatus" NOT NULL DEFAULT 'RUNNING',
    "finalValue" DECIMAL(14,2),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SimulationSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SimEvent" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "step" INTEGER NOT NULL,
    "day" INTEGER NOT NULL,
    "headline" TEXT NOT NULL,
    "explanation" TEXT NOT NULL,
    "impactPct" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SimEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SimInstrument_code_key" ON "SimInstrument"("code");

-- CreateIndex
CREATE INDEX "SimInstrument_type_isActive_idx" ON "SimInstrument"("type", "isActive");

-- CreateIndex
CREATE INDEX "SimulationSession_userId_status_idx" ON "SimulationSession"("userId", "status");

-- CreateIndex
CREATE INDEX "SimulationSession_userId_createdAt_idx" ON "SimulationSession"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "SimulationSession_instrumentId_idx" ON "SimulationSession"("instrumentId");

-- CreateIndex
CREATE INDEX "SimEvent_sessionId_day_idx" ON "SimEvent"("sessionId", "day");

-- AddForeignKey
ALTER TABLE "SimulationSession" ADD CONSTRAINT "SimulationSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SimulationSession" ADD CONSTRAINT "SimulationSession_instrumentId_fkey" FOREIGN KEY ("instrumentId") REFERENCES "SimInstrument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SimEvent" ADD CONSTRAINT "SimEvent_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "SimulationSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

