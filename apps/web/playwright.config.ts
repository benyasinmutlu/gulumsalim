import { defineConfig, devices } from "@playwright/test";

// bkz. denetim raporu: "Kritik E2E Test Senaryosu" - kod tabanında hiç
// otomatik uçtan uca test yoktu (sadece API'de vitest birim/entegrasyon
// testleri, bkz. apps/api). Bu, "Ana Sayfa → Arama → Ürün → Sepet" kritik
// alışveriş akışını koruyan ilk gerçek smoke test'in altyapısı.
//
// ÖN KOŞUL: Bu test paketi Next.js dev sunucusunu KENDİSİ başlatır
// (webServer, aşağıda), ama Fastify API'yi (apps/api, port 3000) VE
// bağımlılıklarını (Postgres, Redis, Meilisearch) başlatmaz - bunlar
// zaten çalışıyor olmalı (bkz. README/DEV kurulumu). CI'a bağlamak
// (Postgres/Redis/Meilisearch'i CI'da ayağa kaldırmak, test verisi
// tohumlamak) ayrı bir karar/iş - hangi CI sağlayıcısının kullanılacağı
// bilinmeden burada varsayılmadı.
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: "html",
  // Next.js dev modu, ilk kez ziyaret edilen bir rotayı isteğin ANINDA
  // derler (on-demand compilation) - bu, varsayılan 5sn'lik bekleme
  // süresini aşabilir. Prod build'de gerekmez, ama bu paket şu an dev
  // sunucusuna karşı çalıştığı için (bkz. webServer altında) gerçekçi.
  expect: { timeout: 15_000 },
  use: {
    baseURL: "http://localhost:3001",
    trace: "on-first-retry",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3001",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
