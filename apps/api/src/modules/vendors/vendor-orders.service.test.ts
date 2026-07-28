import { describe, expect, it } from "vitest";
import { calculateEarning, isTransitionAllowed } from "./vendor-orders.service";

describe("isTransitionAllowed", () => {
  it("pending -> processing geçişine izin verir", () => {
    expect(isTransitionAllowed("pending", "processing")).toBe(true);
  });

  it("pending -> delivered geçişini reddeder (adım atlanamaz)", () => {
    expect(isTransitionAllowed("pending", "delivered")).toBe(false);
  });

  it("processing -> delivered geçişini reddeder (shipped atlanamaz)", () => {
    expect(isTransitionAllowed("processing", "delivered")).toBe(false);
  });

  it("shipped -> delivered geçişine izin verir", () => {
    expect(isTransitionAllowed("shipped", "delivered")).toBe(true);
  });

  it("delivered durumundan hiçbir geçişe izin vermez", () => {
    expect(isTransitionAllowed("delivered", "cancelled")).toBe(false);
    expect(isTransitionAllowed("delivered", "processing")).toBe(false);
  });

  it("shipped durumundaki bir kalem iptal edilemez", () => {
    expect(isTransitionAllowed("shipped", "cancelled")).toBe(false);
  });
});

describe("calculateEarning", () => {
  it("satıcıya özel komisyon oranı yoksa varsayılan %5'i kullanır", () => {
    const result = calculateEarning("1000.00", null);
    expect(result).toEqual({ grossAmount: "1000.00", commissionAmount: "50.00", netAmount: "950.00" });
  });

  it("satıcıya özel komisyon oranı varsa onu kullanır", () => {
    const result = calculateEarning("1000.00", 20);
    expect(result).toEqual({ grossAmount: "1000.00", commissionAmount: "200.00", netAmount: "800.00" });
  });

  it("küsuratlı tutarları doğru yuvarlar", () => {
    const result = calculateEarning("149.90", 10);
    expect(result).toEqual({ grossAmount: "149.90", commissionAmount: "14.99", netAmount: "134.91" });
  });
});
