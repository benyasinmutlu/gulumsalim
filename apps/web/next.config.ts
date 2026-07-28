import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Prod'da nginx zaten /api/*'i doğrudan Fastify'a yönlendiriyor - bu
  // rewrite orada hiç devreye girmez. Yerel geliştirmede (nginx yok, Next
  // ve API ayrı portlarda) client component'lerin her ortamda aynı şekilde
  // sabit "/api/..." relative path'i kullanabilmesini sağlar.
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "http://127.0.0.1:3000/:path*",
      },
    ];
  },
};

export default nextConfig;
