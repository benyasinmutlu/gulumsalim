import { describe, expect, it } from "vitest";
import { renderDistanceSalesContract } from "./contract-template";

const buyer = {
  fullName: "Ayşe Yılmaz",
  phone: "05551112233",
  email: "ayse@example.com",
  city: "İstanbul",
  district: "Kadıköy",
  addressLine: "Test Sk. No:1",
};

describe("renderDistanceSalesContract", () => {
  it("includes buyer info and a block per vendor present in the cart", () => {
    const html = renderDistanceSalesContract({
      buyer,
      vendorBlocks: [
        {
          vendorId: 1,
          legalName: "Mağaza A",
          storeName: "Mağaza A",
          taxId: "1234567890",
          legalAddress: "Adres A",
          items: [{ productNameSnapshot: "Ürün 1", unitPrice: "100.00", quantity: 1, total: "100.00" }],
          lineTotal: "100.00",
        },
        {
          vendorId: 2,
          legalName: "Ayşe Yılmaz",
          storeName: "Mağaza B",
          taxId: null,
          legalAddress: null,
          items: [{ productNameSnapshot: "Ürün 2", unitPrice: "50.00", quantity: 2, total: "100.00" }],
          lineTotal: "100.00",
        },
      ],
      subtotal: "200.00",
      shippingFee: "0.00",
      total: "200.00",
      date: new Date("2026-01-01T00:00:00Z"),
    });

    expect(html).toContain("Ayşe Yılmaz");
    expect(html).toContain("Mağaza A");
    expect(html).toContain("Mağaza B");
    expect(html).toContain("Ayşe Yılmaz");
    expect(html).toContain("Satışta Görünen Ad");
    expect(html).toContain("Ürün 1");
    expect(html).toContain("Ürün 2");
    // Vergi/adres bilgisi olmayan satıcı (henüz doldurmamış) için em-dash fallback.
    expect(html).toContain("—");
    expect(html).not.toContain("undefined");
    expect(html).not.toContain("null");
  });

  it("omits order number when previewing before an order exists", () => {
    const html = renderDistanceSalesContract({
      buyer,
      vendorBlocks: [],
      subtotal: "0.00",
      shippingFee: "0.00",
      total: "0.00",
      date: new Date("2026-01-01T00:00:00Z"),
    });
    expect(html).not.toContain("Sipariş No:");
  });

  it("includes the order number for a real (post-checkout) snapshot", () => {
    const html = renderDistanceSalesContract({
      buyer,
      vendorBlocks: [],
      subtotal: "0.00",
      shippingFee: "0.00",
      total: "0.00",
      orderNumber: "GS12345",
      date: new Date("2026-01-01T00:00:00Z"),
    });
    expect(html).toContain("GS12345");
  });

  it("escapes HTML in user-controlled fields (buyer name, product name)", () => {
    const html = renderDistanceSalesContract({
      buyer: { ...buyer, fullName: "<script>alert(1)</script>" },
      vendorBlocks: [
        {
          vendorId: 1,
          legalName: "Mağaza A",
          storeName: "Mağaza A",
          taxId: null,
          legalAddress: null,
          items: [{ productNameSnapshot: "<img src=x onerror=alert(1)>", unitPrice: "1.00", quantity: 1, total: "1.00" }],
          lineTotal: "1.00",
        },
      ],
      subtotal: "1.00",
      shippingFee: "0.00",
      total: "1.00",
      date: new Date("2026-01-01T00:00:00Z"),
    });
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<img src=x");
  });
});
