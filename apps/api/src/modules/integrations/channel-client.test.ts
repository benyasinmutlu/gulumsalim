import { describe, expect, it } from "vitest";
import { buildTicimaxStockRequest, buildTrendyolPushRequest, getChannelClient, IkasClient, TicimaxClient, TrendyolClient } from "./channel-client";
import { ticimaxCredsSchema } from "./credentials";

describe("buildTrendyolPushRequest (V2 endpoint + auth + body)", () => {
  it("yeni V2 URL kullanır (/integration/inventory/sellers)", () => {
    const req = buildTrendyolPushRequest("12345", "key", "secret", [{ externalBarcode: "BC1", stock: 9 }]);
    expect(req.url).toContain("/integration/inventory/sellers/12345/products/price-and-inventory");
    expect(req.url).not.toContain("sapigw"); // eski (kapanacak) base olmamalı
  });

  it("Basic auth (base64 key:secret) + User-Agent", () => {
    const req = buildTrendyolPushRequest("12345", "key", "secret", []);
    expect(req.headers.Authorization).toBe("Basic " + Buffer.from("key:secret").toString("base64"));
    expect(req.headers["User-Agent"]).toBe("12345 - SelfIntegration");
  });

  it("body: items barcode+quantity, negatif stok 0'a çekilir", () => {
    const req = buildTrendyolPushRequest("1", "k", "s", [
      { externalBarcode: "BC1", stock: -3 },
      { externalBarcode: "BC2", stock: 5 },
    ]);
    expect(JSON.parse(req.body)).toEqual({
      items: [
        { barcode: "BC1", quantity: 0 },
        { barcode: "BC2", quantity: 5 },
      ],
    });
  });
});

describe("getChannelClient (per-vendor creds ile doğru client)", () => {
  it("trendyol → TrendyolClient", () => {
    const c = getChannelClient("trendyol", { supplierId: "1", apiKey: "k", apiSecret: "s" });
    expect(c).toBeInstanceOf(TrendyolClient);
    expect(c.channel).toBe("trendyol");
  });
  it("ikas → IkasClient", () => {
    const c = getChannelClient("ikas", { clientId: "c", clientSecret: "s", storeName: "magaza" });
    expect(c).toBeInstanceOf(IkasClient);
    expect(c.channel).toBe("ikas");
  });
  it("ticimax → TicimaxClient", () => {
    const c = getChannelClient("ticimax", { siteUrl: "https://magaza.example", memberCode: "uye" });
    expect(c).toBeInstanceOf(TicimaxClient);
    expect(c.channel).toBe("ticimax");
  });
});

describe("Ticimax SOAP stok isteği", () => {
  it("resmi StokAdediGuncelle action'ını ve varyasyon ID/stok alanlarını üretir", () => {
    const req = buildTicimaxStockRequest("https://magaza.example", "UYE<&", [{ externalBarcode: "BARKOD-42", externalId: "42", stock: 7.8 }]);
    expect(req.url).toBe("https://magaza.example/Servis/UrunServis.svc");
    expect(req.headers.SOAPAction).toContain("IUrunServis/StokAdediGuncelle");
    expect(req.body).toContain("<a:ID>42</a:ID>");
    expect(req.body).toContain("<a:StokAdedi>7</a:StokAdedi>");
    expect(req.body).toContain("UYE&lt;&amp;");
  });

  it("sayısal olmayan varyasyon ID'sini dış servise göndermeden reddeder", () => {
    expect(() => buildTicimaxStockRequest("https://magaza.example", "uye", [{ externalBarcode: "SKU-1", externalId: "X", stock: 2 }])).toThrow(/varyasyon ID/i);
  });

  it("mağaza URL'sini HTTPS origin'e normalize eder ve yerel adresleri reddeder", () => {
    expect(ticimaxCredsSchema.parse({ siteUrl: "magaza.example/panel", memberCode: "uye" }).siteUrl).toBe("https://magaza.example");
    expect(ticimaxCredsSchema.safeParse({ siteUrl: "http://localhost", memberCode: "uye" }).success).toBe(false);
    expect(ticimaxCredsSchema.safeParse({ siteUrl: "https://127.0.0.1", memberCode: "uye" }).success).toBe(false);
  });
});
