import NewsletterSignupForm from "./newsletter-signup-form";

// bkz. kullanıcı isteği (2026-08-02): "bülten abone ol kısmı çok daha iyi
// bir yerde gözüksün anasayfada gezinirken ve daha estetik olsun" - önceden
// bülten kayıt formu sadece footer'ın en altındaki düz, kenardan kenara
// şeritteydi (bkz. site-footer.tsx .footer-newsletter - o hâlâ diğer
// sayfalarda duruyor). Anasayfaya özel bu bileşen, sayfa akışının İÇİNDE
// (kenar boşluklu, yuvarlak köşeli bir "kart" olarak) daha görünür ve
// estetik bir konumda gösteriliyor - aynı NewsletterSignupForm mantığı
// yeniden kullanılıyor, sadece sarmalayıcı tasarımı farklı.
export default function NewsletterBanner() {
  return (
    <section className="container">
      <div className="newsletter-banner">
        <div className="newsletter-banner-icon">
          <i className="fas fa-envelope-open-text" />
        </div>
        <div className="newsletter-banner-text">
          <h3>Bültenimize Katıl</h3>
          <p>Yeni gelenlerden ve kampanyalardan ilk sen haberdar ol.</p>
        </div>
        <NewsletterSignupForm />
      </div>
    </section>
  );
}
