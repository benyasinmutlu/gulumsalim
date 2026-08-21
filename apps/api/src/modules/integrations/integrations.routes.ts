import { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import type { SalesChannel } from "./inventory-sync";
import {
  insertChannelListing,
  listVendorChannelListings,
  setListingEnabled,
} from "./inventory-sync.repository";
import { getChannelClient } from "./channel-client";
import { ALL_CHANNELS } from "./inventory-sync";
import { parseChannelCreds } from "./credentials";
import {
  deleteVendorCredentials,
  getVendorChannelStatuses,
  getVendorCredentials,
  markVendorCredentialError,
  setVendorCredentials,
} from "./credentials.repository";
import { deriveChannelWebhookIdentity } from "./channel-webhook";
import { processChannelOrderOnce, type ChannelOrderLine } from "./channel-order.service";

const channelParam = z.enum(["trendyol", "ikas", "ticimax"]);

// Kanalın webhook'undan gelen (normalize) sipariş satırı.
// Çeşitli webhook gövdelerinden {barcode, quantity} satırlarını toleranslı çıkar.
// ⚠️ Kanalın GERÇEK payload'ı ile (anahtar gelince) doğrulanmalı; bu lenient
// parser yaygın şekilleri (lines/items/orderLines) yakalar.
function extractOrderLines(body: unknown): ChannelOrderLine[] {
  const out: ChannelOrderLine[] = [];
  const visit = (obj: unknown): void => {
    if (!obj || typeof obj !== "object") return;
    const rec = obj as Record<string, unknown>;
    const arr = (rec.lines ?? rec.items ?? rec.orderLines ?? rec.content ?? rec.Urunler ?? rec.Urun_Liste) as unknown;
    if (Array.isArray(arr)) {
      for (const it of arr) {
        const r = it as Record<string, unknown>;
        const barcode = String(r.barcode ?? r.Barkod ?? r.sku ?? r.StokKodu ?? r.productCode ?? "");
        const quantity = Number(r.quantity ?? r.Adet ?? r.amount ?? r.count ?? 0);
        if (barcode && quantity > 0) out.push({ barcode, quantity });
      }
    }
    for (const v of Object.values(rec)) if (typeof v === "object") visit(v);
  };
  visit(body);
  return out;
}

const newListingSchema = z.object({
  channel: z.enum(["trendyol", "ikas", "ticimax"]),
  productId: z.number().int().positive(),
  variantId: z.number().int().positive().optional(),
  externalBarcode: z.string().min(1),
  externalProductId: z.string().trim().optional(),
}).superRefine((value, ctx) => {
  if (value.channel === "ticimax" && !/^[1-9]\d*$/.test(value.externalProductId ?? "")) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["externalProductId"], message: "Ticimax varyasyon ID pozitif bir sayı olmalı" });
  }
});

const integrationsRoutes: FastifyPluginAsync = async (app) => {
  // ---- Satıcı: kanal bağlantı durumu (PER-VENDOR — her satıcı kendi hesabı) ----
  app.get("/vendor/integrations/status", { preHandler: app.requireVendor }, async (request, reply) => {
    const statuses = await getVendorChannelStatuses(request.session.vendorId!);
    const map = new Map(statuses.map((s) => [s.channel, s]));
    const channels = ALL_CHANNELS.map((ch) => {
      const s = map.get(ch);
      return {
        channel: ch,
        connected: s?.connected ?? false,
        status: s?.status ?? "disconnected",
        lastError: s?.lastError ?? null,
        lastCheckedAt: s?.lastCheckedAt ?? null,
      };
    });
    return reply.send({ channels });
  });

  // ---- Satıcı: kendi kanal API anahtarını bağla (canlı doğrulama ile) ----
  app.post("/vendor/integrations/:channel/connect", { preHandler: [app.requireVendor, app.csrfProtection] }, async (request, reply) => {
    const channel = channelParam.parse((request.params as { channel: string }).channel);
    let creds;
    try {
      creds = parseChannelCreds(channel, request.body);
    } catch {
      return reply.status(400).send({ error: { message: "Eksik veya geçersiz kimlik bilgisi." } });
    }
    // Anahtarları KAYDETMEDEN önce kanala karşı canlı doğrula.
    const test = await getChannelClient(channel, creds).testConnection();
    if (!test.ok) return reply.status(400).send({ error: { message: test.error ?? "Bağlantı doğrulanamadı." } });
    await setVendorCredentials(request.session.vendorId!, channel, creds);
    return reply.send({ ok: true, channel, connected: true });
  });

  // ---- Satıcı: kanal bağlantısını kaldır ----
  app.post("/vendor/integrations/:channel/disconnect", { preHandler: [app.requireVendor, app.csrfProtection] }, async (request, reply) => {
    const channel = channelParam.parse((request.params as { channel: string }).channel);
    await deleteVendorCredentials(request.session.vendorId!, channel);
    return reply.send({ ok: true, channel, connected: false });
  });

  // ---- Satıcı: mevcut bağlantıyı yeniden test et ----
  app.post("/vendor/integrations/:channel/test", { preHandler: [app.requireVendor, app.csrfProtection] }, async (request, reply) => {
    const channel = channelParam.parse((request.params as { channel: string }).channel);
    const creds = await getVendorCredentials(request.session.vendorId!, channel);
    if (!creds) return reply.status(404).send({ error: { message: "Bu kanal bağlı değil." } });
    const test = await getChannelClient(channel, creds).testConnection();
    if (!test.ok) {
      await markVendorCredentialError(request.session.vendorId!, channel, test.error ?? "test başarısız");
      return reply.status(400).send({ error: { message: test.error ?? "Bağlantı testi başarısız." } });
    }
    await setVendorCredentials(request.session.vendorId!, channel, creds); // durum=connected + son kontrol zamanı
    return reply.send({ ok: true });
  });

  // ---- Satıcı: kanal listing yönetimi ----
  app.get("/vendor/channel-listings", { preHandler: app.requireVendor }, async (request, reply) => {
    return reply.send(await listVendorChannelListings(request.session.vendorId!));
  });

  app.post("/vendor/channel-listings", { preHandler: [app.requireVendor, app.csrfProtection] }, async (request, reply) => {
    const input = newListingSchema.parse(request.body);
    const row = await insertChannelListing(input, request.session.vendorId!);
    if (!row) return reply.status(409).send({ error: { message: "Bu ürün bu kanalda zaten listeli (ya da barkod çakışması)" } });
    return reply.status(201).send(row);
  });

  app.patch("/vendor/channel-listings/:id", { preHandler: [app.requireVendor, app.csrfProtection] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { enabled } = z.object({ enabled: z.boolean() }).parse(request.body);
    const row = await setListingEnabled(Number(id), request.session.vendorId!, enabled);
    if (!row) return reply.status(404).send({ error: { message: "Listing bulunamadı" } });
    return reply.send(row);
  });

  // ---- Kanal webhook'ları (gelen sipariş -> merkez stok düş) ----
  // GÜVENLİK: fail-closed shared-secret. Kanal, webhook URL'sine ?token=<secret>
  // ekler; INTEGRATIONS_WEBHOOK_SECRET env'i set değilse TÜM webhook'lar reddedilir
  // (kimse sahte siparişle stok sıfırlayamasın).
  const webhookHandler = (channel: SalesChannel) => async (request: import("fastify").FastifyRequest, reply: import("fastify").FastifyReply) => {
    const secret = process.env.INTEGRATIONS_WEBHOOK_SECRET;
    const provided = (request.query as { token?: string })?.token ?? request.headers["x-webhook-secret"];
    if (!secret || provided !== secret) return reply.status(401).send({ error: { message: "Yetkisiz webhook" } });
    const lines = extractOrderLines(request.body);
    const identity = deriveChannelWebhookIdentity(channel, request.body, request.headers);
    const result = await processChannelOrderOnce({ channel, lines, ...identity });
    return reply.send({ ok: true, ...result });
  };

  app.post("/webhooks/trendyol", webhookHandler("trendyol"));
  app.post("/webhooks/ikas", webhookHandler("ikas"));
  app.post("/webhooks/ticimax", webhookHandler("ticimax"));
};

export default integrationsRoutes;
