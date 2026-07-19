import Link from "next/link";
import RegisterForm from "./register-form";

export default function RegisterPage() {
  return (
    <main className="container" style={{ paddingBlock: "2.5rem" }}>
      <h1 style={{ fontSize: "1.3rem", marginBottom: "1.5rem" }}>Kayıt Ol</h1>
      <RegisterForm />
      <p style={{ marginTop: "1.25rem", fontSize: "0.9rem" }}>
        Zaten hesabınız var mı? <Link href="/giris">Giriş yapın</Link>
      </p>
    </main>
  );
}
