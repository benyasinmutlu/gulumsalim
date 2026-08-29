import { describe, expect, it } from "vitest";
import { filterUnsafePublicSettings, isKnownPublicSettingSafe } from "./public-settings-security";

describe("public settings security", () => {
  it("script/style bağlamına giren değerleri sıkı formatta doğrular", () => {
    expect(isKnownPublicSettingSafe("color_primary", "#C06C84")).toBe(true);
    expect(isKnownPublicSettingSafe("site_instagram", "https://instagram.com/gulumsalim")).toBe(true);
    expect(isKnownPublicSettingSafe("hero_height_desktop", "520px")).toBe(true);
    expect(isKnownPublicSettingSafe("gtm_container_id", "GTM-ABC1234")).toBe(true);
    expect(isKnownPublicSettingSafe("color_primary", "red;}</style><script>alert(1)</script>")).toBe(false);
    expect(isKnownPublicSettingSafe("ga_measurement_id", "G-X');alert(1);//")).toBe(false);
    expect(isKnownPublicSettingSafe("site_instagram", "javascript:alert(1)")).toBe(false);
  });

  it("geçersiz korumalı anahtarı public yanıttan çıkarır", () => {
    expect(
      filterUnsafePublicSettings({
        site_name: "Gülüm Şalım",
        color_primary: "#C06C84",
        gtm_container_id: "bad<script>",
      }),
    ).toEqual({ site_name: "Gülüm Şalım", color_primary: "#C06C84" });
  });
});
