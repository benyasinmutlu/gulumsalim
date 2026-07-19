import { eq, sql } from "drizzle-orm";
import { db } from "../../db/client";
import { orderItems, vendorEarnings, vendors } from "../../db/schema/index";
import { findVendorOrderItem, updateVendorOrderItemStatus } from "./vendor-orders.repository";

export type OrderItemStatus = "pending" | "processing" | "shipped" | "delivered" | "cancelled";
type Status = OrderItemStatus;

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

export function isTransitionAllowed(current: OrderItemStatus, next: OrderItemStatus): boolean {
  return ALLOWED_TRANSITIONS[current].includes(next);
}

// vendors.commissionRate ayarlanmamışsa (null) kullanılan platform
// varsayılan komisyon oranı (%).
const DEFAULT_COMMISSION_RATE = 10;

export function calculateEarning(total: string, commissionRatePercent: number | null) {
  const rate = commissionRatePercent ?? DEFAULT_COMMISSION_RATE;
  const gross = Number(total);
  const commission = gross * (rate / 100);
  const net = gross - commission;
  return {
    grossAmount: gross.toFixed(2),
    commissionAmount: commission.toFixed(2),
    netAmount: net.toFixed(2),
  };
}

export class OrderItemNotFoundError extends Error {}
export class InvalidStatusTransitionError extends Error {}

export async function transitionOrderItemStatus(vendorId: number, orderItemId: number, nextStatus: Status) {
  const item = await findVendorOrderItem(vendorId, orderItemId);
  if (!item) throw new OrderItemNotFoundError();

  if (!isTransitionAllowed(item.vendorStatus as Status, nextStatus)) {
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
    const rate = vendor?.commissionRate ? Number(vendor.commissionRate) : null;
    const earning = calculateEarning(total, rate);

    await tx.insert(vendorEarnings).values({ orderItemId, vendorId, ...earning });

    await tx
      .update(vendors)
      .set({ walletBalance: sql`${vendors.walletBalance} + ${earning.netAmount}` })
      .where(eq(vendors.id, vendorId));

    return updatedItem;
  });
}
