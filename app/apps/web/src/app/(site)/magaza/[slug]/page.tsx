import { redirect } from "next/navigation";

interface Props {
  params: Promise<{ slug: string }>;
}

// gulumsalim.com'daki .htaccess kuralı: "^magaza/([slug])/?$ -> /$1 [R=301,L]"
// - mağaza sayfası artık kök seviyeli temiz URL'de yaşıyor (bkz.
// (site)/[slug]/page.tsx), bu eski adres sadece oraya yönlendiriyor.
export default async function LegacyStorefrontRedirect({ params }: Props) {
  const { slug } = await params;
  redirect(`/${slug}`);
}
