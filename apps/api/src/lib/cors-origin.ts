function normalizeHttpOrigin(value: string) {
  const url = new URL(value);

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(`CORS origin yalnız HTTP(S) olabilir: ${value}`);
  }

  return url.origin;
}

export function buildCorsAllowlist(siteUrl: string, configuredOrigins?: string) {
  const origins = [siteUrl, ...(configuredOrigins?.split(",") ?? [])]
    .map((value) => value.trim())
    .filter(Boolean)
    .map(normalizeHttpOrigin);

  return new Set(origins);
}

export function isCorsOriginAllowed(origin: string | undefined, allowlist: ReadonlySet<string>) {
  // Origin içermeyen curl, health-check ve sunucudan sunucuya istekler CORS
  // kapsamında değildir; tarayıcı origin'leri ise açık allowlist gerektirir.
  return origin === undefined || allowlist.has(origin);
}
