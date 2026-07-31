-- CreateEnum
CREATE TYPE "PagoMovilOrderStatus" AS ENUM ('PENDING', 'PAID', 'EXPIRED');

-- CreateTable
CREATE TABLE "PagoMovilOrder" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "amountUsdCents" INTEGER NOT NULL,
    "exchangeRate" DECIMAL(12,4) NOT NULL,
    "expectedAmountBsCents" INTEGER NOT NULL,
    "status" "PagoMovilOrderStatus" NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paidAt" TIMESTAMP(3),

    CONSTRAINT "PagoMovilOrder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PagoMovilOrder_businessId_status_idx" ON "PagoMovilOrder"("businessId", "status");

-- CreateIndex
CREATE INDEX "PagoMovilOrder_expectedAmountBsCents_status_idx" ON "PagoMovilOrder"("expectedAmountBsCents", "status");

-- AddForeignKey
ALTER TABLE "PagoMovilOrder" ADD CONSTRAINT "PagoMovilOrder_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
