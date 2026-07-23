import { FastifyPluginAsync } from "fastify";
import { getDiscoverFeed } from "./discovery.service";

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
};

export default discoveryRoutes;
