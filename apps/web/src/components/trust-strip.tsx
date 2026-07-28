export default function TrustStrip() {
  return (
    <section className="trust-strip">
      <div className="container trust-strip-inner">
        <div className="trust-strip-item">
          <i className="fas fa-shipping-fast" />
          <span>
            500,00 ₺ Üzeri <strong>Ücretsiz Kargo</strong>
          </span>
        </div>
        <div className="trust-strip-item">
          <i className="fas fa-undo" />
          <span>
            <strong>14 Gün</strong> Koşulsuz İade
          </span>
        </div>
        <div className="trust-strip-item">
          <i className="fas fa-shield-alt" />
          <span>
            <strong>%100 Güvenli</strong> Ödeme
          </span>
        </div>
        <div className="trust-strip-item">
          <i className="fas fa-headset" />
          <span>
            <strong>7/24</strong> Canlı Destek
          </span>
        </div>
      </div>
    </section>
  );
}
