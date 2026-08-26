-- Row-Level Security: a database-level backstop against a missing
-- `where: { businessId }` filter in application code — mirrors the identical
-- setup in the sibling ventas-inventario (KR POS) app exactly (see
-- lib/tenant-db.ts's withTenant/withSuperAdmin). Every request now runs
-- inside a transaction that first tags the Postgres session with
-- app.business_id (or app.is_super_admin for the platform admin panel and
-- the handful of public pre-tenant lookups — subdomain resolution, the
-- cancelToken flow — that don't have a businessId yet); these policies then
-- only let a query see rows matching that tag, regardless of what the
-- query's own WHERE clause did or didn't filter by.
--
-- Deliberately EXCLUDED, matching the same architectural choice already
-- made in ventas-inventario:
--   - Business: the tenant root itself; pre-auth flows (login by email,
--     signup's subdomain-uniqueness check, the public booking widget's
--     subdomain resolution) need to search across every business before a
--     businessId is even known.
--   - User: same reason — login/signup/password-reset all look a user up
--     by email or googleId globally, before any tenant context exists.
--   - PasswordResetToken: keyed by userId, part of that same pre-auth flow.
--   - PlatformSettings: a single global config row, not tenant-scoped at all.

-- Tables with their own businessId column — direct comparison.
ALTER TABLE "BusinessHour" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "BusinessHour" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "BusinessHour"
  USING (
    current_setting('app.is_super_admin', true) = 'true'
    OR "businessId" = current_setting('app.business_id', true)
  );

ALTER TABLE "Specialist" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Specialist" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "Specialist"
  USING (
    current_setting('app.is_super_admin', true) = 'true'
    OR "businessId" = current_setting('app.business_id', true)
  );

ALTER TABLE "Service" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Service" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "Service"
  USING (
    current_setting('app.is_super_admin', true) = 'true'
    OR "businessId" = current_setting('app.business_id', true)
  );

ALTER TABLE "Client" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Client" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "Client"
  USING (
    current_setting('app.is_super_admin', true) = 'true'
    OR "businessId" = current_setting('app.business_id', true)
  );

-- @@map("Package") in schema.prisma — the Prisma model is SessionPackage,
-- the actual table name is "Package".
ALTER TABLE "Package" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Package" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "Package"
  USING (
    current_setting('app.is_super_admin', true) = 'true'
    OR "businessId" = current_setting('app.business_id', true)
  );

ALTER TABLE "Appointment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Appointment" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "Appointment"
  USING (
    current_setting('app.is_super_admin', true) = 'true'
    OR "businessId" = current_setting('app.business_id', true)
  );

ALTER TABLE "Payment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Payment" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "Payment"
  USING (
    current_setting('app.is_super_admin', true) = 'true'
    OR "businessId" = current_setting('app.business_id', true)
  );

ALTER TABLE "PaymentReport" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PaymentReport" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "PaymentReport"
  USING (
    current_setting('app.is_super_admin', true) = 'true'
    OR "businessId" = current_setting('app.business_id', true)
  );

-- Dead schema today (no code path creates or reads these — an earlier,
-- since-abandoned auto-checkout design superseded by the manual
-- PaymentReport + WhatsApp flow), but scoped the same way as everything
-- else in case either is ever revived.
ALTER TABLE "BinancePayOrder" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "BinancePayOrder" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "BinancePayOrder"
  USING (
    current_setting('app.is_super_admin', true) = 'true'
    OR "businessId" = current_setting('app.business_id', true)
  );

ALTER TABLE "PagoMovilOrder" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PagoMovilOrder" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "PagoMovilOrder"
  USING (
    current_setting('app.is_super_admin', true) = 'true'
    OR "businessId" = current_setting('app.business_id', true)
  );

-- Child tables with no businessId column of their own — policy checks the
-- parent row's businessId via EXISTS.
ALTER TABLE "SpecialistHour" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SpecialistHour" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "SpecialistHour"
  USING (
    current_setting('app.is_super_admin', true) = 'true'
    OR EXISTS (
      SELECT 1 FROM "Specialist"
      WHERE "Specialist"."id" = "SpecialistHour"."specialistId"
        AND "Specialist"."businessId" = current_setting('app.business_id', true)
    )
  );

ALTER TABLE "SpecialistService" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SpecialistService" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "SpecialistService"
  USING (
    current_setting('app.is_super_admin', true) = 'true'
    OR EXISTS (
      SELECT 1 FROM "Specialist"
      WHERE "Specialist"."id" = "SpecialistService"."specialistId"
        AND "Specialist"."businessId" = current_setting('app.business_id', true)
    )
  );

ALTER TABLE "ServiceHour" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ServiceHour" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "ServiceHour"
  USING (
    current_setting('app.is_super_admin', true) = 'true'
    OR EXISTS (
      SELECT 1 FROM "Service"
      WHERE "Service"."id" = "ServiceHour"."serviceId"
        AND "Service"."businessId" = current_setting('app.business_id', true)
    )
  );

-- A Transaction hangs off EITHER an Appointment OR a Package (see
-- prisma/schema.prisma) — exactly one of the two FKs is set, so the policy
-- checks whichever one is present.
ALTER TABLE "Transaction" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Transaction" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "Transaction"
  USING (
    current_setting('app.is_super_admin', true) = 'true'
    OR EXISTS (
      SELECT 1 FROM "Appointment"
      WHERE "Appointment"."id" = "Transaction"."appointmentId"
        AND "Appointment"."businessId" = current_setting('app.business_id', true)
    )
    OR EXISTS (
      SELECT 1 FROM "Package"
      WHERE "Package"."id" = "Transaction"."packageId"
        AND "Package"."businessId" = current_setting('app.business_id', true)
    )
  );

ALTER TABLE "Notification" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Notification" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "Notification"
  USING (
    current_setting('app.is_super_admin', true) = 'true'
    OR EXISTS (
      SELECT 1 FROM "Appointment"
      WHERE "Appointment"."id" = "Notification"."appointmentId"
        AND "Appointment"."businessId" = current_setting('app.business_id', true)
    )
  );

ALTER TABLE "PaymentReportLine" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PaymentReportLine" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "PaymentReportLine"
  USING (
    current_setting('app.is_super_admin', true) = 'true'
    OR EXISTS (
      SELECT 1 FROM "PaymentReport"
      WHERE "PaymentReport"."id" = "PaymentReportLine"."paymentReportId"
        AND "PaymentReport"."businessId" = current_setting('app.business_id', true)
    )
  );
