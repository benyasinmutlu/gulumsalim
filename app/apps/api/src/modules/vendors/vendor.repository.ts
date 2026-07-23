import { and, desc, eq, gt, sql } from "drizzle-orm";
import { db } from "../../db/client";
import { products, vendorFollowers, vendorReviews, vendors } from "../../db/schema/index";
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
      productCount: sql<number>`(SELECT COUNT(*) FROM ${products} WHERE ${products.vendorId} = ${outer(vendors.id)} AND ${products.status} = 'active')`.mapWith(
        Number,
      ),
      followerCount: sql<number>`(SELECT COUNT(*) FROM ${vendorFollowers} WHERE ${vendorFollowers.vendorId} = ${outer(vendors.id)})`.mapWith(Number),
    })
    .from(vendors)
    .where(and(eq(vendors.storeSlug, slug), eq(vendors.status, "active")))
    .limit(1);
  return row ?? null;
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

export async function createVendor(data: {
  storeName: string;
  storeSlug: string;
  email: string;
  passwordHash: string;
  fullName: string;
  phone?: string;
}) {
  const [row] = await db.insert(vendors).values(data).returning();
  if (!row) throw new Error("Satıcı oluşturulamadı");
  return row;
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
