// bkz. hesabim/logout-button.tsx - düz link, JS'e bağımlı değil.
export default function VendorLogoutButton() {
  return (
    // eslint-disable-next-line @next/next/no-html-link-for-pages
    <a href="/api/vendor/auth/logout" className="logout" title="Çıkış">
      <i className="fas fa-sign-out-alt" />
    </a>
  );
}
