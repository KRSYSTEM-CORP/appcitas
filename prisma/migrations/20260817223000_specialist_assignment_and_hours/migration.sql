-- CreateEnum
CREATE TYPE "SpecialistAssignmentMode" AS ENUM ('CLIENT_CHOOSES', 'BUSINESS_ASSIGNS');

-- AlterTable
ALTER TABLE "Business" ADD COLUMN     "specialistAssignmentMode" "SpecialistAssignmentMode" NOT NULL DEFAULT 'CLIENT_CHOOSES';

-- AlterTable
ALTER TABLE "Specialist" ADD COLUMN     "hasCustomHours" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable: a business in BUSINESS_ASSIGNS mode creates appointments with
-- no specialist yet — staff assigns one later from the agenda.
ALTER TABLE "Appointment" ALTER COLUMN "specialistId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "SpecialistHour" (
    "id" TEXT NOT NULL,
    "specialistId" TEXT NOT NULL,
    "weekday" INTEGER NOT NULL,
    "opensAt" TEXT,
    "closesAt" TEXT,
    "isClosed" BOOLEAN NOT NULL DEFAULT false,
    "breakStart" TEXT,
    "breakEnd" TEXT,

    CONSTRAINT "SpecialistHour_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SpecialistHour_specialistId_weekday_key" ON "SpecialistHour"("specialistId", "weekday");

-- AddForeignKey
ALTER TABLE "SpecialistHour" ADD CONSTRAINT "SpecialistHour_specialistId_fkey" FOREIGN KEY ("specialistId") REFERENCES "Specialist"("id") ON DELETE CASCADE ON UPDATE CASCADE;
