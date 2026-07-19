import { randomUUID } from "node:crypto";
import { env } from "../../config/env";
import { findCustomerById } from "../auth/auth.repository";
import { hydrateCart } from "../cart/cart.service";
import type { CartLine } from "../cart/cart.types";
import type { ShippingAddress } from "./checkout.schemas";
import { initializeCheckoutForm, retrieveCheckoutForm } from "./iyzico.client";
import {
  createOrder,
  fetchProductsForCheckout,
  findOrderByPaymentRef,
  markOrderPaid,
  markOrderPaymentFailed,
  setOrderPaymentRef,
} from "./order.repository";

const SHIPPING_FEE = 49.9;
const FREE_SHIPPING_THRESHOLD = 500;

export class EmptyCartError extends Error {}
export class UnavailableItemsError extends Error {}
export class PaymentInitError extends Error {}

export async function startCheckout(customerId: number, cart: CartLine[], shippingAddress: ShippingAddress) {
  if (cart.length === 0) throw new EmptyCartError();

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

  const subtotal = Number(hydrated.subtotal);
  const shippingFee = subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FEE;
  const total = subtotal + shippingFee;
  const orderNumber = `GS${Date.now()}${Math.floor(Math.random() * 1000)}`;

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
    items,
  });

  const customer = await findCustomerById(customerId);
  if (!customer) throw new Error("Müşteri bulunamadı");

  const [firstName, ...rest] = shippingAddress.fullName.split(" ");

  const iyzicoResult = await initializeCheckoutForm({
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

export async function handlePaymentCallback(token: string) {
  const result = await retrieveCheckoutForm(token);
  const order = await findOrderByPaymentRef(token);
  if (!order) return null;

  if (result.paymentStatus === "SUCCESS") {
    await markOrderPaid(order.id);
    return { orderNumber: order.orderNumber, success: true };
  }
  await markOrderPaymentFailed(order.id);
  return { orderNumber: order.orderNumber, success: false };
}
