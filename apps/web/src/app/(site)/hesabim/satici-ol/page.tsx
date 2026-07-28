import BecomeSellerButton from "./become-seller-button";

const PERKS = [
  { icon: "fa-bolt", text: "Anında aktif olur, onay beklemezsiniz" },
  { icon: "fa-tags", text: "Kullanmadığınız kıyafetleri, çantaları, ayakkabıları satışa çıkarın" },
  { icon: "fa-shield-halved", text: "Ödeme güvenle platform üzerinden alınır, kargo takibi ile korunursunuz" },
  { icon: "fa-user", text: "Ayrı bir hesap açmanıza gerek yok, mevcut hesabınızla devam edersiniz" },
];

// bkz. kullanıcı isteği: "bireysel olarak müşteri olarak kayıt olan
// kişilerde satış yapabilsin 2. el ürün letgo dolap gibi" - müşteri
// hesabından ulaşılabilen, Dolap/Letgo tarzı bireysel satıcı olma sayfası.
export default function SaticiOlPage() {
  return (
    <div className="form-card">
      <h3>Ürünlerini Satışa Çıkar</h3>
      <p style={{ fontSize: "0.9rem", color: "var(--color-text-light)", marginBottom: 20 }}>
        Dolabındaki kullanmadığın ürünleri, ikinci el veya sıfır fark etmeksizin, dakikalar içinde satışa çıkarabilirsin.
      </p>
      <ul style={{ listStyle: "none", padding: 0, margin: "0 0 24px", display: "flex", flexDirection: "column", gap: 12 }}>
        {PERKS.map((p) => (
          <li key={p.text} style={{ display: "flex", alignItems: "center", gap: 12, fontSize: "0.9rem" }}>
            <span
              style={{
                width: 34, height: 34, borderRadius: "50%", background: "var(--color-primary)", color: "#fff",
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 13,
              }}
            >
              <i className={`fas ${p.icon}`} />
            </span>
            <span>{p.text}</span>
          </li>
        ))}
      </ul>
      <BecomeSellerButton />
    </div>
  );
}
