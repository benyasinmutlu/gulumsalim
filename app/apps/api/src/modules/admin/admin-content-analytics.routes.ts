import { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import {
  dateRangeForPeriod,
  getContentEventTotals,
  getTopSearchQueries,
  hydrateContentStats,
} from "../analytics/content-analytics.repository";
import { getTopPromoBanners } from "./admin-content.repository";

const queryPeriodSchema = z.object({ period: z.enum(["day", "week", "month"]).default("day") });

// bkz. kullanıcı isteği (2026-08-02): "kategoriler sayfalar koleksiyonlar
// mağazalar kampanyalar ... çok önemli bunlar ... bu datalar kaydedilsin" -
// gösterge panelini kalabalıklaştırmadan ayrı bir "İçerik Analitiği" sayfası
// (bkz. icerik-analitigi/page.tsx), Gün/Hafta/Ay seçiciyle bu tek ucu çeker.
const adminContentAnalyticsRoutes: FastifyPluginAsync = async (app) => {
  app.get("/admin/content-analytics", { preHandler: app.requireAdmin }, async (request, reply) => {
    const { period } = queryPeriodSchema.parse(request.query);
    const { from, to } = dateRangeForPeriod(period);

    const [
      productViews,
      productPurchases,
      productFavorites,
      productCartAdds,
      productDwell,
      categoryViews,
      collectionViews,
      vendorViews,
      sectionViews,
      sectionDwell,
      banners,
      searchQueries,
    ] = await Promise.all([
      getContentEventTotals("product", "view", from, to, 8),
      getContentEventTotals("product", "purchase", from, to, 8),
      getContentEventTotals("product", "favorite", from, to, 8),
      getContentEventTotals("product", "cart_add", from, to, 8),
      getContentEventTotals("product", "dwell", from, to, 8),
      getContentEventTotals("category", "view", from, to, 8),
      getContentEventTotals("collection", "view", from, to, 8),
      getContentEventTotals("vendor", "view", from, to, 8),
      getContentEventTotals("homepage_section", "view", from, to, 8),
      getContentEventTotals("homepage_section", "dwell", from, to, 8),
      getTopPromoBanners(from, to, 10),
      getTopSearchQueries(from, to, 15),
    ]);

    const [
      productViewsHydrated,
      productPurchasesHydrated,
      productFavoritesHydrated,
      productCartAddsHydrated,
      productDwellHydrated,
      categoryViewsHydrated,
      collectionViewsHydrated,
      vendorViewsHydrated,
      sectionViewsHydrated,
      sectionDwellHydrated,
    ] = await Promise.all([
      hydrateContentStats("product", productViews),
      hydrateContentStats("product", productPurchases),
      hydrateContentStats("product", productFavorites),
      hydrateContentStats("product", productCartAdds),
      hydrateContentStats("product", productDwell),
      hydrateContentStats("category", categoryViews),
      hydrateContentStats("collection", collectionViews),
      hydrateContentStats("vendor", vendorViews),
      hydrateContentStats("homepage_section", sectionViews),
      hydrateContentStats("homepage_section", sectionDwell),
    ]);

    return reply.send({
      period,
      products: {
        views: productViewsHydrated,
        purchases: productPurchasesHydrated,
        favorites: productFavoritesHydrated,
        cartAdds: productCartAddsHydrated,
        dwell: productDwellHydrated,
      },
      categories: categoryViewsHydrated,
      collections: collectionViewsHydrated,
      vendors: vendorViewsHydrated,
      homepageSections: { views: sectionViewsHydrated, dwell: sectionDwellHydrated },
      banners,
      searchQueries,
    });
  });
};

export default adminContentAnalyticsRoutes;
