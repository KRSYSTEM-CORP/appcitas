-- AlterTable: add the new current-rate fields directly on Business
ALTER TABLE "Business" ADD COLUMN     "exchangeRate" DECIMAL(18,6),
ADD COLUMN     "exchangeRateUpdatedAt" TIMESTAMP(3);

-- Backfill: each business's exchangeRate becomes its most recent
-- ExchangeRate row's rate, exchangeRateUpdatedAt becomes that row's
-- effectiveDate (matches "latest row = current rate" semantics the app
-- already relied on via `orderBy: effectiveDate desc`).
UPDATE "Business" b
SET "exchangeRate" = latest.rate,
    "exchangeRateUpdatedAt" = latest."effectiveDate"
FROM (
  SELECT DISTINCT ON ("businessId") "businessId", rate, "effectiveDate"
  FROM "ExchangeRate"
  ORDER BY "businessId", "effectiveDate" DESC
) AS latest
WHERE b.id = latest."businessId";

-- DropForeignKey
ALTER TABLE "ExchangeRate" DROP CONSTRAINT "ExchangeRate_businessId_fkey";

-- DropTable
DROP TABLE "ExchangeRate";
