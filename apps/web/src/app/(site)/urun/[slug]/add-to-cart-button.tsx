"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { mutateJson } from "@/lib/client-api";
import type { CartResponse, ProductVariant } from "@/lib/types";

interface Props {
  productId: number;
  variants: ProductVariant[];
  price: number;
  // bkz. kullanıcı isteği (2026-08-03): "kurumsal satıcıların stokları
  // zorunlu olarak girilmeli bireysel satıcıların ise stoğu 1 olacak" -
  // varyantsız ürünlerde artık gerçek bir stok var, sadece variants boşken
  // kullanılır.
  stock: number;
  // bkz. denetim raporu madde 4/7/8: satıcının bu ürüne özel girdiği ölçü
  // tablosu (cm). Verilmemişse (çoğu ürün) standart referans tabloya düşülür.
  sizeChart?: Record<string, { bust?: number; waist?: number; hip?: number }> | null;
}

const SIZE_CHART_ROWS: { size: string; bust: string; waist: string; hip: string }[] = [
  { size: "XS", bust: "80-84", waist: "62-66", hip: "88-92" },
  { size: "S", bust: "84-88", waist: "66-70", hip: "92-96" },
  { size: "M", bust: "88-92", waist: "70-74", hip: "96-100" },
  { size: "L", bust: "92-98", waist: "74-80", hip: "100-106" },
  { size: "XL", bust: "98-104", waist: "80-86", hip: "106-112" },
  { size: "XXL", bust: "104-110", waist: "86-92", hip: "112-118" },
];

// bkz. denetim raporu madde 4/7/8: önceden bu modal HER ürün için aynı genel
// tabloyu gösteriyordu, satıcının girdiği gerçek product.sizeChart'la hiç
// bağlantısı yoktu (o veri sadece "Bedenime Uygun" fit motorunda kullanılıyordu).
// Satıcı bu ürüne özel ölçü girdiyse artık burada da gösterilir; girmediyse
// genel referans tabloya düşülür (bu durumda not metni bunu açıkça belirtir).
function SizeChartModal({
  onClose,
  productSizeChart,
}: {
  onClose: () => void;
  productSizeChart?: Record<string, { bust?: number; waist?: number; hip?: number }> | null;
}) {
  const hasProductChart = productSizeChart && Object.keys(productSizeChart).length > 0;
  const rows = hasProductChart
    ? Object.entries(productSizeChart).map(([size, m]) => ({
        size,
        bust: m.bust ? `${m.bust}` : "—",
        waist: m.waist ? `${m.waist}` : "—",
        hip: m.hip ? `${m.hip}` : "—",
      }))
    : SIZE_CHART_ROWS;
  return (
    <>
      <div className="overlay active" onClick={onClose} role="presentation" />
      <div className="size-chart-modal">
        <div className="size-chart-head">
          <h3>Beden Tablosu</h3>
          <button type="button" className="size-chart-close" aria-label="Kapat" onClick={onClose}>
            <i className="fas fa-times" />
          </button>
        </div>
        <p className="size-chart-note">
          Ölçüler santimetre (cm) cinsindendir{hasProductChart ? ", bu ürün için satıcının girdiği gerçek ölçülerdir." : ", genel referans tablosudur."}
        </p>
        <table className="size-chart-table">
          <thead>
            <tr>
              <th>Beden</th>
              <th>Göğüs</th>
              <th>Bel</th>
              <th>Kalça</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.size}>
                <td>{row.size}</td>
                <td>{row.bust}</td>
                <td>{row.waist}</td>
                <td>{row.hip}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

// gulumsalim.com'daki .detail-options / .size-options / .quantity-selector
// yapısının birebir karşılığı.
export default function AddToCartButton({ productId, variants, price, stock, sizeChart }: Props) {
  const router = useRouter();
  const sizes = useMemo(() => [...new Set(variants.map((v) => v.size).filter((s): s is string => !!s))], [variants]);
  const colors = useMemo(() => [...new Set(variants.map((v) => v.color).filter((c): c is string => !!c))], [variants]);

  const [selectedSize, setSelectedSize] = useState<string | null>(sizes[0] ?? null);
  const [selectedColor, setSelectedColor] = useState<string | null>(colors[0] ?? null);
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(false);
  const [buyNowLoading, setBuyNowLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  // bkz. kullanıcı isteği: "ürün sepete eklendiğinde o buton değişsin" -
  // buton birkaç saniyeliğine yeşil "Sepete Eklendi" durumuna geçer.
  const [justAdded, setJustAdded] = useState(false);
  const [sizeChartOpen, setSizeChartOpen] = useState(false);

  const hasVariants = variants.length > 0;
  const matchedVariant = hasVariants
    ? variants.find(
        (v) => (sizes.length === 0 || v.size === selectedSize) && (colors.length === 0 || v.color === selectedColor),
      )
    : undefined;
  const outOfStock = hasVariants ? !matchedVariant || matchedVariant.stock <= 0 : stock <= 0;
  // bkz. kullanıcı isteği: "stok durumu sürekli kontrol ettirilmeli ... 14
  // tane şort etek var 30 tane alabiliyorum bu olmamalı" - varyantlı
  // ürünlerde miktar seçili varyantın gerçek stoğuyla sınırlanır. Varyantsız
  // ürünlerde de artık gerçek bir stok var (bkz. cart.service.ts
  // hydrateCart aynı kural) - bireysel satıcıda bu hep 1'dir.
  const maxQuantity = hasVariants ? (matchedVariant?.stock ?? 0) : stock;

  useEffect(() => {
    setQuantity((q) => Math.min(q, Math.max(1, maxQuantity)));
  }, [maxQuantity]);

  async function handleClick() {
    setLoading(true);
    setMessage(null);
    try {
      await mutateJson<CartResponse>("/cart/items", "POST", {
        productId,
        variantId: matchedVariant?.id,
        quantity,
      });
      setJustAdded(true);
      window.setTimeout(() => setJustAdded(false), 2500);
      router.refresh();
    } catch {
      setMessage("Sepete eklenemedi, tekrar deneyin.");
    } finally {
      setLoading(false);
    }
  }

  // bkz. kullanıcı isteği (mockup): "Hemen Al" - ürünü sepete ekler, ardından
  // Faz 12'de kurulan selectedLines mekanizmasını kullanarak DOĞRUDAN bu tek
  // ürün seçiliyken ödeme sayfasına yönlendirir (sepetteki diğer ürünlere
  // dokunmadan). Yeni bir "sepetsiz checkout" akışı gerekmedi - mevcut
  // sepet+seçili-ödeme altyapısının yeniden kullanımı.
  async function handleBuyNow() {
    setBuyNowLoading(true);
    setMessage(null);
    try {
      await mutateJson<CartResponse>("/cart/items", "POST", {
        productId,
        variantId: matchedVariant?.id,
        quantity,
      });
      const key = `${productId}:${matchedVariant?.id ?? 0}`;
      router.push(`/odeme?selected=${encodeURIComponent(key)}`);
    } catch {
      setMessage("Sepete eklenemedi, tekrar deneyin.");
      setBuyNowLoading(false);
    }
  }

  return (
    <>
    <div className="detail-options">
      {sizes.length > 0 && (
        <div className="option-group">
          <div className="option-label-row">
            <div className="option-label">Beden</div>
            <button type="button" className="size-chart-trigger" onClick={() => setSizeChartOpen(true)}>
              <i className="fas fa-ruler" /> Beden Tablosu
            </button>
          </div>
          <div className="size-options">
            {sizes.map((size) => (
              <button
                key={size}
                type="button"
                className={`size-btn${selectedSize === size ? " active" : ""}`}
                onClick={() => setSelectedSize(size)}
              >
                {size}
              </button>
            ))}
          </div>
        </div>
      )}

      {sizeChartOpen && <SizeChartModal onClose={() => setSizeChartOpen(false)} productSizeChart={sizeChart} />}

      {colors.length > 0 && (
        <div className="option-group">
          <div className="option-label">Renk</div>
          <div className="size-options">
            {colors.map((color) => (
              <button
                key={color}
                type="button"
                className={`size-btn${selectedColor === color ? " active" : ""}`}
                onClick={() => setSelectedColor(color)}
              >
                {color}
              </button>
            ))}
          </div>
        </div>
      )}

      {matchedVariant?.priceOverride && (
        <p style={{ fontSize: "0.85rem", color: "var(--color-text-light)", marginBottom: "0.75rem" }}>
          Bu seçenek için fiyat: {Number(matchedVariant.priceOverride).toLocaleString("tr-TR", { minimumFractionDigits: 2 })} ₺
        </p>
      )}

      {/* bkz. kullanıcı isteği (tasarım brief'i, 2026-08-02): "Stok Uyarısı:
          'Stokta Son X Ürün!' rozeti" - sadece seçili varyantın stoğu azken
          (ve tükenmemişken) gösterilir, aciliyet hissi yaratır. Varyantsız
          üründe (bireysel satıcıda hep 1) aynı rozet ürün stoğuna göre. */}
      {hasVariants
        ? matchedVariant && matchedVariant.stock > 0 && matchedVariant.stock <= 5 && (
            <p className="low-stock-badge">
              <i className="fas fa-fire" /> Stokta Son {matchedVariant.stock} Ürün!
            </p>
          )
        : stock > 0 && stock <= 5 && (
            <p className="low-stock-badge">
              <i className="fas fa-fire" /> Stokta Son {stock} Ürün!
            </p>
          )}

      <div className="option-group">
        <div className="option-label">Miktar:</div>
        <div className="quantity-selector">
          <button type="button" className="qty-btn" onClick={() => setQuantity((q) => Math.max(1, q - 1))}>
            -
          </button>
          <input className="qty-input" value={quantity} readOnly />
          <button
            type="button"
            className="qty-btn"
            disabled={quantity >= maxQuantity}
            onClick={() => setQuantity((q) => Math.min(maxQuantity, q + 1))}
          >
            +
          </button>
        </div>
      </div>

      {/* bkz. kullanıcı isteği (mockup): "Sepete Ekle" birincil (dolu) buton,
          "Hemen Al" ikincil (çerçeveli) - mockup'taki hiyerarşi budur. */}
      <div className="detail-actions">
        <button
          className={`btn btn-lg ${justAdded ? "btn-added" : "btn-primary"}`}
          onClick={handleClick}
          disabled={loading || buyNowLoading || outOfStock}
        >
          {outOfStock ? (
            "Stokta Yok"
          ) : justAdded ? (
            <>
              <i className="fas fa-check" /> Sepete Eklendi
            </>
          ) : loading ? (
            "Ekleniyor..."
          ) : (
            "Sepete Ekle"
          )}
        </button>
        {!outOfStock && (
          <button className="btn btn-lg btn-secondary" onClick={handleBuyNow} disabled={loading || buyNowLoading}>
            {buyNowLoading ? "Yönlendiriliyor..." : "Hemen Al"}
          </button>
        )}
      </div>
      {message && <p style={{ marginTop: "0.5rem", fontSize: "0.9rem" }}>{message}</p>}
    </div>

    {/* bkz. kullanıcı isteği (tasarım brief'i, 2026-08-02): "Mobil görünümde
        alt kısımda sabit (sticky) satın alma barı" - sadece mobilde (bkz.
        globals.css @media max-width:768px), fiyat + tek dokunuşla sepete
        ekleme her zaman ekranda kalsın diye. Aynı handleClick'i kullanır ki
        yukarıdaki butonla state/davranış tutarlı olsun. */}
    <div className="mobile-sticky-buy">
      <div className="mobile-sticky-buy-price">
        <span className="price-current">{price.toLocaleString("tr-TR", { minimumFractionDigits: 2 })} ₺</span>
      </div>
      <button
        className={`btn btn-lg ${justAdded ? "btn-added" : "btn-primary"}`}
        onClick={handleClick}
        disabled={loading || buyNowLoading || outOfStock}
      >
        {outOfStock ? "Stokta Yok" : justAdded ? "Eklendi" : loading ? "Ekleniyor..." : "Sepete Ekle"}
      </button>
    </div>
    </>
  );
}
