import { NextRequest, NextResponse } from "next/server";

function contentSecurityPolicy(nonce: string) {
  const isDev = process.env.NODE_ENV === "development";
  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'self'",
    "form-action 'self' https://*.iyzipay.com https://*.iyzico.com",
    `script-src 'self' 'nonce-${nonce}'${isDev ? " 'unsafe-eval'" : ""} https://accounts.google.com https://www.googletagmanager.com https://connect.facebook.net https://static.cloudflareinsights.com https://*.iyzipay.com https://*.iyzico.com`,
    "script-src-attr 'none'",
    `style-src 'self' 'nonce-${nonce}' https://accounts.google.com https://cdnjs.cloudflare.com https://fonts.googleapis.com`,
    "style-src-attr 'unsafe-inline'",
    "font-src 'self' data: https://cdnjs.cloudflare.com https://fonts.gstatic.com",
    "img-src 'self' data: blob: https:",
    "media-src 'self' blob: https:",
    "connect-src 'self' https://accounts.google.com https://www.googletagmanager.com https://*.google-analytics.com https://static.cloudflareinsights.com https://*.iyzipay.com https://*.iyzico.com",
    "frame-src 'self' https://accounts.google.com https://www.googletagmanager.com https://*.iyzipay.com https://*.iyzico.com",
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "upgrade-insecure-requests",
  ].join("; ");
}

export function proxy(request: NextRequest) {
  // Her HTML yanıtına tahmin edilemez, tek kullanımlık bir nonce. UUID v4'ün
  // rastgele 122 biti CSP nonce için yeterlidir.
  const nonce = crypto.randomUUID().replaceAll("-", "");
  const csp = contentSecurityPolicy(nonce);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: [
    {
      source: "/((?!api|uploads|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
