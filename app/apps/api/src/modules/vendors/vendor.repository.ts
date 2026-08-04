import { and, desc, eq, gt, sql } from "drizzle-orm";
import { db } from "../../db/client";
import { orderItems, orderRefunds, products, vendorFollowers, vendorReviews, vendors } from "../../db/schema/index";
import { outer } from "../../lib/sql-helpers";

// Herkese açık mağaza listesi/profili - sadece güvenli alanlar (passwordHash,
// cüzdan bakiyesi, banka bilgisi gibi hassas kolonlar hiç seçilmez).
export async function listActiveVendors() {
  return db
    .select({
      id: vendors.id,
      storeName: vendors.storeName,
      storeSlug: vendors.storeSlug,
      logo: vendors.logo,
      coverImage: vendors.coverImage,
      isVerified: vendors.isVerified,
      createdAt: vendors.createdAt,
      // Postgres COUNT(*) sürücü seviyesinde string döner (bigint hassasiyeti
      // için) - .mapWith(Number) olmadan tip number desin de değer aslında
      // string kalır (bkz. StatsStrip'teki toplama sırasında "00" hatası).
      productCount: sql<number>`(SELECT COUNT(*) FROM ${products} WHERE ${products.vendorId} = ${outer(vendors.id)} AND ${products.status} = 'active')`.mapWith(
        Number,
      ),
      followerCount: sql<number>`(SELECT COUNT(*) FROM ${vendorFollowers} WHERE ${vendorFollowers.vendorId} = ${outer(vendors.id)})`.mapWith(Number),
      avgRating: sql<number | null>`(SELECT AVG(${vendorReviews.rating}) FROM ${vendorReviews} WHERE ${vendorReviews.vendorId} = ${outer(vendors.id)} AND ${vendorReviews.status} = 'approved')`,
    })
    .from(vendors)
    .where(eq(vendors.status, "active"))
    .orderBy(desc(vendors.createdAt));
}

export async function findActiveVendorBySlugPublic(slug: string) {
  const [row] = await db
    .select({
      id: vendors.id,
      storeName: vendors.storeName,
      storeSlug: vendors.storeSlug,
      logo: vendors.logo,
      storeLayout: vendors.storeLayout,
      isVerified: vendors.isVerified,
      vendorType: vendors.vendorType,
      about: vendors.about,
      coverImage: vendors.coverImage,
      city: vendors.city,
      whatsapp: vendors.whatsapp,
      instagram: vendors.instagram,
      facebook: vendors.facebook,
      twitter: vendors.twitter,
      youtube: vendors.youtube,
      tiktok: vendors.tiktok,
      website: vendors.website,
      seoTitle: vendors.seoTitle,
      seoDescription: vendors.seoDescription,
      createdAt: vendors.createdAt,
      productCount: sql<number>`(SELECT COUNT(*) FROM ${products} WHERE ${products.vendorId} = ${outer(vendors.id)} AND ${products.status} = 'active')`.mapWith(
        Number,
      ),
      followerCount: sql<number>`(SELECT COUNT(*) FROM ${vendorFollowers} WHERE ${vendorFollowers.vendorId} = ${outer(vendors.id)})`.mapWith(Number),
      // bkz. kullanıcı isteği (mockup): "Başarılı Satıcı %" - gerçek bir
      // formülle hesaplanır (uydurma bir sayı DEĞİL): teslim edilmiş
      // kalemlerin kaçında GERÇEKTEN parasal iade tamamlanmış (order_refunds.
      // status='refunded'). Yüzde hesabı route katmanında yapılır (bkz.
      // public-vendors.routes.ts) - burada sadece iki ham sayaç.
      deliveredCount: sql<number>`(SELECT COUNT(*) FROM ${orderItems} WHERE ${orderItems.vendorId} = ${outer(vendors.id)} AND ${orderItems.vendorStatus} = 'delivered')`.mapWith(
        Number,
      ),
      // bkz. sql-helpers.ts (outer()) - bu alt sorgu order_items VE
      // order_refunds'ı join ediyor, ikisi de kendi "id" ve "vendor_id"
      // kolonlarına sahip - Drizzle alt sorgu içindeki kolon referanslarını
      // tablo adı olmadan render ettiği için ("ambiguous column" hatası)
      // hem orderItems.id (join koşulu) hem orderItems.vendorId (WHERE)
      // outer() ile tam nitelenmeli; vendors.id ise gerçek dış tablo referansı.
      refundedDeliveredCount: sql<number>`(SELECT COUNT(*) FROM ${orderItems} INNER JOIN ${orderRefunds} ON ${orderRefunds.orderItemId} = ${outer(orderItems.id)} WHERE ${outer(orderItems.vendorId)} = ${outer(vendors.id)} AND ${orderItems.vendorStatus} = 'delivered' AND ${orderRefunds.status} = 'refunded')`.mapWith(
        Number,
      ),
    })
    .from(vendors)
    .where(and(eq(vendors.storeSlug, slug), eq(vendors.status, "active")))
    .limit(1);
  return row ?? null;
}

// bkz. catalog.repository.ts incrementProductViewCount ile aynı desen -
// kullanıcı isteği (mockup): satıcı/admin panelinde mağaza ziyaretçi sayacı.
export async function incrementVendorViewCount(vendorId: number) {
  await db.update(vendors).set({ storeViewCount: sql`${vendors.storeViewCount} + 1` }).where(eq(vendors.id, vendorId));
}

// vendor/store.php (mağaza profili) formu için tüm düzenlenebilir alanlar -
// hassas olmayan tüm kolonlar. Şifre/bakiye ayrı fonksiyonlarla yönetiliyor.
export async function updateVendorProfile(
  vendorId: number,
  data: Partial<{
    storeName: string;
    fullName: string;
    phone: string;
    about: string;
    logo: string;
    coverImage: string;
    city: string;
    whatsapp: string;
    instagram: string;
    facebook: string;
    twitter: string;
    youtube: string;
    tiktok: string;
    website: string;
    seoTitle: string;
    seoDescription: string;
    bankName: string;
    bankIban: string;
    bankAccountHolder: string;
    taxId: string;
    legalAddress: string;
    passwordHash: string;
  }>,
) {
  const [row] = await db.update(vendors).set(data).where(eq(vendors.id, vendorId)).returning();
  if (!row) throw new Error("Satıcı bulunamadı");
  return row;
}

export async function findVendorByEmail(email: string) {
  const [row] = await db.select().from(vendors).where(eq(vendors.email, email)).limit(1);
  return row ?? null;
}

export async function findVendorBySlug(slug: string) {
  const [row] = await db.select().from(vendors).where(eq(vendors.storeSlug, slug)).limit(1);
  return row ?? null;
}

export async function findVendorById(id: number) {
  const [row] = await db.select().from(vendors).where(eq(vendors.id, id)).limit(1);
  return row ?? null;
}

export async function findVendorAccessStatus(id: number) {
  const [row] = await db
    .select({ status: vendors.status })
    .from(vendors)
    .where(eq(vendors.id, id))
    .limit(1);
  return row?.status ?? null;
}

export async function createVendor(data: {
  storeName: string;
  storeSlug: string;
  email: string;
  passwordHash: string;
  fullName: string;
  phone?: string;
  taxId?: string;
  legalAddress?: string;
  vendorConsentAt?: Date;
}) {
  const [row] = await db.insert(vendors).values(data).returning();
  if (!row) throw new Error("Satıcı oluşturulamadı");
  return row;
}

// bkz. vendor-auth.service.ts registerVendor - doğrulama e-postası
// gönderimi başarısız olursa az önce oluşturulan hesap geri alınır
// (bkz. auth.repository.ts deleteCustomer ile aynı gerekçe).
export async function deleteVendor(id: number) {
  await db.delete(vendors).where(eq(vendors.id, id));
}

// bkz. kullanıcı isteği: "bireysel olarak müşteri olarak kayıt olan
// kişilerde satış yapabilsin 2. el ürün letgo dolap gibi" - normal
// (kurumsal) başvurudan farklı olarak admin onayı BEKLEMEDEN "active"
// durumunda açılır (Dolap/Letgo'nun anında satıcı olma deneyimine en
// yakını, bkz. vendor-auth.service.ts becomeIndividualSeller), ve
// customerId ile açıldığı müşteri hesabına geri bağlanır.
export async function createIndividualVendor(data: {
  storeName: string;
  storeSlug: string;
  email: string;
  passwordHash: string;
  fullName: string;
  phone?: string;
  customerId: number;
  taxId?: string;
  legalAddress?: string;
  vendorConsentAt?: Date;
}) {
  const [row] = await db
    .insert(vendors)
    .values({ ...data, status: "active", vendorType: "individual" })
    .returning();
  if (!row) throw new Error("Bireysel satıcı hesabı oluşturulamadı");
  return row;
}

export async function findVendorByCustomerId(customerId: number) {
  const [row] = await db.select().from(vendors).where(eq(vendors.customerId, customerId)).limit(1);
  return row ?? null;
}

// "Şifremi Unuttum" akışı - bkz. auth.repository.ts customer eşdeğeri.
export async function setVendorResetToken(id: number, tokenHash: string, expiresAt: Date) {
  await db.update(vendors).set({ passwordResetTokenHash: tokenHash, passwordResetExpiresAt: expiresAt }).where(eq(vendors.id, id));
}

export async function findVendorByValidResetToken(tokenHash: string) {
  const [row] = await db
    .select()
    .from(vendors)
    .where(and(eq(vendors.passwordResetTokenHash, tokenHash), gt(vendors.passwordResetExpiresAt, new Date())))
    .limit(1);
  return row ?? null;
}

export async function clearVendorResetToken(id: number) {
  await db.update(vendors).set({ passwordResetTokenHash: null, passwordResetExpiresAt: null }).where(eq(vendors.id, id));
}

// E-posta doğrulama - passwordReset* alan çiftiyle birebir aynı desen.
export async function setVendorEmailVerificationToken(id: number, tokenHash: string, expiresAt: Date) {
  await db.update(vendors).set({ emailVerificationTokenHash: tokenHash, emailVerificationExpiresAt: expiresAt }).where(eq(vendors.id, id));
}

export async function findVendorByValidEmailVerificationToken(tokenHash: string) {
  const [row] = await db
    .select()
    .from(vendors)
    .where(and(eq(vendors.emailVerificationTokenHash, tokenHash), gt(vendors.emailVerificationExpiresAt, new Date())))
    .limit(1);
  return row ?? null;
}

export async function markVendorEmailVerified(id: number) {
  await db
    .update(vendors)
    .set({ emailVerifiedAt: new Date(), emailVerificationTokenHash: null, emailVerificationExpiresAt: null })
    .where(eq(vendors.id, id));
}

// bkz. kullanıcı isteği (2026-08-02): "satıcı üyelik iptali olacak" - bir
// müşteriye teslim edilmemiş/tamamlanmamış siparişi varken satıcı hesabını
// kapatamaz (müşteri mağdur olmasın diye) - admin_vendors.repository.ts'teki
// aynı ürün-say/sil deseninin sipariş karşılığı.
export async function countOpenOrderItemsForVendor(vendorId: number): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)`.mapWith(Number) })
    .from(orderItems)
    .where(and(eq(orderItems.vendorId, vendorId), sql`${orderItems.vendorStatus} IN ('pending', 'processing', 'shipped')`));
  return row?.count ?? 0;
}

// Ürünü olan (dolayısıyla admin_vendors.repository.ts deleteVendorIfNoProducts
// ile kalıcı silinemeyen) bir satıcının kendi isteğiyle hesabını kapatması -
// "banned" ile KARIŞTIRILMAMALI (cezai değil). Vergi/ticari kayıtlar (taxId,
// legalAddress, walletBalance geçmişi) KASITLI OLARAK dokunulmadan bırakılır -
// KVKK kişisel veri anonimleştirmesi, ticari/muhasebe saklama yükümlülüğünü
// geçersiz kılmaz. Tüm aktif ürünleri de pasife alınır ki mağaza kapandıktan
// sonra sitede görünmeye devam etmesin.
export async function closeVendorAccount(vendorId: number): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.update(vendors).set({ status: "closed" }).where(eq(vendors.id, vendorId));
    await tx.update(products).set({ status: "inactive" }).where(and(eq(products.vendorId, vendorId), eq(products.status, "active")));
  });
}
