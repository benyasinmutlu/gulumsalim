import { describe, expect, it } from "vitest";
import { importProductsFromCsv, MAX_AI_ENRICH_ROWS } from "./vendor-bulk-import.service";

describe("bulk import AI guardrails", () => {
  it("rejects costly enrichment batches above the explicit limit before database work", async () => {
    const rows = Array.from({ length: MAX_AI_ENRICH_ROWS + 1 }, (_, index) => `Ürün ${index},10.00,elbise`).join("\n");
    const csv = `name,basePrice,categorySlug\n${rows}`;
    await expect(importProductsFromCsv(1, csv, false, undefined, true)).rejects.toThrow(`en fazla ${MAX_AI_ENRICH_ROWS}`);
  });
});
