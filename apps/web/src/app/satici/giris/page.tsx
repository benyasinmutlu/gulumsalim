import Link from "next/link";
import VendorLoginForm from "./login-form";

export default function VendorLoginPage() {
  return (
    <main className="container" style={{ paddingBlock: "2.5rem" }}>
      <h1 style={{ fontSize: "1.3rem", marginBottom: "1.5rem" }}>Satıcı Girişi</h1>
      <VendorLoginForm />
      <p style={{ marginTop: "1.25rem", fontSize: "0.9rem" }}>
        Henüz satıcı hesabınız yok mu? <Link href="/satici/kayit">Satıcı olun</Link>
      </p>
    </main>
  );
}
