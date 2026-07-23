import Link from "next/link";
import { apiFetchJson } from "@/lib/api";
import type { AdminDashboardData, AdminProfile } from "@/lib/types";

const STATUS_LABEL: Record<string, string> = {
  pending: "Beklemede",
  processing: "Hazırlanıyor",
  shipped: "Kargoda",
  delivered: "Teslim Edildi",
  cancelled: "İptal",
  refunded: "İade Edildi",
};

const STATUS_CLASS: Record<string, string> = {
  pending: "pending",
  processing: "processing",
  shipped: "shipped",
  delivered: "delivered",
  cancelled: "cancelled",
  refunded: "inactive",
};

function formatPrice(value: string) {
  return `${Number(value).toLocaleString("tr-TR", { minimumFractionDigits: 2 })} ₺`;
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

// gulumsalim.com'daki admin/index.php gösterge panelinin birebir karşılığı:
// istatistik kartları, bekleyen sipariş/düşük stok uyarıları, hızlı erişim
// kartları, son siparişler, düşük stok ve en çok görüntülenen ürünler.
export default async function AdminPanelIndexPage() {
  const [admin, dashboard] = await Promise.all([
    apiFetchJson<AdminProfile>("/admin/auth/me"),
    apiFetchJson<AdminDashboardData>("/admin/dashboard"),
  ]);
  const { stats, recentOrders, lowStockProducts, mostViewedProducts } = dashboard;

  return (
    <>
      <h2 style={{ marginBottom: 24, fontSize: 20, fontWeight: 600 }}>Hoş geldin, {admin.fullName} 👋</h2>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-header">
            <div className="stat-icon revenue">
              <i className="fas fa-lira-sign" />
            </div>
          </div>
          <div className="stat-value">{formatPrice(stats.totalRevenue)}</div>
          <div className="stat-label">Toplam Gelir</div>
        </div>
        <div className="stat-card">
          <div className="stat-header">
            <div className="stat-icon orders">
              <i className="fas fa-shopping-bag" />
            </div>
          </div>
          <div className="stat-value">{stats.totalOrders}</div>
          <div className="stat-label">Toplam Sipariş</div>
        </div>
        <div className="stat-card">
          <div className="stat-header">
            <div className="stat-icon products">
              <i className="fas fa-tshirt" />
            </div>
          </div>
          <div className="stat-value">{stats.totalActiveProducts}</div>
          <div className="stat-label">Aktif Ürün</div>
        </div>
        <div className="stat-card">
          <div className="stat-header">
            <div className="stat-icon customers">
              <i className="fas fa-users" />
            </div>
          </div>
          <div className="stat-value">{stats.totalCustomers}</div>
          <div className="stat-label">Müşteri</div>
        </div>
      </div>

      {stats.pendingOrders > 0 && (
        <div className="admin-card">
          <div className="admin-card-body" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span>
              <i className="fas fa-exclamation-circle" style={{ color: "var(--admin-warning)", marginRight: 8 }} />
              <strong>{stats.pendingOrders}</strong> sipariş onayınızı bekliyor.
            </span>
            <Link href="/admin/panel/siparisler" className="admin-btn">
              Siparişleri Gör
            </Link>
          </div>
        </div>
      )}

      {stats.lowStockCount > 0 && (
        <div className="admin-card">
          <div className="admin-card-body" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span>
              <i className="fas fa-exclamation-triangle" style={{ color: "var(--admin-error)", marginRight: 8 }} />
              <strong>{stats.lowStockCount}</strong> ürünün stoğu azalıyor.
            </span>
            <Link href="/admin/panel/urunler" className="admin-btn">
              Ürünleri Gör
            </Link>
          </div>
        </div>
      )}

      <div className="quick-actions" style={{ marginBottom: 24 }}>
        <Link href="/admin/panel/saticilar" className="admin-btn">
          <i className="fas fa-store" /> Satıcılar
        </Link>
        <Link href="/admin/panel/slider" className="admin-btn">
          <i className="fas fa-images" /> Slider Yönet
        </Link>
        <Link href="/admin/panel/siparisler" className="admin-btn">
          <i className="fas fa-shopping-bag" /> Siparişler
        </Link>
        <Link href="/admin/panel/ayarlar" className="admin-btn">
          <i className="fas fa-cog" /> Ayarlar
        </Link>
      </div>

      <div className="admin-card">
        <div className="admin-card-header">
          <h2>Son Siparişler</h2>
        </div>
        {recentOrders.length === 0 ? (
          <div className="admin-empty">
            <i className="fas fa-shopping-bag" />
            <h3>Henüz sipariş yok</h3>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Sipariş No</th>
                  <th>Müşteri</th>
                  <th>Tutar</th>
                  <th>Durum</th>
                  <th>Tarih</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.map((o) => (
                  <tr key={o.id}>
                    <td>{o.orderNumber}</td>
                    <td style={{ fontSize: "0.85rem" }}>{o.customerName}</td>
                    <td>{formatPrice(o.total)}</td>
                    <td>
                      <span className={`admin-badge admin-badge-${STATUS_CLASS[o.status] ?? "pending"}`}>
                        {STATUS_LABEL[o.status] ?? o.status}
                      </span>
                    </td>
                    <td style={{ fontSize: "0.85rem" }}>{formatDate(o.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="admin-card">
        <div className="admin-card-header">
          <h2>Düşük Stok</h2>
        </div>
        {lowStockProducts.length === 0 ? (
          <div className="admin-empty">
            <i className="fas fa-box" />
            <h3>Düşük stoklu ürün yok</h3>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Ürün</th>
                  <th>Fiyat</th>
                  <th>Stok</th>
                </tr>
              </thead>
              <tbody>
                {lowStockProducts.map((p) => (
                  <tr key={p.id}>
                    <td>{p.name}</td>
                    <td>{formatPrice(p.basePrice)}</td>
                    <td>
                      <span className="admin-badge admin-badge-cancelled">{p.totalStock}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="admin-card">
        <div className="admin-card-header">
          <h2>Müşterilerin En Çok Baktığı Ürünler</h2>
        </div>
        {mostViewedProducts.length === 0 ? (
          <div className="admin-empty">
            <i className="fas fa-eye" />
            <h3>Henüz görüntülenme verisi yok</h3>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Ürün</th>
                  <th>Satıcı</th>
                  <th>Fiyat</th>
                  <th>Görüntülenme</th>
                </tr>
              </thead>
              <tbody>
                {mostViewedProducts.map((p) => (
                  <tr key={p.id}>
                    <td>{p.name}</td>
                    <td style={{ fontSize: "0.85rem" }}>{p.vendorStoreName}</td>
                    <td>{formatPrice(p.basePrice)}</td>
                    <td>{p.viewCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
