import { describe, expect, it } from "vitest";
import { toTitleCaseTr } from "./name-case";

describe("toTitleCaseTr", () => {
  it("title-cases a fully lowercase Turkish name", () => {
    expect(toTitleCaseTr("zeynep sümengen")).toBe("Zeynep Sümengen");
  });

  it("handles the Turkish dotted/dotless I pair correctly", () => {
    expect(toTitleCaseTr("ışık İLKER")).toBe("Işık İlker");
  });

  it("preserves multiple internal spaces", () => {
    expect(toTitleCaseTr("ali  veli")).toBe("Ali  Veli");
  });

  it("leaves an already title-cased name unchanged", () => {
    expect(toTitleCaseTr("Ahmet Yılmaz")).toBe("Ahmet Yılmaz");
  });
});
