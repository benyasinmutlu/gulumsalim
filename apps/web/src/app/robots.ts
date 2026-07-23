import type { MetadataRoute } from "next";
import { SITE_ORIGIN } from "@/lib/env";

// gulumsalim.com'daki robots.txt'nin karşılığı - admin/satıcı paneli ve
// oturum gerektiren özel sayfalar dizinlenmesin diye engellenir.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin/", "/satici/panel", "/hesabim", "/sepet", "/odeme", "/siparis-sonucu", "/arama"],
    },
    sitemap: `${SITE_ORIGIN}/sitemap.xml`,
  };
}
