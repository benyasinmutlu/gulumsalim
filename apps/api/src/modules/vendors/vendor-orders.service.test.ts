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
  it("satıcıya özel komisyon oranı yoksa varsayılan %10'u kullanır", () => {
    const result = calculateEarning("1000.00", null);
    expect(result).toEqual({ grossAmount: "1000.00", commissionAmount: "100.00", netAmount: "900.00" });
  });

  it("satıcıya özel komisyon oranı varsa onu kullanır", () => {
    const result = calculateEarning("1000.00", 20);
    expect(result).toEqual({ grossAmount: "1000.00", commissionAmount: "200.00", netAmount: "800.00" });
  });

  it("satıcıya özel sıfır komisyon oranını varsayılanla değiştirmez", () => {
    const result = calculateEarning("1000.00", 0);
    expect(result).toEqual({ grossAmount: "1000.00", commissionAmount: "0.00", netAmount: "1000.00" });
  });

  it("küsuratlı tutarları doğru yuvarlar", () => {
    const result = calculateEarning("149.90", 10);
    expect(result).toEqual({ grossAmount: "149.90", commissionAmount: "14.99", netAmount: "134.91" });
  });

  it("komisyonu bir kez kuruşa yuvarlayıp neti kesin farktan üretir", () => {
    const result = calculateEarning("149.90", 5);
    expect(result).toEqual({ grossAmount: "149.90", commissionAmount: "7.50", netAmount: "142.40" });
    expect(Number(result.grossAmount) - Number(result.commissionAmount)).toBe(Number(result.netAmount));
  });
});
