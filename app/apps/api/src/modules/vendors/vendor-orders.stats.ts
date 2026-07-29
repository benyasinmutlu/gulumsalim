export interface VendorOrderStats {
  total: number;
  pending: number;
  processing: number;
  shipped: number;
  delivered: number;
  cancelled: number;
  // Gerçekleşen ciro: kazanç teslimatta hesaba geçtiği için (bkz.
  // vendor-orders.service.ts markDeliveredAndCreditEarning) yalnız teslim
  // edilen kalemlerin tutarı toplanır.
  revenue: number;
}

export interface OrderStatsInput {
  vendorStatus: string;
  total: string;
}

// Satıcı sipariş özeti (bkz. kullanıcı isteği: "analiz"). Filtrelenmemiş tüm
// paid kalem listesinden SAF olarak hesaplanır - infra gerektirmeden test
// edilebilir ve tek DB sorgusunu yeniden kullanır.
export function computeOrderStats(rows: readonly OrderStatsInput[]): VendorOrderStats {
  const acc: VendorOrderStats = {
    total: 0,
    pending: 0,
    processing: 0,
    shipped: 0,
    delivered: 0,
    cancelled: 0,
    revenue: 0,
  };
  for (const row of rows) {
    acc.total += 1;
    switch (row.vendorStatus) {
      case "pending":
        acc.pending += 1;
        break;
      case "processing":
        acc.processing += 1;
        break;
      case "shipped":
        acc.shipped += 1;
        break;
      case "delivered":
        acc.delivered += 1;
        acc.revenue += Number(row.total) || 0;
        break;
      case "cancelled":
        acc.cancelled += 1;
        break;
    }
  }
  return acc;
}
