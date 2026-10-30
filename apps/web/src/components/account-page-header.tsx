import type { ReactNode } from "react";

interface AccountPageHeaderProps {
  /** Font Awesome ikon sınıfı (örn. "fa-heart"), "fas " öneki otomatik eklenir. */
  icon: string;
  title: string;
  subtitle?: ReactNode;
  action?: ReactNode;
}

// Hesabım alt sayfalarında (favoriler, adresler, siparişler, değerlendirmeler,
// mağazalarım, mesajlarım, satıcı-ol, profil) tekrarlanan ikon + başlık +
// alt açıklama deseni - bkz. plan dosyası Faz 3. Her sayfa kendi ikonunu ve
// metnini veriyor, görsel/markup tek yerde.
export default function AccountPageHeader({ icon, title, subtitle, action }: AccountPageHeaderProps) {
  return (
    <div className="account-page-header">
      <div className="account-page-header-text">
        <h3>
          <i className={`fas ${icon}`} /> {title}
        </h3>
        {subtitle && <div className="account-page-subtitle">{subtitle}</div>}
      </div>
      {action && <div className="account-page-header-action">{action}</div>}
    </div>
  );
}
