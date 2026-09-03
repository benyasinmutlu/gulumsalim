import { and, eq, gte, sql } from "drizzle-orm";
import { db } from "../../db/client";
import { vendorPayouts, vendors } from "../../db/schema/index";

export class InsufficientBalanceError extends Error {}
export class MissingBankAccountError extends Error {}
export class BankAccountMismatchError extends Error {}
export class BankAccountCoolingOffError extends Error {
  constructor(public availableAt: Date) {
    super("Banka hesabı güvenlik bekleme süresinde");
  }
}

const BANK_ACCOUNT_COOLDOWN_MS = 24 * 60 * 60 * 1000;

// Bakiye kontrolü ve düşümü aynı transaction içinde yapılır - iki eşzamanlı
// ödeme talebinin aynı bakiyeyi iki kez harcaması (race condition)
// mümkün değildir.
export async function requestPayout(vendorId: number, amount: number, iban: string, accountHolder: string, note?: string) {
  return db.transaction(async (tx) => {
    const normalizedAmount = amount.toFixed(2);
    const [vendor] = await tx
      .select({
        id: vendors.id,
        bankIban: vendors.bankIban,
        bankAccountHolder: vendors.bankAccountHolder,
        bankAccountChangedAt: vendors.bankAccountChangedAt,
      })
      .from(vendors)
      .where(eq(vendors.id, vendorId))
      .limit(1)
      .for("update");

    if (!vendor?.bankIban || !vendor.bankAccountHolder) throw new MissingBankAccountError();
    if (vendor.bankIban !== iban || vendor.bankAccountHolder !== accountHolder) throw new BankAccountMismatchError();
    if (vendor.bankAccountChangedAt) {
      const availableAt = new Date(vendor.bankAccountChangedAt.getTime() + BANK_ACCOUNT_COOLDOWN_MS);
      if (availableAt.getTime() > Date.now()) throw new BankAccountCoolingOffError(availableAt);
    }

    const [debitedVendor] = await tx
      .update(vendors)
      .set({
        walletBalance: sql`${vendors.walletBalance} - ${normalizedAmount}`,
      })
      .where(and(eq(vendors.id, vendorId), gte(vendors.walletBalance, normalizedAmount)))
      .returning({ id: vendors.id });

    if (!debitedVendor) {
      throw new InsufficientBalanceError();
    }

    const [payout] = await tx
      .insert(vendorPayouts)
      .values({ vendorId, amount: normalizedAmount, iban: vendor.bankIban, accountHolder: vendor.bankAccountHolder, note, status: "pending" })
      .returning();
    if (!payout) throw new Error("Ödeme talebi oluşturulamadı");

    return payout;
  });
}
