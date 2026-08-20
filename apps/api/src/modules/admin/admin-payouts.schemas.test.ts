import { describe, expect, it } from "vitest";
import { processPayoutSchema } from "./admin-payouts.schemas";

describe("processPayoutSchema", () => {
  it("requires a bank transfer reference before marking a payout paid", () => {
    expect(processPayoutSchema.safeParse({ action: "approve" }).success).toBe(false);
    expect(processPayoutSchema.parse({ action: "approve", transferReference: "BANK-2026-001" }))
      .toMatchObject({ action: "approve", transferReference: "BANK-2026-001" });
  });

  it("requires a reason when rejecting a payout", () => {
    expect(processPayoutSchema.safeParse({ action: "reject" }).success).toBe(false);
    expect(processPayoutSchema.parse({ action: "reject", reason: "IBAN doğrulanamadı" }))
      .toMatchObject({ action: "reject", reason: "IBAN doğrulanamadı" });
  });
});
