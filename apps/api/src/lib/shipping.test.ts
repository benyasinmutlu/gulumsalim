import { describe, expect, it } from "vitest";
import { computeVendorShipping, ManualShippingProvider, type VendorShippingLine } from "./shipping";

// bkz. kargo/PTT denetim raporu Faz 3 (2026-09-10): "FAZ 3 ÖNCESİ shipping
// fee = FAZ 3 SONRASI shipping fee" - bu dosya, eski (legacy) computeVendorShipping()
// fonksiyonu ile yeni ManualShippingProvider'ın AYNI girdide AYNI çıktıyı
// verdiğini doğrudan karşılaştırarak kanıtlar. ManualShippingProvider zaten
// computeVendorShipping()'i olduğu gibi çağırıyor (bkz. shipping.ts) - bu
// testler o "olduğu gibi" iddiasının gerçek bir regresyon testidir.
const BASE_FEE = 49.9;
const THRESHOLD = 500;

async function compare(lines: VendorShippingLine[], baseFee = BASE_FEE, threshold = THRESHOLD) {
  const legacy = computeVendorShipping(lines, baseFee, threshold);
  const provider = new ManualShippingProvider();
  const viaProvider = await provider.calculateQuote(lines, baseFee, threshold);
  expect(viaProvider).toEqual(legacy);
  return legacy;
}

describe("ManualShippingProvider vs legacy computeVendorShipping - davranış eşliği", () => {
  it("tek satıcı: eşik altı sepette taban ücret uygulanır", async () => {
    const result = await compare([
      { vendorId: 1, storeName: "Mağaza A", lineTotal: 100, freeShipping: false },
    ]);
    expect(result.total).toBe(BASE_FEE);
    expect(result.breakdown).toEqual([{ vendorId: 1, storeName: "Mağaza A", itemsSubtotal: 100, fee: BASE_FEE, free: false }]);
  });

  it("multi-vendor: 3 satıcı için 3 ayrı ücret hesaplanır ve toplanır", async () => {
    const result = await compare([
      { vendorId: 1, storeName: "A", lineTotal: 100, freeShipping: false },
      { vendorId: 2, storeName: "B", lineTotal: 100, freeShipping: false },
      { vendorId: 3, storeName: "C", lineTotal: 100, freeShipping: false },
    ]);
    expect(result.total).toBe(BASE_FEE * 3);
    expect(result.breakdown).toHaveLength(3);
  });

  it("aynı satıcıdan birden fazla kalem TEK ücrete gruplanır (kalem sayısı değil satıcı sayısı belirler)", async () => {
    const result = await compare([
      { vendorId: 1, storeName: "A", lineTotal: 50, freeShipping: false },
      { vendorId: 1, storeName: "A", lineTotal: 50, freeShipping: false },
      { vendorId: 1, storeName: "A", lineTotal: 50, freeShipping: false },
    ]);
    expect(result.total).toBe(BASE_FEE);
    expect(result.breakdown).toHaveLength(1);
    expect(result.breakdown[0]!.itemsSubtotal).toBe(150);
  });

  it("ücretsiz kargo eşiği ALTINDA ücret alınır", async () => {
    const result = await compare([{ vendorId: 1, lineTotal: THRESHOLD - 0.01, freeShipping: false }]);
    expect(result.breakdown[0]!.free).toBe(false);
    expect(result.total).toBe(BASE_FEE);
  });

  it("ücretsiz kargo eşiği ÜSTÜNDE/EŞİT ücret alınmaz", async () => {
    const result = await compare([{ vendorId: 1, lineTotal: THRESHOLD, freeShipping: false }]);
    expect(result.breakdown[0]!.free).toBe(true);
    expect(result.total).toBe(0);
  });

  it("ürün/kampanya kaynaklı freeShipping bayrağı eşikten bağımsız olarak ücreti sıfırlar", async () => {
    const result = await compare([{ vendorId: 1, lineTotal: 10, freeShipping: true }]);
    expect(result.breakdown[0]!.free).toBe(true);
    expect(result.total).toBe(0);
  });

  it("boş sepet: toplam 0, kırılım boş", async () => {
    const result = await compare([]);
    expect(result.total).toBe(0);
    expect(result.breakdown).toEqual([]);
  });

  it("adet artışıyla lineTotal büyüyüp eşiği geçince ücret sıfırlanır (miktar davranışı)", async () => {
    const unitPrice = 100;
    const belowThreshold = await compare([{ vendorId: 1, lineTotal: unitPrice * 4, freeShipping: false }]); // 400 < 500
    expect(belowThreshold.total).toBe(BASE_FEE);
    const aboveThreshold = await compare([{ vendorId: 1, lineTotal: unitPrice * 5, freeShipping: false }]); // 500 >= 500
    expect(aboveThreshold.total).toBe(0);
  });

  it("admin panelden farklı taban ücret/eşik geldiğinde de eşlik sürer", async () => {
    await compare(
      [
        { vendorId: 1, lineTotal: 80, freeShipping: false },
        { vendorId: 2, lineTotal: 200, freeShipping: false },
      ],
      29.9,
      150,
    );
  });
});
