import { FastifyPluginAsync } from "fastify";
import { resolveHomepageSections } from "./homepage-sections.service";

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
};

export default homepageSectionsRoutes;
