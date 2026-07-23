import SectionsManager from "./sections-manager";

export default function AdminHomepageSectionsPage() {
  return (
    <div>
      <p style={{ fontSize: "0.85rem", color: "var(--admin-text-muted)", marginBottom: "1rem" }}>
        Ana sayfada, sabit bölümlerin (Kategoriler, Kampanyalar, Keşfet) altında sırayla gösterilen ek ürün
        vitrinleri. Sadece dolu (ürün üreten) bölümler sitede görünür.
      </p>
      <SectionsManager />
    </div>
  );
}
