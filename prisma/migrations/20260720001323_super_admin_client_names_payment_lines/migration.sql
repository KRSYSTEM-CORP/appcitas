/*
  Warnings:

  - You are about to drop the column `name` on the `Client` table. All the data in the column will be lost.
  - Added the required column `firstName` to the `Client` table without a default value. This is not possible if the table is not empty.
  - Added the required column `lastName` to the `Client` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
ALTER TYPE "UserStatus" ADD VALUE 'PENDING';

-- DropIndex
DROP INDEX "Transaction_appointmentId_key";

-- AlterTable
ALTER TABLE "Client" DROP COLUMN "name",
ADD COLUMN     "firstName" TEXT NOT NULL,
ADD COLUMN     "lastName" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Service" ADD COLUMN     "priceCurrencyCode" TEXT NOT NULL DEFAULT 'USD';

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "reference" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "isSuperAdmin" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "Transaction_appointmentId_idx" ON "Transaction"("appointmentId");
