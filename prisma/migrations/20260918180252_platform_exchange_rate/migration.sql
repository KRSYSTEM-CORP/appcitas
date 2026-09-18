-- AlterTable
ALTER TABLE "PlatformSettings" ADD COLUMN     "platformExchangeRate" DECIMAL(12,4),
ADD COLUMN     "platformExchangeRateUpdatedAt" TIMESTAMP(3);
