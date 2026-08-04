// bkz. kullanıcı isteği (mockup): hero altındaki şerit tek satır metin
// yerine iki satır (kalın başlık + küçük açıklama) olmalı - tutar
// hardcoded değil, gerçek yapılandırılmış kargo eşiğinden geliyor (bkz.
// top-bar.tsx'teki aynı not).
const DEFAULT_FREE_SHIPPING_LIMIT = 500;

export default function TrustStrip({ freeShippingLimit }: { freeShippingLimit?: string }) {
  const limit = freeShippingLimit ? Number(freeShippingLimit) : DEFAULT_FREE_SHIPPING_LIMIT;
  return (
    <section className="trust-strip">
      <div className="container trust-strip-inner">
        <div className="trust-strip-item">
          <i className="fas fa-shipping-fast" />
          <span>
            <strong>Ücretsiz Kargo</strong>
            <small>{limit.toLocaleString("tr-TR")} TL ve üzeri siparişlerde</small>
          </span>
        </div>
        <div className="trust-strip-item">
          <i className="fas fa-undo" />
          <span>
            <strong>Kolay İade</strong>
            <small>14 gün içinde ücretsiz iade</small>
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
