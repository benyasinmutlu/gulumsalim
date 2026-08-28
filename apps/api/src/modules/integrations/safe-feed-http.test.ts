import { describe, expect, it } from "vitest";
import { createPinnedLookup, validateFeedUrl } from "./safe-feed-http";

describe("feed URL security", () => {
  it("supports both single-address and Node 24 all-address lookup callbacks", async () => {
    const lookup = createPinnedLookup({ address: "203.0.113.20", family: 4 }) as unknown as (
      hostname: string,
      options: { all?: boolean },
      callback: (...args: unknown[]) => void,
    ) => void;
    const single = await new Promise<unknown[]>((resolve) => lookup("feed.example", {}, (...args) => resolve(args)));
    const all = await new Promise<unknown[]>((resolve) => lookup("feed.example", { all: true }, (...args) => resolve(args)));

    expect(single).toEqual([null, "203.0.113.20", 4]);
    expect(all).toEqual([null, [{ address: "203.0.113.20", family: 4 }]]);
  });

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
