"use client";

import { useEffect, useState, type FormEvent } from "react";
import { fetchJson, mutateJson } from "@/lib/client-api";

interface ChannelListing {
  id: number;
  channel: "trendyol" | "ikas";
  variantId: number | null;
  externalBarcode: string;
  enabled: boolean;
  lastSyncedStock: number | null;
  lastSyncedAt: string | null;
  syncStatus: "pending" | "synced" | "error";
  syncError: string | null;
  productName: string;
}
interface IntegrationStatus {
  channels: { channel: "trendyol" | "ikas"; configured: boolean }[];
}
interface VendorProductLite {
  id: number;
  name: string;
}

const CHANNEL_LABEL: Record<string, string> = { trendyol: "Trendyol", ikas: "İkas" };
const SYNC = {
  pending: { label: "Bekliyor", bg: "#fff4e5", fg: "#9a5b00" },
  synced: { label: "Senkron", bg: "#e7f6ec", fg: "#1e7d43" },
  error: { label: "Hata", bg: "#fdeaea", fg: "#b3261e" },
} as const;

function pill(bg: string, fg: string, text: string) {
  return (
    <span style={{ background: bg, color: fg, fontSize: 12, fontWeight: 600, padding: "2px 10px", borderRadius: 999, whiteSpace: "nowrap" }}>{text}</span>
  );
}

export default function ChannelsPanel() {
  const [listings, setListings] = useState<ChannelListing[] | null>(null);
  const [status, setStatus] = useState<IntegrationStatus | null>(null);
  const [products, setProducts] = useState<VendorProductLite[]>([]);
  const [productId, setProductId] = useState<number | "">("");
  const [channel, setChannel] = useState<"trendyol" | "ikas">("trendyol");
  const [barcode, setBarcode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    const [l, s] = await Promise.all([
      fetchJson<ChannelListing[]>("/vendor/channel-listings"),
      fetchJson<IntegrationStatus>("/vendor/integrations/status"),
    ]);
    setListings(l);
    setStatus(s);
  }

  useEffect(() => {
    load().catch(() => setListings([]));
    fetchJson<VendorProductLite[]>("/vendor/products")
      .then((p) => setProducts(p.map((x) => ({ id: x.id, name: x.name }))))
      .catch(() => {});
  }, []);

  async function toggle(l: ChannelListing) {
    await mutateJson(`/vendor/channel-listings/${l.id}`, "PATCH", { enabled: !l.enabled });
    await load();
  }

  async function addListing(e: FormEvent) {
    e.preventDefault();
    if (!productId || !barcode.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await mutateJson("/vendor/channel-listings", "POST", { channel, productId: Number(productId), externalBarcode: barcode.trim() });
      setBarcode("");
      setProductId("");
      await load();
    } catch {
      setError("Eklenemedi — bu ürün bu kanalda zaten listeli ya da barkod kullanılıyor olabilir.");
    } finally {
      setSaving(false);
    }
  }

  const anyConfigured = status?.channels.some((c) => c.configured) ?? false;

  return (
    <div style={{ maxWidth: 900 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, margin: "0 0 4px" }}>Kanallar</h1>
      <p style={{ color: "var(--color-text-light, #666)", margin: "0 0 20px" }}>
        Ürünlerinizi Trendyol ve İkas gibi kanallara bağlayın; stok satıldıkça her iki tarafta da otomatik güncellenir.
      </p>

      {/* Bağlantı durumu */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
        {(status?.channels ?? []).map((c) => (
          <div key={c.channel} style={{ display: "flex", alignItems: "center", gap: 8, border: "1px solid #eee", borderRadius: 10, padding: "8px 14px" }}>
            <strong>{CHANNEL_LABEL[c.channel]}</strong>
            {c.configured ? pill(SYNC.synced.bg, SYNC.synced.fg, "Bağlı") : pill("#f1f1f1", "#888", "Bağlı değil")}
          </div>
        ))}
      </div>

      {!anyConfigured && (
        <div style={{ background: "#fff9ec", border: "1px solid #f2e2bf", borderRadius: 10, padding: "12px 16px", marginBottom: 20, fontSize: 14, color: "#7a5b12" }}>
          <i className="fas fa-info-circle" /> Kanal API anahtarları henüz bağlı değil. Ürün-kanal eşlemelerinizi şimdiden ekleyebilirsiniz; anahtarlar
          bağlandığında stok senkronu otomatik başlar.
        </div>
      )}

      {/* Listing tablosu */}
      {listings === null ? (
        <p style={{ color: "#999" }}>Yükleniyor…</p>
      ) : listings.length === 0 ? (
        <p style={{ color: "#999", padding: "16px 0" }}>Henüz kanal eşlemesi yok. Aşağıdan ekleyebilirsiniz.</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ textAlign: "left", color: "#888", fontSize: 12 }}>
                <th style={{ padding: "8px 10px", borderBottom: "1px solid #eee" }}>Ürün</th>
                <th style={{ padding: "8px 10px", borderBottom: "1px solid #eee" }}>Kanal</th>
                <th style={{ padding: "8px 10px", borderBottom: "1px solid #eee" }}>Barkod</th>
                <th style={{ padding: "8px 10px", borderBottom: "1px solid #eee" }}>Durum</th>
                <th style={{ padding: "8px 10px", borderBottom: "1px solid #eee" }}>Son Senkron</th>
                <th style={{ padding: "8px 10px", borderBottom: "1px solid #eee" }}></th>
              </tr>
            </thead>
            <tbody>
              {listings.map((l) => (
                <tr key={l.id} style={{ opacity: l.enabled ? 1 : 0.5 }}>
                  <td style={{ padding: "10px", borderBottom: "1px solid #f3f3f3" }}>{l.productName}</td>
                  <td style={{ padding: "10px", borderBottom: "1px solid #f3f3f3" }}>{CHANNEL_LABEL[l.channel]}</td>
                  <td style={{ padding: "10px", borderBottom: "1px solid #f3f3f3", fontFamily: "monospace", fontSize: 13 }}>{l.externalBarcode}</td>
                  <td style={{ padding: "10px", borderBottom: "1px solid #f3f3f3" }}>
                    {pill(SYNC[l.syncStatus].bg, SYNC[l.syncStatus].fg, SYNC[l.syncStatus].label)}
                  </td>
                  <td style={{ padding: "10px", borderBottom: "1px solid #f3f3f3", color: "#888" }}>
                    {l.lastSyncedAt ? new Date(l.lastSyncedAt).toLocaleDateString("tr-TR") : "—"}
                  </td>
                  <td style={{ padding: "10px", borderBottom: "1px solid #f3f3f3", textAlign: "right" }}>
                    <button
                      type="button"
                      onClick={() => toggle(l)}
                      style={{ fontSize: 12, padding: "4px 10px", borderRadius: 6, border: "1px solid #ddd", background: "transparent", cursor: "pointer" }}
                    >
                      {l.enabled ? "Durdur" : "Etkinleştir"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Ekleme formu */}
      <form onSubmit={addListing} style={{ marginTop: 24, borderTop: "1px solid #eee", paddingTop: 20 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 12px" }}>Ürün-kanal eşlemesi ekle</h2>
        {error && <p style={{ color: "#b3261e", fontSize: 13, margin: "0 0 10px" }}>{error}</p>}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13, flex: "1 1 220px" }}>
            Ürün
            <select value={productId} onChange={(e) => setProductId(e.target.value ? Number(e.target.value) : "")} required
              style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #ddd" }}>
              <option value="">Seçin…</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13, flex: "0 1 140px" }}>
            Kanal
            <select value={channel} onChange={(e) => setChannel(e.target.value as "trendyol" | "ikas")}
              style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #ddd" }}>
              <option value="trendyol">Trendyol</option>
              <option value="ikas">İkas</option>
            </select>
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13, flex: "1 1 180px" }}>
            Barkod / SKU
            <input value={barcode} onChange={(e) => setBarcode(e.target.value)} placeholder="Kanaldaki barkod" required
              style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #ddd" }} />
          </label>
          <button type="submit" disabled={saving || !productId || !barcode.trim()}
            style={{ padding: "9px 18px", borderRadius: 8, border: "none", background: "var(--color-primary, #8a1c4d)", color: "#fff", fontWeight: 600, cursor: "pointer", opacity: saving ? 0.6 : 1 }}>
            {saving ? "Ekleniyor…" : "Ekle"}
          </button>
        </div>
      </form>
    </div>
  );
}
