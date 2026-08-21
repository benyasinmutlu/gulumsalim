"use client";

import { useEffect, useState, type FormEvent } from "react";
import { ClientApiError, fetchJson, mutateJson } from "@/lib/client-api";

type SalesChannel = "trendyol" | "ikas" | "ticimax";

interface ChannelListing {
  id: number;
  channel: SalesChannel;
  variantId: number | null;
  externalBarcode: string;
  externalProductId: string | null;
  enabled: boolean;
  lastSyncedStock: number | null;
  lastSyncedAt: string | null;
  syncStatus: "pending" | "synced" | "error";
  syncError: string | null;
  productName: string;
}
interface ChannelStatus {
  channel: SalesChannel;
  connected: boolean;
  status: string;
  lastError: string | null;
  lastCheckedAt: string | null;
}
interface IntegrationStatus {
  channels: ChannelStatus[];
}

// Kanal başına istenen API kimlik alanları (satıcı kendi hesabından girer).
const CRED_FIELDS: Record<SalesChannel, { name: string; label: string; placeholder?: string }[]> = {
  trendyol: [
    { name: "supplierId", label: "Supplier ID (Satıcı ID)" },
    { name: "apiKey", label: "API Key" },
    { name: "apiSecret", label: "API Secret" },
  ],
  ikas: [
    { name: "clientId", label: "Client ID" },
    { name: "clientSecret", label: "Client Secret" },
    { name: "storeName", label: "Mağaza adı", placeholder: "magaza (magaza.myikas.com)" },
  ],
  ticimax: [
    { name: "siteUrl", label: "Ticimax mağaza adresi", placeholder: "https://magazaniz.com" },
    { name: "memberCode", label: "Web servis üye kodu" },
  ],
};
interface VendorProductLite {
  id: number;
  name: string;
}

const CHANNEL_LABEL: Record<SalesChannel, string> = { trendyol: "Trendyol", ikas: "İkas", ticimax: "Ticimax" };
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
  const [channel, setChannel] = useState<SalesChannel>("trendyol");
  const [barcode, setBarcode] = useState("");
  const [externalProductId, setExternalProductId] = useState("");
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

  // --- Kanal bağlantısı (per-vendor API anahtarı) ---
  const [creds, setCreds] = useState<Record<SalesChannel, Record<string, string>>>({ trendyol: {}, ikas: {}, ticimax: {} });
  const [busyCh, setBusyCh] = useState<string | null>(null);
  const [chError, setChError] = useState<Record<string, string | null>>({});

  async function connectChannel(ch: SalesChannel) {
    setBusyCh(ch);
    setChError((e) => ({ ...e, [ch]: null }));
    try {
      await mutateJson(`/vendor/integrations/${ch}/connect`, "POST", creds[ch]);
      setCreds((c) => ({ ...c, [ch]: {} }));
      await load();
    } catch (err) {
      setChError((e) => ({ ...e, [ch]: err instanceof Error ? err.message : "Bağlantı doğrulanamadı." }));
    } finally {
      setBusyCh(null);
    }
  }
  async function disconnectChannel(ch: SalesChannel) {
    setBusyCh(ch);
    try {
      await mutateJson(`/vendor/integrations/${ch}/disconnect`, "POST", {});
      await load();
    } finally {
      setBusyCh(null);
    }
  }
  async function testChannel(ch: SalesChannel) {
    setBusyCh(ch);
    setChError((e) => ({ ...e, [ch]: null }));
    try {
      await mutateJson(`/vendor/integrations/${ch}/test`, "POST", {});
      await load();
    } catch (err) {
      setChError((e) => ({ ...e, [ch]: err instanceof Error ? err.message : "Bağlantı testi başarısız." }));
    } finally {
      setBusyCh(null);
    }
  }

  async function addListing(e: FormEvent) {
    e.preventDefault();
    if (!productId || !barcode.trim() || (channel === "ticimax" && !externalProductId.trim())) return;
    setSaving(true);
    setError(null);
    try {
      await mutateJson("/vendor/channel-listings", "POST", {
        channel,
        productId: Number(productId),
        externalBarcode: barcode.trim(),
        ...(channel === "ticimax" ? { externalProductId: externalProductId.trim() } : {}),
      });
      setBarcode("");
      setExternalProductId("");
      setProductId("");
      await load();
    } catch (err) {
      setError(err instanceof ClientApiError ? err.message : "Eşleme eklenemedi.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ maxWidth: 900 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, margin: "0 0 4px" }}>Kanallar</h1>
      <p style={{ color: "var(--color-text-light, #666)", margin: "0 0 20px" }}>
        Trendyol, İkas ve Ticimax hesabınızı bağlayın; merkez stok değiştikçe bağlı kanallar otomatik güncellenir. API bilgileriniz şifreli saklanır.
      </p>

      {/* Kanal bağlantısı — her satıcı kendi API anahtarını girer */}
      <div style={{ display: "grid", gap: 12, marginBottom: 24 }}>
        {(["trendyol", "ikas", "ticimax"] as const).map((ch) => {
          const st = status?.channels.find((c) => c.channel === ch);
          const connected = st?.connected ?? false;
          const filled = CRED_FIELDS[ch].every((f) => (creds[ch][f.name] ?? "").trim().length > 0);
          return (
            <div key={ch} style={{ border: "1px solid #eee", borderRadius: 12, padding: "14px 16px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                <strong style={{ fontSize: 15 }}>{CHANNEL_LABEL[ch]}</strong>
                {connected ? pill(SYNC.synced.bg, SYNC.synced.fg, "Bağlı") : pill("#f1f1f1", "#888", "Bağlı değil")}
              </div>

              {connected ? (
                <div style={{ display: "flex", gap: 8, marginTop: 12, alignItems: "center", flexWrap: "wrap" }}>
                  <button type="button" onClick={() => testChannel(ch)} disabled={busyCh === ch}
                    style={{ fontSize: 13, padding: "7px 14px", borderRadius: 8, border: "1px solid #ddd", background: "transparent", cursor: "pointer" }}>
                    {busyCh === ch ? "…" : "Bağlantıyı Test Et"}
                  </button>
                  <button type="button" onClick={() => disconnectChannel(ch)} disabled={busyCh === ch}
                    style={{ fontSize: 13, padding: "7px 14px", borderRadius: 8, border: "1px solid #f0c6c6", background: "transparent", color: "#b3261e", cursor: "pointer" }}>
                    Bağlantıyı Kaldır
                  </button>
                  {st?.status === "error" && st?.lastError && <span style={{ color: "#b3261e", fontSize: 12.5 }}>{st.lastError}</span>}
                </div>
              ) : (
                <div style={{ marginTop: 12 }}>
                  <p style={{ fontSize: 12.5, color: "#888", margin: "0 0 8px" }}>
                    Kendi {CHANNEL_LABEL[ch]} hesabınızın API bilgilerini girin.
                  </p>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 8 }}>
                    {CRED_FIELDS[ch].map((f) => (
                      <input
                        key={f.name}
                        value={creds[ch][f.name] ?? ""}
                        placeholder={f.placeholder ?? f.label}
                        onChange={(e) => setCreds((c) => ({ ...c, [ch]: { ...c[ch], [f.name]: e.target.value } }))}
                        style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #ddd", fontSize: 13 }}
                      />
                    ))}
                  </div>
                  {chError[ch] && <p style={{ color: "#b3261e", fontSize: 12.5, margin: "8px 0 0" }}>{chError[ch]}</p>}
                  <button type="button" onClick={() => connectChannel(ch)} disabled={busyCh === ch || !filled}
                    style={{ marginTop: 10, padding: "9px 18px", borderRadius: 8, border: "none", background: "var(--color-primary, #8a1c4d)", color: "#fff", fontWeight: 600, cursor: filled ? "pointer" : "default", opacity: busyCh === ch || !filled ? 0.6 : 1 }}>
                    {busyCh === ch ? "Bağlanıyor…" : "Bağlan"}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

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
                <th style={{ padding: "8px 10px", borderBottom: "1px solid #eee" }}>Barkod / Kanal ID</th>
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
                  <td style={{ padding: "10px", borderBottom: "1px solid #f3f3f3", fontFamily: "monospace", fontSize: 13 }}>
                    {l.externalBarcode}{l.externalProductId ? <><br /><span style={{ color: "#888" }}>ID: {l.externalProductId}</span></> : null}
                  </td>
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
            <select value={channel} onChange={(e) => { setChannel(e.target.value as SalesChannel); setBarcode(""); setExternalProductId(""); }}
              style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #ddd" }}>
              <option value="trendyol">Trendyol</option>
              <option value="ikas">İkas</option>
              <option value="ticimax">Ticimax</option>
            </select>
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13, flex: "1 1 180px" }}>
            Barkod / SKU
            <input value={barcode} onChange={(e) => setBarcode(e.target.value)} placeholder="Kanaldaki barkod" required
              style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #ddd" }} />
          </label>
          {channel === "ticimax" && (
            <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13, flex: "1 1 180px" }}>
              Ticimax Varyasyon ID
              <input value={externalProductId} onChange={(e) => setExternalProductId(e.target.value)} placeholder="Örn. 123456" required inputMode="numeric"
                style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #ddd" }} />
            </label>
          )}
          <button type="submit" disabled={saving || !productId || !barcode.trim() || (channel === "ticimax" && !externalProductId.trim())}
            style={{ padding: "9px 18px", borderRadius: 8, border: "none", background: "var(--color-primary, #8a1c4d)", color: "#fff", fontWeight: 600, cursor: "pointer", opacity: saving ? 0.6 : 1 }}>
            {saving ? "Ekleniyor…" : "Ekle"}
          </button>
        </div>
      </form>
    </div>
  );
}
