"use client";

import { useState, type FormEvent } from "react";
import { ClientApiError, mutateJson } from "@/lib/client-api";

interface Props {
  initialName?: string;
  initialEmail?: string;
}

// bkz. kullanıcı isteği: "giriş yapıldıysa direkt yazılı gelsin ad soyad
// ve eposta" - giriş yapmış müşterinin bilgileri formu önceden doldurur,
// yine de değiştirilebilir kalır (ör. farklı bir iletişim e-postası).
export default function ContactForm({ initialName = "", initialEmail = "" }: Props) {
  const [name, setName] = useState(initialName);
  const [email, setEmail] = useState(initialEmail);
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await mutateJson("/contact", "POST", { name, email, message });
      setSuccess(true);
      setName("");
      setEmail("");
      setMessage("");
    } catch (err) {
      setError(err instanceof ClientApiError ? err.message : "Mesaj gönderilemedi");
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="form-card" style={{ marginTop: 24 }}>
        <p>Mesajınız alındı, en kısa sürede size dönüş yapacağız.</p>
      </div>
    );
  }

  return (
    <form className="form-card" style={{ marginTop: 24 }} onSubmit={handleSubmit}>
      <h3>Bize Ulaşın</h3>
      <div className="form-group">
        <label>Ad Soyad</label>
        <input className="form-control" required value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="form-group">
        <label>E-posta</label>
        <input className="form-control" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div className="form-group">
        <label>Mesajınız</label>
        <textarea className="form-control" required rows={5} value={message} onChange={(e) => setMessage(e.target.value)} />
      </div>
      {error && <p className="error-text">{error}</p>}
      <button className="btn btn-primary" type="submit" disabled={loading}>
        {loading ? "Gönderiliyor..." : "Gönder"}
      </button>
    </form>
  );
}
