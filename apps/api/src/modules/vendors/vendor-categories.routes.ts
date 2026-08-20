import { FastifyPluginAsync } from "fastify";

// Satıcılar artık kategori OLUŞTURAMAZ - kategoriler yalnızca yönetim (admin)
// tarafından belirlenir; aksi halde gelen geçen her mağaza keyfine göre
// kategori açar ve kategori ağacı bozulurdu. Uç nokta bilinçli olarak 403
// döndürür (route kayıtlı kalır ki eski/manuel bir istemci net bir "yetkiniz
// yok" cevabı alsın). Ürün ekleme formundaki "+Yeni kategori" UI'ı da
// kaldırıldı (bkz. web new-product-form.tsx) - bu backend tarafı savunmadır.
const vendorCategoriesRoutes: FastifyPluginAsync = async (app) => {
  app.post("/vendor/categories", { preHandler: [app.requireVendor, app.csrfProtection] }, async (_request, reply) => {
    return reply
      .status(403)
      .send({ error: { message: "Kategori oluşturma yetkiniz yok. Kategoriler yönetim tarafından belirlenir." } });
  });
};

export default vendorCategoriesRoutes;
