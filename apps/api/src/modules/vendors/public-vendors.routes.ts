import { and, asc, eq } from "drizzle-orm";
import { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { db } from "../../db/client";
import { collectionProducts, collections } from "../../db/schema/index";
import { decodeCursor, encodeCursor } from "../../lib/pagination";
import { findProductsByIds, listActiveProducts } from "../catalog/catalog.repository";
import { findActiveVendorBySlugPublic, listActiveVendors } from "./vendor.repository";
import { isFollowingVendor, listFollowedVendors, toggleVendorFollow } from "./vendor-follow.repository";
import {
  findReviewableVendor,
  getVendorReviewSummary,
  insertVendorReview,
  listApprovedVendorReviews,
} from "./vendor-reviews.repository";
import { listVendorSocialPosts, listVendorStoreSlides } from "./vendor-store-content.repository";

const storefrontQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(12),
});

const vendorReviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().min(1).max(2000).optional(),
});

// Mağazalar (gulumsalim.com'daki magazalar.php/vendor-store.php'nin
// karşılığı) - herkese açık, kimlik doğrulaması gerektirmez.
const publicVendorsRoutes: FastifyPluginAsync = async (app) => {
  app.get("/vendors", async (_request, reply) => {
    return reply.send(await listActiveVendors());
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

    const isFollowing = request.session.customerId
      ? await isFollowingVendor(request.session.customerId, vendor.id)
      : false;
    const reviewSummary = await getVendorReviewSummary(vendor.id);

    return reply.send({ vendor: { ...vendor, isFollowing, reviewSummary }, products: { items, nextCursor } });
  });

  // vendor-store.php'deki mağaza değerlendirmesi bölümünün karşılığı -
  // ürün değerlendirmesinden (product reviews) ayrı, tüm mağaza deneyimine
  // puan verilir.
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
    return reply.send({ vendor, collection, products });
  });
};

export default publicVendorsRoutes;
