import { describe, expect, it } from "vitest";
import { createProductSchema, createVariantSchema, productListQuerySchema, updateProductSchema } from "./vendor-products.schemas";

const validProduct = {
  categoryId: 1,
  name: "Çiçekli Yazlık Elbise",
  slug: "cicekli-yazlik-elbise",
  condition: "very_good" as const,
  basePrice: 199.9,
};

describe("createProductSchema", () => {
  it("accepts a valid minimal product", () => {
    expect(() => createProductSchema.parse(validProduct)).not.toThrow();
  });

  it("requires a condition (denetim raporu madde 1)", () => {
    const { condition: _condition, ...withoutCondition } = validProduct;
    expect(() => createProductSchema.parse(withoutCondition)).toThrow();
  });

  it("rejects a title over 200 characters", () => {
    expect(() => createProductSchema.parse({ ...validProduct, name: "a".repeat(201) })).toThrow();
  });

  it("rejects an all-caps shouting title", () => {
    expect(() => createProductSchema.parse({ ...validProduct, name: "SÜPER İNDİRİM ELBİSE" })).toThrow();
  });

  it("requires a defect description when hasDefect is true", () => {
    expect(() => createProductSchema.parse({ ...validProduct, hasDefect: true })).toThrow();
    expect(() =>
      createProductSchema.parse({ ...validProduct, hasDefect: true, defectDescription: "sol kolda küçük leke" }),
    ).not.toThrow();
  });
});

// bkz. kargo/PTT denetim raporu Faz 1 (2026-09-10): opsiyonel fiziksel kargo
// verisi - negatif/aşırı büyük değerler reddedilir, boş bırakılabilir.
describe("createProductSchema - shipping dimensions", () => {
  it("allows omitting weight/dimensions entirely", () => {
    const parsed = createProductSchema.parse(validProduct);
    expect(parsed.weightGrams).toBeUndefined();
    expect(parsed.widthCm).toBeUndefined();
    expect(parsed.heightCm).toBeUndefined();
    expect(parsed.lengthCm).toBeUndefined();
  });

  it("accepts weight 0", () => {
    expect(() => createProductSchema.parse({ ...validProduct, weightGrams: 0 })).not.toThrow();
  });

  it("rejects a negative weight", () => {
    expect(() => createProductSchema.parse({ ...validProduct, weightGrams: -1 })).toThrow();
  });

  it("rejects negative dimensions", () => {
    expect(() => createProductSchema.parse({ ...validProduct, widthCm: -5 })).toThrow();
    expect(() => createProductSchema.parse({ ...validProduct, heightCm: -5 })).toThrow();
    expect(() => createProductSchema.parse({ ...validProduct, lengthCm: -5 })).toThrow();
  });

  it("rejects a weight over the 50kg sanity limit", () => {
    expect(() => createProductSchema.parse({ ...validProduct, weightGrams: 50_001 })).toThrow();
  });

  it("rejects a dimension over the 500cm sanity limit", () => {
    expect(() => createProductSchema.parse({ ...validProduct, widthCm: 501 })).toThrow();
  });

  it("accepts a normal value set", () => {
    const parsed = createProductSchema.parse({ ...validProduct, weightGrams: 750, widthCm: 20, heightCm: 5, lengthCm: 30 });
    expect(parsed.weightGrams).toBe(750);
    expect(parsed.widthCm).toBe(20);
    expect(parsed.heightCm).toBe(5);
    expect(parsed.lengthCm).toBe(30);
  });

  it("updateProductSchema also allows omitting or validating shipping fields", () => {
    expect(() => updateProductSchema.parse({})).not.toThrow();
    expect(() => updateProductSchema.parse({ weightGrams: -1 })).toThrow();
    expect(() => updateProductSchema.parse({ weightGrams: 500 })).not.toThrow();
  });

  it("createVariantSchema also validates shipping fields (priceOverride pattern)", () => {
    expect(() => createVariantSchema.parse({ stock: 1, weightGrams: -1 })).toThrow();
    expect(() => createVariantSchema.parse({ stock: 1, weightGrams: 500, widthCm: 20 })).not.toThrow();
  });
});

describe("productListQuerySchema", () => {
  it("defaults sort to newest and leaves optional filters undefined", () => {
    const r = productListQuerySchema.parse({});
    expect(r.sort).toBe("newest");
    expect(r.search).toBeUndefined();
    expect(r.status).toBeUndefined();
    expect(r.stock).toBeUndefined();
  });

  it("treats empty query-string values as absent", () => {
    const r = productListQuerySchema.parse({ search: "  ", status: "", stock: "", sort: "" });
    expect(r.search).toBeUndefined();
    expect(r.status).toBeUndefined();
    expect(r.stock).toBeUndefined();
    expect(r.sort).toBe("newest");
  });

  it("parses and trims valid filters", () => {
    const r = productListQuerySchema.parse({ search: "  elbise ", status: "active", stock: "low", sort: "price_desc" });
    expect(r.search).toBe("elbise");
    expect(r.status).toBe("active");
    expect(r.stock).toBe("low");
    expect(r.sort).toBe("price_desc");
  });

  it("rejects invalid enum values (no injection through status/stock/sort)", () => {
    expect(() => productListQuerySchema.parse({ status: "hacked" })).toThrow();
    expect(() => productListQuerySchema.parse({ stock: "nope" })).toThrow();
    expect(() => productListQuerySchema.parse({ sort: "drop_table" })).toThrow();
  });

  it("rejects an overly long search term", () => {
    expect(() => productListQuerySchema.parse({ search: "x".repeat(101) })).toThrow();
  });
});
