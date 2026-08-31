import type { Redis } from "ioredis";
import type { FastifyBaseLogger } from "fastify";
import { and, desc, eq, isNotNull } from "drizzle-orm";
import { db } from "../../db/client";
import { customers } from "../../db/schema/customers";
import { productFavorites, productImages, products } from "../../db/schema/catalog";
import { env } from "../../config/env";
import { emailButton, emailHeading, emailProductRow, renderEmailLayout, sendMail } from "../../lib/mailer";
import { hydrateCart } from "../cart/cart.service";
import type { CartLine } from "../cart/cart.types";
import type { Session } from "fastify";
import { createCustomerNotification } from "./customer-notifications.repository";

// bkz. kullanıcı isteği: "sepetteki ürünleri hatırlatma ve favoriler
// müşteriye özel ürünler gibi mailler gönderelim". Bu ikisi de pazarlama
// niteliğinde (sipariş/kargo/şifre gibi zorunlu işlemsel e-postalar
// DEĞİL) - bu yüzden SADECE "Ticari Elektronik İleti Onayı"nı vermiş
// (marketingConsentAt dolu) müşterilere gönderilir. Bir sepet için en
// fazla BİR kez hatırlatma gider (bkz. session.cartReminderSentAt),
// tekrar tekrar spam edilmez.

// bkz. plugins/redis-session-store.ts - oturumlar "sess:<id>" anahtarında
// düz JSON.stringify(session) olarak saklanıyor, doğrudan okunabilir/
// yazılabilir. TÜM anahtar uzayını tek seferde KEYS ile taramak yerine
// SCAN kullanılır - bu site ölçeğinde bile bloklamamak için doğru pratik.
async function scanSessionKeys(redis: Redis): Promise<string[]> {
  const keys: string[] = [];
  let cursor = "0";
  do {
    const [nextCursor, batch] = await redis.scan(cursor, "MATCH", "sess:*", "COUNT", 200);
    cursor = nextCursor;
    keys.push(...batch);
  } while (cursor !== "0");
  return keys;
}

export async function sendCartAbandonmentReminders(redis: Redis, log: FastifyBaseLogger) {
  const keys = await scanSessionKeys(redis);
  const remindedCustomerIds = new Set<number>();
  let sent = 0;

  for (const key of keys) {
    const raw = await redis.get(key);
    if (!raw) continue;
    let session: Session & { cart?: CartLine[]; customerId?: number; cartReminderSentAt?: string };
    try {
      session = JSON.parse(raw);
    } catch {
      continue;
    }

    if (!session.customerId || !session.cart || session.cart.length === 0) continue;
    if (session.cartReminderSentAt) continue;
    if (remindedCustomerIds.has(session.customerId)) continue;

    const customer = await db.select().from(customers).where(eq(customers.id, session.customerId)).limit(1).then((r) => r[0]);
    if (!customer || customer.isGuest || !customer.marketingConsentAt) continue;

    const hydrated = await hydrateCart(session.cart);
    if (hydrated.items.length === 0) continue;

    const itemsHtml = hydrated.items
      .map((i) =>
        emailProductRow({
          image: i.image,
          name: i.productName,
          meta: `${i.quantity} adet`,
          priceHtml: `<strong>${Number(i.lineTotal).toLocaleString("tr-TR", { minimumFractionDigits: 2 })} ₺</strong>`,
        }),
      )
      .join("");

    try {
      const body =
        emailHeading("Sepetiniz Sizi Bekliyor 🛍️") +
        `<p>Merhaba ${customer.fullName},</p>` +
        `<p>Sepetinizde tamamlanmayı bekleyen ürünler var:</p>` +
        itemsHtml +
        `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="font-size:16px;font-weight:700;text-align:right;padding-top:8px;">Toplam: ${Number(hydrated.subtotal).toLocaleString("tr-TR", { minimumFractionDigits: 2 })} ₺</td></tr></table>` +
        emailButton(`${env.SITE_URL}/sepet`, "Alışverişimi Tamamla");
      await sendMail(customer.email, "Sepetinizde Ürünler Sizi Bekliyor - Gülüm Şalım", renderEmailLayout("Sepetiniz sizi bekliyor", body));
      // bkz. denetim raporu madde 20: "Web/uygulama bildirimi" - önceden bu
      // hatırlatma SADECE e-posta gönderiyordu, hesabım/bildirimler
      // kutusunda hiç görünmüyordu.
      await createCustomerNotification(
        session.customerId,
        "cart_reminder",
        "Sepetinizde ürünler sizi bekliyor",
        `${hydrated.items.length} üründen oluşan sepetiniz tamamlanmayı bekliyor.`,
        "/sepet",
      ).catch(() => {});
      sent += 1;
      remindedCustomerIds.add(session.customerId);
      // Aynı sepet için tekrar tekrar hatırlatma göndermemek adına oturuma
      // işaretleniyor - KEEPTTL, kalan oturum ömrünü değiştirmeden yazar.
      session.cartReminderSentAt = new Date().toISOString();
      await redis.set(key, JSON.stringify(session), "KEEPTTL");
    } catch (err) {
      log.warn({ err, customerId: session.customerId }, "Sepet hatırlatma e-postası gönderilemedi");
    }
  }

  log.info({ sent, scanned: keys.length }, "Sepet hatırlatma e-postaları gönderildi");
  return { sent };
}

const FAVORITES_DIGEST_LIMIT = 6;

export async function sendFavoritesDigest(log: FastifyBaseLogger) {
  const eligibleCustomers = await db
    .select()
    .from(customers)
    .where(and(isNotNull(customers.marketingConsentAt), isNotNull(customers.emailVerifiedAt), eq(customers.isGuest, false)));

  let sent = 0;
  for (const customer of eligibleCustomers) {
    const favorites = await db
      .select({
        name: products.name,
        slug: products.slug,
        basePrice: products.basePrice,
        compareAtPrice: products.compareAtPrice,
        image: productImages.url,
      })
      .from(productFavorites)
      .innerJoin(products, eq(productFavorites.productId, products.id))
      .leftJoin(productImages, and(eq(productImages.productId, products.id), eq(productImages.isPrimary, true)))
      .where(and(eq(productFavorites.customerId, customer.id), eq(products.status, "active")))
      .orderBy(desc(productFavorites.createdAt))
      .limit(FAVORITES_DIGEST_LIMIT);

    if (favorites.length === 0) continue;

    const itemsHtml = favorites
      .map((p) => {
        const onSale = p.compareAtPrice && Number(p.compareAtPrice) > Number(p.basePrice);
        const priceHtml = onSale
          ? `<s style="color:#9B9B9B;">${Number(p.compareAtPrice).toLocaleString("tr-TR", { minimumFractionDigits: 2 })} ₺</s> <strong style="color:#F44336;">${Number(p.basePrice).toLocaleString("tr-TR", { minimumFractionDigits: 2 })} ₺ 🔥</strong>`
          : `<strong>${Number(p.basePrice).toLocaleString("tr-TR", { minimumFractionDigits: 2 })} ₺</strong>`;
        return emailProductRow({ image: p.image, name: p.name, meta: onSale ? "İndirimde!" : "Favorilerinizde", priceHtml, href: `/urun/${p.slug}` });
      })
      .join("");

    try {
      const body =
        emailHeading("Favorileriniz Sizi Bekliyor 💕") +
        `<p>Merhaba ${customer.fullName},</p>` +
        `<p>Favorilerinize eklediğiniz ürünlerden bazıları:</p>` +
        itemsHtml +
        emailButton(`${env.SITE_URL}/hesabim/favoriler`, "Tüm Favorilerim");
      await sendMail(customer.email, "Favorilerinizdeki Ürünler Sizi Bekliyor - Gülüm Şalım", renderEmailLayout("Favorileriniz sizi bekliyor", body));
      sent += 1;
    } catch (err) {
      log.warn({ err, customerId: customer.id }, "Favoriler e-postası gönderilemedi");
    }
  }

  log.info({ sent, eligible: eligibleCustomers.length }, "Favoriler e-postaları gönderildi");
  return { sent };
}
