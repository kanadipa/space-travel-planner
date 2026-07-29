-- CreateTable
CREATE TABLE "Mission" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "spacecraftId" TEXT NOT NULL,
    "passengerCount" INTEGER NOT NULL,
    "destinationIds" TEXT[],
    "departureDate" TIMESTAMP(3) NOT NULL,
    "arrivalDate" TIMESTAMP(3) NOT NULL,
    "totalDistanceKm" DOUBLE PRECISION NOT NULL,
    "rangeConsumedKm" DOUBLE PRECISION NOT NULL,
    "durationYears" DOUBLE PRECISION NOT NULL,
    "legs" JSONB NOT NULL,
    "spacecraftSnapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Mission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Mission_reference_key" ON "Mission"("reference");

-- CreateIndex
CREATE INDEX "Mission_departureDate_idx" ON "Mission"("departureDate");

-- CreateIndex
CREATE INDEX "Mission_spacecraftId_idx" ON "Mission"("spacecraftId");
