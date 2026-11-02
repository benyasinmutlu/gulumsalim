import type { NextConfig } from "next";
import { resolve } from "node:path";

const localApiProxyUrl = process.env.LOCAL_API_PROXY_URL ?? "http://127.0.0.1:3000";
const localMediaProxyOrigin = process.env.LOCAL_MEDIA_PROXY_ORIGIN ?? "http://127.0.0.1:3000";

// Static renderingi korurken tarayıcının hangi kaynaklardan kod/içerik
// yükleyebileceğini sınırlar. Next'in inline bootstrap scriptleri ve iyzico
// checkout formu nedeniyle unsafe-inline şimdilik gereklidir; kaynak
// allowlist'i ve object/base/form/frame kısıtları saldırı yüzeyini daraltır.
const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'self'",
  "form-action 'self' https://*.iyzipay.com https://*.iyzico.com",
  `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""} https://accounts.google.com https://www.googletagmanager.com https://connect.facebook.net https://static.cloudflareinsights.com https://*.iyzipay.com https://*.iyzico.com`,
  "style-src 'self' 'unsafe-inline' https://accounts.google.com https://cdnjs.cloudflare.com https://fonts.googleapis.com",
  "font-src 'self' data: https://cdnjs.cloudflare.com https://fonts.gstatic.com",
  "img-src 'self' data: blob: https:",
  "media-src 'self' blob: https:",
  "connect-src 'self' https://accounts.google.com https://www.googletagmanager.com https://*.google-analytics.com https://static.cloudflareinsights.com https://*.iyzipay.com https://*.iyzico.com",
  "frame-src 'self' https://accounts.google.com https://www.googletagmanager.com https://*.iyzipay.com https://*.iyzico.com",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "upgrade-insecure-requests",
].join("; ");

const nextConfig: NextConfig = {
  // Yerel tarayıcı testleri hem localhost hem de 127.0.0.1 üzerinden
  // çalıştırılabiliyor. Next dev istemcisinin ikinci origin'de hydration/HMR
  // kaynaklarını engellemesini önler; üretim davranışını etkilemez.
  allowedDevOrigins: ["127.0.0.1"],
  // İç içe iki eski workspace dosyası bulunduğunda Next üst dizini yanlış
  // seçebiliyordu. Uygulamanın gerçek pnpm workspace kökünü açıkça sabitler.
  // Next 16 `turbopack.root` için mutlak yol bekler.
  turbopack: {
    root: resolve(process.cwd(), "../.."),
  },
  // Prod'da nginx zaten /api/*'i doğrudan Fastify'a yönlendiriyor - bu
  // rewrite orada hiç devreye girmez. Yerel geliştirmede (nginx yok, Next
  // ve API ayrı portlarda) client component'lerin her ortamda aynı şekilde
  // sabit "/api/..." relative path'i kullanabilmesini sağlar.
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${localApiProxyUrl}/:path*`,
      },
      {
        source: "/uploads/:path*",
        destination: `${localMediaProxyOrigin}/uploads/:path*`,
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [{ key: "Content-Security-Policy", value: contentSecurityPolicy }],
      },
    ];
  },
};

export default nextConfig;
