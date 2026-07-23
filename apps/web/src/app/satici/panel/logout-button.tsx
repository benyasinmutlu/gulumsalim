// bkz. hesabim/logout-button.tsx - düz link, JS'e bağımlı değil.
export default function VendorLogoutButton() {
  return (
    <a href="/api/vendor/auth/logout" className="logout" title="Çıkış">
      <i className="fas fa-sign-out-alt" />
    </a>
  );
}
