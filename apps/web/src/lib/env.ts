// Next.js server tarafında (SSR) API'ye erişmek için kullanılır.
// Tarayıcıya asla gönderilmez, bu yüzden NEXT_PUBLIC_ önekine gerek yok.
export const API_URL = process.env.API_URL ?? "http://127.0.0.1:3000";
