import { describe, expect, it } from "vitest";
import { buildCorsAllowlist, isCorsOriginAllowed } from "./cors-origin";

describe("CORS origin allowlist", () => {
  it("canonical site ve açıkça tanımlanan ek origin'lere izin verir", () => {
    const allowlist = buildCorsAllowlist(
      "https://gulumsalim.com/store",
      "https://www.gulumsalim.com, http://localhost:3001/path",
    );

    expect([...allowlist]).toEqual([
      "https://gulumsalim.com",
      "https://www.gulumsalim.com",
      "http://localhost:3001",
    ]);
    expect(isCorsOriginAllowed("https://gulumsalim.com", allowlist)).toBe(true);
    expect(isCorsOriginAllowed("https://evil.example", allowlist)).toBe(false);
  });

  it("Origin içermeyen sunucudan sunucuya isteklere izin verir", () => {
    expect(isCorsOriginAllowed(undefined, buildCorsAllowlist("https://gulumsalim.com"))).toBe(true);
  });

  it("HTTP(S) dışındaki origin yapılandırmalarını reddeder", () => {
    expect(() => buildCorsAllowlist("https://gulumsalim.com", "javascript:alert(1)")).toThrow(
      "CORS origin yalnız HTTP(S) olabilir",
    );
  });
});
