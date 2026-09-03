import type { Metadata } from "next";
import { Cormorant_Garamond, Outfit } from "next/font/google";
import { publicFetchJson } from "@/lib/api";
import type { SiteSettings } from "@/lib/types";
import PresenceHeartbeat from "@/components/presence-heartbeat";
import "./globals.css";

async function getSiteSettings(): Promise<SiteSettings> {
  try {
    return await publicFetchJson<SiteSettings>("/site-settings");
  } catch {
    return {};
  }
}

// Outfit arayüz ve uzun metinlerde okunaklı kalır. Cormorant Garamond yalnız
// marka ve vitrin başlıklarında kullanılan sıcak, editoryal display yüzüdür.
const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin", "latin-ext"],
  weight: ["300", "400", "500", "600", "700", "800"],
});

const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700"],
  style: ["italic", "normal"],
});

const SITE_URL = "https://gulumsalim.com";

const SYSTEM_THEME_COLORS = {
  primary: ["#C06C84", "#151515", "#24201C"],
  primaryDark: ["#8B3A62", "#2F2F2D", "#171512"],
  secondary: ["#6C5B7B", "#5F5F5B", "#625B53"],
  accent: ["#F67280", "#806A4F", "#6B5D4F"],
} as const;

function customThemeColor(value: string | undefined, systemDefaults: readonly string[]) {
  if (!value || systemDefaults.some((candidate) => value.toUpperCase() === candidate.toUpperCase())) return undefined;
  return value;
}

function hexToRgbTriplet(value: string | undefined) {
  if (!value) return undefined;
  const raw = value.slice(1);
  const normalized = raw.length === 3 || raw.length === 4
    ? raw.slice(0, 3).split("").map((char) => `${char}${char}`).join("")
    : raw.slice(0, 6);
  if (!/^[0-9a-f]{6}$/i.test(normalized)) return undefined;
  return [0, 2, 4].map((offset) => Number.parseInt(normalized.slice(offset, offset + 2), 16)).join(", ");
}

// gulumsalim.com'daki admin/settings.php > SEO sekmesinin karşılığı -
// admin panelden meta başlık/açıklama girilmişse onlar kullanılır. Open
// Graph etiketleri önceki denetimde hiç eklenmemişti - WhatsApp/Facebook/
// Twitter'da paylaşılan bağlantı önizlemesi (kart) için gerekli, sayfa
// bazlı generateMetadata'lar (ürün/sayfa/kategori) bunun üzerine kendi
// title/description'larını yazarak devralır.
export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSiteSettings();
  const title = settings.meta_title || settings.site_name || "Gülüm Şalım";
  const description = settings.meta_description || "Kadın Giyim - Şıklığınızı Tamamlayın";
  return {
    title,
    description,
    metadataBase: new URL(SITE_URL),
    alternates: { canonical: SITE_URL },
    openGraph: {
      type: "website",
      siteName: settings.site_name || "Gülüm Şalım",
      title,
      description,
      url: SITE_URL,
    },
    // bkz. denetim raporu: "Open Graph ve sosyal paylaşım metadata" -
    // Twitter/X kart etiketi hiç yoktu, site genelinde bu tek yerden gelir
    // (sayfa bazlı generateMetadata'lar - bkz. getProductMeta - kendi
    // title/description/images'ıyla üzerine yazar).
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

// bkz. denetim raporu: "Organization ... structured data" hiç yoktu -
// Google'ın bilgi panelinde/arama sonucunda marka kimliğini (logo, ad,
// iletişim) tanıyabilmesi için.
function organizationJsonLd(settings: SiteSettings) {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: settings.site_name || "Gülüm Şalım",
    url: SITE_URL,
    ...(settings.site_logo && { logo: settings.site_logo }),
    ...(settings.site_email && { email: settings.site_email }),
    ...(settings.site_phone && { telephone: settings.site_phone }),
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const settings = await getSiteSettings();
  // Admin panelde gerçekten özelleştirilmiş marka renkleri varsa yeni tema
  // varsayılanlarının üzerine yazılır. Önceki pembe ve Fildişi varsayılanları
  // özelleştirme sayılmaz; gerçekten admin tarafından seçilen renkler korunur.
  const customPrimary = customThemeColor(settings.color_primary, SYSTEM_THEME_COLORS.primary);
  const customPrimaryDark = customThemeColor(settings.color_primary_dark, SYSTEM_THEME_COLORS.primaryDark);
  const customSecondary = customThemeColor(settings.color_secondary, SYSTEM_THEME_COLORS.secondary);
  const customAccent = customThemeColor(settings.color_accent, SYSTEM_THEME_COLORS.accent);
  const customPrimaryRgb = hexToRgbTriplet(customPrimary);
  const customAccentRgb = hexToRgbTriplet(customAccent);
  const colorOverrides = [
    customPrimary && `--color-primary: ${customPrimary};`,
    customPrimary && `--color-primary-light: color-mix(in srgb, ${customPrimary} 14%, white);`,
    customPrimaryRgb && `--color-primary-rgb: ${customPrimaryRgb};`,
    customPrimaryDark && `--color-primary-dark: ${customPrimaryDark};`,
    customSecondary && `--color-secondary: ${customSecondary};`,
    customAccent && `--color-accent: ${customAccent};`,
    customAccent && `--color-gold: ${customAccent};`,
    customAccentRgb && `--color-accent-rgb: ${customAccentRgb};`,
    settings.hero_height_desktop && `--hero-height-desktop: ${settings.hero_height_desktop};`,
    settings.hero_height_mobile && `--hero-height-mobile: ${settings.hero_height_mobile};`,
  ]
    .filter(Boolean)
    .join(" ");

  const gaId = settings.ga_measurement_id;
  const gtmId = settings.gtm_container_id;
  const pixelId = settings.meta_pixel_id;

  return (
    <html lang="tr" className={`${outfit.variable} ${cormorant.variable}`}>
      <head>
        {/* gulumsalim.com'daki ikon setiyle birebir aynı - Font Awesome 6.5.1 */}
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css" />
        {colorOverrides && <style dangerouslySetInnerHTML={{ __html: `:root { ${colorOverrides} }` }} />}
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd(settings)) }} />

        {/* admin/settings.php > Analitik sekmesinin karşılığı - üçü de
            admin ayarlarında boşsa hiç enjekte edilmez. */}
        {gtmId && (
          // Admin tarafından verilen container ID ile koşullu, mevcut CSP
          // nonce akışına bağlı özel snippet.
          // eslint-disable-next-line @next/next/next-script-for-ga
          <script
            dangerouslySetInnerHTML={{
              __html: `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${gtmId}');`,
            }}
          />
        )}
        {gaId && (
          <>
            <script async src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`} />
            <script
              dangerouslySetInnerHTML={{
                __html: `window.dataLayer = window.dataLayer || [];function gtag(){dataLayer.push(arguments);}gtag('js', new Date());gtag('config', '${gaId}');`,
              }}
            />
          </>
        )}
        {pixelId && (
          <script
            dangerouslySetInnerHTML={{
              __html: `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init', '${pixelId}');fbq('track', 'PageView');`,
            }}
          />
        )}
      </head>
      <body>
        {gtmId && (
          <noscript>
            <iframe
              src={`https://www.googletagmanager.com/ns.html?id=${gtmId}`}
              height="0"
              width="0"
              style={{ display: "none", visibility: "hidden" }}
            />
          </noscript>
        )}
        <PresenceHeartbeat />
        {children}
      </body>
    </html>
  );
}
