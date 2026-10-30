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
  refunding: "Para iadeniz ödeme kuruluşunda kontrol ediliyor",
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
      <div className="refund-box">
        {error && <p className="refund-error">{error}</p>}
        <textarea
          className="ga-input"
          rows={3}
          placeholder="İade sebebinizi açıklayın (ör. beden uymadı, ürün hasarlı geldi)..."
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
        <div className="refund-actions">
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
    <div className="refund-box refund-box-sm">
      <p>
        <strong>{STATUS_LABEL[refund.status]}</strong>
      </p>
      <p className="refund-reason">Sebep: {refund.reason}</p>

      {refund.status === "pending" && (
        <div className="refund-mt">
          {refund.photos.length > 0 && (
            <div className="refund-photos">
              {refund.photos.map((p) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={p} src={p} alt="" className="refund-photo-thumb" />
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
        <p className="refund-mt">
          <strong>Satıcı notu:</strong> {refund.vendorNote}
        </p>
      )}

      {refund.status === "approved" && !refund.returnTrackingNumber && (
        <div className="refund-tracking-row">
          {error && <p className="refund-error refund-error-full">{error}</p>}
          <div className="refund-field">
            <label>Kargo Firması</label>
            <select className="ga-input" value={carrier} onChange={(e) => setCarrier(e.target.value)}>
              {CARRIER_OPTIONS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          {carrier === "Diğer" && (
            <div className="refund-field">
              <label>Firma Adı</label>
              <input className="ga-input" value={customCarrier} onChange={(e) => setCustomCarrier(e.target.value)} />
            </div>
          )}
          <div className="refund-field">
            <label>Takip Numarası</label>
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
        <p className="refund-mt">
          <strong>Kargo:</strong> {refund.returnTrackingCarrier} — {refund.returnTrackingNumber}
        </p>
      )}
    </div>
  );
}
