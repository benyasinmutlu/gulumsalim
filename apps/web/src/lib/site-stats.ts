import { publicFetchJson } from "./api";
import type { SiteStats } from "./types";

export { formatStatCount } from "./format-stat-count";

// bkz. denetim raporu madde 4: "Yüzlerce satıcı/binlerce ürün/milyonlarca
// müşteri" gibi sabit pazarlama iddialarının yerine gerçek /site-stats
// sayaçları. Sadece Server Component'lerden çağrılır (publicFetchJson gibi).
// Hata durumunda sıfır döner - çağıran taraf sayıyı 0 görürse niceliksel
// iddiayı hiç göstermemeli.
export async function getSiteStats(): Promise<SiteStats> {
  try {
    return await publicFetchJson<SiteStats>("/site-stats");
  } catch {
    return { activeVendors: 0, activeProducts: 0, customers: 0, defaultCommissionRate: 10 };
  }
}
