-- CreateEnum
CREATE TYPE "PaymentReportStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "BinancePayOrderStatus" AS ENUM ('PENDING', 'PAID', 'EXPIRED', 'FAILED');

-- AlterTable
ALTER TABLE "Business" ADD COLUMN     "isExempt" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "monthlyFeeUsdCents" INTEGER,
ADD COLUMN     "nextPaymentDueDate" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "amountUsdCents" INTEGER NOT NULL,
    "exchangeRate" DECIMAL(12,4) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "verifiedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentReport" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "reportedById" TEXT NOT NULL,
    "proofImageDataUrl" TEXT,
    "note" TEXT,
    "status" "PaymentReportStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentReportLine" (
    "id" TEXT NOT NULL,
    "paymentReportId" TEXT NOT NULL,
    "paymentMethod" "PaymentMethod" NOT NULL,
    "amountUsdCents" INTEGER NOT NULL,
    "reference" TEXT,

    CONSTRAINT "PaymentReportLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BinancePayOrder" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "merchantTradeNo" TEXT NOT NULL,
    "prepayId" TEXT,
    "amountUsdCents" INTEGER NOT NULL,
    "status" "BinancePayOrderStatus" NOT NULL DEFAULT 'PENDING',
    "checkoutUrl" TEXT,
    "qrcodeLink" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paidAt" TIMESTAMP(3),

    CONSTRAINT "BinancePayOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformSettings" (
    "id" TEXT NOT NULL,
    "paymentInstructions" TEXT,
    "billingExchangeRate" DECIMAL(12,4),
    "defaultMonthlyFeeUsdCents" INTEGER,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Payment_businessId_createdAt_idx" ON "Payment"("businessId", "createdAt");

-- CreateIndex
CREATE INDEX "PaymentReport_businessId_status_idx" ON "PaymentReport"("businessId", "status");

-- CreateIndex
CREATE INDEX "PaymentReport_status_createdAt_idx" ON "PaymentReport"("status", "createdAt");

-- CreateIndex
CREATE INDEX "PaymentReportLine_paymentReportId_idx" ON "PaymentReportLine"("paymentReportId");

-- CreateIndex
CREATE UNIQUE INDEX "BinancePayOrder_merchantTradeNo_key" ON "BinancePayOrder"("merchantTradeNo");

-- CreateIndex
CREATE INDEX "BinancePayOrder_businessId_status_idx" ON "BinancePayOrder"("businessId", "status");

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentReport" ADD CONSTRAINT "PaymentReport_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentReportLine" ADD CONSTRAINT "PaymentReportLine_paymentReportId_fkey" FOREIGN KEY ("paymentReportId") REFERENCES "PaymentReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BinancePayOrder" ADD CONSTRAINT "BinancePayOrder_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
