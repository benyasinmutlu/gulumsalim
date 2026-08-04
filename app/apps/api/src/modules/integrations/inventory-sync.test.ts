import { describe, expect, it } from "vitest";
import {
  exposedStock,
  decrementAmount,
  computeReconcileDiff,
  buildOutboxEvents,
  backoffSeconds,
} from "./inventory-sync";

describe("exposedStock (güvenlik tamponu)", () => {
  it("gerçek stoktan tamponu düşer", () => {
    expect(exposedStock(10, 1)).toBe(9);
    expect(exposedStock(10, 2)).toBe(8);
  });
  it("tampon stoktan büyükse 0 gösterir (asla negatif değil)", () => {
    expect(exposedStock(1, 2)).toBe(0);
    expect(exposedStock(0, 1)).toBe(0);
  });
  it("geçersiz/negatif stok -> 0", () => {
    expect(exposedStock(-5, 1)).toBe(0);
    expect(exposedStock(Number.NaN, 1)).toBe(0);
  });
  it("tampon 0/geçersizse gerçek stoğu gösterir", () => {
    expect(exposedStock(10, 0)).toBe(10);
    expect(exposedStock(10, -1)).toBe(10);
  });
});

describe("decrementAmount", () => {
  it("pozitif satış adedini döndürür", () => {
    expect(decrementAmount(3)).toBe(3);
  });
  it("negatif/NaN -> 0 (varsayılan güvenli)", () => {
    expect(decrementAmount(-2)).toBe(0);
    expect(decrementAmount(Number.NaN)).toBe(0);
  });
  it("allowNegative ile iade/iptal (artış) desteği", () => {
    expect(decrementAmount(-2, true)).toBe(-2);
  });
});

describe("computeReconcileDiff", () => {
  it("sadece hedeften FARKLI kanallar için düzeltme üretir", () => {
    const diff = computeReconcileDiff(10, 1, [
      { listingId: 1, channel: "trendyol", reportedStock: 9 }, // hedef=9, eşit -> yok
      { listingId: 2, channel: "ikas", reportedStock: 5 }, // yanlış -> düzelt
    ]);
    expect(diff).toEqual([{ listingId: 2, channel: "ikas", from: 5, to: 9 }]);
  });
  it("tümü doğruysa boş döner", () => {
    expect(computeReconcileDiff(10, 1, [{ listingId: 1, channel: "trendyol", reportedStock: 9 }])).toEqual([]);
  });
});

describe("buildOutboxEvents", () => {
  it("satışın geldiği kanal HARİÇ tüm aktif kanallara itme üretir", () => {
    const events = buildOutboxEvents(
      10,
      1,
      [
        { listingId: 1, channel: "trendyol" },
        { listingId: 2, channel: "ikas" },
      ],
      "trendyol", // satış trendyol'dan geldi -> ona geri itme
    );
    expect(events).toEqual([{ channel: "ikas", listingId: 2, targetStock: 9 }]);
  });
  it("exceptChannel yoksa tüm kanallara iter", () => {
    const events = buildOutboxEvents(5, 1, [
      { listingId: 1, channel: "trendyol" },
      { listingId: 2, channel: "ikas" },
    ]);
    expect(events.map((e) => e.targetStock)).toEqual([4, 4]);
  });
});

describe("backoffSeconds", () => {
  it("ilk denemede taban değeri", () => {
    expect(backoffSeconds(0, 30)).toBe(30);
  });
  it("üstel artar ama tavanı aşmaz", () => {
    expect(backoffSeconds(1, 30)).toBe(60);
    expect(backoffSeconds(2, 30)).toBe(120);
    expect(backoffSeconds(50, 30, 3600)).toBe(3600);
  });
});
