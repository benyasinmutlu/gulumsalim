import { pgEnum } from "drizzle-orm/pg-core";

export const vendorStatusEnum = pgEnum("vendor_status", [
  "pending",
  "active",
  "suspended",
  "banned",
  // bkz. kullanıcı isteği (2026-08-02): "satıcı üyelik iptali olacak" -
  // "banned"tan farklı: kendi isteğiyle kapatılmış, cezai değil (bkz.
  // vendor-auth.service.ts closeVendorAccount).
  "closed",
]);

// bkz. kullanıcı isteği: "bireysel olarak müşteri olarak kayıt olan
// kişilerde satış yapabilsin 2. el ürün letgo dolap gibi" - normal
// (kurumsal) satıcı başvurusundan ayrı, bir müşteri hesabından anında
// açılan bireysel/2. el satıcı tipini ayırt eder.
export const vendorTypeEnum = pgEnum("vendor_type", [
  "business",
  "individual",
]);

// bkz. olay: 2026-08-02 "bireysel satıcıların ürünleri yayınlanması için
// onaylanması gerekiyor adminden" - "pending", bireysel satıcının
// sihirbazda Yayınla'ya bastığı (ya da reddedilen/pasif bir ürünü tekrar
// gönderdiği) andan admin onaylayana kadarki ara durum. Kurumsal
// satıcılarda bu durum hiç kullanılmaz - onlar hâlâ doğrudan aktif edebilir.
export const productStatusEnum = pgEnum("product_status", [
  "draft",
  "pending",
  "active",
  "inactive",
  "rejected",
]);

// bkz. denetim raporu madde 5: ürün kondisyonu artık serbest metin
// (attributes jsonb) değil, yapılandırılmış ve zorunlu bir alan.
export const productConditionEnum = pgEnum("product_condition", [
  "new_with_tags",
  "new_without_tags",
  "very_good",
  "good",
  "used",
]);

export const reviewStatusEnum = pgEnum("review_status", [
  "pending",
  "approved",
  "rejected",
]);

export const orderStatusEnum = pgEnum("order_status", [
  "pending",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
  "refunded",
]);

export const paymentStatusEnum = pgEnum("payment_status", [
  "pending",
  "paid",
  "failed",
  "refunded",
]);

export const payoutStatusEnum = pgEnum("payout_status", [
  "pending",
  "paid",
  "rejected",
]);

export const refundStatusEnum = pgEnum("refund_status", [
  "pending",
  "approved",
  "rejected",
]);

// order_refunds.status icin ozel enum - promo_banners.status'un kullandigi
// refundStatusEnum ile KARISTIRILMAMALI (ikisi ayni degerlerle basladi ama
// anlamca ilgisiz iki kavram, bkz. kullanici istegi: iade akisi satici
// onayi + fiziksel teslim alma + admin para iadesi asamalarindan geciyor).
// pending: musteri talep etti, satici karar bekliyor
// approved: satici onayladi, musteri urunu geri gondermeyi bekliyor
// rejected: satici reddetti (bitis durumu)
// item_received: satici urunu fiziksel olarak geri aldigini onayladi
// refunded: admin musteriye parayi gercekten iade etti (bitis durumu)
export const orderRefundStatusEnum = pgEnum("order_refund_status", [
  "pending",
  "approved",
  "rejected",
  "item_received",
  "refunding",
  "refunded",
]);

export const messageSenderEnum = pgEnum("message_sender", [
  "admin",
  "vendor",
]);

export const customerMessageSenderEnum = pgEnum("customer_message_sender", [
  "customer",
  "vendor",
]);

export const complaintStatusEnum = pgEnum("complaint_status", [
  "pending",
  "reviewed",
  "dismissed",
]);

export const sectionAlgoEnum = pgEnum("section_algo", [
  "manual",
  "vendor_carousel",
  "vendor_products",
  "promo_banners",
  "recently_viewed",
  "related_viewed",
  "trending",
  "discover_personalized",
  "new_arrivals",
  "featured",
  "best_sellers",
  "weekly_best",
  // bkz. kullanıcı isteği: gerçek bitiş zamanına sayan geri sayımlı
  // "Flaş İndirimler" bölümü (bkz. homepage-sections.service.ts
  // SectionConfig.endsAt).
  "flash_sale",
  // bkz. kullanıcı isteği (2026-08-02): admin panelinden kategori bazlı
  // vitrin bölümü oluşturulabilsin (bkz. SectionConfig.categoryId/saleOnly).
  "category",
]);

// bkz. kullanıcı isteği: "kupon kodu... admin panelde kontrol edebilelim" -
// yüzde (ör. %10) ya da sabit tutar (ör. 100 TL) indirim.
export const couponTypeEnum = pgEnum("coupon_type", ["percent", "fixed"]);

export const campaignTypeEnum = pgEnum("campaign_type", ["percent", "free_shipping"]);
export const campaignScopeEnum = pgEnum("campaign_scope", ["all", "category", "vendor", "product"]);

// bkz. kargo/PTT denetim raporu Faz 2 (2026-09-10): Shipment (bir siparişte
// belirli bir satıcının müşteriye gönderdiği fiziksel gönderi), orderItems.
// vendorStatus'tan KASITLI OLARAK ayrı bir durum kümesi - PTT/taşıyıcı API'si
// henüz yok, bu yüzden taşıyıcıdan gelecek GERÇEK durumlar (in_transit,
// out_for_delivery, label_created vb.) BİLİNÇLİ OLARAK eklenmedi. "created":
// shipment kaydı oluştu ama henüz hiçbir kalemi kargoya verilmedi. "shipped":
// en az bir kalemi kargoya verildi. "delivered": tüm (iptal olmayan)
// kalemleri teslim edildi. "cancelled": tüm kalemleri iptal oldu. Bu enum
// büyüyecek (Faz 3+, gerçek taşıyıcı entegrasyonu ile) ama şimdiden
// taşıyıcıya özgü durum uydurulmadı.
export const shipmentStatusEnum = pgEnum("shipment_status", ["created", "shipped", "delivered", "cancelled"]);

// Gidiş (satıcı->müşteri) / dönüş (müşteri->satıcı, iade) gönderisi ayrımı.
// Bu faz SADECE "outbound" üretir - return shipment akışı (order_refunds.
// returnTrackingCarrier/Number ile ayrı yürüyen mevcut iade sistemi) bu
// fazda BİLİNÇLİ OLARAK Shipment'a bağlanmadı, ileride ayrı ele alınacak.
// Alan şimdiden açıldı ki o faz geldiğinde şema değişikliği gerekmesin.
export const shipmentDirectionEnum = pgEnum("shipment_direction", ["outbound", "return"]);
