import { describe, expect, it } from "vitest";
import { buildTrendyolPushRequest, IkasClient, TrendyolClient } from "./channel-client";

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

describe("client isConfigured (env key yokken false olmalı)", () => {
  it("Trendyol yapılandırılmamış -> false", () => {
    expect(new TrendyolClient().isConfigured()).toBe(false);
  });
  it("İkas yapılandırılmamış -> false (store_name dahil 3 alan gerekir)", () => {
    expect(new IkasClient().isConfigured()).toBe(false);
  });
});
