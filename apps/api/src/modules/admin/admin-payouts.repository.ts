import { desc, eq } from "drizzle-orm";
import { db } from "../../db/client";
import { vendorPayouts, vendors } from "../../db/schema/index";

type PayoutStatus = "pending" | "paid" | "rejected";

export async function listPayouts(status?: PayoutStatus) {
  const base = db
    .select({
      id: vendorPayouts.id,
      vendorId: vendorPayouts.vendorId,
      vendorStoreName: vendors.storeName,
      amount: vendorPayouts.amount,
      iban: vendorPayouts.iban,
      note: vendorPayouts.note,
      status: vendorPayouts.status,
      requestedAt: vendorPayouts.requestedAt,
      processedAt: vendorPayouts.processedAt,
      rejectionReason: vendorPayouts.rejectionReason,
    })
    .from(vendorPayouts)
    .innerJoin(vendors, eq(vendorPayouts.vendorId, vendors.id))
    .orderBy(desc(vendorPayouts.requestedAt));

  if (status) return base.where(eq(vendorPayouts.status, status));
  return base;
}

export async function findPayoutById(id: number) {
  const [row] = await db.select().from(vendorPayouts).where(eq(vendorPayouts.id, id)).limit(1);
  return row ?? null;
}
