// gulumsalim.com'daki "Güvenli Çıkış" bağlantısının birebir karşılığı: düz
// bir <a href>, JS/fetch/CSRF token'a hiç bağımlı değil - tıklanınca
// tarayıcı normal bir sayfa navigasyonu yapar, sunucu oturumu yok edip
// anasayfaya yönlendirir. Önceki POST+fetch+router.push/refresh sürümü
// bazı önbellek/tarayıcı koşullarında sessizce hiçbir şey olmamış gibi
// takılabiliyordu - bu yüzden en sağlam yöntem olan düz linke geçildi.
export default function CustomerLogoutButton() {
  return (
    <a href="/api/auth/logout" className="btn btn-secondary btn-sm">
      <i className="fas fa-sign-out-alt" /> Çıkış Yap
    </a>
  );
}
