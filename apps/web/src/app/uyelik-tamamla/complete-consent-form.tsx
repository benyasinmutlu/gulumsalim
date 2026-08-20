"use client";

import { useState, type FormEvent } from "react";
import { ClientApiError, mutateJson } from "@/lib/client-api";
import type { CustomerProfile } from "@/lib/types";
import ConsentModal from "@/components/consent-modal";
import ConsentDocumentCard from "@/components/consent-document-card";

export default function CompleteConsentForm() {
  const [phone, setPhone] = useState("");
  const [membershipConsent, setMembershipConsent] = useState(false);
  const [marketingConsent, setMarketingConsent] = useState(false);
  const [analyticsConsent, setAnalyticsConsent] = useState(false);
  const [membershipModalOpen, setMembershipModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!membershipConsent) {
      setError("Devam etmek için Üyelik Sözleşmesini ve KVKK Aydınlatma Metnini kabul etmelisiniz");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await mutateJson<CustomerProfile>("/auth/complete-consent", "POST", {
        phone: phone || undefined,
        membershipConsent,
        marketingConsent,
        analyticsConsent,
      });
      window.location.href = "/";
    } catch (err) {
      setError(err instanceof ClientApiError ? err.message : "Bir şeyler ters gitti");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      {error && (
        <div className="ga-alert">
          <i className="fas fa-exclamation-circle" /> {error}
        </div>
      )}

      <div className="ga-fg">
        <label>Telefon Numarası</label>
        <div className="ga-input-wrap">
          <i className="fas fa-phone ga-ic" />
          <input className="ga-input" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
      </div>

      <div style={{ margin: "18px 0 14px" }}>
        <ConsentDocumentCard
          label="Üyelik Sözleşmesi ve KVKK Aydınlatma Metni"
          accepted={membershipConsent}
          onOpen={() => setMembershipModalOpen(true)}
        />
      </div>
      <ConsentModal
        open={membershipModalOpen}
        onClose={() => setMembershipModalOpen(false)}
        onAccept={() => setMembershipConsent(true)}
        title="Üyelik Sözleşmesi ve KVKK Aydınlatma Metni"
        slugs={["alici-uyelik-sozlesmesi", "kvkk"]}
      />

      <label className="ga-consent">
        <input type="checkbox" checked={marketingConsent} onChange={(e) => setMarketingConsent(e.target.checked)} />
        <a href="/ticari-elektronik-ileti-onayi" target="_blank" rel="noopener noreferrer">Ticari Elektronik İleti Onayı&apos;nı</a> okudum, kampanya/fırsat bildirimlerini (SMS/e-posta) almak istiyorum.
      </label>

      <label className="ga-consent">
        <input type="checkbox" checked={analyticsConsent} onChange={(e) => setAnalyticsConsent(e.target.checked)} />
        <a href="/acik-riza-metni" target="_blank" rel="noopener noreferrer">Açık Rıza Metni&apos;ni</a> okudum, kişiselleştirilmiş ürün önerileri gösterilmesini istiyorum.
      </label>

      <button className="ga-submit" type="submit" disabled={loading}>
        {loading ? "Kaydediliyor..." : "Devam Et"}
      </button>
    </form>
  );
}
