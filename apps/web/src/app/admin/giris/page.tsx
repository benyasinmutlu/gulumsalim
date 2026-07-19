import AdminLoginForm from "./login-form";

export default function AdminLoginPage() {
  return (
    <main className="container" style={{ paddingBlock: "2.5rem" }}>
      <h1 style={{ fontSize: "1.3rem", marginBottom: "1.5rem" }}>Yönetici Girişi</h1>
      <AdminLoginForm />
    </main>
  );
}
