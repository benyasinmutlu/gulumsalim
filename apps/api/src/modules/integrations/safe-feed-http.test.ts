import { describe, expect, it } from "vitest";
import { validateFeedUrl } from "./safe-feed-http";

describe("feed URL security", () => {
  it("accepts a normal HTTPS catalog URL without exposing credentials", () => {
    expect(validateFeedUrl("https://shop.example.com/catalog.xml?token=secret").hostname).toBe("shop.example.com");
  });

  it.each([
    "http://shop.example.com/catalog.xml",
    "https://user:pass@shop.example.com/catalog.xml",
    "https://localhost/catalog.xml",
    "https://127.0.0.1/catalog.xml",
    "https://[::1]/catalog.xml",
    "https://shop.local/catalog.xml",
    "https://shop.example.com:8443/catalog.xml",
  ])("rejects unsafe address %s", (url) => {
    expect(() => validateFeedUrl(url)).toThrow();
  });
});
