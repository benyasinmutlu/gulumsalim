import Link from "next/link";

export default function TopBar() {
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
          <Link href="/hakkimizda">Hakkımızda</Link>
          <Link href="/iletisim">İletişim</Link>
        </div>
      </div>
    </div>
  );
}
