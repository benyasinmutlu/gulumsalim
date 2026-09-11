import Link from "next/link";
import type { CustomerProfile } from "../lib/types";

// bkz. kullanıcı isteği: "websitesine ilk defa giren için kişiyi üye/satıcı
// olmaya teşvik etmeliyiz bu yerleri kolay bulmalı trendyol gibi sahibinden
// gibi olmalı" - önceden "Satıcı Ol" sadece footer'da (sayfanın en altında,
// kaçırılması kolay) vardı. Üst şerit her sayfada, kaydırmadan görünen tek
// yer - Trendyol/Sahibinden'de de bu tür linkler tam burada.
//
// bkz. kullanıcı kararı (2026-09-11): "500 tl ve üstü de ücretsiz olmayacak"
// - site genelinde eşik bazlı ücretsiz kargo politikası kaldırıldı, bu
// yüzden "Ücretsiz Kargo X TL ve üzeri" vaadi burada da kaldırıldı (artık
// doğru olmayan bir vaat göstermiş olurduk).
export default function TopBar({ customer }: { customer: CustomerProfile | null }) {
  return (
    <div className="top-bar">
      <div className="container">
        <div className="top-bar-left">
          <span>
            <i className="fas fa-undo" /> 14 Gün Koşulsuz İade
          </span>
          <span>
            <i className="fas fa-lock" /> Güvenli Ödeme 256 Bit SSL
          </span>
        </div>
        <div className="top-bar-right">
          {!customer && (
            <Link href="/kayit" className="top-bar-cta">
              <i className="fas fa-user-plus" /> Üye Ol
            </Link>
          )}
          <Link href="/siparis-takip">
            <i className="fas fa-truck" /> Sipariş Takip
          </Link>
          <Link href="/yardim">
            <i className="fas fa-life-ring" /> Yardım &amp; Destek
          </Link>
          <Link href="/hakkimizda">Hakkımızda</Link>
        </div>
      </div>
    </div>
  );
}
