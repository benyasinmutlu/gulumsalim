import { FastifyPluginAsync } from "fastify";
import { resolveHomepageSections, resolveSectionBySlug } from "./homepage-sections.service";

const homepageSectionsRoutes: FastifyPluginAsync = async (app) => {
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
