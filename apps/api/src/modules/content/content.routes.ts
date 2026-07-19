import { FastifyPluginAsync } from "fastify";
import { findPublicPageBySlug, listActivePromoBanners, listActiveSliders } from "./content.repository";

// Admin panelde (bkz. modules/admin/admin-pages.* ve ileride slider/banner
// modülleri) yönetilen içeriğin herkese açık, kimlik doğrulaması
// gerektirmeyen okuma uçları burada.
const contentRoutes: FastifyPluginAsync = async (app) => {
  app.get("/pages/:slug", async (request, reply) => {
    const { slug } = request.params as { slug: string };
    const page = await findPublicPageBySlug(slug);
    if (!page) {
      reply.status(404).send({ error: { message: "Sayfa bulunamadı" } });
      return;
    }
    reply.send(page);
  });

  app.get("/sliders", async (_request, reply) => {
    reply.send(await listActiveSliders());
  });

  app.get("/promo-banners", async (_request, reply) => {
    reply.send(await listActivePromoBanners());
  });
};

export default contentRoutes;
