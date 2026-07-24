import { describe, expect, it } from "vitest";
import { isVendorSessionAllowed } from "./vendor-access";

describe("isVendorSessionAllowed", () => {
  it.each(["active", "pending"] as const)("allows %s vendors", (status) => {
    expect(isVendorSessionAllowed(status)).toBe(true);
  });

  it.each(["suspended", "banned", null] as const)("revokes %s vendor sessions", (status) => {
    expect(isVendorSessionAllowed(status)).toBe(false);
  });
});
