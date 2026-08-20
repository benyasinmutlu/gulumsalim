import Link from "next/link";
import { apiFetchJson } from "@/lib/api";
import type { VendorDashboardData, VendorProfile } from "@/lib/types";
import { OrderStatusPieChart, SalesLineChart } from "@/components/dashboard-charts";
import PeriodChangeBadge from "@/components/period-change-badge";

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
  stats: { todaySales: "0", monthSales: "0", totalOrders: 0, pendingOrders: 0, productCount: 0, avgRating: null, reviewCount: 0, lowStockCount: 0, followerCount: 0, storeViewCount: 0 },
  recentOrders: [],
  salesTimeSeries: [],
  orderStatusBreakdown: [],
  periodComparison: { revenueChangePercent: null, orderCountChangePercent: null },
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
  const [{ stats, recentOrders, salesTimeSeries, orderStatusBreakdown, periodComparison }, profile] = await Promise.all([
    getDashboard(),
    apiFetchJson<VendorProfile>("/vendor/auth/me").catch(() => null),
  ]);

  // bkz. kullanıcı isteği: "vergi/tckn no'su email'i telefon no'su adresi
  // olmayan satıcılar satış yapamaz" - bu kısıt sadece YENİ onaylarda
  // uygulanıyor (bkz. admin-vendors.service.ts), bu kısıttan önce zaten
  // "active" olan satıcılar geriye dönük durdurulmuyor; onun yerine burada
  // profillerini tamamlamaları için nazik bir uyarı gösteriliyor.
  const missingFields: string[] = [];
  if (profile) {
    if (!profile.taxId) missingFields.push("Vergi No / TCKN");
    if (!profile.phone) missingFields.push("Telefon");
    if (!profile.legalAddress) missingFields.push("Adres");
  }

  return (
    <div>
      {missingFields.length > 0 && (
        <div className="ga-alert" style={{ marginBottom: 20 }}>
          <i className="fas fa-triangle-exclamation" /> Mağaza profilinizde eksik bilgiler var: <strong>{missingFields.join(", ")}</strong>.
          Yakında bu bilgiler olmadan satışa devam edilemeyecek,{" "}
          <Link href="/satici/panel/ayarlar" style={{ textDecoration: "underline" }}>
            lütfen Ayarlar sayfasından tamamlayın
          </Link>
          .
        </div>
      )}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="sc-label"><i className="fas fa-calendar-day" /> Bugünkü Satış</div>
          <div className="sc-val" style={{ color: "var(--pr)" }}>{tl(stats.todaySales)}</div>
          <div className="sc-sub">Bugün ödemesi tamamlanan</div>
        </div>
        <div className="stat-card">
          <div className="sc-label"><i className="fas fa-calendar-alt" /> Aylık Satış</div>
          <div className="sc-val">{tl(stats.monthSales)}</div>
          <div className="sc-sub" style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            Bu ay ödemesi tamamlanan
            {periodComparison.revenueChangePercent !== null && (
              <>· son 30 gün <PeriodChangeBadge value={periodComparison.revenueChangePercent} /></>
            )}
          </div>
        </div>
        <div className="stat-card">
          <div className="sc-label"><i className="fas fa-shopping-bag" /> Toplam Sipariş</div>
          <div className="sc-val">{stats.totalOrders}</div>
          <div className="sc-sub" style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            Tüm zamanlar
            {periodComparison.orderCountChangePercent !== null && (
              <>· son 30 gün <PeriodChangeBadge value={periodComparison.orderCountChangePercent} /></>
            )}
          </div>
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
        {/* bkz. kullanıcı isteği (2026-08-02): "bireysel satıcı panelinde
            arayüz daha basit olsun" - bireysel satıcının ürünü tek parça
            (stok hep 1, satılınca otomatik kalkar, bkz. kullanıcı isteği
            2026-08-03), yani "az kaldı" diye bir ara durum yok, ikili: ya
            var ya satıldı. Bu yüzden "Düşük Stok" kartı onlar için anlamsız.
            İşletme satıcıda değişiklik yok. */}
        {profile?.vendorType !== "individual" && (
          <div className="stat-card">
            <div className="sc-label"><i className="fas fa-box" /> Düşük Stok</div>
            <div className="sc-val" style={{ color: stats.lowStockCount > 0 ? "var(--er)" : undefined }}>{stats.lowStockCount}</div>
            <div className="sc-sub">Ürün az kaldı</div>
          </div>
        )}
        <div className="stat-card">
          <div className="sc-label"><i className="fas fa-eye" /> Mağaza Ziyaretçisi</div>
          <div className="sc-val">{stats.storeViewCount}</div>
          <div className="sc-sub">Toplam görüntülenme</div>
        </div>
      </div>

      {profile?.vendorType !== "individual" && stats.lowStockCount > 0 && (
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

      <div className="row2" style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 20, marginBottom: 20 }}>
        <div className="card" style={{ minWidth: 0 }}>
          <div className="ch">
            <h3><i className="fas fa-chart-line" /> Son 30 Gün Satış</h3>
          </div>
          <div className="card-body">
            <SalesLineChart data={salesTimeSeries} />
          </div>
        </div>
        <div className="card" style={{ minWidth: 0 }}>
          <div className="ch">
            <h3><i className="fas fa-chart-pie" /> Sipariş Durumu Dağılımı</h3>
          </div>
          <div className="card-body">
            <OrderStatusPieChart data={orderStatusBreakdown} statusLabels={STATUS_LABEL} />
          </div>
        </div>
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
