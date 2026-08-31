import Link from "next/link";

// bkz. denetim raporu: "404 ve 301 yönlendirmeleri" - özel bir not-found.tsx
// yoktu, Next'in jenerik/markasız 404'ü gösteriliyordu. Kullanıcıyı boşlukta
// bırakmaması için anasayfa ve ürün gözatma linkleri var (bkz. .empty-state
// globals.css - ürün listesi boş sonuç bloğuyla aynı görsel dil).
export default function NotFound() {
  return (
    <main className="main-content">
      <div className="container" style={{ padding: "80px 0" }}>
        <div className="empty-state">
          <i className="fas fa-compass" />
          <h2>Aradığınız sayfa bulunamadı</h2>
          <p>Bağlantı hatalı olabilir ya da bu sayfa artık mevcut değil.</p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 16 }}>
            <Link href="/" className="btn btn-primary">
              Ana Sayfaya Dön
            </Link>
            <Link href="/urunler" className="btn btn-secondary">
              Ürünleri Keşfet
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
