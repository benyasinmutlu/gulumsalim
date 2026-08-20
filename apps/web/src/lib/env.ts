// Next.js server tarafında (SSR) API'ye erişmek için kullanılır.
// Tarayıcıya asla gönderilmez, bu yüzden NEXT_PUBLIC_ önekine gerek yok.
export const API_URL = process.env.API_URL ?? "http://127.0.0.1:3000";

// sitemap.ts/robots.ts gibi mutlak URL üretmesi gereken yerler için -
// gulumsalim.com'daki sitemap.php'deki $base sabitinin karşılığı.
export const SITE_ORIGIN = process.env.SITE_ORIGIN ?? "https://gulumsalim.com";
