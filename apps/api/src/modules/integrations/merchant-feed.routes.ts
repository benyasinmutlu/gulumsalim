import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { db } from "../../db/client";
import { categories } from "../../db/schema/index";
import { eq } from "drizzle-orm";
import { encryptSecret } from "../../lib/crypto-secret";
import { findVendorById } from "../vendors/vendor.repository";
import { validateFeedUrl } from "./safe-feed-http";
import { feedPreviewInputSchema, feedSourceInputSchema, feedStatusSchema } from "./merchant-feed.types";
import { inspectMerchantFeed, previewMerchantFeed, syncOwnedFeedSource } from "./merchant-feed.service";
import {
  createFeedSource,
  getOwnedFeedSource,
  listAdminFeedSources,
  listFeedRuns,
  listVendorFeedSources,
  setFeedSourceStatus,
  updateFeedSource,
} from "./merchant-feed.repository";

const idParams = z.object({ id: z.coerce.number().int().positive() });

const merchantFeedRoutes: FastifyPluginAsync = async (app) => {
  const requireBusinessVendor = async (request: FastifyRequest, reply: FastifyReply) => {
    const vendor = await findVendorById(request.session.vendorId!);
    if (!vendor || vendor.vendorType !== "business") {
      return reply.status(403).send({ error: { message: "Otomatik feed entegrasyonu yalnız kurumsal üyeler içindir" } });
    }
  };

  app.get("/vendor/feed-sources", { preHandler: [app.requireVendor, requireBusinessVendor] }, async (request, reply) => {
    return reply.send(await listVendorFeedSources(request.session.vendorId!));
  });

  app.post("/vendor/feed-sources/preview", { preHandler: [app.requireVendor, requireBusinessVendor, app.csrfProtection] }, async (request, reply) => {
    try {
      const input = feedPreviewInputSchema.parse(request.body);
      const url = validateFeedUrl(input.url);
      const inspected = await previewMerchantFeed({ url: url.toString(), format: input.format, mapping: input.mapping });
      if (inspected.needsMapping) return reply.send(inspected);
      return reply.send({
        needsMapping: false,
        format: inspected.format,
        mapping: inspected.mapping,
        itemCount: inspected.items.length,
        sample: inspected.items.slice(0, 3).map(({ dataHash: _hash, ...item }) => item),
      });
    } catch (error) {
      return reply.status(422).send({ error: { message: error instanceof Error ? error.message : "Feed önizlenemedi" } });
    }
  });

  app.post("/vendor/feed-sources", { preHandler: [app.requireVendor, requireBusinessVendor, app.csrfProtection] }, async (request, reply) => {
    try {
      const input = feedSourceInputSchema.parse(request.body);
      const url = validateFeedUrl(input.url);
      const [category] = await db.select({ id: categories.id }).from(categories).where(eq(categories.id, input.defaultCategoryId)).limit(1);
      if (!category) return reply.status(400).send({ error: { message: "Geçerli bir varsayılan kategori seçin" } });
      const inspected = await inspectMerchantFeed({ url: url.toString(), format: input.format, mapping: input.mapping });
      const source = await createFeedSource({
        vendorId: request.session.vendorId!,
        name: input.name,
        provider: input.provider,
        format: inspected.format,
        feedHost: url.hostname,
        encryptedUrl: encryptSecret(url.toString()),
        defaultCategoryId: input.defaultCategoryId,
        intervalMinutes: input.intervalMinutes,
        stockBuffer: input.stockBuffer,
        missingGraceRuns: input.missingGraceRuns,
        staleAfterMinutes: input.staleAfterMinutes,
        fieldMapping: inspected.mapping,
      });
      return reply.status(201).send({ id: source.id, status: source.status, itemCount: inspected.items.length });
    } catch (error) {
      if ((error as { code?: string })?.code === "23505") return reply.status(409).send({ error: { message: "Bu isimde bir feed kaynağı zaten var" } });
      return reply.status(422).send({ error: { message: error instanceof Error ? error.message : "Feed kaynağı oluşturulamadı" } });
    }
  });

  app.patch("/vendor/feed-sources/:id", { preHandler: [app.requireVendor, requireBusinessVendor, app.csrfProtection] }, async (request, reply) => {
    try {
      const { id } = idParams.parse(request.params);
      const input = feedSourceInputSchema.parse(request.body);
      const url = validateFeedUrl(input.url);
      const [category] = await db.select({ id: categories.id }).from(categories).where(eq(categories.id, input.defaultCategoryId)).limit(1);
      if (!category) return reply.status(400).send({ error: { message: "Geçerli bir varsayılan kategori seçin" } });
      const inspected = await inspectMerchantFeed({ url: url.toString(), format: input.format, mapping: input.mapping });
      const source = await updateFeedSource(request.session.vendorId!, id, {
        name: input.name,
        provider: input.provider,
        format: inspected.format,
        feedHost: url.hostname,
        encryptedUrl: encryptSecret(url.toString()),
        defaultCategoryId: input.defaultCategoryId,
        intervalMinutes: input.intervalMinutes,
        stockBuffer: input.stockBuffer,
        missingGraceRuns: input.missingGraceRuns,
        staleAfterMinutes: input.staleAfterMinutes,
        fieldMapping: inspected.mapping,
      });
      if (!source) {
        const exists = await getOwnedFeedSource(request.session.vendorId!, id);
        return reply.status(exists ? 409 : 404).send({
          error: { message: exists ? "Kaynak şu anda senkronize ediliyor; kısa süre sonra tekrar deneyin" : "Feed kaynağı bulunamadı" },
        });
      }
      return reply.send({ id: source.id, status: source.status, itemCount: inspected.items.length });
    } catch (error) {
      if ((error as { code?: string })?.code === "23505") return reply.status(409).send({ error: { message: "Bu isimde bir feed kaynağı zaten var" } });
      return reply.status(422).send({ error: { message: error instanceof Error ? error.message : "Feed bağlantısı yenilenemedi" } });
    }
  });

  app.patch("/vendor/feed-sources/:id/status", { preHandler: [app.requireVendor, requireBusinessVendor, app.csrfProtection] }, async (request, reply) => {
    const { id } = idParams.parse(request.params);
    const { status } = z.object({ status: feedStatusSchema.exclude(["error"]) }).parse(request.body);
    const source = await setFeedSourceStatus(request.session.vendorId!, id, status);
    if (!source) {
      const exists = await getOwnedFeedSource(request.session.vendorId!, id);
      return reply.status(exists ? 409 : 404).send({
        error: { message: exists ? "Kaynak şu anda senkronize ediliyor; kısa süre sonra tekrar deneyin" : "Feed kaynağı bulunamadı" },
      });
    }
    return reply.send({ id: source.id, status: source.status });
  });

  app.post("/vendor/feed-sources/:id/sync", { preHandler: [app.requireVendor, requireBusinessVendor, app.csrfProtection] }, async (request, reply) => {
    const { id } = idParams.parse(request.params);
    const owned = await getOwnedFeedSource(request.session.vendorId!, id);
    if (!owned) return reply.status(404).send({ error: { message: "Feed kaynağı bulunamadı" } });
    if (owned.status === "paused") return reply.status(409).send({ error: { message: "Kontrolü çalıştırmadan önce feed kaynağını etkinleştirin" } });
    try {
      return reply.send(await syncOwnedFeedSource(request.session.vendorId!, id));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Feed senkronizasyonu başarısız";
      const busy = message.includes("başka bir senkron");
      return reply.status(busy ? 409 : 502).send({ error: { message } });
    }
  });

  app.get("/vendor/feed-sources/:id/runs", { preHandler: [app.requireVendor, requireBusinessVendor] }, async (request, reply) => {
    const { id } = idParams.parse(request.params);
    return reply.send(await listFeedRuns(request.session.vendorId!, id));
  });

  app.get("/admin/feed-sources", { preHandler: app.requireAdmin }, async (_request, reply) => {
    return reply.send(await listAdminFeedSources());
  });
};

export default merchantFeedRoutes;
