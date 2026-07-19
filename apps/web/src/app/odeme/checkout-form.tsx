"use client";

import { useState, type FormEvent } from "react";
import { ClientApiError, mutateJson } from "@/lib/client-api";

interface CheckoutResult {
  orderNumber: string;
  checkoutFormContent: string;
}

export default function CheckoutForm() {
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [district, setDistrict] = useState("");
  const [addressLine, setAddressLine] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CheckoutResult | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const data = await mutateJson<CheckoutResult>("/checkout", "POST", {
        shippingAddress: { fullName, phone, city, district, addressLine },
      });
      setResult(data);
    } catch (err) {
      setError(err instanceof ClientApiError ? err.message : "Ödeme başlatılamadı");
    } finally {
      setLoading(false);
    }
  }

  // iyzico Checkout Form entegrasyonu: dönen checkoutFormContent, iyzico'nun
  // ödeme iframe'ini bu sayfaya gömen bir <script> parçası - iyzico'nun
  // resmi entegrasyon yöntemi bu şekilde çalışıyor.
  if (result) {
    return (
      <div>
        <p style={{ marginBottom: "1rem" }}>
          Sipariş No: <strong>{result.orderNumber}</strong> — ödemeyi tamamlamak için aşağıdaki formu kullanın.
        </p>
        <div dangerouslySetInnerHTML={{ __html: result.checkoutFormContent }} />
      </div>
    );
  }

  return (
    <form className="form" onSubmit={handleSubmit}>
      <label>
        Ad Soyad
        <input required value={fullName} onChange={(e) => setFullName(e.target.value)} />
      </label>
      <label>
        Telefon
        <input required value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="05XXXXXXXXX" />
      </label>
      <label>
        Şehir
        <input required value={city} onChange={(e) => setCity(e.target.value)} />
      </label>
      <label>
        İlçe
        <input required value={district} onChange={(e) => setDistrict(e.target.value)} />
      </label>
      <label>
        Açık Adres
        <input required value={addressLine} onChange={(e) => setAddressLine(e.target.value)} />
      </label>
      {error && <p className="error-text">{error}</p>}
      <button className="btn" type="submit" disabled={loading}>
        {loading ? "Yönlendiriliyor..." : "Ödemeye Geç"}
      </button>
    </form>
  );
}
