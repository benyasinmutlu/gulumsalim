import { permanentRedirect } from "next/navigation";

interface Props {
  params: Promise<{ slug: string }>;
}

// /kategori/{slug} artık kalıcı olarak kök seviyeye taşındı (bkz. kullanıcı
// isteği: "/kategori/elbiseler şeklinde olmasın direkt /elbiseler olsun" -
// karşılığı [slug]/page.tsx'teki kategori çözümlemesi). Eski bağlantılar/
// arama motoru kayıtları kırılmasın diye burası 308 kalıcı yönlendirme yapar.
export default async function LegacyCategoryRedirect({ params }: Props) {
  const { slug } = await params;
  permanentRedirect(`/${slug}`);
}
