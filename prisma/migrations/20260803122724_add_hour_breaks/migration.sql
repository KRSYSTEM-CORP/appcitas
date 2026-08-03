-- AlterTable
ALTER TABLE "BusinessHour" ADD COLUMN     "breakEnd" TEXT,
ADD COLUMN     "breakStart" TEXT;

-- AlterTable
ALTER TABLE "ServiceHour" ADD COLUMN     "breakEnd" TEXT,
ADD COLUMN     "breakStart" TEXT;
