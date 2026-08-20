// gulumsalim.com'daki "Avantajlarımız" bölümünün birebir karşılığı - eski
// sitede bu bölümün kendi CSS sınıfı yok, tamamen inline style ile
// biçimlendirilmiş (bkz. index.php), o yüzden burada da aynı şekilde.
export default function Advantages() {
  const items = [
    { icon: "fa-shipping-fast", title: "Hızlı ve Ücretsiz Kargo", text: "500,00 ₺ üzeri alışverişlerinizde kargo bedava." },
    { icon: "fa-undo", title: "Kolay İade Garantisi", text: "Teslim aldığınız ürünü 14 gün içinde koşulsuz iade edebilirsiniz." },
    { icon: "fa-shield-alt", title: "%100 Güvenli Ödeme", text: "iyzico güvencesiyle 256-bit SSL korumalı kredi kartı ödemesi." },
    { icon: "fa-headset", title: "7/24 Canlı Destek", text: "Sorularınız için destek hattımız her zaman aktif." },
  ];

  return (
    <section style={{ backgroundColor: "var(--color-surface)", padding: "50px 0", borderTop: "1px solid var(--color-border-light)" }}>
      <div className="container">
        <div className="advantages-grid" style={{ textAlign: "center" }}>
          {items.map((item) => (
            <div key={item.title} className="advantage-card">
              <i className={`fas ${item.icon}`} style={{ fontSize: 32, color: "var(--color-primary)", marginBottom: 12 }} />
              <h4 style={{ fontWeight: 600, marginBottom: 6 }}>{item.title}</h4>
              <p style={{ fontSize: 13, color: "var(--color-text-light)" }}>{item.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
