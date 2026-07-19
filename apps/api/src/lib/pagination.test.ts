import { describe, expect, it } from "vitest";
import { decodeCursor, encodeCursor } from "./pagination";

describe("encodeCursor / decodeCursor", () => {
  it("kodlanan bir cursor'ı kayıpsız geri çözer", () => {
    const cursor = { createdAt: "2026-07-19T01:07:59.618Z", id: 42 };
    const decoded = decodeCursor(encodeCursor(cursor));
    expect(decoded).toEqual(cursor);
  });

  it("milisaniye hassasiyetini korur (Postgres/JS zaman damgası uyuşmazlığı sınıfı hataya karşı)", () => {
    // Bu test, Faz 1'de sayfalamanın eşzamanlı eklenen kayıtlarda bir
    // satırı atladığı gerçek bir hatayı yakaladığımız senaryoyu belgeler.
    const cursor = { createdAt: "2026-07-19T01:07:59.618Z", id: 2 };
    const decoded = decodeCursor(encodeCursor(cursor));
    expect(decoded?.createdAt).toBe("2026-07-19T01:07:59.618Z");
  });

  it("bozuk base64 girdide null döner, hata fırlatmaz", () => {
    expect(decodeCursor("gecersiz-!!!")).toBeNull();
  });

  it("eksik alanlı geçerli base64 girdide null döner", () => {
    const malformed = Buffer.from(JSON.stringify({ id: 1 })).toString("base64url");
    expect(decodeCursor(malformed)).toBeNull();
  });
});
