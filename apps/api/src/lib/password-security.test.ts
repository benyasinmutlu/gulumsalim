import bcrypt from "bcryptjs";
import { describe, expect, it } from "vitest";
import { DUMMY_PASSWORD_HASH } from "./password-security";

describe("password timing hardening", () => {
  it("keeps a valid cost-12 dummy bcrypt hash for missing accounts", async () => {
    expect(DUMMY_PASSWORD_HASH).toMatch(/^\$2[aby]\$12\$/);
    expect(await bcrypt.compare("not-a-real-password", DUMMY_PASSWORD_HASH)).toBe(true);
  });
});
