import { and, eq, sql } from "drizzle-orm";
import { db } from "../../db/client";
import { vendorPayouts, vendors } from "../../db/schema/index";

export class PayoutNotFoundError extends Error {}
export class PayoutAlreadyProcessedError extends Error {}

async function throwPayoutTransitionError(payoutId: number) {
  const [existing] = await db.select({ id: vendorPayouts.id }).from(vendorPayouts).where(eq(vendorPayouts.id, payoutId)).limit(1);
  if (!existing) throw new PayoutNotFoundError();
  throw new PayoutAlreadyProcessedError();
}

export async function approvePayout(payoutId: number, adminId: number, transferReference: string) {
  const [updated] = await db
    .update(vendorPayouts)
    .set({ status: "paid", processedAt: new Date(), processedBy: adminId, transferReference: transferReference.trim() })
    .where(and(eq(vendorPayouts.id, payoutId), eq(vendorPayouts.status, "pending")))
    .returning();
  if (!updated) return throwPayoutTransitionError(payoutId);
  return updated;
}

// Talep oluşturulurken tutar satıcının cüzdanından hemen düşülmüştü
// (bkz. vendor-finance.service.ts requestPayout - bakiyenin iki talep
// tarafından aynı anda harcanmasını önlemek için). Reddedilince bu
// tutar simetrik olarak geri eklenir.
export async function rejectPayout(payoutId: number, adminId: number, reason?: string) {
  return db.transaction(async (tx) => {
    const [updated] = await tx
      .update(vendorPayouts)
      .set({ status: "rejected", processedAt: new Date(), processedBy: adminId, rejectionReason: reason })
      .where(and(eq(vendorPayouts.id, payoutId), eq(vendorPayouts.status, "pending")))
      .returning();

    if (!updated) {
      const [existing] = await tx.select({ id: vendorPayouts.id }).from(vendorPayouts).where(eq(vendorPayouts.id, payoutId)).limit(1);
      if (!existing) throw new PayoutNotFoundError();
      throw new PayoutAlreadyProcessedError();
    }

    await tx
      .update(vendors)
      .set({ walletBalance: sql`${vendors.walletBalance} + ${updated.amount}` })
      .where(eq(vendors.id, updated.vendorId));

    return updated;
  });
}
