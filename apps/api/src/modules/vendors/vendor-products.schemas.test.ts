import { describe, expect, it } from "vitest";
import { createProductSchema, productListQuerySchema } from "./vendor-products.schemas";

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
