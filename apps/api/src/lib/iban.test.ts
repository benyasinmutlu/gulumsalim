import { describe, expect, it } from "vitest";
import { isValidTurkishIban, normalizeIban } from "./iban";

describe("Turkish IBAN", () => {
  it("normalizes spaces and letter casing", () => {
    expect(normalizeIban("tr33 0006 1005 1978 6457 8413 26")).toBe("TR330006100519786457841326");
  });

  it("accepts a checksum-valid Turkish IBAN", () => {
    expect(isValidTurkishIban("TR33 0006 1005 1978 6457 8413 26")).toBe(true);
  });

  it.each([
    "TR33 0006 1005 1978 6457 8413 27",
    "DE89 3704 0044 0532 0130 00",
    "TR12",
    "TRXX 0006 1005 1978 6457 8413 26",
  ])("rejects invalid input: %s", (value) => {
    expect(isValidTurkishIban(value)).toBe(false);
  });
});
