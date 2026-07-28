import { eq, sql } from "drizzle-orm";
import { db } from "../../db/client";
import { vendorPayouts, vendors } from "../../db/schema/index";
import { findPayoutById } from "./admin-payouts.repository";

export class PayoutNotFoundError extends Error {}
export class PayoutAlreadyProcessedError extends Error {}

export async function approvePayout(payoutId: number, adminId: number) {
  const payout = await findPayoutById(payoutId);
  if (!payout) throw new PayoutNotFoundError();
  if (payout.status !== "pending") throw new PayoutAlreadyProcessedError();

  const [updated] = await db
    .update(vendorPayouts)
    .set({ status: "paid", processedAt: new Date(), processedBy: adminId })
    .where(eq(vendorPayouts.id, payoutId))
    .returning();
  return updated;
}

// Talep oluşturulurken tutar satıcının cüzdanından hemen düşülmüştü
// (bkz. vendor-finance.service.ts requestPayout - bakiyenin iki talep
// tarafından aynı anda harcanmasını önlemek için). Reddedilince bu
// tutar simetrik olarak geri eklenir.
export async function rejectPayout(payoutId: number, adminId: number, reason?: string) {
  const payout = await findPayoutById(payoutId);
  if (!payout) throw new PayoutNotFoundError();
  if (payout.status !== "pending") throw new PayoutAlreadyProcessedError();

  return db.transaction(async (tx) => {
    const [updated] = await tx
      .update(vendorPayouts)
      .set({ status: "rejected", processedAt: new Date(), processedBy: adminId, rejectionReason: reason })
      .where(eq(vendorPayouts.id, payoutId))
      .returning();

    await tx
      .update(vendors)
      .set({ walletBalance: sql`${vendors.walletBalance} + ${payout.amount}` })
      .where(eq(vendors.id, payout.vendorId));

    return updated;
  });
}
