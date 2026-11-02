const LEGACY_CATEGORY_REDIRECTS: Readonly<Record<string, string>> = {
  "ayakkabi-canta": "cantalar",
  elbiseler: "elbise",
  bluzlar: "ust-giyim",
  pantolonlar: "alt-giyim",
  etekler: "alt-giyim",
  ceketler: "dis-giyim",
  aksesuarlar: "aksesuar",
};

export function resolveLegacyCategorySlug(slug: string): string | null {
  return LEGACY_CATEGORY_REDIRECTS[slug] ?? null;
}
