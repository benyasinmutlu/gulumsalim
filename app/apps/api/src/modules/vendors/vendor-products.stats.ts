export interface VendorProductStats {
  total: number;
  active: number;
  lowStock: number;
  outOfStock: number;
  totalViews: number;
  totalFavorites: number;
}

// computeProductStats yalnız bu alanları okur - liste satırının (daha geniş)
// tipi buna yapısal olarak atanabilir, böylece test için tam satırı kurmaya
// gerek kalmaz.
export interface ProductStatsInput {
  status: string;
  totalStock: number;
  viewCount: number;
  favoriteCount: number;
}

// Düşük stok eşiği - products-table.tsx'teki görsel uyarıyla (≤5) aynı.
export const LOW_STOCK_THRESHOLD = 5;

// Satıcı ürün özeti (bkz. kullanıcı isteği: "analiz"). Filtrelenmemiş tüm
// ürün listesinden SAF olarak hesaplanır - infra gerektirmeden test edilebilir
// ve tek DB sorgusunu yeniden kullanır.
export function computeProductStats(rows: readonly ProductStatsInput[]): VendorProductStats {
  return rows.reduce<VendorProductStats>(
    (acc, row) => {
      acc.total += 1;
      if (row.status === "active") acc.active += 1;
      if (row.totalStock === 0) acc.outOfStock += 1;
      else if (row.totalStock <= LOW_STOCK_THRESHOLD) acc.lowStock += 1;
      acc.totalViews += row.viewCount;
      acc.totalFavorites += row.favoriteCount;
      return acc;
    },
    { total: 0, active: 0, lowStock: 0, outOfStock: 0, totalViews: 0, totalFavorites: 0 },
  );
}
