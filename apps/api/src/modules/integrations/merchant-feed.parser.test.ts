import { describe, expect, it } from "vitest";
import { detectMerchantFeedColumns, parseMerchantFeed } from "./merchant-feed.parser";

describe("merchant feed parser", () => {
  it("normalizes a Google Merchant XML feed and uses conservative stock for availability-only rows", async () => {
    const xml = Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
      <rss xmlns:g="http://base.google.com/ns/1.0"><channel>
        <item><g:id>A-RED-M</g:id><g:item_group_id>A</g:item_group_id><g:title>Keten Elbise</g:title><g:price>1.500,00 TRY</g:price><g:sale_price>1.234,56 TRY</g:sale_price><g:availability>in_stock</g:availability><g:size>M</g:size><g:color>Kırmızı</g:color><g:image_link>https://cdn.example.com/a.webp</g:image_link></item>
        <item><g:id>A-RED-L</g:id><g:item_group_id>A</g:item_group_id><g:title>Keten Elbise</g:title><g:price>1234.56 TRY</g:price><g:availability>out_of_stock</g:availability><g:size>L</g:size><g:color>Kırmızı</g:color></item>
      </channel></rss>`);

    const parsed = await parseMerchantFeed(xml, "auto", undefined, "application/xml");
    expect(parsed.format).toBe("xml");
    expect(parsed.items).toHaveLength(2);
    expect(parsed.items[0]).toMatchObject({ externalKey: "A-RED-M", groupKey: "A", price: "1234.56", compareAtPrice: "1500.00", stock: 1, available: true, size: "M" });
    expect(parsed.items[1]).toMatchObject({ externalKey: "A-RED-L", stock: 0, available: false });
  });

  it("supports an explicit path for a single generic XML product", async () => {
    const xml = Buffer.from(`<catalog><products><product><code>X1</code><label>Şal</label><amount>99,90 TL</amount><qty>7</qty></product></products></catalog>`);
    const parsed = await parseMerchantFeed(xml, "xml", {
      itemsPath: "catalog.products.product",
      externalId: "code",
      name: "label",
      price: "amount",
      stock: "qty",
    });
    expect(parsed.items).toHaveLength(1);
    expect(parsed.items[0]).toMatchObject({ externalKey: "X1", name: "Şal", price: "99.90", stock: 7 });
  });

  it("returns columns for a custom single-item feed that needs manual mapping", async () => {
    const xml = Buffer.from(`<catalog><product><kod>X1</kod><etiket>Şal</etiket><tutar>99.90</tutar><miktar>2</miktar></product></catalog>`);
    const detected = await detectMerchantFeedColumns(xml, "xml");
    expect(detected.columns).toEqual(expect.arrayContaining(["kod", "etiket", "tutar", "miktar"]));
  });

  it("rejects duplicate external keys before any database write", async () => {
    const csv = Buffer.from("id,name,price,stock\nX1,Ürün 1,10,2\nX1,Ürün 2,11,3");
    await expect(parseMerchantFeed(csv, "csv")).rejects.toThrow("yinelenen ürün kimliği");
  });

  it("rejects an empty feed instead of deactivating the current catalog", async () => {
    const csv = Buffer.from("id,name,price,stock\n");
    await expect(parseMerchantFeed(csv, "csv", { externalId: "id", name: "name", price: "price", stock: "stock" }))
      .rejects.toThrow("Feed boş");
  });
});
