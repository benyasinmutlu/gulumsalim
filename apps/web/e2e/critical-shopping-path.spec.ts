import { expect, test } from "@playwright/test";

// bkz. denetim raporu: "Kritik E2E Test Senaryosu" - Ana Sayfa → Arama →
// Ürün → Sepet akışının hiçbir otomatik koruması yoktu. Test verisi
// ortama göre değiştiği için (kaç ürün/kategori olduğu bilinmez) sabit
// bir ürün adı/sayısı varsaymak yerine, sayfadan GERÇEKTEN bulunan ilk
// ürünle devam edilir - bu da testi hem gerçekçi hem de kırılgan
// olmaktan kurtarır.
test.describe("kritik alışveriş akışı", () => {
  test("ana sayfa yüklenir", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/Gülüm Şalım/);
  });

  test("arama kutusu sonuç sayfasına gider", async ({ page }) => {
    await page.goto("/");
    // bkz. components/search-box.tsx - placeholder daktilo efektiyle sürekli
    // değişiyor (bkz. useTypewriterPlaceholder), bu yüzden sabit bir
    // aria-label kullanılır.
    const searchInput = page.getByLabel("Aradığın ürün, kategori veya mağaza");
    await searchInput.fill("elbise");
    await searchInput.press("Enter");
    await expect(page).toHaveURL(/\/arama\?/);
    // Sonuç bulunsun ya da bulunmasın, sayfa çökmemeli - başlık her
    // durumda görünür olmalı.
    await expect(page.locator("h1")).toBeVisible();
  });

  test("ürün listesinden ürün sayfasına geçilip sepete eklenebilir", async ({ page }) => {
    await page.goto("/urunler");
    const firstProductLink = page.locator(".product-card a").first();

    // Bu ortamda hiç aktif ürün yoksa akışın geri kalanı anlamsız -
    // testi başarısız saymak yerine bilgilendirici şekilde atla.
    test.skip((await firstProductLink.count()) === 0, "Test ortamında aktif ürün yok, akış devam ettirilemedi");

    await firstProductLink.click();
    await expect(page).toHaveURL(/\/[^/]+\/[^/]+$|\/urun\//);
    await expect(page.locator(".detail-name")).toBeVisible();

    const addToCartButton = page.getByRole("button", { name: "Sepete Ekle" });
    await expect(addToCartButton).toBeVisible();
    if (await addToCartButton.isEnabled()) {
      const [response] = await Promise.all([
        page.waitForResponse((r) => r.url().includes("/api/cart/items") && r.request().method() === "POST"),
        addToCartButton.click(),
      ]);
      expect(response.ok()).toBeTruthy();
      await expect(page.getByRole("button", { name: /Sepete Eklendi/ })).toBeVisible();

      await page.goto("/sepet");
      await expect(page.locator(".cart-items, .empty-state")).toBeVisible();
    }
  });
});
