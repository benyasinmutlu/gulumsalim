"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ClientApiError, mutateJson } from "@/lib/client-api";
import type { VendorProfile } from "@/lib/types";
import ConsentModal from "@/components/consent-modal";
import ConsentDocumentCard from "@/components/consent-document-card";

const VENDOR_CONSENT_SLUGS = ["satici-uyelik-sozlesmesi", "satici-komisyon-politikasi", "yasakli-urunler-politikasi", "kvkk"];

// bkz. kullanıcı isteği: "bireysel olarak müşteri olarak kayıt olan
// kişilerde satış yapabilsin 2. el ürün letgo dolap gibi" - admin onayı
// beklemeden, ayrı bir satıcı girişi yapmadan bireysel satıcı hesabı açılır
// ve doğrudan ürün ekleme sayfasına yönlendirilir. Mesafeli Satış
// Sözleşmesi'nin satıcı bloğu için Vergi No/TCKN + adres ve satıcı
// belgelerinin onayı zorunlu olduğundan (bkz. vendor-auth.schemas.ts
// becomeIndividualSellerSchema) artık tek tık değil, küçük bir form var.
export default function BecomeSellerButton() {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [storeName, setStoreName] = useState("");
  const [taxId, setTaxId] = useState("");
  const [legalAddress, setLegalAddress] = useState("");
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [consentModalOpen, setConsentModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!consentAccepted) {
      setError("Devam etmek için satıcı belgelerini kabul etmelisiniz");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await mutateJson<VendorProfile>("/my/become-individual-seller", "POST", { storeName, taxId, legalAddress, consentAccepted });
      router.push("/satici/panel/urunler/yeni");
    } catch (err) {
      setError(err instanceof ClientApiError ? err.message : "Bir şeyler ters gitti, tekrar deneyin");
      setLoading(false);
    }
  }

  if (!expanded) {
    return (
      <button type="button" className="btn btn-primary btn-lg" onClick={() => setExpanded(true)}>
        Hemen Satışa Başla
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="become-seller-form">
      <div className="form-group">
        <label htmlFor="individual-store-name">Satışta Görünecek Ad (Kullanıcı Adı)</label>
        <input
          id="individual-store-name"
          className="form-control"
          required
          minLength={2}
          maxLength={120}
          autoComplete="nickname"
          placeholder="Örn. Ayşe'nin Dolabı"
          value={storeName}
          onChange={(e) => setStoreName(e.target.value)}
        />
        <small className="form-text">Ürünlerde ve mağaza sayfanda bu ad görünür. Gerçek adın yalnızca ödeme ve yasal belgelerde kullanılır.</small>
      </div>
      <div className="form-group">
        <label>Vergi No / TCKN</label>
        <input className="form-control" required value={taxId} onChange={(e) => setTaxId(e.target.value)} />
      </div>
      <div className="form-group">
        <label>Adres</label>
        <input className="form-control" required value={legalAddress} onChange={(e) => setLegalAddress(e.target.value)} />
      </div>
      <ConsentDocumentCard
        label="Satıcı Sözleşmesi, Komisyon Politikası, Yasaklı Ürünler Politikası ve KVKK"
        accepted={consentAccepted}
        onOpen={() => setConsentModalOpen(true)}
      />
      <ConsentModal
        open={consentModalOpen}
        onClose={() => setConsentModalOpen(false)}
        onAccept={() => setConsentAccepted(true)}
        title="Satıcı Belgeleri"
        slugs={VENDOR_CONSENT_SLUGS}
      />
      {error && <p className="error-text">{error}</p>}
      <button type="submit" className="btn btn-primary btn-lg" disabled={loading}>
        {loading ? "Hazırlanıyor..." : "Onayla ve Başla"}
      </button>
    </form>
  );
}
