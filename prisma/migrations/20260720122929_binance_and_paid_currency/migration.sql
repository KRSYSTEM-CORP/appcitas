-- AlterEnum
ALTER TYPE "PaymentMethod" ADD VALUE 'BINANCE';

-- AlterTable: add nullable first so existing rows can be backfilled
ALTER TABLE "Transaction" ADD COLUMN     "paidCurrencyCode" TEXT;

-- Backfill: every existing payment was entered in the business's local
-- currency under the old single-currency payment form, so paidCurrencyCode
-- always matches the row's own currencyLocal snapshot.
UPDATE "Transaction" SET "paidCurrencyCode" = "currencyLocal" WHERE "paidCurrencyCode" IS NULL;

-- Now that every row has a value, enforce it going forward.
ALTER TABLE "Transaction" ALTER COLUMN "paidCurrencyCode" SET NOT NULL;
