import { z } from "zod";

const INTERNAL_BASE = "https://gulumsalim.invalid";

export function normalizePublicLink(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^[\\/]{2}/.test(trimmed)) return null;

  try {
    const parsed = new URL(trimmed, INTERNAL_BASE);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    if (parsed.origin === INTERNAL_BASE) return `${parsed.pathname}${parsed.search}${parsed.hash}`;
    return parsed.toString();
  } catch {
    return null;
  }
}

export function normalizeExternalHttpUrl(value: string): string | null {
  try {
    const parsed = new URL(value.trim());
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

export const publicLinkUrlSchema = z
  .string()
  .max(2048)
  .refine((value) => normalizePublicLink(value) !== null, "Yalnız güvenli site içi veya HTTP(S) bağlantısı kullanılabilir");

export const externalHttpUrlSchema = z
  .string()
  .max(2048)
  .refine((value) => normalizeExternalHttpUrl(value) !== null, "Yalnız HTTP(S) bağlantısı kullanılabilir");
