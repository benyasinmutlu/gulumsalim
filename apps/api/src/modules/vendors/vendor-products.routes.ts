import { FastifyPluginAsync } from "fastify";
import { removeProductFromIndex, syncProductToIndex } from "../catalog/search-index.service";
import { InvalidImageError, saveProductImage } from "./image-upload.service";
import { InvalidVideoError, saveVideo } from "../../lib/video-upload";
import { deleteObject } from "../../lib/storage";
import { getCartCounts } from "../../lib/cart-product-index";
import { findVendorById } from "./vendor.repository";
import {
  deleteProductImageById,
  deleteProductVariant,
  deleteVendorProduct,
  findProductBySlugAnyVendor,
  findProductImageOwnedByVendor,
  findVariantOwnedByVendor,
  findVendorProduct,
  insertProductImage,
  insertProductVariant,
  insertVendorProduct,
  listProductImages,
  listProductVariants,
  listVendorProducts,
  setPrimaryProductImage,
  updateProductVariant,
  updateVendorProduct,
} from "./vendor-products.repository";
import {
  createProductSchema,
  createVariantSchema,
  productIdParamsSchema,
  productImageParamsSchema,
  productVariantParamsSchema,
  updateProductSchema,
  updateVariantSchema,
} from "./vendor-products.schemas";

// bkz. kullanıcı isteği (2026-08-02): "kullanıcıların şikayet ettiklerini
// araştır, o özellikler bizde de olsun" - araştırma, Türkiye pazaryerlerinde
// "eski fiyatın" satıştan hemen önce yapay olarak şişirilip sahte büyük
// indirim gösterilmesinin en yaygın/kanıtlanmış şikayet olduğunu ve
// Ticaret Bakanlığı'nın 2026-08-01'de bu "aldatıcı indirim" uygulamasını
// yönetmelikle yasakladığını ortaya koydu. Önceki halde compareAtPrice için
// basePrice'a göre HİÇBİR sınır yoktu (bir satıcı 10 TL'lik ürüne 10.000 TL
// "eski fiyat" yazıp "%99 indirim" gösterebilirdi). MAX_DISCOUNT_MULTIPLE
// gerçekçi bir tavan koyuyor (~%80 indirime kadar meşru, ötesi güven
// sorunu) - bu hem yasal uyum hem de platformun "sahte indirim yok" güven
// vaadinin (bkz. anasayfa "Neden Gülüm Şalım" bölümü) teknik güvencesi.
const MAX_DISCOUNT_MULTIPLE = 5;

function validateDiscountPricing(basePrice: number, compareAtPrice: number | undefined): string | null {
  if (compareAtPrice === undefined) return null;
  if (compareAtPrice <= basePrice) {
    return "Karşılaştırma (eski) fiyat, güncel fiyattan yüksek olmalı.";
  }
  if (compareAtPrice > basePrice * MAX_DISCOUNT_MULTIPLE) {
    return "Karşılaştırma fiyatı gerçekçi olmayan şekilde yüksek görünüyor - lütfen gerçek eski satış fiyatını girin.";
  }
  return null;
}

const vendorProductsRoutes: FastifyPluginAsync = async (app) => {
  app.get("/vendor/products", { preHandler: app.requireVendor }, async (request, reply) => {
    const rows = await listVendorProducts(request.session.vendorId!);
    const cartCounts = await getCartCounts(app.redis, rows.map((r) => r.id));
    return reply.send(rows.map((r) => ({ ...r, cartCount: cartCounts.get(r.id) ?? 0 })));
  });

  app.post("/vendor/products", { preHandler: [app.requireVendor, app.csrfProtection] }, async (request, reply) => {
    const input = createProductSchema.parse(request.body);
    const existingSlug = await findProductBySlugAnyVendor(input.slug);
    if (existingSlug) {
      return reply.status(409).send({ error: { message: "Bu ürün adresi zaten kullanılıyor" } });
    }

    const pricingError = validateDiscountPricing(input.basePrice, input.compareAtPrice);
    if (pricingError) {
      return reply.status(400).send({ error: { message: pricingError } });
    }

    // bkz. olay: 2026-08-02 "bireysel satıcıların ürünleri yayınlanması için
    // onaylanması gerekiyor adminden ... en son adım yayınlaya basınca onay
    // sürecine gitmeli" - sihirbazın son adımı ürünü ancak Yayınla'ya
    // basılınca oluşturduğu için (bkz. new-product-form.tsx), bireysel
    // satıcıda bu an "pending" (onay bekliyor) demek. Kurumsal satıcıda
    // davranış değişmedi (draft, kendisi aktif eder).
    const vendor = await findVendorById(request.session.vendorId!);
    const initialStatus = vendor?.vendorType === "individual" ? "pending" : undefined;

    const product = await insertVendorProduct(request.session.vendorId!, {
      categoryId: input.categoryId,
      name: input.name,
      slug: input.slug,
      description: input.description,
      brand: input.brand,
      basePrice: input.basePrice.toFixed(2),
      compareAtPrice: input.compareAtPrice?.toFixed(2),
      // bkz. kullanıcı isteği: "normal kurumsal satıcılar için 2.el seçeneği
      // olmasın" - istemci arayüzü kurumsal satıcıda bu seçeneği zaten
      // göstermiyor, ama doğrudan API isteğiyle atlatılamasın diye burada da
      // zorlanıyor.
      isSecondHand: vendor?.vendorType === "individual" ? input.isSecondHand : false,
      status: initialStatus,
      // bkz. kullanıcı isteği (2026-08-03): "kurumsal satıcıların stokları
      // zorunlu olarak girilmeli bireysel satıcıların ise ... stoğu 1
      // olacak" - bireysel satıcıda istemciden ne gelirse gelsin hep 1'e
      // zorlanır (tek parça satılıyor, bkz. şema yorumuna). Kurumsal
      // satıcıda istemcinin girdiği stok aynen kullanılır - varyant
      // eklenecekse (renk/beden satırları) bu 0 kalabilir, o durumda gerçek
      // stok kaynağı variant toplamıdır (bkz. listVendorProducts
      // totalStock); ürünü aktife çekerken varyantsız + stok=0 ise PATCH
      // route'u reddeder (bkz. aşağıdaki "active" kontrolü).
      stock: vendor?.vendorType === "individual" ? 1 : (input.stock ?? 0),
    });
    syncProductToIndex(product.id).catch(() => {});
    return reply.status(201).send(product);
  });

  app.patch("/vendor/products/:id", { preHandler: [app.requireVendor, app.csrfProtection] }, async (request, reply) => {
    const { id } = productIdParamsSchema.parse(request.params);
    const input = updateProductSchema.parse(request.body);

    if (input.slug) {
      const existingSlug = await findProductBySlugAnyVendor(input.slug);
      if (existingSlug && existingSlug.id !== id) {
        return reply.status(409).send({ error: { message: "Bu ürün adresi zaten kullanılıyor" } });
      }
    }

    // bkz. olay: 2026-08-02 - bireysel satıcı bir ürünü taslak/reddedildi/
    // onay bekliyor durumundan doğrudan "aktif"e çekemez, admin onayından
    // geçmesi gerekir (bkz. POST handler'daki aynı gerekçe). Daha önce
    // onaylanmış (yani "inactive"ten geliyor - satıcı kendi durdurmuştu)
    // bir ürünü yeniden aktif etmek istisna: bu yeniden onay istemiyor,
    // sadece "satışa devam" anlamına geliyor.
    //
    // bkz. kullanıcı isteği (2026-08-03): "kurumsal satıcıların stokları
    // zorunlu olarak girilmeli" - kurumsal satıcı, varyantı olmayan bir
    // ürünü stok girmeden aktife çekemez (varyantı varsa stok zaten
    // variant seviyesinde tutuluyor, bkz. vendor-products.repository.ts
    // listVendorProducts totalStock).
    if (input.status === "active") {
      const current = await findVendorProduct(request.session.vendorId!, id);
      const vendor = await findVendorById(request.session.vendorId!);
      if (current && current.status !== "inactive" && vendor?.vendorType === "individual") {
        return reply.status(403).send({
          error: { message: "Ürününüz yayınlanmadan önce admin onayından geçmesi gerekiyor. Önce 'Onaya Gönder'i kullanın." },
        });
      }
      if (current && vendor?.vendorType !== "individual") {
        const variants = await listProductVariants(id);
        const effectiveStock = input.stock ?? current.stock;
        if (variants.length === 0 && effectiveStock <= 0) {
          return reply.status(400).send({
            error: { message: "Ürünü yayınlamadan önce stok adedi girmelisiniz." },
          });
        }
      }
    }


    if (input.basePrice !== undefined || input.compareAtPrice !== undefined) {
      const current = await findVendorProduct(request.session.vendorId!, id);
      if (current) {
        const effectiveBasePrice = input.basePrice ?? Number(current.basePrice);
        const effectiveCompareAtPrice = input.compareAtPrice ?? (current.compareAtPrice ? Number(current.compareAtPrice) : undefined);
        const pricingError = validateDiscountPricing(effectiveBasePrice, effectiveCompareAtPrice);
        if (pricingError) {
          return reply.status(400).send({ error: { message: pricingError } });
        }
      }
    }

    // bkz. POST handler'daki aynı gerekçe - kurumsal satıcı isSecondHand'i
    // doğrudan API isteğiyle de set edemesin.
    let isSecondHandOverride: boolean | undefined;
    if (input.isSecondHand !== undefined) {
      const vendor = await findVendorById(request.session.vendorId!);
      isSecondHandOverride = vendor?.vendorType === "individual" ? input.isSecondHand : false;
    }

    // bkz. yukarıdaki gerekçe - bireysel satıcının stoğu (hep 1, satılınca
    // sistem otomatik düşürür) doğrudan API isteğiyle değiştirilemesin, bu
    // yüzden onlarda gelen stock alanı sessizce yoksayılır (aşağıda ...input
    // yayılımından ÖNCE çıkarılır).
    const { stock: inputStock, ...restInput } = input;
    let stockPatch: number | undefined;
    if (inputStock !== undefined) {
      const vendor = await findVendorById(request.session.vendorId!);
      if (vendor?.vendorType !== "individual") stockPatch = inputStock;
    }

    const updated = await updateVendorProduct(request.session.vendorId!, id, {
      ...restInput,
      basePrice: input.basePrice?.toFixed(2),
      compareAtPrice: input.compareAtPrice?.toFixed(2),
      ...(isSecondHandOverride !== undefined ? { isSecondHand: isSecondHandOverride } : {}),
      ...(stockPatch !== undefined ? { stock: stockPatch } : {}),
    });
    if (!updated) {
      return reply.status(404).send({ error: { message: "Ürün bulunamadı" } });
    }
    syncProductToIndex(id).catch(() => {});
    return reply.send(updated);
  });

  app.delete("/vendor/products/:id", { preHandler: [app.requireVendor, app.csrfProtection] }, async (request, reply) => {
    const { id } = productIdParamsSchema.parse(request.params);
    const result = await deleteVendorProduct(request.session.vendorId!, id);
    if (result.blockedByOrders) {
      return reply.status(409).send({
        error: { message: "Bu ürün daha önce sipariş edildiği için silinemez. Bunun yerine ürünü pasife alabilirsiniz." },
      });
    }
    if (!result.deleted) {
      return reply.status(404).send({ error: { message: "Ürün bulunamadı" } });
    }
    removeProductFromIndex(id).catch(() => {});
    for (const url of result.imageUrls ?? []) {
      deleteObject(url).catch(() => {});
    }
    return reply.send({ ok: true });
  });

  app.get("/vendor/products/:id/images", { preHandler: app.requireVendor }, async (request, reply) => {
    const { id } = productIdParamsSchema.parse(request.params);
    const product = await findVendorProduct(request.session.vendorId!, id);
    if (!product) {
      return reply.status(404).send({ error: { message: "Ürün bulunamadı" } });
    }
    return reply.send(await listProductImages(id));
  });

  app.post("/vendor/products/:id/images", { preHandler: [app.requireVendor, app.csrfProtection] }, async (request, reply) => {
    const { id } = productIdParamsSchema.parse(request.params);
    const product = await findVendorProduct(request.session.vendorId!, id);
    if (!product) {
      return reply.status(404).send({ error: { message: "Ürün bulunamadı" } });
    }

    const file = await request.file();
    if (!file) {
      return reply.status(400).send({ error: { message: "Dosya bulunamadı" } });
    }
    const buffer = await file.toBuffer();

    try {
      const url = await saveProductImage(request.session.vendorId!, buffer, file.mimetype);
      const existingImages = await listProductImages(id);
      const image = await insertProductImage(id, url, existingImages.length === 0, existingImages.length);
      return reply.status(201).send(image);
    } catch (err) {
      if (err instanceof InvalidImageError) {
        return reply.status(400).send({ error: { message: err.message } });
      }
      throw err;
    }
  });

  app.delete(
    "/vendor/products/:id/images/:imageId",
    { preHandler: [app.requireVendor, app.csrfProtection] },
    async (request, reply) => {
      const { imageId } = productImageParamsSchema.parse(request.params);
      const image = await findProductImageOwnedByVendor(request.session.vendorId!, imageId);
      if (!image) {
        return reply.status(404).send({ error: { message: "Görsel bulunamadı" } });
      }
      await deleteProductImageById(image.id);
      deleteObject(image.url).catch(() => {}); // S3/local orphan temizliği (best-effort)
      return reply.send({ ok: true });
    },
  );

  app.post(
    "/vendor/products/:id/images/:imageId/primary",
    { preHandler: [app.requireVendor, app.csrfProtection] },
    async (request, reply) => {
      const { id, imageId } = productImageParamsSchema.parse(request.params);
      const image = await findProductImageOwnedByVendor(request.session.vendorId!, imageId);
      if (!image) {
        return reply.status(404).send({ error: { message: "Görsel bulunamadı" } });
      }
      await setPrimaryProductImage(id, imageId);
      return reply.send({ ok: true });
    },
  );

  app.get("/vendor/products/:id/variants", { preHandler: app.requireVendor }, async (request, reply) => {
    const { id } = productIdParamsSchema.parse(request.params);
    const product = await findVendorProduct(request.session.vendorId!, id);
    if (!product) {
      return reply.status(404).send({ error: { message: "Ürün bulunamadı" } });
    }
    return reply.send(await listProductVariants(id));
  });

  app.post("/vendor/products/:id/variants", { preHandler: [app.requireVendor, app.csrfProtection] }, async (request, reply) => {
    const { id } = productIdParamsSchema.parse(request.params);
    const product = await findVendorProduct(request.session.vendorId!, id);
    if (!product) {
      return reply.status(404).send({ error: { message: "Ürün bulunamadı" } });
    }
    const input = createVariantSchema.parse(request.body);
    const variant = await insertProductVariant(id, {
      sku: input.sku,
      size: input.size,
      color: input.color,
      priceOverride: input.priceOverride?.toFixed(2),
      stock: input.stock,
    });
    syncProductToIndex(id).catch(() => {});
    return reply.status(201).send(variant);
  });

  app.patch(
    "/vendor/products/:id/variants/:variantId",
    { preHandler: [app.requireVendor, app.csrfProtection] },
    async (request, reply) => {
      const { id, variantId } = productVariantParamsSchema.parse(request.params);
      const owned = await findVariantOwnedByVendor(request.session.vendorId!, variantId);
      if (!owned) {
        return reply.status(404).send({ error: { message: "Varyant bulunamadı" } });
      }
      const input = updateVariantSchema.parse(request.body);
      const updated = await updateProductVariant(variantId, {
        ...input,
        priceOverride: input.priceOverride?.toFixed(2),
      });
      syncProductToIndex(id).catch(() => {});
      return reply.send(updated);
    },
  );

  app.delete(
    "/vendor/products/:id/variants/:variantId",
    { preHandler: [app.requireVendor, app.csrfProtection] },
    async (request, reply) => {
      const { id, variantId } = productVariantParamsSchema.parse(request.params);
      const owned = await findVariantOwnedByVendor(request.session.vendorId!, variantId);
      if (!owned) {
        return reply.status(404).send({ error: { message: "Varyant bulunamadı" } });
      }
      await deleteProductVariant(variantId);
      syncProductToIndex(id).catch(() => {});
      return reply.send({ ok: true });
    },
  );
  // ---- Ürün tanıtım videosu ----
  // Satıcı ürününe tek bir video ekler (MP4/WebM/MOV, maks. 50MB). Görsellerle
  // aynı mülkiyet + CSRF koruması; video storage sürücüsüne (S3) gider,
  // products.video_url'e yazılır. Yeni yükleme öncekini mantıksal olarak
  // değiştirir (eski dosya S3'te orphan kalabilir - temizlik ayrı iş).
  app.post("/vendor/products/:id/video", { preHandler: [app.requireVendor, app.csrfProtection] }, async (request, reply) => {
    const { id } = productIdParamsSchema.parse(request.params);
    const product = await findVendorProduct(request.session.vendorId!, id);
    if (!product) {
      return reply.status(404).send({ error: { message: "Ürün bulunamadı" } });
    }
    const file = await request.file();
    if (!file) {
      return reply.status(400).send({ error: { message: "Dosya bulunamadı" } });
    }
    const previousVideo = product.videoUrl;
    try {
      const buffer = await file.toBuffer();
      const url = await saveVideo(`videos/${request.session.vendorId}`, buffer, file.mimetype);
      const updated = await updateVendorProduct(request.session.vendorId!, id, { videoUrl: url });
      if (previousVideo && previousVideo !== url) deleteObject(previousVideo).catch(() => {}); // eski videoyu temizle
      return reply.status(201).send(updated);
    } catch (err) {
      if (err instanceof InvalidVideoError) {
        return reply.status(400).send({ error: { message: err.message } });
      }
      if ((err as { code?: string })?.code === "FST_REQ_FILE_TOO_LARGE") {
        return reply.status(413).send({ error: { message: "Video çok büyük (en fazla 50MB)" } });
      }
      throw err;
    }
  });

  app.delete("/vendor/products/:id/video", { preHandler: [app.requireVendor, app.csrfProtection] }, async (request, reply) => {
    const { id } = productIdParamsSchema.parse(request.params);
    const product = await findVendorProduct(request.session.vendorId!, id);
    if (!product) {
      return reply.status(404).send({ error: { message: "Ürün bulunamadı" } });
    }
    await updateVendorProduct(request.session.vendorId!, id, { videoUrl: null });
    if (product.videoUrl) deleteObject(product.videoUrl).catch(() => {}); // videoyu depodan da sil
    return reply.send({ ok: true });
  });
};

export default vendorProductsRoutes;
