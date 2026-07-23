"use client";

import { useRef, useState } from "react";
import { ClientApiError, mutateJson, uploadFile } from "@/lib/client-api";
import type { CustomerRefund } from "@/lib/types";

const CARRIER_OPTIONS = ["Yurtiçi Kargo", "Aras Kargo", "MNG Kargo", "PTT Kargo", "Sürat Kargo", "UPS", "DHL", "FedEx", "Diğer"];

const STATUS_LABEL: Record<CustomerRefund["status"], string> = {
  pending: "İade talebiniz satıcı tarafından inceleniyor",
  approved: "İade onaylandı — ürünü kargolayıp takip kodunu aşağıya girin",
  rejected: "İade talebiniz reddedildi",
  item_received: "Ürün satıcıya ulaştı, para iadeniz işleme alınıyor",
  refunded: "Para iadeniz tamamlandı",
};

// bkz. kullanıcı isteği: "iade süreçlerinde ürün iade edildiğinde satıcıya
// müşteri sebepleri yazıyor fotoğrafları vs atıyor bu da yine müşteri
// panelinden olacak" - talep oluşturma, fotoğraf ekleme ve (onaylanınca)
// kargo takip kodu girme tek bileşende, sipariş kalemi teslim edilmişse
// gösterilir.
export default function RefundSection({ orderItemId, initialRefund }: { orderItemId: number; initialRefund: CustomerRefund | null }) {
  const [refund, setRefund] = useState<CustomerRefund | null>(initialRefund);
  const [showForm, setShowForm] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [carrier, setCarrier] = useState(CARRIER_OPTIONS[0]);
  const [customCarrier, setCustomCarrier] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function submitRequest() {
    if (reason.trim().length < 10) {
      setError("Lütfen iade sebebini biraz daha detaylandırın (en az 10 karakter)");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const created = await mutateJson<CustomerRefund>(`/orders/items/${orderItemId}/refund-request`, "POST", { reason: reason.trim() });
      setRefund(created);
      setShowForm(false);
    } catch (err) {
      setError(err instanceof ClientApiError ? err.message : "İade talebi oluşturulamadı");
    } finally {
      setLoading(false);
    }
  }

  async function uploadPhoto(file: File) {
    if (!refund) return;
    setUploadingPhoto(true);
    try {
      const updated = await uploadFile<CustomerRefund>(`/refunds/${refund.id}/photos`, file);
      setRefund(updated);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } finally {
      setUploadingPhoto(false);
    }
  }

  async function submitTracking() {
    if (!refund) return;
    const resolvedCarrier = carrier === "Diğer" ? customCarrier.trim() : carrier;
    if (!resolvedCarrier || !trackingNumber.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const updated = await mutateJson<CustomerRefund>(`/refunds/${refund.id}/return-tracking`, "POST", {
        carrier: resolvedCarrier,
        trackingNumber: trackingNumber.trim(),
      });
      setRefund(updated);
    } catch (err) {
      setError(err instanceof ClientApiError ? err.message : "Takip kodu kaydedilemedi");
    } finally {
      setLoading(false);
    }
  }

  if (!refund && !showForm) {
    return (
      <button className="btn btn-sec btn-sm" onClick={() => setShowForm(true)}>
        İade Talebi Oluştur
      </button>
    );
  }

  if (!refund && showForm) {
    return (
      <div style={{ maxWidth: 420 }}>
        {error && <p style={{ color: "var(--color-error)", fontSize: "0.85rem" }}>{error}</p>}
        <textarea
          className="ga-input"
          rows={3}
          placeholder="İade sebebinizi açıklayın (ör. beden uymadı, ürün hasarlı geldi)..."
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <button className="btn btn-primary btn-sm" disabled={loading} onClick={submitRequest}>
            {loading ? "Gönderiliyor..." : "Talebi Gönder"}
          </button>
          <button className="btn btn-sec btn-sm" onClick={() => setShowForm(false)}>
            Vazgeç
          </button>
        </div>
      </div>
    );
  }

  if (!refund) return null;

  return (
    <div style={{ maxWidth: 420, fontSize: "0.85rem" }}>
      <p>
        <strong>{STATUS_LABEL[refund.status]}</strong>
      </p>
      <p style={{ marginTop: 4, color: "var(--color-text-muted)" }}>Sebep: {refund.reason}</p>

      {refund.status === "pending" && (
        <div style={{ marginTop: 8 }}>
          {refund.photos.length > 0 && (
            <div style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
              {refund.photos.map((p) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={p} src={p} alt="" style={{ width: 56, height: 56, objectFit: "cover", borderRadius: 6 }} />
              ))}
            </div>
          )}
          {refund.photos.length < 6 && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                disabled={uploadingPhoto}
                onChange={(e) => e.target.files?.[0] && uploadPhoto(e.target.files[0])}
              />
              {uploadingPhoto && <span> Yükleniyor...</span>}
            </>
          )}
        </div>
      )}

      {refund.vendorNote && (
        <p style={{ marginTop: 8 }}>
          <strong>Satıcı notu:</strong> {refund.vendorNote}
        </p>
      )}

      {refund.status === "approved" && !refund.returnTrackingNumber && (
        <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
          {error && <p style={{ color: "var(--color-error)", width: "100%" }}>{error}</p>}
          <div>
            <label style={{ display: "block", fontSize: "0.75rem" }}>Kargo Firması</label>
            <select className="ga-input" value={carrier} onChange={(e) => setCarrier(e.target.value)}>
              {CARRIER_OPTIONS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          {carrier === "Diğer" && (
            <div>
              <label style={{ display: "block", fontSize: "0.75rem" }}>Firma Adı</label>
              <input className="ga-input" value={customCarrier} onChange={(e) => setCustomCarrier(e.target.value)} />
            </div>
          )}
          <div>
            <label style={{ display: "block", fontSize: "0.75rem" }}>Takip Numarası</label>
            <input className="ga-input" value={trackingNumber} onChange={(e) => setTrackingNumber(e.target.value)} />
          </div>
          <button
            className="btn btn-primary btn-sm"
            disabled={loading || !trackingNumber.trim() || (carrier === "Diğer" && !customCarrier.trim())}
            onClick={submitTracking}
          >
            {loading ? "Kaydediliyor..." : "Kargo Bilgisini Kaydet"}
          </button>
        </div>
      )}

      {refund.returnTrackingNumber && (
        <p style={{ marginTop: 8 }}>
          <strong>Kargo:</strong> {refund.returnTrackingCarrier} — {refund.returnTrackingNumber}
        </p>
      )}
    </div>
  );
}
