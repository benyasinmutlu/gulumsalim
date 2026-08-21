import { z } from "zod";
import { isIP } from "node:net";
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

const ticimaxSiteUrlSchema = z
  .string()
  .trim()
  .min(1, "Ticimax mağaza adresi gerekli")
  .transform((value, ctx) => {
    const candidate = /^https?:\/\//i.test(value) ? value : `https://${value}`;
    try {
      const url = new URL(candidate);
      const host = url.hostname.toLowerCase();
      if (url.protocol !== "https:" || url.username || url.password || (url.port && url.port !== "443")) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Ticimax adresi HTTPS mağaza alan adı olmalı" });
        return z.NEVER;
      }
      if (isIP(host) || host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local")) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Yerel/IP adresleri kullanılamaz" });
        return z.NEVER;
      }
      return url.origin;
    } catch {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Geçerli bir Ticimax mağaza adresi girin" });
      return z.NEVER;
    }
  });

export const ticimaxCredsSchema = z.object({
  siteUrl: ticimaxSiteUrlSchema,
  memberCode: z.string().trim().min(1, "Üye kodu gerekli").max(200),
});

export type TrendyolCreds = z.infer<typeof trendyolCredsSchema>;
export type IkasCreds = z.infer<typeof ikasCredsSchema>;
export type TicimaxCreds = z.infer<typeof ticimaxCredsSchema>;
export type ChannelCreds = TrendyolCreds | IkasCreds | TicimaxCreds;

// Kanala göre gövdeyi doğrula (route'ta kullanılır). Geçersizse zod fırlatır.
export function parseChannelCreds(channel: SalesChannel, body: unknown): ChannelCreds {
  if (channel === "trendyol") return trendyolCredsSchema.parse(body);
  if (channel === "ikas") return ikasCredsSchema.parse(body);
  return ticimaxCredsSchema.parse(body);
}

// Tip daraltma yardımcıları.
export function isTrendyolCreds(c: ChannelCreds): c is TrendyolCreds {
  return "supplierId" in c;
}
export function isIkasCreds(c: ChannelCreds): c is IkasCreds {
  return "clientId" in c;
}
export function isTicimaxCreds(c: ChannelCreds): c is TicimaxCreds {
  return "memberCode" in c;
}
