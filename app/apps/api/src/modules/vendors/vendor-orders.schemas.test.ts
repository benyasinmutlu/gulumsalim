import { describe, expect, it } from "vitest";
import { orderListQuerySchema } from "./vendor-orders.schemas";

describe("orderListQuerySchema", () => {
  it("defaults sort to newest and leaves filters undefined", () => {
    const r = orderListQuerySchema.parse({});
    expect(r.sort).toBe("newest");
    expect(r.search).toBeUndefined();
    expect(r.status).toBeUndefined();
  });

  it("coalesces empty query-string values to absent", () => {
    const r = orderListQuerySchema.parse({ search: "  ", status: "", sort: "" });
    expect(r.search).toBeUndefined();
    expect(r.status).toBeUndefined();
    expect(r.sort).toBe("newest");
  });

  it("parses and trims valid filters", () => {
    const r = orderListQuerySchema.parse({ search: " GS-2026 ", status: "shipped", sort: "oldest" });
    expect(r.search).toBe("GS-2026");
    expect(r.status).toBe("shipped");
    expect(r.sort).toBe("oldest");
  });

  it("rejects invalid status/sort values", () => {
    expect(() => orderListQuerySchema.parse({ status: "boom" })).toThrow();
    expect(() => orderListQuerySchema.parse({ sort: "sideways" })).toThrow();
  });
});
