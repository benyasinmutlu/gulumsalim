import { describe, expect, it } from "vitest";
import { containsContactInfo } from "./contact-info-detector";

describe("containsContactInfo", () => {
  it.each([
    "TR330006100519786457841326",
    "IBAN: TR33 0006 1005 1978 6457 8413 26",
    "beni 0532 123 45 67 den ara",
    "whatsapptan yazarsan konuşuruz 05321234567",
    "mail: ali@example.com",
    "instagram.com/magazam",
    "www.magazam.com adresinden bak",
    "@magazam_insta hesabımdan yazabilirsin",
    "http://ornek.com üzerinden ulaşabilirsin",
  ])("iletişim bilgisi içeren metni yakalar: %s", (text) => {
    expect(containsContactInfo(text)).toBe(true);
  });

  it.each([
    "Ürün teslim aldıktan sonra 14 gün içinde iade edebilirsiniz",
    "Bu elbise 38-40 beden aralığında",
    "2026 yılında yeni koleksiyon geliyor",
    "Fiyatı 1500 TL, kargo 2-3 gün sürer",
    "Merhaba, ürün ne zaman kargoya verilir?",
    "5 yıldız veriyorum çok memnun kaldım",
  ])("masum metinleri geçirir: %s", (text) => {
    expect(containsContactInfo(text)).toBe(false);
  });
});
