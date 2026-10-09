-- Run once before upgrading, for the default Better Auth SQLite names only.
-- Back up first. Use schema generation for other adapters or custom names.
BEGIN;
ALTER TABLE "solanaPayment" ADD COLUMN "fulfillmentStatus" TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE "solanaPayment" ADD COLUMN "fulfillmentToken" TEXT;
ALTER TABLE "solanaPayment" ADD COLUMN "fulfillmentClaimedAt" INTEGER;
-- Legacy paid rows already completed their old fulfillment path.
UPDATE "solanaPayment" SET "fulfillmentStatus" = 'completed' WHERE "status" = 'paid';
COMMIT;
