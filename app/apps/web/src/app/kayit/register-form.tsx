"use client";

import { useState, type FormEvent } from "react";
import { ClientApiError, mutateJson } from "@/lib/client-api";
import ConsentModal from "@/components/consent-modal";
import ConsentDocumentCard from "@/components/consent-document-card";

export default function RegisterForm() {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [membershipConsent, setMembershipConsent] = useState(false);
  const [marketingConsent, setMarketingConsent] = useState(false);
  const [analyticsConsent, setAnalyticsConsent] = useState(false);
  const [membershipModalOpen, setMembershipModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (password !== passwordConfirm) {
      setError("Şifreler eşleşmiyor");
      return;
    }
    if (!membershipConsent) {
      setError("Devam etmek için Üyelik Sözleşmesini ve KVKK Aydınlatma Metnini kabul etmelisiniz");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await mutateJson<{ email: string; verificationRequired: boolean }>("/auth/register", "POST", {
        fullName: `${firstName} ${lastName}`.trim(),
        email,
        phone: phone || undefined,
        password,
        membershipConsent,
        marketingConsent,
        analyticsConsent,
      });
      // bkz. kullanıcı isteği: "email doğrulamayı zorunlu olmalı" - kayıt
      // artık otomatik giriş yapmıyor, doğrulama e-postasını bekliyoruz.
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
        <i className="fas fa-envelope-circle-check" /> <strong>{email}</strong> adresine bir doğrulama bağlantısı gönderdik. Hesabınızı
        kullanabilmek için gelen kutunuzdaki (ve spam klasörünüzdeki) bağlantıya tıklayın.
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

      <div className="ga-row2">
        <div className="ga-fg">
          <label>
            Adınız <span className="req">*</span>
          </label>
          <div className="ga-input-wrap">
            <input className="ga-input" type="text" required value={firstName} onChange={(e) => setFirstName(e.target.value)} />
          </div>
        </div>
        <div className="ga-fg">
          <label>
            Soyadınız <span className="req">*</span>
          </label>
          <div className="ga-input-wrap">
            <input className="ga-input" type="text" required value={lastName} onChange={(e) => setLastName(e.target.value)} />
          </div>
        </div>
      </div>

      <div className="ga-fg">
        <label>
          E-Posta Adresi <span className="req">*</span>
        </label>
        <div className="ga-input-wrap">
          <i className="fas fa-envelope ga-ic" />
          <input className="ga-input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
      </div>

      <div className="ga-fg">
        <label>Telefon Numarası</label>
        <div className="ga-input-wrap">
          <i className="fas fa-phone ga-ic" />
          <input className="ga-input" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
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
              type={showPassword ? "text" : "password"}
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button type="button" className="ga-pw-toggle" onClick={() => setShowPassword((v) => !v)} aria-label="Şifreyi göster/gizle">
              <i className={showPassword ? "fas fa-eye-slash" : "fas fa-eye"} />
            </button>
          </div>
        </div>
        <div className="ga-fg">
          <label>
            Şifre Tekrar <span className="req">*</span>
          </label>
          <div className="ga-input-wrap">
            <input
              className="ga-input"
              type={showPassword ? "text" : "password"}
              required
              value={passwordConfirm}
              onChange={(e) => setPasswordConfirm(e.target.value)}
            />
          </div>
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
        <a href="/ticari-elektronik-ileti-onayi" target="_blank" rel="noopener noreferrer">Ticari Elektronik İleti Onayı'nı</a> okudum, kampanya/fırsat bildirimlerini (SMS/e-posta) almak istiyorum.
      </label>

      <label className="ga-consent">
        <input type="checkbox" checked={analyticsConsent} onChange={(e) => setAnalyticsConsent(e.target.checked)} />
        <a href="/acik-riza-metni" target="_blank" rel="noopener noreferrer">Açık Rıza Metni'ni</a> okudum, kişiselleştirilmiş ürün önerileri gösterilmesini istiyorum.
      </label>

      <button className="ga-submit" type="submit" disabled={loading}>
        {loading ? "Kaydediliyor..." : "Kayıt Ol"}
      </button>
    </form>
  );
}
