import { expect, test } from "@playwright/test";

test.describe("anasayfa ve üyelik düzeni", () => {
  test("anasayfada tekrar eden promosyon ve kategori vitrini gösterilmez", async ({ page }) => {
    await page.goto("/");

    await expect(page.locator(".home-hero-cards")).toHaveCount(0);
    await expect(page.locator(".home-categories")).toHaveCount(0);

    const seasonTrendHeading = page.locator(".deal-shelf-title:visible").filter({ hasText: /^Sezon Trendleri$/ });
    if ((await page.locator(".product-card").count()) > 0) {
      await expect(seasonTrendHeading).toBeVisible();
    }
  });

  test("filtre ve sıralama tek panelden uygulanır", async ({ page }) => {
    await page.goto("/urunler");

    const panel = page.locator(".filter-sidebar-desktop");
    await expect(panel.getByRole("heading", { name: "Filtrele ve Sırala" })).toBeVisible();
    await panel.getByLabel("Sıralama").selectOption("price-asc");
    await panel.getByRole("button", { name: "Sonuçları Göster" }).click();
    await expect(page).toHaveURL(/(?:\?|&)sort=price-asc(?:&|$)/);
  });

  test("kurumsal kayıt vitrini masaüstünde ilk ekranda dengeli görünür", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/satici/kayit");

    const visual = page.locator(".ga-vendor-register .ga-visual");
    const content = page.locator(".ga-vendor-register .ga-visual-inner");
    await expect(visual).toBeVisible();
    await expect(content).toBeVisible();

    const visualBox = await visual.boundingBox();
    const contentBox = await content.boundingBox();
    expect(visualBox).not.toBeNull();
    expect(contentBox).not.toBeNull();
    expect(visualBox!.height).toBeGreaterThanOrEqual(799);
    expect(contentBox!.y).toBeLessThan(180);
  });

  test("kurumsal kayıt formu mobilde tek kolon kalır", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/satici/kayit");

    await expect(page.locator(".ga-vendor-register .ga-visual")).toBeHidden();
    await expect(page.getByRole("heading", { name: "Kurumsal Üyelik Başvurusu" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Başvuruyu Gönder" })).toBeVisible();
  });
});
