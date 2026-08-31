import { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { emitBehavioralEvent } from "../analytics/events.client";
import { recordProductView } from "../../lib/view-history";
import { getCartCounts } from "../../lib/cart-product-index";
import { findProductVendorAndCategory, findRedirectForOldProductSlug, getSearchHighlights, incrementProductViewCount, listActiveProducts, listFavoritesByCustomer, toggleFavorite } from "./catalog.repository";
import { getTopSearchQueries, recordContentEvent, recordSearchQuery } from "../analytics/content-analytics.repository";
import { getSearchMatches, getSearchSuggestions } from "./search-suggest.service";
import { listProductsQuerySchema, productSlugParamsSchema, toggleFavoriteSchema } from "./catalog.schemas";
import { getCategories, getProductBySlug, getProductFacets, getProducts } from "./catalog.service";
import { findCustomerById } from "../auth/auth.repository";
import type { SizePrefs } from "../../db/schema/customers";
import { computeFit, normalizeProductChart, aggregateFeedback, learnedChart, mergeCharts, sizeLabelToNumeric } from "../fit";
import { recordFitFeedback, getProductFeedbackRows } from "../fit/fit-feedback.repository";

const searchSuggestQuerySchema = z.object({ q: z.string().trim().min(1).max(80) });

// Fit-Zekâsı Faz 5: satın alma sonrası kalıp geri bildirimi gövdesi.
const fitFeedbackSchema = z.object({
  size: z.string().trim().min(1).max(6),
  verdict: z.enum(["cok_dar", "dar", "tam", "bol", "cok_bol"]),
});

const catalogRoutes: FastifyPluginAsync = async (app) => {
  app.get("/categories", async (_request, reply) => {
    return reply.send(await getCategories());
  });

  // bkz. kullanıcı isteği: "websitesindeki ürünleri mağazaları gösterceksin
  // orada" - arama kutusundaki yazılıp-silinen efekt (bkz.
  // components/search-box.tsx) için sitedeki gerçek, popüler ürün/mağaza
  // adları.
  app.get("/search-highlights", async (_request, reply) => {
    return reply.send(await getSearchHighlights());
  });

  // bkz. denetim raporu madde 16: "Popüler aramalar" - search_queries
  // tablosu (recordSearchQuery, yukarıdaki /products) zaten dolduruluyordu
  // ama önceden sadece admin panelinde okunuyordu, müşteriye dönük hiçbir
  // uç yoktu.
  app.get("/search-trending", async (_request, reply) => {
    const to = new Date();
    const from = new Date(to.getTime() - 7 * 24 * 60 * 60 * 1000);
    const rows = await getTopSearchQueries(from, to, 8);
    return reply.send(rows.map((r) => r.query));
  });

  // bkz. kullanıcı isteği: "filtrelerde renk ve marka gibi şeyleri
  // listelenenlere göre değişsin" - filtre kenar çubuğunun renk/marka
  // seçenekleri için ayrı, hafif bir uç (limit:0 Meilisearch sorgusu).
  app.get("/products/facets", async (request, reply) => {
    const query = listProductsQuerySchema.parse(request.query);
    return reply.send(await getProductFacets(query));
  });

  app.get("/products", async (request, reply) => {
    const query = listProductsQuerySchema.parse(request.query);
    if (query.search) {
      recordSearchQuery(query.search).catch(() => {});
    }
    // "Bedenime uygun" açık + giriş yapılmışsa profildeki bedenleri al (tek
    // kaynak profil; giriş yoksa/beden yoksa sessizce normal gözatmaya döner).
    let sizePrefs: SizePrefs | null = null;
    if (query.fitToMe && request.session.customerId) {
      const customer = await findCustomerById(request.session.customerId);
      sizePrefs = customer?.sizePrefs ?? null;
    }
    const result = await getProducts(query, sizePrefs);
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
    recordContentEvent("product", product.id, "view").catch(() => {});
    if (request.session.customerId) {
      // Ateşle-unut - "Son Baktıklarınız" bölümü için, yanıtı bekletmez.
      recordProductView(app.redis, request.session.customerId, product.id).catch(() => {});
    }
    return reply.send(product);
  });

  // bkz. denetim raporu: "301 yönlendirmeleri" - ürün adresi (slug)
  // değiştiğinde eski bağlantı 404 vermesin. Frontend, /products/:slug 404
  // döndüğünde bu ucu deneyip varsa permanentRedirect() yapar.
  app.get("/products/by-old-slug/:oldSlug", async (request, reply) => {
    const { oldSlug } = request.params as { oldSlug: string };
    const redirect = await findRedirectForOldProductSlug(oldSlug);
    if (!redirect) {
      return reply.status(404).send({ error: { message: "Yönlendirme bulunamadı" } });
    }
    return reply.send(redirect);
  });

  // product-detail.php'deki "İlginizi Çekebilecek Diğer Ürünler" bölümünün
  // karşılığı - aynı kategoriden, mevcut ürün hariç, en yeni 8 ürün.
  app.get("/products/:slug/related", async (request, reply) => {
    const { slug } = productSlugParamsSchema.parse(request.params);
    const product = await getProductBySlug(slug);
    if (!product) {
      return reply.status(404).send({ error: { message: "Ürün bulunamadı" } });
    }
    const related = await listActiveProducts({ categoryIds: [product.categoryId], limit: 9 });
    return reply.send(related.filter((p) => p.id !== product.id).slice(0, 8));
  });

  // bkz. denetim raporu madde 19: "Aynı Mağazadan" - satıcının diğer aktif
  // ürünleri. "Benzer Ürünler" (yukarıdaki /related, kategori bazlı) ile
  // KARIŞTIRILMAMALI, ayrı bir bölüm.
  app.get("/products/:slug/same-vendor", async (request, reply) => {
    const { slug } = productSlugParamsSchema.parse(request.params);
    const product = await getProductBySlug(slug);
    if (!product) {
      return reply.status(404).send({ error: { message: "Ürün bulunamadı" } });
    }
    const sameVendor = await listActiveProducts({ vendorId: product.vendorId, limit: 9 });
    return reply.send(sameVendor.filter((p) => p.id !== product.id).slice(0, 8));
  });

  // Fit-Zekâsı: "Sana Oturur mu?" — giriş yapmış müşterinin bedeni/boyu ile bu
  // ürünün beden önerisi + boyut-boyut fit. Kişisel → cache'lenmez.
  app.get("/products/:slug/fit", { preHandler: app.requireCustomer }, async (request, reply) => {
    const { slug } = productSlugParamsSchema.parse(request.params);
    const product = await getProductBySlug(slug);
    if (!product) return reply.status(404).send({ error: { message: "Ürün bulunamadı" } });
    const customer = await findCustomerById(request.session.customerId!);
    const sizes = [...new Set(product.variants.map((v) => v.size).filter((s): s is string => !!s))];
    // Faz 4: satıcının ölçtüğü tablo (kesin) + Faz 5: geri bildirimden öğrenilen
    // kalıp. Satıcı açıkça girdiği boyut kazanır, girmediğinde öğrenilmiş devreye
    // girer, o da yoksa standart tabloya düşülür (mergeCharts + matchFit).
    const vendorChart = normalizeProductChart(product.sizeChart);
    const learned = learnedChart(aggregateFeedback(await getProductFeedbackRows(product.id)));
    const outcome = computeFit(
      { kadinBeden: customer?.sizePrefs?.kadinBeden, heightCm: customer?.heightCm, weightKg: customer?.weightKg },
      sizes,
      product.name,
      mergeCharts(learned, vendorChart),
    );
    return reply.send(outcome);
  });

  // Fit-Zekâsı Faz 5: müşteri satın aldıktan sonra "geldi: dar/tam/bol" der.
  // Ürünün kalıbı bu sinyallerden öğrenilir (bkz. /fit route mergeCharts).
  app.post("/products/:slug/fit/feedback", { preHandler: [app.requireCustomer, app.csrfProtection] }, async (request, reply) => {
    const { slug } = productSlugParamsSchema.parse(request.params);
    const { size, verdict } = fitFeedbackSchema.parse(request.body);
    const product = await getProductBySlug(slug);
    if (!product) return reply.status(404).send({ error: { message: "Ürün bulunamadı" } });
    const sizeNumeric = sizeLabelToNumeric(size);
    if (sizeNumeric == null) return reply.status(400).send({ error: { message: "Geçersiz beden" } });
    await recordFitFeedback({ productId: product.id, customerId: request.session.customerId!, sizeNumeric, verdict });
    return reply.send({ ok: true });
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
      recordContentEvent("product", productId, "favorite").catch(() => {});
    }
    return reply.send({ favorited });
  });

  app.get("/favorites", { preHandler: app.requireCustomer }, async (request, reply) => {
    return reply.send(await listFavoritesByCustomer(request.session.customerId!));
  });
};

export default catalogRoutes;
