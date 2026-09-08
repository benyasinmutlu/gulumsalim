// bkz. kullanıcı isteği: "tümünü gör sayfalarının arka planında başlığa
// özel hareketli ikonlar olsun" - .section-theme-bg/.stb-icon/.stb-blob
// CSS'i (globals.css) zaten tam hazırdı (yorum satırı bile "Bölüm Tümünü
// Gör sayfası: bölüm başlığına göre tematik arkaplan" diyordu) ama hiçbir
// sayfa bunu kullanmıyordu.

interface IconStyle {
  fontSize: number;
  top: string;
  left: string;
  animationDelay?: string;
}

const POSITIONS: IconStyle[] = [
  { fontSize: 130, top: "6%", left: "5%" },
  { fontSize: 90, top: "62%", left: "84%", animationDelay: "3s" },
  { fontSize: 64, top: "78%", left: "12%", animationDelay: "6s" },
  { fontSize: 50, top: "18%", left: "70%", animationDelay: "9s" },
];

// bkz. kullanıcı isteği: "erkek çocuk ve kız çocuk sayfalarının teması da
// bunlara uygun olsun ikonlar" - `icon` bir dizi verilirse 4 pozisyona
// sırayla dağıtılır (kategori.icon admin panelden emoji de olabilir, bkz.
// category-dropdown.tsx'teki aynı "fa" ile başlamıyorsa emoji" ayrımı -
// FontAwesome className'i beklediği için emoji'yi <i class="fas 👦">
// olarak basmak hiçbir şey göstermezdi).
export default function TitleBackgroundIcons({ icon }: { icon: string | string[] }) {
  const icons = Array.isArray(icon) ? icon : [icon];
  return (
    <div className="section-theme-bg" aria-hidden="true">
      <span className="stb-blob stb-blob-1" />
      <span className="stb-blob stb-blob-2" />
      <span className="stb-blob stb-blob-3" />
      {POSITIONS.map((style, i) => {
        const current = icons[i % icons.length];
        const isFontAwesome = current.startsWith("fa");
        return isFontAwesome ? (
          <i key={i} className={`${current.startsWith("fa-") ? "fas " : ""}${current} stb-icon`} style={style} />
        ) : (
          <span key={i} className="stb-icon" style={style}>
            {current}
          </span>
        );
      })}
    </div>
  );
}
