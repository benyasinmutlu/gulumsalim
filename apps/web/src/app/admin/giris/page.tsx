import AdminLoginForm from "./login-form";

export default function AdminLoginPage() {
  return (
    <div className="admin-login-page">
      <div className="admin-login-card">
        <div className="login-logo">
          <span className="logo-icon">GS</span>
          <h1>Gülüm Şalım</h1>
          <p>Mağaza Yönetim Paneli</p>
        </div>
        <AdminLoginForm />
      </div>
    </div>
  );
}
