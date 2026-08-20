import { z } from "zod";
import type { SalesChannel } from "./inventory-sync";

// =============================================================================
// Kanal kimlik bilgisi tipleri + doğrulama (SAF). Her SATICI kendi hesabının
// anahtarını girer (per-vendor); DB'de şifreli saklanır (bkz. crypto-secret).
// =============================================================================

export const trendyolCredsSchema = z.object({
  supplierId: z.string().trim().min(1, "Supplier ID gerekli"),
  apiKey: z.string().trim().min(1, "API Key gerekli"),
  apiSecret: z.string().trim().min(1, "API Secret gerekli"),
});

export const ikasCredsSchema = z.object({
  clientId: z.string().trim().min(1, "Client ID gerekli"),
  clientSecret: z.string().trim().min(1, "Client Secret gerekli"),
  storeName: z.string().trim().min(1, "Mağaza adı gerekli").regex(/^[a-zA-Z0-9-]+$/, "Mağaza adı yalnız harf/rakam/tire"),
});

export type TrendyolCreds = z.infer<typeof trendyolCredsSchema>;
export type IkasCreds = z.infer<typeof ikasCredsSchema>;
export type ChannelCreds = TrendyolCreds | IkasCreds;

// Kanala göre gövdeyi doğrula (route'ta kullanılır). Geçersizse zod fırlatır.
export function parseChannelCreds(channel: SalesChannel, body: unknown): ChannelCreds {
  return channel === "trendyol" ? trendyolCredsSchema.parse(body) : ikasCredsSchema.parse(body);
}

// Tip daraltma yardımcıları.
export function isTrendyolCreds(c: ChannelCreds): c is TrendyolCreds {
  return "supplierId" in c;
}
export function isIkasCreds(c: ChannelCreds): c is IkasCreds {
  return "clientId" in c;
}
