import type { Metadata } from "next";
import { Outfit, Playfair_Display } from "next/font/google";
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

// Orijinal gulumsalim.com kimliğine dönüş (2026-07-21) - eski sitenin
// assets/css/style.css'inde kullandığı fontlarla birebir aynı: gövde metni
// Outfit, başlıklar Playfair Display.
const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
});

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  weight: ["400", "700"],
  style: ["italic", "normal"],
});

const SITE_URL = "https://gulumsalim.com";

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
    openGraph: {
      type: "website",
      siteName: settings.site_name || "Gülüm Şalım",
      title,
      description,
      url: SITE_URL,
    },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const settings = await getSiteSettings();
  // gulumsalim.com'daki admin/settings.php > Görünüm sekmesinin karşılığı -
  // admin panelden marka renkleri girilmişse globals.css'teki varsayılanların
  // üzerine :root özel özellikleri olarak yazılır.
  const colorOverrides = [
    settings.color_primary && `--color-primary: ${settings.color_primary};`,
    settings.color_primary_dark && `--color-primary-dark: ${settings.color_primary_dark};`,
    settings.color_secondary && `--color-secondary: ${settings.color_secondary};`,
    settings.color_accent && `--color-accent: ${settings.color_accent};`,
    settings.hero_height_desktop && `--hero-height-desktop: ${settings.hero_height_desktop};`,
    settings.hero_height_mobile && `--hero-height-mobile: ${settings.hero_height_mobile};`,
  ]
    .filter(Boolean)
    .join(" ");

  const gaId = settings.ga_measurement_id;
  const gtmId = settings.gtm_container_id;
  const pixelId = settings.meta_pixel_id;

  return (
    <html lang="tr" className={`${outfit.variable} ${playfair.variable}`}>
      <head>
        {/* gulumsalim.com'daki ikon setiyle birebir aynı - Font Awesome 6.5.1 */}
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css" />
        {colorOverrides && <style dangerouslySetInnerHTML={{ __html: `:root { ${colorOverrides} }` }} />}

        {/* admin/settings.php > Analitik sekmesinin karşılığı - üçü de
            admin ayarlarında boşsa hiç enjekte edilmez. */}
        {gtmId && (
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
