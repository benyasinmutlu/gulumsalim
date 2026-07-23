import SiteNav from "../../components/site-nav";
import SiteFooter from "../../components/site-footer";
import { CategoryNavProvider } from "../../components/category-nav-context";
import SiteFeedbackWidget from "../../components/site-feedback-widget";

// Müşteri tarafı sayfalarının (anasayfa, ürün, sepet, giriş/kayıt, mağaza vb.)
// ortak header/footer'ı burada - admin ve satıcı paneli bu route group'un
// DIŞINDA olduğu için bu header/footer'ı hiç görmüyor (eski sitede de admin/
// satıcı panelleri tamamen ayrı, header/footer'sız sayfalardı).
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <CategoryNavProvider>
      <SiteNav />
      {children}
      <SiteFooter />
      <SiteFeedbackWidget />
    </CategoryNavProvider>
  );
}
