import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import type { FastifyInstance } from "fastify";
import { env } from "../../config/env";
import { emitBehavioralEvent } from "../analytics/events.client";
import { createGuestCustomer, findCustomerByEmail, findCustomerById, updateGuestCustomerContact } from "../auth/auth.repository";
import { hydrateCart } from "../cart/cart.service";
import { createNotification } from "../notifications/notifications.repository";
import { getPublicSettings } from "../content/content.repository";
import type { CartLine } from "../cart/cart.types";
import type { ShippingAddress } from "./checkout.schemas";
import { initializeCheckoutForm, retrieveCheckoutForm } from "./iyzico.client";
import {
  createOrder,
  fetchProductsForCheckout,
  findOrderByPaymentRef,
  findOrderItemsWithProductInfo,
  InsufficientStockError,
  markOrderPaid,
  markOrderPaymentFailed,
  setOrderPaymentRef,
} from "./order.repository";
import { createPublicOrderNumber, isVerifiedSuccessfulPayment } from "./order-security";

export { InsufficientStockError };

const DEFAULT_SHIPPING_FEE = 49.9;
const DEFAULT_FREE_SHIPPING_THRESHOLD = 500;

// gulumsalim.com'daki admin/settings.php > Kargo sekmesinin karşılığı -
// admin panelden değiştirilebilir, hiç ayarlanmamışsa eski sabit
// değerlere düşer.
async function getShippingConfig() {
  const rows = await getPublicSettings(["shipping_cost", "free_shipping_limit"]);
  const shippingFee = rows.shipping_cost ? Number(rows.shipping_cost) : DEFAULT_SHIPPING_FEE;
  const freeShippingThreshold = rows.free_shipping_limit ? Number(rows.free_shipping_limit) : DEFAULT_FREE_SHIPPING_THRESHOLD;
  return { shippingFee, freeShippingThreshold };
}

export class EmptyCartError extends Error {}
export class UnavailableItemsError extends Error {}
export class PaymentInitError extends Error {}
export class GuestEmailRequiredError extends Error {}
export class EmailBelongsToAccountError extends Error {}

// checkout.php'deki misafir sipariş akışının karşılığı - oturum açmış
// müşteride sessionCustomerId zaten var, aksi halde e-posta zorunlu ve bu
// e-postayla ya var olan bir misafir kaydı güncellenir ya da yenisi
// oluşturulur. E-posta gerçek (üye) bir hesaba aitse, o hesabın siparişi
// "çalınmasın" diye giriş yapması istenir.
async function resolveCustomerId(sessionCustomerId: number | undefined, email: string | undefined, shippingAddress: ShippingAddress): Promise<number> {
  if (sessionCustomerId) return sessionCustomerId;
  if (!email) throw new GuestEmailRequiredError();

  const existing = await findCustomerByEmail(email);
  if (existing) {
    if (!existing.isGuest) throw new EmailBelongsToAccountError();
    const updated = await updateGuestCustomerContact(existing.id, { fullName: shippingAddress.fullName, phone: shippingAddress.phone });
    return updated.id;
  }

  const passwordHash = await bcrypt.hash(randomUUID(), 12);
  const guest = await createGuestCustomer({ email, passwordHash, fullName: shippingAddress.fullName, phone: shippingAddress.phone });
  return guest.id;
}

export async function startCheckout(
  sessionCustomerId: number | undefined,
  cart: CartLine[],
  shippingAddress: ShippingAddress,
  email?: string,
  orderNote?: string,
) {
  if (cart.length === 0) throw new EmptyCartError();
  const customerId = await resolveCustomerId(sessionCustomerId, email, shippingAddress);

  // hydrateCart zaten pasif/silinmiş ürünleri sessizce eler - eğer eledikten
  // sonra satır sayısı azaldıysa, kullanıcı hâlâ artık geçersiz bir ürünü
  // sepette sanıyor demektir; checkout'u burada durdurup ona haber veriyoruz.
  const hydrated = await hydrateCart(cart);
  if (hydrated.items.length === 0 || hydrated.items.length !== cart.length) {
    throw new UnavailableItemsError();
  }

  const productIds = [...new Set(cart.map((c) => c.productId))];
  const productRows = await fetchProductsForCheckout(productIds);
  const productMap = new Map(productRows.map((p) => [p.id, p]));

  const { shippingFee: baseShippingFee, freeShippingThreshold } = await getShippingConfig();
  const subtotal = Number(hydrated.subtotal);
  const shippingFee = subtotal >= freeShippingThreshold ? 0 : baseShippingFee;
  const total = subtotal + shippingFee;
  const orderNumber = createPublicOrderNumber();

  const items = hydrated.items.map((item) => {
    const product = productMap.get(item.productId);
    if (!product) throw new UnavailableItemsError();
    return {
      vendorId: product.vendorId,
      productId: item.productId,
      variantId: item.variantId,
      productNameSnapshot: item.productName,
      unitPrice: item.unitPrice,
      quantity: item.quantity,
      total: item.lineTotal,
    };
  });

  const { order } = await createOrder({
    customerId,
    orderNumber,
    subtotal: subtotal.toFixed(2),
    shippingFee: shippingFee.toFixed(2),
    total: total.toFixed(2),
    shippingAddress,
    orderNote,
    items,
  });

  const customer = await findCustomerById(customerId);
  if (!customer) throw new Error("Müşteri bulunamadı");

  const [firstName, ...rest] = shippingAddress.fullName.split(" ");

  // initializeCheckoutForm birkaç ağ denemesinden sonra da başarısız olursa
  // (ör. iyzico sandbox'ın ara sıra TLS bağlantısını sıfırlaması), sipariş
  // "pending" durumda askıda kalmasın diye burada da payment-failed olarak
  // işaretlenip müşteriye anlaşılır bir hata döndürülür - checkout.routes.ts
  // sadece PaymentInitError'ı 502 olarak yakalıyor, ham ağ hatası genel
  // "Sunucu hatası" 500'üne düşerdi.
  let iyzicoResult;
  try {
    iyzicoResult = await initializeCheckoutForm({
      locale: "tr",
      conversationId: randomUUID(),
      price: subtotal.toFixed(2),
      paidPrice: total.toFixed(2),
      currency: "TRY",
      basketId: order.orderNumber,
      paymentGroup: "PRODUCT",
      callbackUrl: `${env.SITE_URL}/api/payment-callback`,
      buyer: {
        id: String(customer.id),
        name: firstName || shippingAddress.fullName,
        surname: rest.join(" ") || "-",
        gsmNumber: shippingAddress.phone,
        email: customer.email,
        // Sandbox test akışı için sabit değer - gerçek TC Kimlik No toplama
        // alanı, canlıya geçiş öncesi checkout formuna eklenmeli.
        identityNumber: "11111111111",
        registrationAddress: shippingAddress.addressLine,
        city: shippingAddress.city,
        country: "Turkey",
        ip: "127.0.0.1",
      },
      shippingAddress: {
        contactName: shippingAddress.fullName,
        city: shippingAddress.city,
        country: "Turkey",
        address: `${shippingAddress.district}, ${shippingAddress.addressLine}`,
      },
      billingAddress: {
        contactName: shippingAddress.fullName,
        city: shippingAddress.city,
        country: "Turkey",
        address: `${shippingAddress.district}, ${shippingAddress.addressLine}`,
      },
      basketItems: items.map((item) => ({
        id: String(item.productId),
        name: item.productNameSnapshot,
        category1: "Giyim",
        itemType: "PHYSICAL",
        price: item.total,
      })),
    });
  } catch {
    await markOrderPaymentFailed(order.id);
    throw new PaymentInitError("Ödeme sağlayıcısına ulaşılamadı, lütfen birazdan tekrar deneyin");
  }

  if (iyzicoResult.status !== "success") {
    await markOrderPaymentFailed(order.id);
    throw new PaymentInitError(iyzicoResult.errorMessage ?? "Ödeme başlatılamadı");
  }

  await setOrderPaymentRef(order.id, iyzicoResult.token);

  return {
    orderNumber: order.orderNumber,
    checkoutFormContent: iyzicoResult.checkoutFormContent,
  };
}

export async function handlePaymentCallback(app: FastifyInstance, token: string) {
  const result = await retrieveCheckoutForm(token);
  const order = await findOrderByPaymentRef(token);
  if (!order) return null;

  if (result.paymentStatus === "SUCCESS") {
    if (!isVerifiedSuccessfulPayment(result, order)) {
      app.log.warn({ orderId: order.id }, "Payment provider result did not match the pending order");
      return { orderNumber: order.orderNumber, success: false };
    }

    const transitioned = await markOrderPaid(order.id);
    if (!transitioned) {
      return { orderNumber: order.orderNumber, success: order.paymentStatus === "paid" };
    }

    // Satın alma, en güçlü davranışsal sinyal (bkz. discovery servisi
    // ağırlıkları) - her sipariş kalemi için ayrı bir event yayınlanır,
    // genel bir "sipariş tamamlandı" event'i yerine (plan §4).
    const items = await findOrderItemsWithProductInfo(order.id);
    for (const item of items) {
      emitBehavioralEvent(app, {
        type: "purchase",
        customerId: order.customerId,
        productId: item.productId,
        vendorId: item.vendorId,
        categoryId: item.categoryId,
      });
    }

    // Her satıcıya (bir sipariş birden fazla satıcıya yayılabildiği için
    // tekilleştirilmiş) yeni sipariş bildirimi düşer.
    const vendorIds = [...new Set(items.map((i) => i.vendorId))];
    await Promise.all(
      vendorIds.map((vendorId) =>
        createNotification(vendorId, "new_order", "Yeni Sipariş", `#${order.orderNumber} numaralı yeni bir siparişiniz var.`, "/satici/panel/siparisler"),
      ),
    );

    return { orderNumber: order.orderNumber, success: true };
  }
  const transitioned = await markOrderPaymentFailed(order.id);
  return {
    orderNumber: order.orderNumber,
    success: !transitioned && order.paymentStatus === "paid",
  };
}
