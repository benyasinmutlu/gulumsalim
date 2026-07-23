import { FastifyPluginAsync } from "fastify";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../../db/client";
import { vendors } from "../../db/schema/index";

const storeLayoutSchema = z.object({
  sections: z.array(
    z.object({
      type: z.enum(["collections", "products", "about", "slider", "social"]),
      visible: z.boolean(),
    }),
  ),
});

// Şemaya sonradan eklenen bölüm tipleri - storeLayout sütununun varsayılanı
// eski satıcılarda bunları içermiyor, GET'te otomatik tamamlanır (bkz.
// aşağı) ki "Mağaza Düzeni" sayfası her satıcıda aynı seçenekleri göstersin.
const ALL_SECTION_TYPES = ["collections", "products", "about", "slider", "social"] as const;

const vendorStoreLayoutRoutes: FastifyPluginAsync = async (app) => {
  app.get("/vendor/store-layout", { preHandler: app.requireVendor }, async (request, reply) => {
    const [row] = await db.select({ storeLayout: vendors.storeLayout }).from(vendors).where(eq(vendors.id, request.session.vendorId!)).limit(1);
    const sections = (row?.storeLayout ?? []) as { type: string; visible: boolean }[];
    const missing = ALL_SECTION_TYPES.filter((t) => !sections.some((s) => s.type === t)).map((type) => ({ type, visible: false }));
    return reply.send([...sections, ...missing]);
  });

  app.patch(
    "/vendor/store-layout",
    { preHandler: [app.requireVendor, app.csrfProtection] },
    async (request, reply) => {
      const { sections } = storeLayoutSchema.parse(request.body);
      await db.update(vendors).set({ storeLayout: sections }).where(eq(vendors.id, request.session.vendorId!));
      return reply.send({ ok: true });
    },
  );
};

export default vendorStoreLayoutRoutes;
