import Link from "next/link";
import type { CustomerProfile } from "../lib/types";

// bkz. kullanıcı isteği: "websitesine ilk defa giren için kişiyi üye/satıcı
// olmaya teşvik etmeliyiz bu yerleri kolay bulmalı trendyol gibi sahibinden
// gibi olmalı" - önceden "Satıcı Ol" sadece footer'da (sayfanın en altında,
// kaçırılması kolay) vardı. Üst şerit her sayfada, kaydırmadan görünen tek
// yer - Trendyol/Sahibinden'de de bu tür linkler tam burada.
export default function TopBar({ customer }: { customer: CustomerProfile | null }) {
  return (
    <div className="top-bar">
      <div className="container">
        <div className="top-bar-left">
          <span>
            <i className="fas fa-shipping-fast" /> 500,00 ₺ üzeri ücretsiz kargo
          </span>
          <span>
            <i className="fas fa-undo" /> 14 gün koşulsuz iade
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
          <Link href="/hakkimizda">Hakkımızda</Link>
          <Link href="/iletisim">İletişim</Link>
        </div>
      </div>
    </div>
  );
}
