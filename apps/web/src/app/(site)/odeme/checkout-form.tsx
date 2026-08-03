"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { ClientApiError, mutateJson } from "@/lib/client-api";
import type { CustomerAddress } from "@/lib/types";
import Modal from "@/components/modal";

interface CheckoutResult {
  orderNumber: string;
  checkoutFormContent: string;
}

interface SelectedLine {
  productId: number;
  variantId?: number;
}

// bkz. kullanıcı isteği: "adresi kayıtlı ise teslimat bilgileri kısmı
// direkt dolu olarak gelsin" - form yine tamamen düzenlenebilir kalır,
// sadece varsayılan değerler kayıtlı adresten gelir.
export default function CheckoutForm({
  isGuest,
  defaultAddress,
  selectedLines,
}: {
  isGuest: boolean;
  defaultAddress?: CustomerAddress | null;
  // bkz. sepet/page.tsx checkbox seçimi - verilirse sadece bu kalemler
  // ödenir, sepetteki diğer kalemler dokunulmadan kalır (bkz.
  // checkout.routes.ts filterCartBySelection).
  selectedLines?: SelectedLine[];
}) {
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState(defaultAddress?.fullName ?? "");
  const [phone, setPhone] = useState(defaultAddress?.phone ?? "");
  const [city, setCity] = useState(defaultAddress?.city ?? "");
  const [district, setDistrict] = useState(defaultAddress?.district ?? "");
  const [addressLine, setAddressLine] = useState(defaultAddress?.addressLine ?? "");
  const [zipCode, setZipCode] = useState(defaultAddress?.zipCode ?? "");
  const [orderNote, setOrderNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CheckoutResult | null>(null);
  const formContainerRef = useRef<HTMLDivElement>(null);

  // Ödeme öncesi Mesafeli Satış Sözleşmesi + Ön Bilgilendirme Formu'nun
  // GERÇEK sipariş bilgileriyle doldurulmuş önizlemesi (bkz. contract-
  // template.ts, POST /checkout/contract-preview). Onay kutusu, önizleme en
  // az bir kez açılıp gösterilmeden aktif olmaz - müşteri gerçekten görmeden
  // tikleyemez.
  const [contractHtml, setContractHtml] = useState<string | null>(null);
  const [contractModalOpen, setContractModalOpen] = useState(false);
  const [contractLoading, setContractLoading] = useState(false);
  const [contractError, setContractError] = useState<string | null>(null);
  const [contractAccepted, setContractAccepted] = useState(false);

  async function handlePreviewContract() {
    setContractLoading(true);
    setContractError(null);
    try {
      const data = await mutateJson<{ html: string }>("/checkout/contract-preview", "POST", {
        shippingAddress: { fullName, phone, city, district, addressLine, zipCode: zipCode || undefined },
        email: isGuest ? email : undefined,
        selectedLines,
      });
      setContractHtml(data.html);
      setContractModalOpen(true);
    } catch (err) {
      setContractError(err instanceof ClientApiError ? err.message : "Sözleşme önizlemesi alınamadı");
    } finally {
      setContractLoading(false);
    }
  }

  // iyzico'nun checkoutFormContent'i bir <script src="..."> etiketi
  // içeriyor ve o script çalışınca ödeme iframe'ini DOM'a kendisi yazıyor.
  // dangerouslySetInnerHTML (yani .innerHTML ataması) tarayıcı standardı
  // gereği <script> etiketlerini asla çalıştırmaz - bu yüzden script'i elle
  // yeniden oluşturup DOM'a eklemek gerekiyor, aksi halde ödeme formu hiç
  // görünmüyordu.
  useEffect(() => {
    if (!result || !formContainerRef.current) return;
    const container = formContainerRef.current;
    container.innerHTML = result.checkoutFormContent;
    Array.from(container.querySelectorAll("script")).forEach((oldScript) => {
      const newScript = document.createElement("script");
      Array.from(oldScript.attributes).forEach((attr) => newScript.setAttribute(attr.name, attr.value));
      newScript.textContent = oldScript.textContent;
      oldScript.replaceWith(newScript);
    });
  }, [result]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const data = await mutateJson<CheckoutResult>("/checkout", "POST", {
        shippingAddress: { fullName, phone, city, district, addressLine, zipCode: zipCode || undefined },
        email: isGuest ? email : undefined,
        orderNote: orderNote || undefined,
        contractAccepted,
        selectedLines,
      });
      setResult(data);
    } catch (err) {
      setError(err instanceof ClientApiError ? err.message : "Ödeme başlatılamadı");
    } finally {
      setLoading(false);
    }
  }

  if (result) {
    return (
      <div className="form-card">
        <p style={{ marginBottom: "1rem" }}>
          Sipariş No: <strong>{result.orderNumber}</strong> — ödemeyi tamamlamak için aşağıdaki formu kullanın.
        </p>
        <div ref={formContainerRef} />
      </div>
    );
  }

  return (
    <form className="form-card" onSubmit={handleSubmit}>
      <h3>Teslimat Adresi</h3>
      {isGuest && (
        <div className="form-group">
          <label>E-posta</label>
          <input
            className="form-control"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Sipariş takibi için gerekli"
          />
        </div>
      )}
      <div className="form-group">
        <label>Ad Soyad</label>
        <input className="form-control" required value={fullName} onChange={(e) => setFullName(e.target.value)} />
      </div>
      <div className="form-group">
        <label>Telefon</label>
        <input
          className="form-control"
          required
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="05XXXXXXXXX"
        />
      </div>
      <div className="form-row">
        <div className="form-group">
          <label>Şehir</label>
          <input className="form-control" required value={city} onChange={(e) => setCity(e.target.value)} />
        </div>
        <div className="form-group">
          <label>İlçe</label>
          <input className="form-control" required value={district} onChange={(e) => setDistrict(e.target.value)} />
        </div>
      </div>
      <div className="form-row">
        <div className="form-group">
          <label>Açık Adres</label>
          <textarea
            className="form-control"
            required
            value={addressLine}
            onChange={(e) => setAddressLine(e.target.value)}
          />
        </div>
        <div className="form-group">
          <label>Posta Kodu</label>
          <input className="form-control" value={zipCode} onChange={(e) => setZipCode(e.target.value)} placeholder="Opsiyonel" />
        </div>
      </div>
      <div className="form-group">
        <label>Sipariş Notu</label>
        <textarea
          className="form-control"
          value={orderNote}
          onChange={(e) => setOrderNote(e.target.value)}
          placeholder="Kargo/teslimat ile ilgili notunuz (opsiyonel)"
        />
      </div>
      <div className="form-group">
        <button type="button" className="btn btn-secondary" onClick={handlePreviewContract} disabled={contractLoading}>
          {contractLoading ? "Hazırlanıyor..." : "Mesafeli Satış Sözleşmesi'ni Görüntüle"}
        </button>
        {contractError && <p className="error-text">{contractError}</p>}
      </div>

      <label className="ga-consent">
        <input
          type="checkbox"
          required
          disabled={!contractHtml}
          checked={contractAccepted}
          onChange={(e) => setContractAccepted(e.target.checked)}
        />
        Mesafeli Satış Sözleşmesi'ni ve Ön Bilgilendirme Formu'nu (yukarıdaki "Görüntüle" ile) okudum, onaylıyorum.
      </label>

      {error && <p className="error-text">{error}</p>}
      <button className="btn btn-primary btn-block" type="submit" disabled={loading || !contractAccepted}>
        {loading ? "Yönlendiriliyor..." : "Ödemeye Geç"}
      </button>

      <Modal open={contractModalOpen} onClose={() => setContractModalOpen(false)} title="Mesafeli Satış Sözleşmesi">
        {contractHtml && <div dangerouslySetInnerHTML={{ __html: contractHtml }} />}
      </Modal>
    </form>
  );
}
