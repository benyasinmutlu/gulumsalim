import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import type { FastifyInstance } from "fastify";
import { env } from "../../config/env";
import { emitBehavioralEvent } from "../analytics/events.client";
import { recordContentEvent } from "../analytics/content-analytics.repository";
import { createGuestCustomer, findCustomerByEmail, findCustomerById, updateGuestCustomerContact } from "../auth/auth.repository";
import { createAddress, listAddressesByCustomer } from "../customers/customer-addresses.repository";
import { hydrateCart } from "../cart/cart.service";
import { createNotification } from "../notifications/notifications.repository";
import { emailButton, emailDivider, emailHeading, emailProductRow, renderEmailLayout, sendMail } from "../../lib/mailer";
import type { CartLine } from "../cart/cart.types";
import type { ShippingAddress } from "./checkout.schemas";
import { renderDistanceSalesContract, type ContractVendorBlock } from "./contract-template";
import { initializeCheckoutForm, retrieveCheckoutForm, verifyCheckoutFormSignature } from "./iyzico.client";
import {
  createOrder,
  fetchProductsForCheckout,
  fetchVendorsForCheckout,
  findOrderByPaymentRef,
  findOrderItemsForDetail,
  findOrderItemsForPayment,
  findOrderItemsWithProductInfo,
  InsufficientStockError,
  markOrderPaid,
  markOrderPaymentFailed,
  setOrderPaymentRef,
} from "./order.repository";
import { isVerifiedSuccessfulPayment, verifyPaymentItemTransactions } from "./order-security";
import { recordCouponRedemption } from "./coupon.repository";
import { createOrderAccessToken } from "./order-access-token";
import { resolveCheckoutTotals } from "./checkout-totals";

export { InsufficientStockError };

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

// Sepetten Mesafeli Satış Sözleşmesi için satıcı bloklarını üretir - hem
// gerçek checkout hem önizleme (previewContract) AYNI fonksiyonu kullanır,
// böylece gösterilenle DB'ye yazılan snapshot birebir aynı olur.
async function buildContractVendorBlocks(
  items: Array<{ vendorId: number; productNameSnapshot: string; unitPrice: string; quantity: number; total: string }>,
): Promise<ContractVendorBlock[]> {
  const vendorIds = [...new Set(items.map((i) => i.vendorId))];
  const vendorRows = await fetchVendorsForCheckout(vendorIds);
  const vendorMap = new Map(vendorRows.map((v) => [v.id, v]));
  return vendorIds.map((vendorId) => {
    const vendorItems = items.filter((i) => i.vendorId === vendorId);
    const vendor = vendorMap.get(vendorId);
    const lineTotal = vendorItems.reduce((sum, i) => sum + Number(i.total), 0).toFixed(2);
    return {
      vendorId,
      storeName: vendor?.storeName ?? "—",
      legalName: vendor ? (vendor.vendorType === "individual" ? vendor.fullName : vendor.storeName) : "—",
      taxId: vendor?.taxId ?? null,
      legalAddress: vendor?.legalAddress ?? null,
      items: vendorItems.map((i) => ({
        productNameSnapshot: i.productNameSnapshot,
        unitPrice: i.unitPrice,
        quantity: i.quantity,
        total: i.total,
      })),
      lineTotal,
    };
  });
}

// Sepet + adres bilgisiyle, sipariş oluşturmadan Mesafeli Satış Sözleşmesi
// önizlemesi üretir. ÖNEMLİ: resolveCustomerId'yi ÇAĞIRMAZ - o fonksiyon
// misafir akışında createGuestCustomer ile DB'ye yazıyor (satır ~50); bu
// önizleme her açılışta çalıştığı için (kullanıcı formu açıp kapatabilir,
// henüz sipariş vermemiş olabilir) o yan etkiyi tetiklerse boş misafir
// hesapları birikir. Bunun yerine oturum açıksa var olan müşterinin
// e-postasını salt-okunur okur, değilse body'deki email'i doğrudan
// görüntüleme metnine koyar.
export async function previewContract(
  sessionCustomerId: number | undefined,
  cart: CartLine[],
  shippingAddress: ShippingAddress,
  email?: string,
  couponCode?: string,
) {
  if (cart.length === 0) throw new EmptyCartError();

  let buyerEmail = email;
  if (sessionCustomerId) {
    const customer = await findCustomerById(sessionCustomerId);
    buyerEmail = customer?.email ?? email;
  }
  if (!buyerEmail) throw new GuestEmailRequiredError();

  const hydrated = await hydrateCart(cart);
  if (hydrated.items.length === 0 || hydrated.items.length !== cart.length) {
    throw new UnavailableItemsError();
  }

  const productIds = [...new Set(cart.map((c) => c.productId))];
  const productRows = await fetchProductsForCheckout(productIds);
  const productMap = new Map(productRows.map((p) => [p.id, p]));

  const totals = await resolveCheckoutTotals(hydrated.items, productMap, couponCode, sessionCustomerId);

  const items = hydrated.items.map((item) => {
    const product = productMap.get(item.productId);
    if (!product) throw new UnavailableItemsError();
    return {
      vendorId: product.vendorId,
      productNameSnapshot: item.productName,
      unitPrice: item.unitPrice,
      quantity: item.quantity,
      total: item.lineTotal,
    };
  });

  const vendorBlocks = await buildContractVendorBlocks(items);

  return renderDistanceSalesContract({
    buyer: {
      fullName: shippingAddress.fullName,
      phone: shippingAddress.phone,
      email: buyerEmail,
      city: shippingAddress.city,
      district: shippingAddress.district,
      addressLine: shippingAddress.addressLine,
    },
    vendorBlocks,
    subtotal: totals.subtotal.toFixed(2),
    shippingFee: totals.shippingFee.toFixed(2),
    couponCode: totals.couponCode,
    discountAmount: totals.discountAmount.toFixed(2),
    total: totals.total.toFixed(2),
    date: new Date(),
  });
}

export async function startCheckout(
  sessionCustomerId: number | undefined,
  cart: CartLine[],
  shippingAddress: ShippingAddress,
  email?: string,
  orderNote?: string,
  contractAccepted?: boolean,
  couponCode?: string,
  identityNumber?: string,
  buyerIp?: string,
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

  const { subtotal, shippingFee, discountAmount, total, couponId, couponCode: appliedCouponCode, campaignId } =
    await resolveCheckoutTotals(hydrated.items, productMap, couponCode, customerId);
  const orderNumber = `GS${Date.now()}${Math.floor(Math.random() * 1000)}`;

  const items = hydrated.items.map((item) => {
    const product = productMap.get(item.productId);
    if (!product) throw new UnavailableItemsError();
    return {
      vendorId: product.vendorId,
      productId: item.productId,
      paymentItemRef: randomUUID(),
      variantId: item.variantId,
      productNameSnapshot: item.productName,
      unitPrice: item.unitPrice,
      quantity: item.quantity,
      total: item.lineTotal,
    };
  });

  const customer = await findCustomerById(customerId);
  if (!customer) throw new Error("Müşteri bulunamadı");

  const vendorBlocks = await buildContractVendorBlocks(items);
  const contractSnapshot = renderDistanceSalesContract({
    buyer: {
      fullName: shippingAddress.fullName,
      phone: shippingAddress.phone,
      email: customer.email,
      city: shippingAddress.city,
      district: shippingAddress.district,
      addressLine: shippingAddress.addressLine,
    },
    vendorBlocks,
    subtotal: subtotal.toFixed(2),
    shippingFee: shippingFee.toFixed(2),
    couponCode: appliedCouponCode,
    discountAmount: discountAmount.toFixed(2),
    total: total.toFixed(2),
    orderNumber,
    date: new Date(),
  });

  const { order } = await createOrder({
    customerId,
    orderNumber,
    subtotal: subtotal.toFixed(2),
    shippingFee: shippingFee.toFixed(2),
    couponId: couponId ?? undefined,
    campaignId: campaignId ?? undefined,
    discountAmount: discountAmount.toFixed(2),
    total: total.toFixed(2),
    shippingAddress,
    orderNote,
    items,
    contractSnapshot,
    contractAcceptedAt: contractAccepted ? new Date() : undefined,
  });

  // bkz. kullanıcı isteği: "adres bilgisi yoksa oraya yazdığı adresi
  // kaydettirelim" - sadece GERÇEKTEN giriş yapmış hesaplar için (misafir
  // sipariş sırasında oluşturulan customerId'ler DEĞİL, bkz. resolveCustomerId),
  // ve sadece hiç kayıtlı adresi yoksa (varsa zaten ödeme sayfasında
  // ön-doluyor, tekrar yazıp adres çoğaltmamak için dokunulmuyor).
  if (sessionCustomerId) {
    listAddressesByCustomer(sessionCustomerId)
      .then((existing) => {
        if (existing.length === 0) {
          return createAddress(sessionCustomerId, { ...shippingAddress, isDefault: true });
        }
      })
      .catch(() => {});
  }

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
      enabledInstallments: [1],
      callbackUrl: `${env.SITE_URL}/api/payment-callback`,
      buyer: {
        id: String(customer.id),
        name: firstName || shippingAddress.fullName,
        surname: rest.join(" ") || "-",
        gsmNumber: shippingAddress.phone,
        email: customer.email,
        identityNumber,
        registrationAddress: shippingAddress.addressLine,
        city: shippingAddress.city,
        country: "Turkey",
        ip: buyerIp,
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
        id: item.paymentItemRef,
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

  // İdempotentlik: iyzico aynı token için callback'i birden fazla kez
  // tetikleyebilir (kullanıcı /siparis-sonucu'nu yenilerse tarayıcı formu
  // yeniden POST'layabilir de). Sipariş zaten "paid" ise satış event'lerini
  // ve satıcı bildirimlerini tekrar üretmeden doğrudan başarı dönülür -
  // markOrderPaymentFailed'daki aynı garantinin ödenmiş sipariş karşılığı.
  // bkz. kullanıcı isteği: "ödeme bekleniyor veya ödeme başarısız olunca
  // siparişlerde listeleme sepette kalmaya devam etsin ürünler" - sepetten
  // çıkarma artık burada (ödeme GERÇEKTEN başarılı olunca), checkout.routes.ts
  // POST /checkout'ta DEĞİL - önceden sipariş oluşturulur oluşturulmaz
  // (iyzico'ya daha gitmeden) sepet boşaltılıyordu, ödeme başarısız olsa
  // bile geri gelmiyordu. Satın alınan satırları tanımlamak için sipariş
  // kalemleri kullanılır (bkz. cart.service.ts lineKey ile aynı anahtar).
  async function getPurchasedLines(orderId: number) {
    const orderItemsList = await findOrderItemsWithProductInfo(orderId);
    return orderItemsList.map((i) => ({ productId: i.productId, variantId: i.variantId ?? undefined }));
  }

  if (order.paymentStatus === "paid") {
    return { orderNumber: order.orderNumber, success: true, purchasedLines: await getPurchasedLines(order.id) };
  }

  if (result.paymentStatus === "SUCCESS") {
    // Callback tutar + token doğrulaması: iyzico'dan server-to-server alınan
    // sonuç, siparişin paymentRef'i/numarası ve tutarlarıyla (BigInt kuruş)
    // birebir eşleşmeli. Tamper edilmiş/yanlış-tutarlı "success" reddedilir.
    const paymentItems = verifyPaymentItemTransactions(result.itemTransactions, await findOrderItemsForPayment(order.id));
    if (!verifyCheckoutFormSignature(result) || !paymentItems || !isVerifiedSuccessfulPayment(result, order)) {
      app.log.warn({ orderId: order.id }, "Ödeme sağlayıcı sonucu bekleyen siparişle eşleşmedi");
      return { orderNumber: order.orderNumber, success: false };
    }

    // Koşullu geçiş (pending -> paid) yalnız BİR çağrıda başarılı olur;
    // event/bildirim üretimi buna bağlanır → eşzamanlı/tekrarlı callback'te
    // satın alma event'leri ve satıcı bildirimleri tekrar üretilmez.
    const transitioned = await markOrderPaid(order.id, result.paymentId, paymentItems);
    if (!transitioned) {
      const current = await findOrderByPaymentRef(token);
      if (current?.paymentStatus === "paid") {
        return { orderNumber: order.orderNumber, success: true, purchasedLines: await getPurchasedLines(order.id) };
      }
      app.log.warn({ orderId: order.id, paymentStatus: current?.paymentStatus }, "Ödeme başarı geçişi başka bir durum tarafından kazanıldı");
      return { orderNumber: order.orderNumber, success: false };
    }

    // Kupon kullanımı SADECE ödeme gerçekten başarılı olunca sayılır (vendor
    // earnings/behavioral event'lerle aynı prensip) - ödeme başarısız/askıda
    // kalan bir siparişte müşterinin tek kullanımlık kuponu boşa yanmaz.
    if (order.couponId) {
      await recordCouponRedemption(order.couponId, order.customerId, order.id).catch((err) =>
        app.log.warn({ err, orderId: order.id }, "Kupon kullanım kaydı oluşturulamadı"),
      );
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
      recordContentEvent("product", item.productId, "purchase", item.quantity).catch(() => {});
    }

    // bkz. kullanıcı isteği: "kargo sipariş şifre ... gibi mailler
    // gönderelim" - ödeme gerçekten başarılı olunca müşteriye sipariş
    // onayı e-postası gider. E-posta gönderimi başarısız olursa (ör. geçici
    // Resend hatası) ödeme akışını bozmasın diye hata yutulur, sadece
    // loglanır - sipariş zaten "paid" olarak işaretlendi.
    const orderCustomer = await findCustomerById(order.customerId);
    if (orderCustomer) {
      const orderItemsDetail = await findOrderItemsForDetail(order.id);
      const itemsHtml = orderItemsDetail
        .map((i) =>
          emailProductRow({
            image: i.productImage,
            name: i.productNameSnapshot,
            meta: `${i.vendorStoreName} · ${i.quantity} adet`,
            priceHtml: `<strong>${Number(i.total).toLocaleString("tr-TR", { minimumFractionDigits: 2 })} ₺</strong>`,
            href: `/urun/${i.productSlug}`,
          }),
        )
        .join("");
      const trackHref = orderCustomer.isGuest
        ? `${env.SITE_URL}/siparis-sonucu?order=${encodeURIComponent(order.orderNumber)}&success=true&access=${createOrderAccessToken(order.orderNumber)}`
        : `${env.SITE_URL}/hesabim/siparisler/${order.orderNumber}`;
      const body =
        emailHeading("Siparişiniz Alındı! 🎉") +
        `<p>Merhaba ${orderCustomer.fullName},</p>` +
        `<p><strong>#${order.orderNumber}</strong> numaralı siparişiniz alındı ve ödemeniz onaylandı. Ürünleriniz en kısa sürede hazırlanıp kargoya verilecek.</p>` +
        emailDivider() +
        itemsHtml +
        emailDivider() +
        `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="font-size:16px;font-weight:700;text-align:right;">Toplam: ${Number(order.total).toLocaleString("tr-TR", { minimumFractionDigits: 2 })} ₺</td></tr></table>` +
        emailButton(trackHref, "Siparişimi Takip Et");
      await sendMail(orderCustomer.email, `Siparişiniz Alındı - #${order.orderNumber}`, renderEmailLayout(`Siparişiniz onaylandı - #${order.orderNumber}`, body)).catch(
        (err) => app.log.warn({ err, orderId: order.id }, "Sipariş onayı e-postası gönderilemedi"),
      );
    }

    // Her satıcıya (bir sipariş birden fazla satıcıya yayılabildiği için
    // tekilleştirilmiş) yeni sipariş bildirimi düşer.
    const vendorIds = [...new Set(items.map((i) => i.vendorId))];
    await Promise.all(
      vendorIds.map((vendorId) =>
        createNotification(vendorId, "new_order", "Yeni Sipariş", `#${order.orderNumber} numaralı yeni bir siparişiniz var.`, "/satici/panel/siparisler"),
      ),
    );

    return { orderNumber: order.orderNumber, success: true, purchasedLines: items.map((i) => ({ productId: i.productId, variantId: i.variantId ?? undefined })) };
  }
  await markOrderPaymentFailed(order.id);
  return { orderNumber: order.orderNumber, success: false };
}
