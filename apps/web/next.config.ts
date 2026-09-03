import type { NextConfig } from "next";
import { resolve } from "node:path";

const localApiProxyUrl = process.env.LOCAL_API_PROXY_URL ?? "http://127.0.0.1:3000";
const localMediaProxyOrigin = process.env.LOCAL_MEDIA_PROXY_ORIGIN ?? "http://127.0.0.1:3000";

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
};

export default nextConfig;
