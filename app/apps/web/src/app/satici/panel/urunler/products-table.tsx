"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { fetchJson, mutateJson } from "@/lib/client-api";
import type { VendorProduct, VendorProductStats } from "@/lib/types";

const STATUS_LABEL: Record<VendorProduct["status"], string> = {
  draft: "Taslak",
  active: "Aktif",
  inactive: "Pasif",
  rejected: "Reddedildi",
};

const STATUS_CLASS: Record<VendorProduct["status"], string> = {
  draft: "muted",
  active: "success",
  inactive: "warn",
  rejected: "danger",
};

const SORT_OPTIONS: { value: string; label: string }[] = [
  { value: "newest", label: "En Yeni" },
  { value: "oldest", label: "En Eski" },
  { value: "price_desc", label: "Fiyat: Yüksek → Düşük" },
  { value: "price_asc", label: "Fiyat: Düşük → Yüksek" },
  { value: "stock_desc", label: "Stok: Çok → Az" },
  { value: "stock_asc", label: "Stok: Az → Çok" },
  { value: "most_viewed", label: "En Çok Görüntülenen" },
  { value: "most_favorited", label: "En Çok Favorilenen" },
];

function tl(value: string) {
  return Number(value).toLocaleString("tr-TR", { minimumFractionDigits: 2 }) + " ₺";
}

export default function ProductsTable() {
  const [products, setProducts] = useState<VendorProduct[] | null>(null);
  const [stats, setStats] = useState<VendorProductStats | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus] = useState("");
  const [stock, setStock] = useState("");
  const [sort, setSort] = useState("newest");

  // Arama her tuş vuruşunda değil, kısa bir duraksamadan sonra sunucuya gider.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (debouncedSearch.trim()) params.set("search", debouncedSearch.trim());
    if (status) params.set("status", status);
    if (stock) params.set("stock", stock);
    if (sort) params.set("sort", sort);
    const qs = params.toString();
    const data = await fetchJson<VendorProduct[]>(`/vendor/products${qs ? `?${qs}` : ""}`);
    setProducts(data);
  }, [debouncedSearch, status, stock, sort]);

  const loadStats = useCallback(async () => {
    try {
      setStats(await fetchJson<VendorProductStats>("/vendor/products/stats"));
    } catch {
      // Özet analiz opsiyonel - tablo yine de gösterilir.
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  async function toggleStatus(product: VendorProduct) {
    setBusyId(product.id);
    try {
      const nextStatus = product.status === "active" ? "inactive" : "active";
      await mutateJson(`/vendor/products/${product.id}`, "PATCH", { status: nextStatus });
      await Promise.all([load(), loadStats()]);
    } finally {
      setBusyId(null);
    }
  }

  async function removeProduct(product: VendorProduct) {
    if (!confirm(`"${product.name}" silinsin mi?`)) return;
    setBusyId(product.id);
    try {
      await mutateJson(`/vendor/products/${product.id}`, "DELETE");
      await Promise.all([load(), loadStats()]);
    } finally {
      setBusyId(null);
    }
  }

  const hasFilters = Boolean(debouncedSearch.trim() || status || stock);

  return (
    <div>
      {stats && (
        <div className="stat-chips">
          <div className="chip">
            <span className="chip-val">{stats.total}</span>
            <span className="chip-lbl">Toplam Ürün</span>
          </div>
          <div className="chip">
            <span className="chip-val">{stats.active}</span>
            <span className="chip-lbl">Aktif</span>
          </div>
          <div className="chip chip-wa">
            <span className="chip-val">{stats.lowStock}</span>
            <span className="chip-lbl">Düşük Stok</span>
          </div>
          <div className="chip chip-er">
            <span className="chip-val">{stats.outOfStock}</span>
            <span className="chip-lbl">Tükendi</span>
          </div>
          <div className="chip">
            <span className="chip-val">{stats.totalViews.toLocaleString("tr-TR")}</span>
            <span className="chip-lbl">
              <i className="fas fa-eye" /> Görüntülenme
            </span>
          </div>
          <div className="chip">
            <span className="chip-val">{stats.totalFavorites.toLocaleString("tr-TR")}</span>
            <span className="chip-lbl">
              <i className="fas fa-heart" /> Favori
            </span>
          </div>
        </div>
      )}

      <div className="card">
        <div className="ch">
          <h3>Ürünlerim</h3>
          <Link href="/satici/panel/urunler/yeni" className="btn btn-pr btn-sm">
            <i className="fas fa-plus" /> Yeni Ürün Ekle
          </Link>
        </div>

        <div className="toolbar">
          <div className="toolbar-search">
            <i className="fas fa-search" />
            <input
              className="fi"
              type="search"
              placeholder="Ürün adına göre ara..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select className="fi" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Durum filtresi">
            <option value="">Tüm Durumlar</option>
            <option value="active">Aktif</option>
            <option value="inactive">Pasif</option>
            <option value="draft">Taslak</option>
            <option value="rejected">Reddedildi</option>
          </select>
          <select className="fi" value={stock} onChange={(e) => setStock(e.target.value)} aria-label="Stok filtresi">
            <option value="">Tüm Stok</option>
            <option value="in">Stokta</option>
            <option value="low">Düşük Stok (≤5)</option>
            <option value="out">Tükendi</option>
          </select>
          <select className="fi" value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sıralama">
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        {products === null ? (
          <div className="card-body">Yükleniyor...</div>
        ) : products.length === 0 ? (
          <div className="empty">
            <i className="fas fa-tshirt" />
            <p>{hasFilters ? "Bu filtrelere uygun ürün bulunamadı." : "Henüz ürün eklemediniz."}</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th></th>
                  <th>Ürün</th>
                  <th>Fiyat</th>
                  <th>Stok</th>
                  <th>Durum</th>
                  <th>İlgi</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <Link href={`/satici/panel/urunler/${p.id}`}>
                        {p.primaryImageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={p.primaryImageUrl}
                            alt={p.name}
                            style={{ width: 44, height: 44, objectFit: "cover", borderRadius: 6, display: "block" }}
                          />
                        ) : (
                          <div
                            style={{
                              width: 44,
                              height: 44,
                              borderRadius: 6,
                              background: "var(--s2)",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              color: "var(--tx3)",
                            }}
                          >
                            <i className="fas fa-image" />
                          </div>
                        )}
                      </Link>
                    </td>
                    <td>
                      <Link href={`/satici/panel/urunler/${p.id}`}>{p.name}</Link>
                    </td>
                    <td>{tl(p.basePrice)}</td>
                    <td>
                      {p.totalStock === 0 ? (
                        <span className="st st-danger">Tükendi</span>
                      ) : p.totalStock <= 5 ? (
                        <span className="st st-warn">{p.totalStock} adet</span>
                      ) : (
                        <span>{p.totalStock} adet</span>
                      )}
                    </td>
                    <td>
                      <span className={`st st-${STATUS_CLASS[p.status]}`}>{STATUS_LABEL[p.status]}</span>
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: 10, fontSize: 12, color: "var(--tx3)" }}>
                        <span title="Görüntülenme">
                          <i className="fas fa-eye" /> {p.viewCount}
                        </span>
                        <span title="Favori">
                          <i className="fas fa-heart" /> {p.favoriteCount}
                        </span>
                        <span title="Sepette">
                          <i className="fas fa-cart-shopping" /> {p.cartCount}
                        </span>
                      </div>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
                        <Link href={`/satici/panel/urunler/${p.id}`} className="btn btn-sec btn-sm">
                          Düzenle
                        </Link>
                        {p.status !== "rejected" && (
                          <button className="btn btn-sec btn-sm" disabled={busyId === p.id} onClick={() => toggleStatus(p)}>
                            {p.status === "active" ? "Pasife Al" : "Aktif Et"}
                          </button>
                        )}
                        <button className="btn btn-danger btn-sm" disabled={busyId === p.id} onClick={() => removeProduct(p)}>
                          Sil
                        </button>
                      </div>
                    </td>
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
