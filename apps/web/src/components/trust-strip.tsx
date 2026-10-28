// bkz. kullanıcı isteği (mockup): hero altındaki şerit tek satır metin
// yerine iki satır (kalın başlık + küçük açıklama) olmalı.
//
// bkz. kullanıcı kararı (2026-09-11): "500 tl ve üstü de ücretsiz olmayacak"
// - eşik bazlı ücretsiz kargo politikası kaldırıldığı için o madde de
// buradan kaldırıldı (bkz. top-bar.tsx'teki aynı not).
export default function TrustStrip() {
  return (
    <section className="trust-strip">
      <div className="container trust-strip-inner">
        <div className="trust-strip-item">
          <i className="fas fa-undo" />
          <span>
            <strong>Kolay İade</strong>
            <small>14 gün içinde koşulsuz iade</small>
          </span>
        </div>
        <div className="trust-strip-item">
          <i className="fas fa-shield-alt" />
          <span>
            <strong>Güvenli Ödeme</strong>
            <small>256 Bit SSL ile korunur</small>
          </span>
        </div>
        <div className="trust-strip-item">
          <i className="fas fa-headset" />
          <span>
            <strong>7/24 Destek</strong>
            <small>Canlı destek hattı</small>
          </span>
        </div>
      </div>
    </section>
  );
}
