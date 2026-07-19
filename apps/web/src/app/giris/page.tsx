import Link from "next/link";
import LoginForm from "./login-form";

export default function LoginPage() {
  return (
    <main className="container" style={{ paddingBlock: "2.5rem" }}>
      <h1 style={{ fontSize: "1.3rem", marginBottom: "1.5rem" }}>Giriş Yap</h1>
      <LoginForm />
      <p style={{ marginTop: "1.25rem", fontSize: "0.9rem" }}>
        Hesabınız yok mu? <Link href="/kayit">Kayıt olun</Link>
      </p>
    </main>
  );
}
