import { FastifyPluginAsync } from "fastify";
import { getPublicSiteStats } from "./homepage-sections.repository";
import { DEFAULT_COMMISSION_RATE } from "../vendors/commission";
import { resolveHomepageSections, resolveSectionBySlug } from "./homepage-sections.service";

const homepageSectionsRoutes: FastifyPluginAsync = async (app) => {
  // bkz. denetim raporu madde 4: pazarlama metinlerindeki ("binlerce ürün",
  // "milyonlarca müşteri" vb.) sabit sayıların yerini alacak, herkese açık
  // gerçek platform sayaçları.
  app.get("/site-stats", async (request, reply) => {
    try {
      const stats = await getPublicSiteStats();
      return reply.send(stats);
    } catch (err) {
      request.log.warn({ err }, "site istatistikleri alınamadı");
      return reply.send({ activeVendors: 0, activeProducts: 0, customers: 0, defaultCommissionRate: DEFAULT_COMMISSION_RATE });
    }
  });

  app.get("/homepage-sections", async (request, reply) => {
    try {
      const sections = await resolveHomepageSections(app.redis, request.session.customerId);
      return reply.send(sections);
    } catch (err) {
      // Bir bölümün hesaplanması başarısız olsa bile ana sayfa çökmemeli.
      request.log.warn({ err }, "anasayfa bölümleri hesaplanamadı");
      return reply.send([]);
    }
  });

  // [slug]/page.tsx zincirinin son adımı için - bir bölümün kendi kök
  // seviye SEO sayfası (bkz. homepage-sections.service.ts).
  app.get("/homepage-sections/by-slug/:slug", async (request, reply) => {
    const { slug } = request.params as { slug: string };
    const section = await resolveSectionBySlug(app.redis, request.session.customerId, slug);
    if (!section) return reply.status(404).send({ error: { message: "Bölüm bulunamadı" } });
    return reply.send(section);
  });
};

export default homepageSectionsRoutes;
