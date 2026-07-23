import { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { emitBehavioralEvent } from "../analytics/events.client";
import { recordProductView } from "../../lib/view-history";
import { getCartCounts } from "../../lib/cart-product-index";
import { findProductVendorAndCategory, incrementProductViewCount, listActiveProducts, listFavoritesByCustomer, toggleFavorite } from "./catalog.repository";
import { getSearchMatches, getSearchSuggestions } from "./search-suggest.service";
import { listProductsQuerySchema, productSlugParamsSchema, toggleFavoriteSchema } from "./catalog.schemas";
import { getCategories, getProductBySlug, getProducts } from "./catalog.service";

const searchSuggestQuerySchema = z.object({ q: z.string().trim().min(1).max(80) });

const catalogRoutes: FastifyPluginAsync = async (app) => {
  app.get("/categories", async (_request, reply) => {
    return reply.send(await getCategories());
  });

  app.get("/products", async (request, reply) => {
    const query = listProductsQuerySchema.parse(request.query);
    const result = await getProducts(query);
    // Sepet sayısı (bkz. lib/cart-product-index.ts) Redis'teki ürün->oturum
    // ters indeksinden geliyor, SQL/Meilisearch sonuçlarının hiçbirinde yok
    // - route seviyesinde (app.redis burada erişilebilir) sonradan eklenir.
    const cartCounts = await getCartCounts(app.redis, result.items.map((i) => i.id));
    const items = result.items.map((item) => ({ ...item, cartCount: cartCounts.get(item.id) ?? 0 }));
    return reply.send({ ...result, items });
  });

  app.get("/products/:slug", async (request, reply) => {
    const { slug } = productSlugParamsSchema.parse(request.params);
    const product = await getProductBySlug(slug);
    if (!product) {
      return reply.status(404).send({ error: { message: "Ürün bulunamadı" } });
    }
    emitBehavioralEvent(app, {
      type: "view",
      customerId: request.session.customerId,
      productId: product.id,
      vendorId: product.vendorId,
      categoryId: product.categoryId,
    });
    incrementProductViewCount(product.id).catch(() => {});
    if (request.session.customerId) {
      // Ateşle-unut - "Son Baktıklarınız" bölümü için, yanıtı bekletmez.
      recordProductView(app.redis, request.session.customerId, product.id).catch(() => {});
    }
    return reply.send(product);
  });

  // product-detail.php'deki "İlginizi Çekebilecek Diğer Ürünler" bölümünün
  // karşılığı - aynı kategoriden, mevcut ürün hariç, en yeni 8 ürün.
  app.get("/products/:slug/related", async (request, reply) => {
    const { slug } = productSlugParamsSchema.parse(request.params);
    const product = await getProductBySlug(slug);
    if (!product) {
      return reply.status(404).send({ error: { message: "Ürün bulunamadı" } });
    }
    const related = await listActiveProducts({ categoryId: product.categoryId, limit: 9 });
    return reply.send(related.filter((p) => p.id !== product.id).slice(0, 8));
  });

  app.get("/search-suggest", async (request, reply) => {
    const { q } = searchSuggestQuerySchema.parse(request.query);
    return reply.send(await getSearchSuggestions(q));
  });

  // /arama sayfasının üst kısmı için - eşleşen mağaza/kategori özeti.
  app.get("/search-matches", async (request, reply) => {
    const { q } = searchSuggestQuerySchema.parse(request.query);
    return reply.send(await getSearchMatches(q));
  });

  app.post("/favorites/toggle", { preHandler: [app.requireCustomer, app.csrfProtection] }, async (request, reply) => {
    const { productId } = toggleFavoriteSchema.parse(request.body);
    const favorited = await toggleFavorite(request.session.customerId!, productId);
    if (favorited) {
      const product = await findProductVendorAndCategory(productId);
      if (product) {
        emitBehavioralEvent(app, {
          type: "favorite",
          customerId: request.session.customerId,
          productId,
          vendorId: product.vendorId,
          categoryId: product.categoryId,
        });
      }
    }
    return reply.send({ favorited });
  });

  app.get("/favorites", { preHandler: app.requireCustomer }, async (request, reply) => {
    return reply.send(await listFavoritesByCustomer(request.session.customerId!));
  });
};

export default catalogRoutes;
