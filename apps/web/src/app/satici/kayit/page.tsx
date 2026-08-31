import Link from "next/link";
import type { Metadata } from "next";
import VendorRegisterForm from "./register-form";
import { getSiteStats } from "@/lib/site-stats";
import { formatStatCount } from "@/lib/format-stat-count";

export const metadata: Metadata = { title: "Kurumsal Üyelik Başvurusu | Gülüm Şalım" };

export default async function VendorRegisterPage() {
  const stats = await getSiteStats();
  const customerPhrase = stats.customers > 0 ? `${formatStatCount(stats.customers)} müşteriye ulaşın` : "Müşterilerinize ulaşın";
  const buyerPhrase = stats.customers > 0 ? `${formatStatCount(stats.customers)} alıcıya anında ulaş` : "Alıcılara anında ulaş";
  return (
    <>
      <Link href="/" className="ga-back">
        <i className="fas fa-arrow-left" /> Ana Sayfa
      </Link>
      <div className="ga-wrap">
        <div className="ga-visual">
          <div className="ga-orb ga-orb1" />
          <div className="ga-orb ga-orb2" />
          <div className="ga-visual-inner">
            <Link href="/" className="ga-brand">
              <div className="ga-brand-icon">GS</div>
              <div className="ga-brand-name">Gülüm Şalım</div>
            </Link>
            <h1>{customerPhrase}</h1>
            <p>
              Kayıt sonrası mağazanız &quot;onay bekliyor&quot; durumunda oluşturulur — ürünleriniz admin onayından
              sonra yayınlanır.
            </p>
            <div className="ga-perks">
              <div className="ga-perk">
                <i className="fas fa-store" /> {buyerPhrase}
              </div>
              <div className="ga-perk">
                <i className="fas fa-bolt" /> Dakikalar içinde kurulan satıcı paneli
              </div>
              <div className="ga-perk">
                <i className="fas fa-wallet" /> Hızlı ve güvenli ödeme akışı
              </div>
            </div>
          </div>
        </div>

        <div className="ga-panel">
          <div className="ga-card">
            <div className="ga-tabs">
              <Link href="/kayit" className="ga-tab">
                Bireysel Üyelik
              </Link>
              <span className="ga-tab active">Kurumsal Üyelik</span>
            </div>

            <h2>Kurumsal Üyelik Başvurusu</h2>
            <p className="ga-sub">{stats.customers > 0 ? `${formatStatCount(stats.customers)} müşteriye ulaşmak için bugün başvurun.` : "Müşterilerinize ulaşmak için bugün başvurun."}</p>

            <VendorRegisterForm />

            {/* bkz. denetim raporu madde 15: "Komisyon oranı, ödeme takvimi,
                kargo/iade süreci, faturalandırma, yasaklı ürünler, bireysel/
                kurumsal farkı" - önceden sayfada hiçbiri yoktu, satıcı adayı
                bu bilgilere ancak kayıt formundaki onay modalında (ve orada
                da sadece sözleşme metni olarak) ulaşabiliyordu. */}
            <div className="ga-terms-summary">
              <h3>Nasıl Çalışır?</h3>
              <ul>
                <li>
                  <strong>Komisyon oranı:</strong> Platform her satıştan %{stats.defaultCommissionRate} komisyon alır
                  (bazı satıcılarla farklı oran için ayrıca anlaşılabilir).
                </li>
                <li>
                  <strong>Ödeme:</strong> Ürün teslim edildikten ve 14 günlük yasal cayma süresi geçtikten sonra net
                  bakiyeniz IBAN hesabınıza aktarılır.
                </li>
                <li>
                  <strong>Bireysel / Kurumsal fark:</strong> Kurumsal Mağaza stok/varyant yönetimi yapabilir ve
                  ürünlerini kendisi aktif eder; Bireysel Satıcı tekil (2. el dahil) ürün satar, ürünleri admin
                  onayından sonra yayınlanır.
                </li>
              </ul>
              <div className="ga-terms-links">
                <Link href="/satici-komisyon-politikasi" target="_blank">
                  Komisyon ve Ödeme Politikası
                </Link>
                <Link href="/yasakli-urunler-politikasi" target="_blank">
                  Yasaklı Ürünler Politikası
                </Link>
                <Link href="/satici-uyelik-sozlesmesi" target="_blank">
                  Satıcı Üyelik ve Hizmet Sözleşmesi
                </Link>
              </div>
            </div>

            <div className="ga-footer">
              Zaten kurumsal üye misiniz? <Link href="/satici/giris">Giriş Yapın</Link>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
