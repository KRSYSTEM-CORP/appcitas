-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('OWNER', 'SPECIALIST');

-- CreateEnum
CREATE TYPE "AppointmentStatus" AS ENUM ('PENDING', 'CONFIRMED', 'ATTENDED', 'NO_SHOW', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'TRANSFER', 'CARD', 'PAGO_MOVIL', 'OTHER');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('WHATSAPP', 'SMS', 'PUSH');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('SCHEDULED', 'SENT', 'FAILED');

-- CreateTable
CREATE TABLE "Business" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "subdomain" TEXT NOT NULL,
    "loginCode" TEXT NOT NULL,
    "logoDataUrl" TEXT,
    "brandColor" TEXT,
    "brandBackground" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'America/Caracas',
    "localCurrencyCode" TEXT NOT NULL DEFAULT 'VES',
    "fxEnabled" BOOLEAN NOT NULL DEFAULT false,
    "foreignCurrencyCode" TEXT NOT NULL DEFAULT 'USD',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Business_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BusinessHour" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "weekday" INTEGER NOT NULL,
    "opensAt" TEXT,
    "closesAt" TEXT,
    "isClosed" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "BusinessHour_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "email" TEXT,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'OWNER',
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Specialist" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "userId" TEXT,
    "displayName" TEXT NOT NULL,
    "bio" TEXT,
    "avatarDataUrl" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Specialist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Service" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "durationMinutes" INTEGER NOT NULL,
    "basePriceCents" INTEGER NOT NULL,
    "category" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Service_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SpecialistService" (
    "specialistId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,

    CONSTRAINT "SpecialistService_pkey" PRIMARY KEY ("specialistId","serviceId")
);

-- CreateTable
CREATE TABLE "Client" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Appointment" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "specialistId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "status" "AppointmentStatus" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Appointment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL,
    "appointmentId" TEXT NOT NULL,
    "amountLocalCents" INTEGER NOT NULL,
    "amountForeignCents" INTEGER,
    "currencyLocal" TEXT NOT NULL,
    "currencyForeign" TEXT,
    "fxRate" DECIMAL(18,6),
    "paymentMethod" "PaymentMethod" NOT NULL,
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExchangeRate" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "rate" DECIMAL(18,6) NOT NULL,
    "effectiveDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExchangeRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "appointmentId" TEXT NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "status" "NotificationStatus" NOT NULL DEFAULT 'SCHEDULED',
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3),

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Business_subdomain_key" ON "Business"("subdomain");

-- CreateIndex
CREATE UNIQUE INDEX "Business_loginCode_key" ON "Business"("loginCode");

-- CreateIndex
CREATE UNIQUE INDEX "BusinessHour_businessId_weekday_key" ON "BusinessHour"("businessId", "weekday");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_businessId_idx" ON "User"("businessId");

-- CreateIndex
CREATE UNIQUE INDEX "Specialist_userId_key" ON "Specialist"("userId");

-- CreateIndex
CREATE INDEX "Specialist_businessId_idx" ON "Specialist"("businessId");

-- CreateIndex
CREATE INDEX "Service_businessId_idx" ON "Service"("businessId");

-- CreateIndex
CREATE UNIQUE INDEX "Client_businessId_phone_key" ON "Client"("businessId", "phone");

-- CreateIndex
CREATE INDEX "Appointment_businessId_startsAt_idx" ON "Appointment"("businessId", "startsAt");

-- CreateIndex
CREATE INDEX "Appointment_specialistId_startsAt_idx" ON "Appointment"("specialistId", "startsAt");

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_appointmentId_key" ON "Transaction"("appointmentId");

-- CreateIndex
CREATE INDEX "ExchangeRate_businessId_effectiveDate_idx" ON "ExchangeRate"("businessId", "effectiveDate");

-- CreateIndex
CREATE INDEX "Notification_appointmentId_idx" ON "Notification"("appointmentId");

-- AddForeignKey
ALTER TABLE "BusinessHour" ADD CONSTRAINT "BusinessHour_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Specialist" ADD CONSTRAINT "Specialist_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Specialist" ADD CONSTRAINT "Specialist_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Service" ADD CONSTRAINT "Service_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpecialistService" ADD CONSTRAINT "SpecialistService_specialistId_fkey" FOREIGN KEY ("specialistId") REFERENCES "Specialist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpecialistService" ADD CONSTRAINT "SpecialistService_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Client" ADD CONSTRAINT "Client_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_specialistId_fkey" FOREIGN KEY ("specialistId") REFERENCES "Specialist"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExchangeRate" ADD CONSTRAINT "ExchangeRate_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
