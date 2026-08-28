-- Add businessId to Transaction: denormalized from the appointment/package
-- it hangs off, so tenant-scoped reads (reports.ts) and the RLS policy can
-- filter on a single column instead of a join through both possible
-- parents. Added nullable first so the (currently tiny) existing table
-- doesn't need a placeholder default, backfilled, then locked to NOT NULL.

ALTER TABLE "Transaction" ADD COLUMN "businessId" TEXT;

UPDATE "Transaction" t
SET "businessId" = COALESCE(
  (SELECT a."businessId" FROM "Appointment" a WHERE a.id = t."appointmentId"),
  (SELECT p."businessId" FROM "Package" p WHERE p.id = t."packageId")
)
WHERE t."businessId" IS NULL;

ALTER TABLE "Transaction" ALTER COLUMN "businessId" SET NOT NULL;
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_businessId_fkey"
  FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "Transaction_businessId_paidAt_idx" ON "Transaction"("businessId", "paidAt");

-- Replace the join-based RLS policy (through Appointment OR Package) with a
-- direct column check now that businessId is populated on every row.
DROP POLICY "tenant_isolation" ON "Transaction";
CREATE POLICY "tenant_isolation" ON "Transaction"
  USING (
    current_setting('app.is_super_admin', true) = 'true'
    OR "businessId" = current_setting('app.business_id', true)
  );
