// bkz. kullanıcı isteği: "tümünü gör sayfalarının arka planında başlığa
// özel hareketli ikonlar olsun" - .section-theme-bg/.stb-icon/.stb-blob
// CSS'i (globals.css) zaten tam hazırdı (yorum satırı bile "Bölüm Tümünü
// Gör sayfası: bölüm başlığına göre tematik arkaplan" diyordu) ama hiçbir
// sayfa bunu kullanmıyordu.
export default function TitleBackgroundIcons({ icon }: { icon: string }) {
  return (
    <div className="section-theme-bg" aria-hidden="true">
      <span className="stb-blob stb-blob-1" />
      <span className="stb-blob stb-blob-2" />
      <span className="stb-blob stb-blob-3" />
      <i className={`fas ${icon} stb-icon`} style={{ fontSize: 130, top: "6%", left: "5%" }} />
      <i className={`fas ${icon} stb-icon`} style={{ fontSize: 90, top: "62%", left: "84%", animationDelay: "3s" }} />
      <i className={`fas ${icon} stb-icon`} style={{ fontSize: 64, top: "78%", left: "12%", animationDelay: "6s" }} />
      <i className={`fas ${icon} stb-icon`} style={{ fontSize: 50, top: "18%", left: "70%", animationDelay: "9s" }} />
    </div>
  );
}
