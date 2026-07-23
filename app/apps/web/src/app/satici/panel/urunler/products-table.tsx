"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { fetchJson, mutateJson } from "@/lib/client-api";
import type { VendorProduct } from "@/lib/types";

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

export default function ProductsTable() {
  const [products, setProducts] = useState<VendorProduct[] | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  async function load() {
    const data = await fetchJson<VendorProduct[]>("/vendor/products");
    setProducts(data);
  }

  useEffect(() => {
    load();
  }, []);

  async function toggleStatus(product: VendorProduct) {
    setBusyId(product.id);
    try {
      const nextStatus = product.status === "active" ? "inactive" : "active";
      await mutateJson(`/vendor/products/${product.id}`, "PATCH", { status: nextStatus });
      await load();
    } finally {
      setBusyId(null);
    }
  }

  async function removeProduct(product: VendorProduct) {
    if (!confirm(`"${product.name}" silinsin mi?`)) return;
    setBusyId(product.id);
    try {
      await mutateJson(`/vendor/products/${product.id}`, "DELETE");
      await load();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="card">
      <div className="ch">
        <h3>Ürünlerim</h3>
        <Link href="/satici/panel/urunler/yeni" className="btn btn-pr btn-sm">
          <i className="fas fa-plus" /> Yeni Ürün Ekle
        </Link>
      </div>

      {products === null ? (
        <div className="card-body">Yükleniyor...</div>
      ) : products.length === 0 ? (
        <div className="empty">
          <i className="fas fa-tshirt" />
          <p>Henüz ürün eklemediniz.</p>
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
                            background: "var(--bg2, #f3f3f3)",
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
                  <td>{Number(p.basePrice).toLocaleString("tr-TR", { minimumFractionDigits: 2 })} ₺</td>
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
                    {/* bkz. kullanıcı isteği: "ürünlerine kaç kişi baktı ...
                        favorideyse de göster ... sepetteyse göster" */}
                    <div style={{ display: "flex", gap: 10, fontSize: 12, color: "var(--tx3)" }}>
                      <span title="Görüntülenme"><i className="fas fa-eye" /> {p.viewCount}</span>
                      <span title="Favori"><i className="fas fa-heart" /> {p.favoriteCount}</span>
                      <span title="Sepette"><i className="fas fa-cart-shopping" /> {p.cartCount}</span>
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
  );
}
