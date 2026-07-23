"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ClientApiError, mutateJson } from "@/lib/client-api";
import type { VendorProfile } from "@/lib/types";

// bkz. kullanıcı isteği: "bireysel olarak müşteri olarak kayıt olan
// kişilerde satış yapabilsin 2. el ürün letgo dolap gibi" - tek tıkla,
// admin onayı beklemeden, ayrı bir satıcı girişi yapmadan bireysel satıcı
// hesabı açılır ve doğrudan ürün ekleme sayfasına yönlendirilir.
export default function BecomeSellerButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setError(null);
    try {
      await mutateJson<VendorProfile>("/my/become-individual-seller", "POST");
      router.push("/satici/panel/urunler/yeni");
    } catch (err) {
      setError(err instanceof ClientApiError ? err.message : "Bir şeyler ters gitti, tekrar deneyin");
      setLoading(false);
    }
  }

  return (
    <div>
      <button type="button" className="btn btn-primary btn-lg" onClick={handleClick} disabled={loading}>
        {loading ? "Hazırlanıyor..." : "Hemen Satışa Başla"}
      </button>
      {error && <p className="error-text" style={{ marginTop: 10 }}>{error}</p>}
    </div>
  );
}
