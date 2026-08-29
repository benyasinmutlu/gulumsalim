import { describe, expect, it } from "vitest";
import { externalHttpUrlSchema, normalizePublicLink, publicLinkUrlSchema } from "./public-url";

describe("public URL security", () => {
  it("site içi ve HTTP(S) bağlantılarını normalize eder", () => {
    expect(normalizePublicLink(" /urunler?sort=new#liste ")).toBe("/urunler?sort=new#liste");
    expect(normalizePublicLink("https://example.com/kampanya")).toBe("https://example.com/kampanya");
  });

  it.each(["javascript:alert(1)", "data:text/html,<script>alert(1)</script>", "//evil.example/x", "/\\evil.example/x"])(
    "tehlikeli bağlantıyı reddeder: %s",
    (value) => expect(publicLinkUrlSchema.safeParse(value).success).toBe(false),
  );

  it("sosyal gönderide yalnız mutlak HTTP(S) URL kabul eder", () => {
    expect(externalHttpUrlSchema.safeParse("https://instagram.com/p/example").success).toBe(true);
    expect(externalHttpUrlSchema.safeParse("/urunler").success).toBe(false);
  });
});
