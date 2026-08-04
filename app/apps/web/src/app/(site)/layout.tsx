import SiteNav from "../../components/site-nav";
import SiteFooter from "../../components/site-footer";
import { CategoryNavProvider } from "../../components/category-nav-context";
import SiteFeedbackWidget from "../../components/site-feedback-widget";
import CookieConsentBanner from "../../components/cookie-consent-banner";
import MobileBottomNav from "../../components/mobile-bottom-nav";

// Müşteri tarafı sayfalarının (anasayfa, ürün, sepet, giriş/kayıt, mağaza vb.)
// ortak header/footer'ı burada - admin ve satıcı paneli bu route group'un
// DIŞINDA olduğu için bu header/footer'ı hiç görmüyor (eski sitede de admin/
// satıcı panelleri tamamen ayrı, header/footer'sız sayfalardı).
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <CategoryNavProvider>
      <SiteNav />
      <div className="site-mobile-nav-pad">{children}</div>
      <SiteFooter />
      <SiteFeedbackWidget />
      <CookieConsentBanner />
      <MobileBottomNav />
    </CategoryNavProvider>
  );
}
