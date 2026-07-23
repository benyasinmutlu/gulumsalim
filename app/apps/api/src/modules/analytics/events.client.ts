import type { FastifyInstance } from "fastify";

export type BehavioralEventType = "view" | "favorite" | "cart_add" | "purchase";

interface EmitEventParams {
  type: BehavioralEventType;
  customerId?: number;
  productId: number;
  vendorId?: number;
  categoryId?: number;
  sessionId?: string;
}

const MAX_STREAM_LENGTH = "500000";

// Ateşle-unut: Go keşfet servisi Redis Stream'i tüketir (bkz.
// services/discovery/internal/ingest). Bu fonksiyon asla await edilmez
// ve hata durumunda isteği asla çökertmez - analitik, çekirdek işlevin
// (görüntüleme/sepete ekleme/satın alma) yan etkisi, ön koşulu değil.
export function emitBehavioralEvent(app: FastifyInstance, params: EmitEventParams): void {
  const fields: Record<string, string> = {
    type: params.type,
    productId: String(params.productId),
    ts: String(Date.now()),
  };
  if (params.customerId) fields.customerId = String(params.customerId);
  if (params.vendorId) fields.vendorId = String(params.vendorId);
  if (params.categoryId) fields.categoryId = String(params.categoryId);
  if (params.sessionId) fields.sessionId = params.sessionId;

  const args = Object.entries(fields).flat();
  app.redis
    .xadd("events:behavioral", "MAXLEN", "~", MAX_STREAM_LENGTH, "*", ...args)
    .catch((err: unknown) => {
      app.log.warn({ err }, "davranışsal event gönderilemedi");
    });
}
