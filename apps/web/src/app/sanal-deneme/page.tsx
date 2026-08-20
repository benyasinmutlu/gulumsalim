import VirtualTryOn from "@/components/virtual-tryon";

export const metadata = { title: "Sanal Deneme — Demo" };

// Örnek polo tişört (kendi çizdiğimiz temiz SVG garment - şeffaf, gerçek bir
// kıyafet gibi görünür). Gerçek ürün sayfalarında ürünün S3 görseli gelir.
const SAMPLE =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='300' height='340' viewBox='0 0 300 340'><path d='M62 74 L20 152 L60 170 L86 100 Z' fill='%2326344f'/><path d='M238 74 L280 152 L240 170 L214 100 Z' fill='%2326344f'/><path d='M86 86 Q150 64 214 86 L234 306 Q150 326 66 306 Z' fill='%232c3e5a'/><path d='M120 72 L150 106 L136 60 Z' fill='%2344577a'/><path d='M180 72 L150 106 L164 60 Z' fill='%2344577a'/><rect x='144' y='98' width='12' height='76' rx='3' fill='%2326344f'/><circle cx='150' cy='120' r='4.5' fill='%23ffffff'/><circle cx='150' cy='148' r='4.5' fill='%23ffffff'/></svg>";

export default function SanalDenemeDemo() {
  return (
    <main style={{ maxWidth: 760, margin: "40px auto", padding: 24, fontFamily: "system-ui, sans-serif" }}>
      <h1 style={{ fontSize: 28, marginBottom: 8 }}>Sanal Deneme — Demo</h1>
      <p style={{ color: "#666", marginBottom: 24, lineHeight: 1.6 }}>
        Kendi fotoğrafını yükle, örnek ürünün üzerinde nasıl durduğunu büyüteçle gör. Fotoğrafın <strong>cihazında kalır</strong>,
        sunucuya gönderilmez. (Gerçek ürün sayfalarında bu buton her ürünün altında çıkar.)
      </p>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={SAMPLE}
        alt="Örnek polo tişört"
        style={{ width: 130, background: "#f3f0f7", borderRadius: 12, padding: 8, marginBottom: 16, display: "block" }}
      />
      <VirtualTryOn productImage={SAMPLE} productName="Örnek Polo Tişört" />
    </main>
  );
}
