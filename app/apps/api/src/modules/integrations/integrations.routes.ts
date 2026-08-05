import { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import type { SalesChannel } from "./inventory-sync";
import {
  atomicDecrementProductStock,
  atomicDecrementVariantStock,
  getListingByBarcode,
  insertChannelListing,
  listVendorChannelListings,
  setListingEnabled,
} from "./inventory-sync.repository";
import { enqueueStockSync } from "./inventory-sync.service";

// Kanalın webhook'undan gelen (normalize) sipariş satırı.
interface OrderLine {
  barcode: string;
  quantity: number;
}

// Kanal-agnostik çekirdek: her satır için barkoddan listing bul -> merkez stoğu
// ATOMİK düş -> diğer kanallara outbox yaz. Yetersiz stok / eşleşmeyen barkod
// güvenle atlanır.
async function processChannelOrder(channel: SalesChannel, lines: OrderLine[]): Promise<{ processed: number }> {
  let processed = 0;
  for (const line of lines) {
    if (!line.barcode || !Number.isFinite(line.quantity) || line.quantity <= 0) continue;
    const listing = await getListingByBarcode(channel, line.barcode);
    if (!listing) continue;
    const newStock = listing.variantId
      ? await atomicDecrementVariantStock(listing.variantId, line.quantity)
      : await atomicDecrementProductStock(listing.productId, line.quantity);
    if (newStock === null) continue; // yetersiz stok (merkezde zaten tükenmiş)
    await enqueueStockSync(listing.productId, newStock, channel); // satışı bildiren kanal hariç
    processed++;
  }
  return { processed };
}

// Çeşitli webhook gövdelerinden {barcode, quantity} satırlarını toleranslı çıkar.
// ⚠️ Kanalın GERÇEK payload'ı ile (anahtar gelince) doğrulanmalı; bu lenient
// parser yaygın şekilleri (lines/items/orderLines) yakalar.
function extractOrderLines(body: unknown): OrderLine[] {
  const out: OrderLine[] = [];
  const visit = (obj: unknown): void => {
    if (!obj || typeof obj !== "object") return;
    const rec = obj as Record<string, unknown>;
    const arr = (rec.lines ?? rec.items ?? rec.orderLines ?? rec.content) as unknown;
    if (Array.isArray(arr)) {
      for (const it of arr) {
        const r = it as Record<string, unknown>;
        const barcode = String(r.barcode ?? r.sku ?? r.productCode ?? "");
        const quantity = Number(r.quantity ?? r.amount ?? r.count ?? 0);
        if (barcode && quantity > 0) out.push({ barcode, quantity });
      }
    }
    for (const v of Object.values(rec)) if (typeof v === "object") visit(v);
  };
  visit(body);
  return out;
}

const newListingSchema = z.object({
  channel: z.enum(["trendyol", "ikas"]),
  productId: z.number().int().positive(),
  variantId: z.number().int().positive().optional(),
  externalBarcode: z.string().min(1),
});

const integrationsRoutes: FastifyPluginAsync = async (app) => {
  // ---- Satıcı: kanal listing yönetimi ----
  app.get("/vendor/channel-listings", { preHandler: app.requireVendor }, async (request, reply) => {
    return reply.send(await listVendorChannelListings(request.session.vendorId!));
  });

  app.post("/vendor/channel-listings", { preHandler: [app.requireVendor, app.csrfProtection] }, async (request, reply) => {
    const input = newListingSchema.parse(request.body);
    const row = await insertChannelListing(input);
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
    const result = await processChannelOrder(channel, lines);
    return reply.send({ ok: true, ...result });
  };

  app.post("/webhooks/trendyol", webhookHandler("trendyol"));
  app.post("/webhooks/ikas", webhookHandler("ikas"));
};

export default integrationsRoutes;
