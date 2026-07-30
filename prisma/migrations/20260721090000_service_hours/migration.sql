-- AlterTable
ALTER TABLE "Service" ADD COLUMN     "hasCustomHours" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "ServiceHour" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "weekday" INTEGER NOT NULL,
    "opensAt" TEXT,
    "closesAt" TEXT,
    "isClosed" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ServiceHour_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ServiceHour_serviceId_weekday_key" ON "ServiceHour"("serviceId", "weekday");

-- AddForeignKey
ALTER TABLE "ServiceHour" ADD CONSTRAINT "ServiceHour_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;
