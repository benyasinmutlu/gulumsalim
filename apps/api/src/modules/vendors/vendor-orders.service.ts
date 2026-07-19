import { eq, sql } from "drizzle-orm";
import { db } from "../../db/client";
import { orderItems, vendorEarnings, vendors } from "../../db/schema/index";
import { findVendorOrderItem, updateVendorOrderItemStatus } from "./vendor-orders.repository";

type Status = "pending" | "processing" | "shipped" | "delivered" | "cancelled";

// Sadece ileri yönde ve tek adımlık geçişlere izin verilir - "shipped"
// durumundaki bir kalem doğrudan "pending"e dönemez ya da "delivered"i
// atlayamaz. Kargoya verilmiş/teslim edilmiş bir kalem iptal edilemez.
const ALLOWED_TRANSITIONS: Record<Status, Status[]> = {
  pending: ["processing", "cancelled"],
  processing: ["shipped", "cancelled"],
  shipped: ["delivered"],
  delivered: [],
  cancelled: [],
};

// vendors.commissionRate ayarlanmamışsa (null) kullanılan platform
// varsayılan komisyon oranı (%).
const DEFAULT_COMMISSION_RATE = 10;

export class OrderItemNotFoundError extends Error {}
export class InvalidStatusTransitionError extends Error {}

export async function transitionOrderItemStatus(vendorId: number, orderItemId: number, nextStatus: Status) {
  const item = await findVendorOrderItem(vendorId, orderItemId);
  if (!item) throw new OrderItemNotFoundError();

  const allowed = ALLOWED_TRANSITIONS[item.vendorStatus as Status] ?? [];
  if (!allowed.includes(nextStatus)) {
    throw new InvalidStatusTransitionError(`"${item.vendorStatus}" durumundan "${nextStatus}" durumuna geçilemez`);
  }

  if (nextStatus === "delivered") {
    return markDeliveredAndCreditEarning(vendorId, item.id, item.total);
  }

  return updateVendorOrderItemStatus(vendorId, orderItemId, nextStatus as Exclude<Status, "pending">);
}

// Kazanç, teslimat onaylandığı anda cüzdana geçer (iade/anlaşmazlık riskini
// azaltmak için ödeme anında değil) - kalem durumu, kazanç kaydı ve cüzdan
// bakiyesi güncellemesi tek transaction'da, ya hep ya hiç yazılır.
// vendor_earnings.order_item_id UNIQUE olduğu için aynı kalem yanlışlıkla
// iki kez "delivered"a alınsa bile çifte kazanç kredisi imkansızdır.
async function markDeliveredAndCreditEarning(vendorId: number, orderItemId: number, total: string) {
  return db.transaction(async (tx) => {
    const [updatedItem] = await tx
      .update(orderItems)
      .set({ vendorStatus: "delivered" })
      .where(eq(orderItems.id, orderItemId))
      .returning();
    if (!updatedItem) throw new Error("Sipariş kalemi güncellenemedi");

    const [vendor] = await tx
      .select({ commissionRate: vendors.commissionRate })
      .from(vendors)
      .where(eq(vendors.id, vendorId))
      .limit(1);
    const rate = vendor?.commissionRate ? Number(vendor.commissionRate) : DEFAULT_COMMISSION_RATE;

    const gross = Number(total);
    const commission = gross * (rate / 100);
    const net = gross - commission;

    await tx.insert(vendorEarnings).values({
      orderItemId,
      vendorId,
      grossAmount: gross.toFixed(2),
      commissionAmount: commission.toFixed(2),
      netAmount: net.toFixed(2),
    });

    await tx
      .update(vendors)
      .set({ walletBalance: sql`${vendors.walletBalance} + ${net.toFixed(2)}` })
      .where(eq(vendors.id, vendorId));

    return updatedItem;
  });
}
