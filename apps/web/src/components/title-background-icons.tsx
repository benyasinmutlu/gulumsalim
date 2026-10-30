// bkz. kullanıcı bildirimi (2026-10-30): "ben o basit sepetdir indirimdir
// o tarz şeylerin görünmesini istemiyorum daha şık modern profesyonel bir
// arkaplan olsun" - FontAwesome ikonları kaldırılmıştı. Ardından "arka
// plandaki çemberler kötü duruyor onları beğenmedim" bildirimiyle ince
// halka motifleri de kaldırıldı; geriye sadece yumuşak renk blob'ları
// kaldı. `icon` prop'u geriye dönük uyumluluk için duruyor (5 çağıran yer
// var) ama artık kullanılmıyor.
export default function TitleBackgroundIcons({ icon: _icon }: { icon: string | string[] }) {
  return (
    <div className="section-theme-bg" aria-hidden="true">
      <span className="stb-blob stb-blob-1" />
      <span className="stb-blob stb-blob-2" />
      <span className="stb-blob stb-blob-3" />
    </div>
  );
}
