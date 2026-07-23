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
                    <span className={`st st-${STATUS_CLASS[p.status]}`}>{STATUS_LABEL[p.status]}</span>
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
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
