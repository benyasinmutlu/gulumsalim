import { describe, expect, it } from "vitest";
import { requestPayoutSchema } from "./vendor-finance.schemas";

const valid = {
  amount: "50.25",
  iban: "tr33 0006 1005 1978 6457 8413 26",
  accountHolder: "  Ayşe Yılmaz  ",
};

describe("requestPayoutSchema", () => {
  it("normalizes a valid payout request", () => {
    expect(requestPayoutSchema.parse(valid)).toMatchObject({
      amount: 50.25,
      iban: "TR330006100519786457841326",
      accountHolder: "Ayşe Yılmaz",
    });
  });

  it.each([NaN, Infinity, -Infinity, 49.99, 50.001])("rejects invalid amount %s", (amount) => {
    expect(() => requestPayoutSchema.parse({ ...valid, amount })).toThrow();
  });

  it("rejects a bad IBAN checksum", () => {
    expect(() => requestPayoutSchema.parse({ ...valid, iban: "TR330006100519786457841327" })).toThrow();
  });

  it("requires the account holder", () => {
    expect(() => requestPayoutSchema.parse({ ...valid, accountHolder: " " })).toThrow();
  });
});
