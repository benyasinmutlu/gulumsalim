import { and, asc, eq } from "drizzle-orm";
import { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { db } from "../../db/client";
import { collectionProducts, collections } from "../../db/schema/index";
import { decodeCursor, encodeCursor } from "../../lib/pagination";
import { findProductsByIds, listActiveProducts, listFavoritesByCustomer } from "../catalog/catalog.repository";
import { getRecentlyViewedProductIds } from "../../lib/view-history";
import { findActiveVendorBySlugPublic, incrementVendorViewCount, listActiveVendors } from "./vendor.repository";
import { isFollowingVendor, listFollowedVendors, toggleVendorFollow } from "./vendor-follow.repository";
import { getVendorQuestionCount } from "../questions/questions.repository";
import {
  findReviewableVendor,
  getVendorReviewSummary,
  insertVendorReview,
  listApprovedVendorReviews,
} from "./vendor-reviews.repository";
import { listVendorSocialPosts, listVendorStoreSlides } from "./vendor-store-content.repository";
import { insertVendorComplaint } from "./vendor-complaints.repository";
import { listActiveVendorPromoBanners } from "./vendor-promo-banners.repository";
import { recordContentEvent } from "../analytics/content-analytics.repository";
import { CONTACT_INFO_MESSAGE, containsContactInfo } from "../../lib/contact-info-detector";

const storefrontQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(12),
});

const vendorReviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().min(1).max(2000).refine((v) => !containsContactInfo(v), CONTACT_INFO_MESSAGE).optional(),
});

const COMPLAINT_REASONS = ["sahte_urun", "gec_teslimat", "kotu_iletisim", "hatali_urun", "diger"] as const;
const vendorComplaintSchema = z.object({
  reason: z.enum(COMPLAINT_REASONS),
  message: z.string().min(10).max(2000).refine((v) => !containsContactInfo(v), CONTACT_INFO_MESSAGE),
});

type PublicVendor = NonNullable<Awaited<ReturnType<typeof findActiveVendorBySlugPublic>>>;

async function buildVendorSummary(vendor: PublicVendor, customerId?: number) {
  const [isFollowing, reviewSummary, answeredQuestionCount] = await Promise.all([
    customerId ? isFollowingVendor(customerId, vendor.id) : Promise.resolve(false),
    getVendorReviewSummary(vendor.id),
    getVendorQuestionCount(vendor.id),
  ]);
  const { deliveredCount, refundedDeliveredCount, ...vendorRest } = vendor;
  const successRate = deliveredCount > 0
    ? Math.round(((deliveredCount - refundedDeliveredCount) / deliveredCount) * 1000) / 10
    : null;
  return {
    ...vendorRest,
    isFollowing,
    reviewSummary,
    successRate,
    salesCount: deliveredCount,
    answeredQuestionCount,
  };
}

// Mağazalar (gulumsalim.com'daki magazalar.php/vendor-store.php'nin
// karşılığı) - herkese açık, kimlik doğrulaması gerektirmez.
const publicVendorsRoutes: FastifyPluginAsync = async (app) => {
  app.get("/vendors", async (_request, reply) => {
    return reply.send(await listActiveVendors());
  });

  // Ürün detayındaki satıcı kartı için hafif uç: mağaza ürünlerini okumaz ve
  // mağaza görüntülenme analitiğini artırmaz. Böylece her ürün sayfası açılışı
  // yanlışlıkla mağaza ziyareti sayılmaz.
  app.get("/vendors/:slug/summary", async (request, reply) => {
    const { slug } = request.params as { slug: string };
    const vendor = await findActiveVendorBySlugPublic(slug);
    if (!vendor) {
      return reply.status(404).send({ error: { message: "Mağaza bulunamadı" } });
    }
    return reply.send({ vendor: await buildVendorSummary(vendor, request.session.customerId) });
  });

  app.get("/vendors/:slug", async (request, reply) => {
    const { slug } = request.params as { slug: string };
    const vendor = await findActiveVendorBySlugPublic(slug);
    if (!vendor) {
      return reply.status(404).send({ error: { message: "Mağaza bulunamadı" } });
    }

    const query = storefrontQuerySchema.parse(request.query);
    const cursor = query.cursor ? decodeCursor(query.cursor) : null;
    const rows = await listActiveProducts({ vendorId: vendor.id, cursor, limit: query.limit });
    const hasMore = rows.length > query.limit;
    const items = hasMore ? rows.slice(0, query.limit) : rows;
    const last = items[items.length - 1];
    const nextCursor = hasMore && last ? encodeCursor({ createdAt: last.createdAt.toISOString(), id: last.id }) : null;

    const vendorSummary = await buildVendorSummary(vendor, request.session.customerId);

    // bkz. catalog.routes.ts incrementProductViewCount ile aynı desen -
    // sayfa yanıtını beklemeden, arka planda sessizce artırılır.
    incrementVendorViewCount(vendor.id).catch(() => {});
    recordContentEvent("vendor", vendor.id, "view").catch(() => {});

    return reply.send({
      vendor: vendorSummary,
      products: { items, nextCursor },
    });
  });

  // vendor-store.php'deki mağaza değerlendirmesi bölümünün karşılığı -
  // ürün değerlendirmesinden (product reviews) ayrı, tüm mağaza deneyimine
  // puan verilir.
  // bkz. kullanıcı isteği (mockup): mağaza sayfasında ayrı bir "Kampanyalar"
  // sekmesi - satıcının onaylanmış/aktif kampanya bannerları.
  app.get("/vendors/:slug/promo-banners", async (request, reply) => {
    const { slug } = request.params as { slug: string };
    const vendor = await findActiveVendorBySlugPublic(slug);
    if (!vendor) {
      return reply.status(404).send({ error: { message: "Mağaza bulunamadı" } });
    }
    return reply.send(await listActiveVendorPromoBanners(vendor.id));
  });

  app.get("/vendors/:slug/reviews", async (request, reply) => {
    const { slug } = request.params as { slug: string };
    const vendor = await findActiveVendorBySlugPublic(slug);
    if (!vendor) {
      return reply.status(404).send({ error: { message: "Mağaza bulunamadı" } });
    }
    return reply.send(await listApprovedVendorReviews(vendor.id));
  });

  app.post(
    "/vendors/:slug/reviews",
    { preHandler: [app.requireCustomer, app.csrfProtection] },
    async (request, reply) => {
      const { slug } = request.params as { slug: string };
      const vendor = await findActiveVendorBySlugPublic(slug);
      if (!vendor) {
        return reply.status(404).send({ error: { message: "Mağaza bulunamadı" } });
      }
      const reviewable = await findReviewableVendor(request.session.customerId!, vendor.id);
      if (!reviewable) {
        return reply
          .status(403)
          .send({ error: { message: "Bu mağazayı değerlendirmek için önce bir siparişinizi teslim almış olmalısınız" } });
      }
      const input = vendorReviewSchema.parse(request.body);
      const review = await insertVendorReview({ vendorId: vendor.id, customerId: request.session.customerId!, ...input });
      return reply.status(201).send(review);
    },
  );

  // bkz. kullanıcı isteği: "mağazayı şikayet et bölümü ekleyelim" - satın
  // alma şartı yok, sadece giriş yapmış olmak yeterli (soru sormakla aynı
  // kural). Admin moderasyon kuyruğuna düşer, herkese açık gösterilmez.
  app.post(
    "/vendors/:slug/complaints",
    { preHandler: [app.requireCustomer, app.csrfProtection] },
    async (request, reply) => {
      const { slug } = request.params as { slug: string };
      const vendor = await findActiveVendorBySlugPublic(slug);
      if (!vendor) {
        return reply.status(404).send({ error: { message: "Mağaza bulunamadı" } });
      }
      const input = vendorComplaintSchema.parse(request.body);
      // Satıcıya burada bilgilendirme YAPILMAZ (bkz. yorum yukarıda) -
      // admin inceleyip gerekliyse kendisi iletişime geçer, aksi halde
      // şikayet eden müşteri dolaylı olarak ifşa olabilir.
      const complaint = await insertVendorComplaint({ vendorId: vendor.id, customerId: request.session.customerId!, ...input });
      return reply.status(201).send(complaint);
    },
  );

  app.post(
    "/vendors/:slug/follow",
    { preHandler: [app.requireCustomer, app.csrfProtection] },
    async (request, reply) => {
      const { slug } = request.params as { slug: string };
      const vendor = await findActiveVendorBySlugPublic(slug);
      if (!vendor) {
        return reply.status(404).send({ error: { message: "Mağaza bulunamadı" } });
      }
      const following = await toggleVendorFollow(request.session.customerId!, vendor.id);
      return reply.send({ following });
    },
  );

  app.get("/my/followed-vendors", { preHandler: app.requireCustomer }, async (request, reply) => {
    return reply.send(await listFollowedVendors(request.session.customerId!));
  });

  app.get("/vendors/:slug/store-slides", async (request, reply) => {
    const { slug } = request.params as { slug: string };
    const vendor = await findActiveVendorBySlugPublic(slug);
    if (!vendor) {
      return reply.status(404).send({ error: { message: "Mağaza bulunamadı" } });
    }
    return reply.send(await listVendorStoreSlides(vendor.id));
  });

  app.get("/vendors/:slug/social-posts", async (request, reply) => {
    const { slug } = request.params as { slug: string };
    const vendor = await findActiveVendorBySlugPublic(slug);
    if (!vendor) {
      return reply.status(404).send({ error: { message: "Mağaza bulunamadı" } });
    }
    return reply.send(await listVendorSocialPosts(vendor.id));
  });

  // vendor/store-layout.php'deki "sevdikleriniz" / "son baktıklarınız"
  // bölümlerinin karşılığı - sadece giriş yapmış müşteriye özel, bu
  // mağazanın ürünleriyle sınırlı. Misafir ziyaretçide boş dizi döner,
  // storefront bileşeni bölümü otomatik gizler.
  app.get("/vendors/:slug/favorites", async (request, reply) => {
    const { slug } = request.params as { slug: string };
    const vendor = await findActiveVendorBySlugPublic(slug);
    if (!vendor) {
      return reply.status(404).send({ error: { message: "Mağaza bulunamadı" } });
    }
    if (!request.session.customerId) return reply.send([]);
    return reply.send(await listFavoritesByCustomer(request.session.customerId, vendor.id));
  });

  app.get("/vendors/:slug/recently-viewed", async (request, reply) => {
    const { slug } = request.params as { slug: string };
    const vendor = await findActiveVendorBySlugPublic(slug);
    if (!vendor) {
      return reply.status(404).send({ error: { message: "Mağaza bulunamadı" } });
    }
    if (!request.session.customerId) return reply.send([]);
    const ids = await getRecentlyViewedProductIds(app.redis, request.session.customerId, 20);
    const rows = await findProductsByIds(ids);
    return reply.send(rows.filter((p) => p.vendorSlug === slug).slice(0, 8));
  });

  app.get("/vendors/:slug/collections", async (request, reply) => {
    const { slug } = request.params as { slug: string };
    const vendor = await findActiveVendorBySlugPublic(slug);
    if (!vendor) {
      return reply.status(404).send({ error: { message: "Mağaza bulunamadı" } });
    }
    const rows = await db
      .select({
        id: collections.id,
        name: collections.name,
        slug: collections.slug,
        coverImage: collections.coverImage,
      })
      .from(collections)
      .where(and(eq(collections.vendorId, vendor.id), eq(collections.isActive, true)));
    return reply.send(rows);
  });

  // gulumsalim.com'daki /{mağaza-slug}/koleksiyon/{koleksiyon-slug} temiz
  // URL'inin karşılığı - tek bir koleksiyonun kendi ürün vitrini.
  app.get("/vendors/:slug/koleksiyon/:collectionSlug", async (request, reply) => {
    const { slug, collectionSlug } = request.params as { slug: string; collectionSlug: string };
    const vendor = await findActiveVendorBySlugPublic(slug);
    if (!vendor) {
      return reply.status(404).send({ error: { message: "Mağaza bulunamadı" } });
    }
    const [collection] = await db
      .select({ id: collections.id, name: collections.name, slug: collections.slug, coverImage: collections.coverImage })
      .from(collections)
      .where(and(eq(collections.vendorId, vendor.id), eq(collections.slug, collectionSlug), eq(collections.isActive, true)))
      .limit(1);
    if (!collection) {
      return reply.status(404).send({ error: { message: "Koleksiyon bulunamadı" } });
    }
    const memberships = await db
      .select({ productId: collectionProducts.productId })
      .from(collectionProducts)
      .where(eq(collectionProducts.collectionId, collection.id))
      .orderBy(asc(collectionProducts.sortOrder));
    const products = await findProductsByIds(memberships.map((m) => m.productId));
    recordContentEvent("collection", collection.id, "view").catch(() => {});
    return reply.send({ vendor, collection, products });
  });
};

export default publicVendorsRoutes;
