import { eq, sql } from "drizzle-orm";
import { db } from "../../db/client";
import { vendorPayouts, vendors } from "../../db/schema/index";

export class InsufficientBalanceError extends Error {}

// Bakiye kontrolü ve düşümü aynı transaction içinde yapılır - iki eşzamanlı
// ödeme talebinin aynı bakiyeyi iki kez harcaması (race condition)
// mümkün değildir.
export async function requestPayout(vendorId: number, amount: number, iban: string, note?: string) {
  return db.transaction(async (tx) => {
    const [vendor] = await tx
      .select({ walletBalance: vendors.walletBalance })
      .from(vendors)
      .where(eq(vendors.id, vendorId))
      .limit(1);

    if (!vendor || Number(vendor.walletBalance) < amount) {
      throw new InsufficientBalanceError();
    }

    await tx
      .update(vendors)
      .set({ walletBalance: sql`${vendors.walletBalance} - ${amount.toFixed(2)}` })
      .where(eq(vendors.id, vendorId));

    const [payout] = await tx
      .insert(vendorPayouts)
      .values({ vendorId, amount: amount.toFixed(2), iban, note, status: "pending" })
      .returning();
    if (!payout) throw new Error("Ödeme talebi oluşturulamadı");

    return payout;
  });
}
