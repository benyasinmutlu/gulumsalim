// bkz. kullanıcı isteği (2026-08-02): "kullanıcıların şikayet ettiklerini
// araştır ve o özellikler bizde de olsun" - araştırma büyük pazaryerleri
// hakkındaki en yaygın/kanıtlanmış şikayetleri ortaya koydu: şişirilmiş
// sahte indirimler (Ticaret Bakanlığı 2026-08-01'de bunu yönetmelikle
// yasakladı), sahte aciliyet/geri sayım taktikleri, bireysel satıcılardan
// gelen kalitesiz/sahte ürünler, manipüle edilmiş yorumlar. Her madde
// burada platformda ZATEN GERÇEKTEN VAR OLAN bir önlemle eşleştirildi -
// hiçbiri pazarlama iddiası değil, kod tarafında karşılığı olan gerçek
// özellikler (bkz. vendor-products.routes.ts validateDiscountPricing,
// countdown-timer.tsx gerçek bitiş zamanı, admin onay akışı).
const ITEMS: { icon: string; title: string; text: string }[] = [
  {
    icon: "fa-tags",
    title: "Gerçek İndirimler",
    text: "Gösterdiğimiz indirim oranları şişirilmiş bir 'eski fiyata' değil, gerçek fiyat farkına dayanır.",
  },
  {
    icon: "fa-user-check",
    title: "İncelenmiş Satıcılar",
    text: "Bireysel satıcıların ürünleri yayınlanmadan önce ekibimiz tarafından incelenir, otomatik onaylanmaz.",
  },
  {
    icon: "fa-clock",
    title: "Sahte Aciliyet Yok",
    text: "Geri sayımlarımız gerçek kampanya bitiş zamanını gösterir - süre dolunca sessizce kaybolur, sıfırlanmaz.",
  },
  {
    icon: "fa-star",
    title: "Şeffaf Değerlendirmeler",
    text: "Ürün puanları yalnızca gerçek müşteri yorumlarından hesaplanır.",
  },
];

export default function TrustDifferentiators() {
  return (
    <section className="trust-diff-section">
      <div className="container">
        <div className="section-header">
          <span className="section-tag">Farkımız</span>
          <h2 className="section-title">Neden Gülüm Şalım?</h2>
        </div>
        <div className="trust-diff-grid">
          {ITEMS.map((item) => (
            <div key={item.title} className="trust-diff-card">
              <div className="trust-diff-icon">
                <i className={`fas ${item.icon}`} />
              </div>
              <h3>{item.title}</h3>
              <p>{item.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
