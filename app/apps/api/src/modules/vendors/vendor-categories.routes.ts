import { FastifyPluginAsync } from "fastify";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../../db/client";
import { categories } from "../../db/schema/index";
import { slugify } from "../../lib/slugify";

const createVendorCategorySchema = z.object({
  name: z.string().min(2).max(60),
  parentId: z.coerce.number().int().positive().nullable().optional(),
});

// bkz. kullanıcı isteği: "satıcı panelinde ürün eklemede kategori eklemede
// olsun ve bu şekilde kategori çeşitliliğimiz artar" - satıcı, ürün ekleme
// formundan ayrılmadan yeni bir kategori oluşturabilir. Admin/kategoriler
// sayfasındaki tam formun aksine (ikon/görsel/SEO) burada bilinçli olarak
// sadece isim var - hızlı ekleme akışı, ince ayar admin panelden yapılır.
const vendorCategoriesRoutes: FastifyPluginAsync = async (app) => {
  app.post("/vendor/categories", { preHandler: [app.requireVendor, app.csrfProtection] }, async (request, reply) => {
    const { name, parentId } = createVendorCategorySchema.parse(request.body);
    const slug = slugify(name);
    const existing = await db.select({ id: categories.id }).from(categories).where(eq(categories.slug, slug)).limit(1);
    if (existing.length > 0) {
      return reply.status(409).send({ error: { message: "Bu isimde bir kategori zaten var" } });
    }
    const [row] = await db.insert(categories).values({ name, slug, parentId: parentId ?? null }).returning();
    return reply.status(201).send(row);
  });
};

export default vendorCategoriesRoutes;
