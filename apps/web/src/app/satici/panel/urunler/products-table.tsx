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

  if (products === null) return <p style={{ marginTop: "1rem" }}>Yükleniyor...</p>;

  return (
    <div>
      <p style={{ marginTop: "1.5rem" }}>
        <Link href="/satici/panel/urunler/yeni" className="btn">
          Yeni Ürün Ekle
        </Link>
      </p>

      {products.length === 0 ? (
        <p className="empty-state">Henüz ürün eklemediniz.</p>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Ürün</th>
              <th>Fiyat</th>
              <th>Durum</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id}>
                <td>
                  <Link href={`/satici/panel/urunler/${p.id}`}>{p.name}</Link>
                </td>
                <td>{Number(p.basePrice).toLocaleString("tr-TR", { minimumFractionDigits: 2 })} ₺</td>
                <td>
                  <span className="badge">{STATUS_LABEL[p.status]}</span>
                </td>
                <td style={{ textAlign: "right" }}>
                  <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
                    {p.status !== "rejected" && (
                      <button
                        className="btn btn-secondary"
                        disabled={busyId === p.id}
                        onClick={() => toggleStatus(p)}
                        style={{ fontSize: "0.8rem" }}
                      >
                        {p.status === "active" ? "Pasife Al" : "Aktif Et"}
                      </button>
                    )}
                    <button
                      className="btn btn-secondary"
                      disabled={busyId === p.id}
                      onClick={() => removeProduct(p)}
                      style={{ fontSize: "0.8rem" }}
                    >
                      Sil
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
