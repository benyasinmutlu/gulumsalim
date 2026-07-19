import Link from "next/link";
import VendorRegisterForm from "./register-form";

export default function VendorRegisterPage() {
  return (
    <main className="container" style={{ paddingBlock: "2.5rem" }}>
      <h1 style={{ fontSize: "1.3rem", marginBottom: "0.5rem" }}>Satıcı Olun</h1>
      <p style={{ marginBottom: "1.5rem", opacity: 0.75, maxWidth: 480 }}>
        Kayıt sonrası mağazanız &quot;onay bekliyor&quot; durumunda oluşturulur — ürünleriniz admin onayından sonra
        yayınlanır.
      </p>
      <VendorRegisterForm />
      <p style={{ marginTop: "1.25rem", fontSize: "0.9rem" }}>
        Zaten satıcı hesabınız var mı? <Link href="/satici/giris">Giriş yapın</Link>
      </p>
    </main>
  );
}
