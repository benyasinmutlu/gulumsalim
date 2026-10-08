import "dotenv/config";
import { PttClient } from "../modules/shipping/ptt.client";

// Bu script yalnız PTT'nin TEST servisinde kontrollü kabul kaydı üretir.
// Kimlik bilgilerini yazdırmaz ve production ortamında çalışmayı reddeder.
if ((process.env.PTT_ENV ?? "test") !== "test") {
  throw new Error("Doğrulama scripti yalnız PTT_ENV=test ile çalışır");
}
const customerId = process.env.PTT_CUSTOMER_ID;
const password = process.env.PTT_PASSWORD;
if (!customerId || !password) throw new Error("PTT_CUSTOMER_ID ve PTT_PASSWORD gerekli");

const client = new PttClient({ environment: "test", customerId, password, timeoutMs: 30_000 });
const existingReference = process.env.PTT_VERIFY_REFERENCE;
if (existingReference) {
  const tracking = await client.trackByReference(existingReference);
  process.stdout.write(JSON.stringify({
    environment: "test",
    reference: existingReference,
    barcode: tracking.barcode,
    trackingVisible: tracking.found,
    resultCode: tracking.resultCode,
    description: tracking.description,
  }, null, 2));
  process.exit(0);
}

const now = new Date();
const compactTimestamp = now.toISOString().replace(/\D/g, "").slice(0, 14);
const reference = `GS-VERIFY-${compactTimestamp}`;
const fileName = `GSV_${compactTimestamp}`;

const result = await client.registerShipment({
  fileName,
  reference,
  recipient: {
    name: "PTT TEST ALICI",
    phone: "05555555555",
    email: "ptt-test@gulumsalim.com",
    city: "ANKARA",
    district: "ÇANKAYA",
    address: "PTT ENTEGRASYON TEST GÖNDERİSİ, KIZILAY MAHALLESİ NO 1",
    postalCode: "06420",
  },
  sender: {
    name: "GÜLÜM ŞALIM TEST",
    phone: "05555555555",
    email: "ptt-test@gulumsalim.com",
    city: "İSTANBUL",
    district: "FATİH",
    address: "PTT ENTEGRASYON TEST GÖNDERİSİ, TEST MAHALLESİ NO 1",
    postalCode: "34000",
  },
  package: { weightGrams: 1000, widthCm: 20, lengthCm: 30, heightCm: 10 },
});

let trackingVisible = false;
let resolvedBarcode = result.barcode;
try {
  const tracking = await client.trackByReference(reference);
  trackingVisible = tracking.found;
  resolvedBarcode = tracking.barcode ?? resolvedBarcode;
} catch {
  // Kabul verisi takip servisine gecikmeli düşebilir. Kayıt başarılıysa bu,
  // doğrulama çıktısını başarısız yapmaz; referans daha sonra sorgulanabilir.
}

process.stdout.write(JSON.stringify({
  environment: "test",
  reference,
  barcode: resolvedBarcode,
  registrationCode: result.code,
  trackingVisible,
}, null, 2));
