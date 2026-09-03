import { describe, expect, it } from "vitest";
import { productReadinessIssues, type ProductReadinessState } from "./product-readiness.repository";

const ready: ProductReadinessState = {
  vendorType: "business",
  stock: 2,
  hasDefect: false,
  generalImageCount: 1,
  defectPhotoCount: 0,
  variantCount: 0,
  variantStock: 0,
};

describe("product publication readiness", () => {
  it("accepts a complete product", () => {
    expect(productReadinessIssues(ready)).toEqual([]);
  });

  it("keeps image-less and stock-less partial records out of publication", () => {
    expect(productReadinessIssues({ ...ready, generalImageCount: 0, stock: 0 })).toEqual([
      "En az bir ürün görseli yüklemelisiniz.",
      "Yayınlamadan önce pozitif stok girmelisiniz.",
    ]);
  });

  it("requires the dedicated defect evidence and uses variant stock", () => {
    expect(productReadinessIssues({ ...ready, hasDefect: true, variantCount: 2, variantStock: 0 })).toEqual([
      "Kusurlu ürün için ayrı kusur fotoğrafı yüklemelisiniz.",
      "Yayınlamadan önce pozitif stok girmelisiniz.",
    ]);
  });
});
