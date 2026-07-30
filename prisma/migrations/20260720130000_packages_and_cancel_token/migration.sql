-- CreateEnum
CREATE TYPE "PackagePaymentMode" AS ENUM ('PACKAGE', 'PER_SESSION');

-- CreateTable
CREATE TABLE "Package" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "specialistId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "totalSessions" INTEGER NOT NULL,
    "paymentMode" "PackagePaymentMode" NOT NULL DEFAULT 'PER_SESSION',
    "packagePriceCents" INTEGER,
    "packagePriceCurrencyCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Package_pkey" PRIMARY KEY ("id")
);

-- AlterTable: add package/session columns, cancelToken nullable first so
-- existing rows can be backfilled before the NOT NULL + unique constraint go on.
ALTER TABLE "Appointment" ADD COLUMN     "packageId" TEXT,
ADD COLUMN     "sessionNumber" INTEGER,
ADD COLUMN     "cancelToken" TEXT;

-- Backfill: every pre-existing appointment gets a real random token so the
-- unique/NOT NULL constraints below can apply cleanly.
UPDATE "Appointment" SET "cancelToken" = gen_random_uuid()::text WHERE "cancelToken" IS NULL;

ALTER TABLE "Appointment" ALTER COLUMN "cancelToken" SET NOT NULL;

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "packageId" TEXT,
ALTER COLUMN "appointmentId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "Package_businessId_idx" ON "Package"("businessId");

-- CreateIndex
CREATE UNIQUE INDEX "Appointment_cancelToken_key" ON "Appointment"("cancelToken");

-- CreateIndex
CREATE INDEX "Appointment_packageId_idx" ON "Appointment"("packageId");

-- CreateIndex
CREATE INDEX "Transaction_packageId_idx" ON "Transaction"("packageId");

-- AddForeignKey
ALTER TABLE "Package" ADD CONSTRAINT "Package_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Package" ADD CONSTRAINT "Package_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Package" ADD CONSTRAINT "Package_specialistId_fkey" FOREIGN KEY ("specialistId") REFERENCES "Specialist"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Package" ADD CONSTRAINT "Package_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "Package"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "Package"("id") ON DELETE CASCADE ON UPDATE CASCADE;
