-- CreateEnum
CREATE TYPE "CandleInterval" AS ENUM ('DAY');

-- CreateTable
CREATE TABLE "Candle" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "interval" "CandleInterval" NOT NULL,
    "bucketStart" TIMESTAMP(3) NOT NULL,
    "open" DECIMAL(18,8) NOT NULL,
    "high" DECIMAL(18,8) NOT NULL,
    "low" DECIMAL(18,8) NOT NULL,
    "close" DECIMAL(18,8) NOT NULL,
    "volume" DECIMAL(24,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Candle_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Candle_assetId_interval_bucketStart_idx" ON "Candle"("assetId", "interval", "bucketStart");

-- CreateIndex
CREATE UNIQUE INDEX "Candle_assetId_interval_bucketStart_key" ON "Candle"("assetId", "interval", "bucketStart");

-- AddForeignKey
ALTER TABLE "Candle" ADD CONSTRAINT "Candle_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
