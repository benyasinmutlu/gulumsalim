import Link from "next/link";
import type { CustomerProfile } from "../lib/types";

// bkz. kullanıcı isteği: "websitesine ilk defa giren için kişiyi üye/satıcı
// olmaya teşvik etmeliyiz bu yerleri kolay bulmalı trendyol gibi sahibinden
// gibi olmalı" - önceden "Satıcı Ol" sadece footer'da (sayfanın en altında,
// kaçırılması kolay) vardı. Üst şerit her sayfada, kaydırmadan görünen tek
// yer - Trendyol/Sahibinden'de de bu tür linkler tam burada.
// bkz. kullanıcı isteği (mockup): metin mockup'taki gibi "Ücretsiz Kargo
// {tutar} TL ve üzeri" kalıbında - tutar admin panelden değiştirilebilir
// gerçek bir ayar (bkz. api/lib/shipping.ts getShippingConfig), bu yüzden
// mockup'taki "750 TL" örneğini KOPYALAMIYORUZ, gerçek yapılandırılmış
// değeri (ayarlanmamışsa varsayılan 500 TL) gösteriyoruz.
const DEFAULT_FREE_SHIPPING_LIMIT = 500;

export default function TopBar({ customer, freeShippingLimit }: { customer: CustomerProfile | null; freeShippingLimit?: string }) {
  const limit = freeShippingLimit ? Number(freeShippingLimit) : DEFAULT_FREE_SHIPPING_LIMIT;
  return (
    <div className="top-bar">
      <div className="container">
        <div className="top-bar-left">
          <span>
            <i className="fas fa-shipping-fast" /> Ücretsiz Kargo {limit.toLocaleString("tr-TR")} TL ve üzeri
          </span>
          <span>
            <i className="fas fa-undo" /> İade Garantisi 14 gün içinde
          </span>
          <span>
            <i className="fas fa-lock" /> Güvenli Ödeme 256 Bit SSL
          </span>
        </div>
        <div className="top-bar-right">
          <Link href="/satici/kayit" className="top-bar-cta">
            <i className="fas fa-store" /> Satıcı Ol
          </Link>
          {!customer && (
            <Link href="/kayit" className="top-bar-cta">
              <i className="fas fa-user-plus" /> Üye Ol
            </Link>
          )}
          <Link href="/siparis-takip">
            <i className="fas fa-truck" /> Sipariş Takip
          </Link>
          <Link href="/iletisim">
            <i className="fas fa-life-ring" /> Yardım &amp; Destek
          </Link>
          <Link href="/hakkimizda">Hakkımızda</Link>
        </div>
      </div>
    </div>
  );
}
