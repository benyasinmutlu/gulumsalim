import { and, eq, gte, sql } from "drizzle-orm";
import { db } from "../../db/client";
import { vendorPayouts, vendors } from "../../db/schema/index";

export class InsufficientBalanceError extends Error {}

// Bakiye kontrolü ve düşümü aynı transaction içinde yapılır - iki eşzamanlı
// ödeme talebinin aynı bakiyeyi iki kez harcaması (race condition)
// mümkün değildir.
export async function requestPayout(vendorId: number, amount: number, iban: string, accountHolder: string, note?: string) {
  return db.transaction(async (tx) => {
    const normalizedAmount = amount.toFixed(2);
    const [debitedVendor] = await tx
      .update(vendors)
      .set({
        walletBalance: sql`${vendors.walletBalance} - ${normalizedAmount}`,
        bankIban: iban,
        bankAccountHolder: accountHolder,
      })
      .where(and(eq(vendors.id, vendorId), gte(vendors.walletBalance, normalizedAmount)))
      .returning({ id: vendors.id });

    if (!debitedVendor) {
      throw new InsufficientBalanceError();
    }

    const [payout] = await tx
      .insert(vendorPayouts)
      .values({ vendorId, amount: normalizedAmount, iban, accountHolder, note, status: "pending" })
      .returning();
    if (!payout) throw new Error("Ödeme talebi oluşturulamadı");

    return payout;
  });
}
