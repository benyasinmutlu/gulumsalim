import Link from "next/link";
import { apiFetchJson } from "@/lib/api";
import type { VendorDashboardData } from "@/lib/types";

function tl(value: string) {
  return Number(value).toLocaleString("tr-TR", { minimumFractionDigits: 2 }) + " ₺";
}

const STATUS_LABEL: Record<string, string> = {
  pending: "Beklemede",
  processing: "Hazırlanıyor",
  shipped: "Kargoda",
  delivered: "Teslim Edildi",
  cancelled: "İptal",
};

const EMPTY: VendorDashboardData = {
  stats: { todaySales: "0", monthSales: "0", totalOrders: 0, pendingOrders: 0, productCount: 0, avgRating: null, reviewCount: 0, lowStockCount: 0, followerCount: 0 },
  recentOrders: [],
};

async function getDashboard(): Promise<VendorDashboardData> {
  try {
    return await apiFetchJson<VendorDashboardData>("/vendor/dashboard");
  } catch {
    return EMPTY;
  }
}

// vendor/index.php'nin karşılığı - önceki halde bu sayfa yanlışlıkla
// Finans sayfasının cüzdan kartlarını tekrarlıyordu (bkz. re-audit
// bulgusu), gerçek "Genel Bakış" içeriği (satış/sipariş/ürün/puan
// istatistikleri, düşük stok uyarısı, hızlı erişim, son siparişler)
// hiç yoktu.
export default async function VendorDashboardPage() {
  const { stats, recentOrders } = await getDashboard();

  return (
    <div>
      <div className="stats-grid">
        <div className="stat-card">
          <div className="sc-label"><i className="fas fa-calendar-day" /> Bugünkü Satış</div>
          <div className="sc-val" style={{ color: "var(--pr)" }}>{tl(stats.todaySales)}</div>
          <div className="sc-sub">Bugün ödemesi tamamlanan</div>
        </div>
        <div className="stat-card">
          <div className="sc-label"><i className="fas fa-calendar-alt" /> Aylık Satış</div>
          <div className="sc-val">{tl(stats.monthSales)}</div>
          <div className="sc-sub">Bu ay ödemesi tamamlanan</div>
        </div>
        <div className="stat-card">
          <div className="sc-label"><i className="fas fa-shopping-bag" /> Toplam Sipariş</div>
          <div className="sc-val">{stats.totalOrders}</div>
          <div className="sc-sub">Tüm zamanlar</div>
        </div>
        <div className="stat-card">
          <div className="sc-label"><i className="fas fa-clock" /> Bekleyen Sipariş</div>
          <div className="sc-val" style={{ color: stats.pendingOrders > 0 ? "var(--wa)" : undefined }}>{stats.pendingOrders}</div>
          <div className="sc-sub">Hazırlanmayı bekliyor</div>
        </div>
        <div className="stat-card">
          <div className="sc-label"><i className="fas fa-tshirt" /> Aktif Ürün</div>
          <div className="sc-val">{stats.productCount}</div>
          <div className="sc-sub">Yayında</div>
        </div>
        <div className="stat-card">
          <div className="sc-label"><i className="fas fa-star" /> Ortalama Puan</div>
          <div className="sc-val">{stats.avgRating !== null ? `★ ${stats.avgRating.toFixed(1)}` : "—"}</div>
          <div className="sc-sub">{stats.reviewCount} değerlendirme</div>
        </div>
        <div className="stat-card">
          <div className="sc-label"><i className="fas fa-box" /> Düşük Stok</div>
          <div className="sc-val" style={{ color: stats.lowStockCount > 0 ? "var(--er)" : undefined }}>{stats.lowStockCount}</div>
          <div className="sc-sub">Ürün az kaldı</div>
        </div>
      </div>

      {stats.lowStockCount > 0 && (
        <div className="alert alert-wa">
          <i className="fas fa-triangle-exclamation" /> <strong>{stats.lowStockCount}</strong> ürününüzün stoğu azalıyor.{" "}
          <Link href="/satici/panel/urunler" style={{ textDecoration: "underline" }}>Ürünlerimi Gör</Link>
        </div>
      )}

      <div className="row4" style={{ marginBottom: 20 }}>
        <Link href="/satici/panel/urunler/yeni" className="btn btn-pr">
          <i className="fas fa-plus-circle" /> Yeni Ürün
        </Link>
        <Link href="/satici/panel/siparisler" className="btn btn-sec">
          <i className="fas fa-shopping-bag" /> Siparişler
        </Link>
        <Link href="/satici/panel/magaza" className="btn btn-sec">
          <i className="fas fa-store" /> Mağazam
        </Link>
        <Link href="/satici/panel/finans" className="btn btn-sec">
          <i className="fas fa-wallet" /> Finans
        </Link>
      </div>

      <div className="card">
        <div className="ch">
          <h3>Son Siparişler</h3>
        </div>
        {recentOrders.length === 0 ? (
          <div className="empty">
            <i className="fas fa-shopping-bag" />
            <p>Henüz ödemesi tamamlanmış bir sipariş yok.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Sipariş No</th>
                  <th>Müşteri</th>
                  <th>Ürün</th>
                  <th>Tutar</th>
                  <th>Durum</th>
                  <th>Tarih</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.map((o) => (
                  <tr key={o.id}>
                    <td>{o.orderNumber}</td>
                    <td>{o.customerName}</td>
                    <td>{o.productNameSnapshot}</td>
                    <td>{tl(o.total)}</td>
                    <td>{STATUS_LABEL[o.vendorStatus] ?? o.vendorStatus}</td>
                    <td style={{ fontSize: "0.85rem" }}>{new Date(o.createdAt).toLocaleDateString("tr-TR")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
