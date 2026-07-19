import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "../../db/client";
import { vendorEarnings, vendorPayouts, vendors } from "../../db/schema/index";

export async function getVendorWalletSummary(vendorId: number) {
  const [vendor] = await db
    .select({ walletBalance: vendors.walletBalance })
    .from(vendors)
    .where(eq(vendors.id, vendorId))
    .limit(1);

  const [earningsSum] = await db
    .select({
      totalGross: sql<string>`COALESCE(SUM(${vendorEarnings.grossAmount}), 0)`,
      totalNet: sql<string>`COALESCE(SUM(${vendorEarnings.netAmount}), 0)`,
    })
    .from(vendorEarnings)
    .where(eq(vendorEarnings.vendorId, vendorId));

  const [paidOutSum] = await db
    .select({ totalPaid: sql<string>`COALESCE(SUM(${vendorPayouts.amount}), 0)` })
    .from(vendorPayouts)
    .where(and(eq(vendorPayouts.vendorId, vendorId), eq(vendorPayouts.status, "paid")));

  return {
    walletBalance: vendor?.walletBalance ?? "0.00",
    totalGross: earningsSum?.totalGross ?? "0.00",
    totalNet: earningsSum?.totalNet ?? "0.00",
    totalPaidOut: paidOutSum?.totalPaid ?? "0.00",
  };
}

export async function listVendorEarnings(vendorId: number) {
  return db.select().from(vendorEarnings).where(eq(vendorEarnings.vendorId, vendorId)).orderBy(desc(vendorEarnings.createdAt));
}

export async function listVendorPayouts(vendorId: number) {
  return db.select().from(vendorPayouts).where(eq(vendorPayouts.vendorId, vendorId)).orderBy(desc(vendorPayouts.requestedAt));
}
