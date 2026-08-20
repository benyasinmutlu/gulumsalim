import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "../../config/env";

// Misafir siparis numaralari gizli bilgi degildir ve zaman damgasi tabanlidir.
// Siparis detayini yalniz numarayla acmak yerine, sunucunun SESSION_SECRET ile
// imzaladigi sabit uzunlukta bir erisim anahtari kullanilir. Veritabanina ham
// token yazilmaz; secret rotasyonu eski linkleri de gecersiz kilar.
export function createOrderAccessToken(orderNumber: string): string {
  return createHmac("sha256", env.SESSION_SECRET)
    .update(`order-detail:v1:${orderNumber}`)
    .digest("hex");
}

export function verifyOrderAccessToken(orderNumber: string, token: string | undefined): boolean {
  if (!token || !/^[a-f0-9]{64}$/i.test(token)) return false;
  const expected = Buffer.from(createOrderAccessToken(orderNumber), "hex");
  const supplied = Buffer.from(token, "hex");
  return expected.length === supplied.length && timingSafeEqual(expected, supplied);
}
