import { describe, expect, it } from "vitest";
import { renderShippingNotification } from "./shipping-notification";

const base = {
  orderNumber: "GS-2026-000123",
  productName: "Çiçekli Yazlık Elbise",
  quantity: 2,
  carrier: "Yurtiçi Kargo",
  trackingNumber: "1234567890",
  siteUrl: "http://127.0.0.1:3001",
};

describe("renderShippingNotification", () => {
  it("puts the order number in the subject", () => {
    const { subject } = renderShippingNotification(base);
    expect(subject).toContain("GS-2026-000123");
  });

  it("includes product, carrier and tracking number in the body", () => {
    const { html } = renderShippingNotification(base);
    expect(html).toContain("Çiçekli Yazlık Elbise");
    expect(html).toContain("Yurtiçi Kargo");
    expect(html).toContain("1234567890");
  });

  it("renders a tracking CTA link built from siteUrl (no hardcoded domain)", () => {
    const { html } = renderShippingNotification(base);
    expect(html).toContain("http://127.0.0.1:3001/hesabim/siparisler");
  });

  it("omits the CTA link when siteUrl is absent", () => {
    const { html } = renderShippingNotification({ ...base, siteUrl: undefined });
    expect(html).not.toContain("/hesabim/siparisler");
  });

  it("HTML-escapes user-controlled fields to prevent email HTML injection", () => {
    const { html } = renderShippingNotification({
      ...base,
      productName: '<script>alert(1)</script>',
      carrier: 'A & B <b>Kargo</b>',
    });
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("A &amp; B &lt;b&gt;Kargo&lt;/b&gt;");
  });

  it("shows quantity only when greater than one", () => {
    expect(renderShippingNotification({ ...base, quantity: 1 }).html).not.toContain("× 1");
    expect(renderShippingNotification({ ...base, quantity: 3 }).html).toContain("× 3");
  });
});
