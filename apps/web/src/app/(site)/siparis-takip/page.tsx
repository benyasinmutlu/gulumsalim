import type { Metadata } from "next";
import Link from "next/link";
import OrderTrackingForm from "./order-tracking-form";

export const metadata: Metadata = { title: "Sipariş Takip | Gülüm Şalım" };

// bkz. backend envanteri: GET /orders/:orderNumber girişsiz (misafir)
// çalışıyor - sipariş numarası tek başına erişim anahtarı (bkz. API'deki
// order.repository.ts findOrderByNumberPublic yorumu). Bu yüzden form
// sadece sipariş numarası ister, olmayan bir e-posta/telefon doğrulama
// adımı sahte biçimde eklenmez.
//
// bkz. plan Faz 4: mağazalar/yardım'ın geniş, iki kolonlu düzenlerinin
// aksine bu sayfa TEK bir amaca hizmet ediyor (numara gir, sorgula) -
// bu yüzden kompozisyon kasıtlı olarak ortalanmış, dar bir sütun.
export default function OrderTrackingPage() {
  return (
    <main className="main-content">
      <div className="breadcrumb-bar">
        <div className="container-hero">
          <div className="breadcrumb">
            <Link href="/">Ana Sayfa</Link> <span className="sep">{">"}</span> <span className="current">Sipariş Takip</span>
          </div>
        </div>
      </div>

      <section className="lookup-hero">
        <div className="container-hero">
          <h1 className="lookup-hero-title">Siparişinizi Takip Edin</h1>
          <p className="lookup-hero-sub">
            Sipariş numaranızı ve siparişte kullandığınız e-postayı girerek durumunu ve kargo bilgilerini görüntüleyin.
          </p>
        </div>
      </section>

      <div className="lookup-shell">
        <OrderTrackingForm />
      </div>
    </main>
  );
}
