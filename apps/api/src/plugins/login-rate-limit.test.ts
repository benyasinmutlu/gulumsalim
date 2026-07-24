import { describe, expect, it } from "vitest";
import { loginRateLimitKey, LOGIN_RATE_LIMIT_MAX } from "./login-rate-limit";

describe("loginRateLimitKey", () => {
  it("separates login surfaces and does not store the raw IP address", () => {
    const customer = loginRateLimitKey("/auth/login", "203.0.113.10");
    const admin = loginRateLimitKey("/admin/auth/login", "203.0.113.10");

    expect(customer).not.toBe(admin);
    expect(customer).not.toContain("203.0.113.10");
  });

  it("uses a bounded attempt limit", () => {
    expect(LOGIN_RATE_LIMIT_MAX).toBeGreaterThanOrEqual(5);
    expect(LOGIN_RATE_LIMIT_MAX).toBeLessThanOrEqual(20);
  });
});
