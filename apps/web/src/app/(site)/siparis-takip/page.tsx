import type { Metadata } from "next";
import OrderTrackingForm from "./order-tracking-form";

export const metadata: Metadata = { title: "Sipariş Takip | Gülüm Şalım" };

// bkz. backend envanteri: GET /orders/:orderNumber girişsiz (misafir)
// çalışıyor - sipariş numarası tek başına erişim anahtarı (bkz. API'deki
// order.repository.ts findOrderByNumberPublic yorumu). Bu yüzden form
// sadece sipariş numarası ister, olmayan bir e-posta/telefon doğrulama
// adımı sahte biçimde eklenmez.
export default function OrderTrackingPage() {
  return (
    <main className="main-content">
      <div className="container" style={{ maxWidth: 640, padding: "40px 16px" }}>
        <h1 className="products-page-title">Sipariş Takip</h1>
        <p style={{ color: "var(--color-text-secondary, #666)", marginBottom: 24 }}>
          Sipariş numaranızı girerek siparişinizin durumunu ve kargo bilgilerini görüntüleyebilirsiniz.
        </p>
        <OrderTrackingForm />
      </div>
    </main>
  );
}
