"use client";

import { useState, type FormEvent } from "react";
import { ClientApiError, mutateJson } from "@/lib/client-api";
import ConsentModal from "@/components/consent-modal";
import ConsentDocumentCard from "@/components/consent-document-card";

const VENDOR_CONSENT_SLUGS = ["satici-uyelik-sozlesmesi", "satici-komisyon-politikasi", "yasakli-urunler-politikasi", "kvkk"];

function slugify(value: string) {
  return value
    .toLocaleLowerCase("tr-TR")
    .replace(/ç/g, "c")
    .replace(/ğ/g, "g")
    .replace(/ı/g, "i")
    .replace(/ö/g, "o")
    .replace(/ş/g, "s")
    .replace(/ü/g, "u")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export default function VendorRegisterForm() {
  const [storeName, setStoreName] = useState("");
  const [storeSlug, setStoreSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [taxId, setTaxId] = useState("");
  const [legalAddress, setLegalAddress] = useState("");
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [consentModalOpen, setConsentModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  function handleStoreNameChange(value: string) {
    setStoreName(value);
    if (!slugTouched) setStoreSlug(slugify(value));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (password !== passwordConfirm) {
      setError("Şifreler eşleşmiyor");
      return;
    }
    if (!consentAccepted) {
      setError("Devam etmek için satıcı belgelerini kabul etmelisiniz");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await mutateJson<{ email: string; verificationRequired: boolean }>("/vendor/auth/register", "POST", {
        storeName,
        storeSlug,
        fullName,
        phone: phone || undefined,
        email,
        password,
        taxId,
        legalAddress,
        consentAccepted,
      });
      // bkz. kullanıcı isteği: e-posta doğrulaması zorunlu - kayıt artık
      // otomatik giriş yapmıyor.
      setSent(true);
    } catch (err) {
      setError(err instanceof ClientApiError ? err.message : "Kayıt başarısız oldu");
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div className="ga-alert" style={{ background: "var(--color-success-bg)", color: "var(--color-success)" }}>
        <i className="fas fa-envelope-circle-check" /> <strong>{email}</strong> adresine bir doğrulama bağlantısı gönderdik. Satıcı
        panelinize giriş yapabilmek için gelen kutunuzdaki (ve spam klasörünüzdeki) bağlantıya tıklayın. Ayrıca başvurunuz admin onayı
        bekliyor olacak.
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      {error && (
        <div className="ga-alert">
          <i className="fas fa-exclamation-circle" /> {error}
        </div>
      )}

      <div className="ga-fg">
        <label>
          Mağaza Adı <span className="req">*</span>
        </label>
        <div className="ga-input-wrap">
          <input className="ga-input" required value={storeName} onChange={(e) => handleStoreNameChange(e.target.value)} />
        </div>
      </div>
      <div className="ga-fg">
        <label>
          Mağaza Adresi (/{storeSlug || "magaza-adiniz"}) <span className="req">*</span>
        </label>
        <div className="ga-input-wrap">
          <input
            className="ga-input"
            required
            value={storeSlug}
            onChange={(e) => {
              setSlugTouched(true);
              setStoreSlug(slugify(e.target.value));
            }}
          />
        </div>
      </div>

      <div className="ga-section-title">Kişisel Bilgiler</div>
      <div className="ga-row2">
        <div className="ga-fg">
          <label>
            Ad Soyad <span className="req">*</span>
          </label>
          <div className="ga-input-wrap">
            <input className="ga-input" required value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
        </div>
        <div className="ga-fg">
          <label>Telefon</label>
          <div className="ga-input-wrap">
            <input className="ga-input" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
        </div>
      </div>

      <div className="ga-section-title">Hesap Güvenliği</div>
      <div className="ga-fg">
        <label>
          E-posta Adresi <span className="req">*</span>
        </label>
        <div className="ga-input-wrap">
          <i className="fas fa-envelope ga-ic" />
          <input className="ga-input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
      </div>
      <div className="ga-row2">
        <div className="ga-fg">
          <label>
            Şifre <span className="req">*</span>
          </label>
          <div className="ga-input-wrap">
            <input
              className="ga-input"
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
        </div>
        <div className="ga-fg">
          <label>
            Şifre Tekrar <span className="req">*</span>
          </label>
          <div className="ga-input-wrap">
            <input
              className="ga-input"
              type="password"
              required
              value={passwordConfirm}
              onChange={(e) => setPasswordConfirm(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="ga-section-title">Yasal Bilgiler</div>
      <div className="ga-fg">
        <label>
          Vergi No / MERSİS No / TCKN <span className="req">*</span>
        </label>
        <div className="ga-input-wrap">
          <input className="ga-input" required value={taxId} onChange={(e) => setTaxId(e.target.value)} />
        </div>
      </div>
      <div className="ga-fg">
        <label>
          Adres <span className="req">*</span>
        </label>
        <div className="ga-input-wrap">
          <input className="ga-input" required value={legalAddress} onChange={(e) => setLegalAddress(e.target.value)} />
        </div>
      </div>

      <div style={{ margin: "18px 0 14px" }}>
        <ConsentDocumentCard
          label="Satıcı Sözleşmesi, Komisyon Politikası, Yasaklı Ürünler Politikası ve KVKK"
          accepted={consentAccepted}
          onOpen={() => setConsentModalOpen(true)}
        />
      </div>
      <ConsentModal
        open={consentModalOpen}
        onClose={() => setConsentModalOpen(false)}
        onAccept={() => setConsentAccepted(true)}
        title="Satıcı Belgeleri"
        slugs={VENDOR_CONSENT_SLUGS}
      />

      <button className="ga-submit" type="submit" disabled={loading}>
        {loading ? "Gönderiliyor..." : "Başvuruyu Gönder"}
      </button>
    </form>
  );
}
