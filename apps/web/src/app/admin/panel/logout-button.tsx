// bkz. hesabim/logout-button.tsx - düz link, JS'e bağımlı değil.
export default function AdminLogoutButton() {
  return (
    <a href="/api/admin/auth/logout" className="sidebar-logout" title="Çıkış Yap">
      <i className="fas fa-sign-out-alt" />
    </a>
  );
}
