import { FastifyPluginAsync } from "fastify";
import { getDiscoverFeed } from "./discovery.service";
import { findMostViewedProductIds, findProductsByIds, findTopViewedCategories } from "../catalog/catalog.repository";
import { computeBestSellingProductIds } from "../homepage-sections/homepage-sections.repository";

const discoveryRoutes: FastifyPluginAsync = async (app) => {
  app.get("/discover", async (request, reply) => {
    try {
      const feed = await getDiscoverFeed(request.session.customerId, 12);
      return reply.send(feed);
    } catch (err) {
      // Keşfet servisi geçici olarak erişilemez olsa bile ana sayfa
      // çökmemeli - boş bir bölüm olarak sessizce düşer.
      request.log.warn({ err }, "keşfet akışı alınamadı");
      return reply.send({ items: [], strategy: "unavailable" });
    }
  });

  // bkz. kullanıcı isteği: "/sana-ozel sayfasında ... altında en çok
  // bakılan ürünler kategoriler ... listele, diğer bölümler için de
  // algoritma oluştur" - kişiselleştirilmiş akışın altına eklenen, doğrudan
  // SQL'den hesaplanan üç ek bölüm (en çok bakılan ürün/kategori, çok satan).
  app.get("/discover/trending", async (_request, reply) => {
    const [mostViewedIds, bestSellerIds, topCategories] = await Promise.all([
      findMostViewedProductIds(12),
      computeBestSellingProductIds(12),
      findTopViewedCategories(6),
    ]);
    const [mostViewed, bestSellers] = await Promise.all([
      findProductsByIds(mostViewedIds),
      findProductsByIds(bestSellerIds),
    ]);
    return reply.send({ mostViewed, bestSellers, topCategories });
  });
};

export default discoveryRoutes;
