import { FastifyPluginAsync } from "fastify";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../../db/client";
import { vendors } from "../../db/schema/index";

const storeLayoutSchema = z.object({
  sections: z.array(
    z.object({
      type: z.enum(["collections", "products", "about", "slider", "social", "discount", "favorites", "recently_viewed"]),
      visible: z.boolean(),
    }),
  ),
});

// Şemaya sonradan eklenen bölüm tipleri - storeLayout sütununun varsayılanı
// eski satıcılarda bunları içermiyor, GET'te otomatik tamamlanır (bkz.
// aşağı) ki "Mağaza Düzeni" sayfası her satıcıda aynı seçenekleri göstersin.
// discount/favorites/recently_viewed: vendor/store-layout.php'deki
// "indirim vitrini" / "sevdikleriniz" / "son baktıklarınız" bölümlerinin
// karşılığı (bkz. re-audit bulgusu, önceden hiç toggle edilemiyordu).
const ALL_SECTION_TYPES = [
  "collections",
  "products",
  "about",
  "slider",
  "social",
  "discount",
  "favorites",
  "recently_viewed",
] as const;

// Yeni bölüm tipleri eski sitedeki gibi varsayılan olarak açık gelir -
// vendor daha önce hiç kaydetmediyse (storeLayout'ta hiç yoksa) otomatik
// gizlenmiş gibi davranmamalı (bkz. "discount" - şu ana kadar zaten
// koşulsuz gösteriliyordu, bu davranış korunur).
// bkz. re-audit bulgusu: "collections"/"products"/"about" mağazanın HER
// ZAMAN gösterildiği eski (opt-in olmayan) bölümlerdi - storefront tarafı
// bunları eksikse `?? true` ile zaten görünür varsayıyordu (bkz.
// vendor-storefront.tsx), ama bu liste onları burada varsayılan olarak
// KAPALI gösteriyordu. Sonuç: satıcı panele hiç dokunmadan mağaza düzeni
// sayfasını açtığında anahtarlar kapalı görünüyordu ama vitrin açıktı -
// "kaydet"e basınca da gerçekten kapanıyordu, yani panel yalan söylüyordu.
const DEFAULT_VISIBLE: Partial<Record<(typeof ALL_SECTION_TYPES)[number], boolean>> = {
  collections: true,
  products: true,
  about: true,
  discount: true,
  favorites: true,
  recently_viewed: true,
};

const vendorStoreLayoutRoutes: FastifyPluginAsync = async (app) => {
  app.get("/vendor/store-layout", { preHandler: app.requireVendor }, async (request, reply) => {
    const [row] = await db.select({ storeLayout: vendors.storeLayout }).from(vendors).where(eq(vendors.id, request.session.vendorId!)).limit(1);
    const sections = (row?.storeLayout ?? []) as { type: string; visible: boolean }[];
    const missing = ALL_SECTION_TYPES.filter((t) => !sections.some((s) => s.type === t)).map((type) => ({
      type,
      visible: DEFAULT_VISIBLE[type] ?? false,
    }));
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
