import { createHash } from "node:crypto";

// Ürünün "yakın-kopya" parmak izi: aynı satıcının aynı ürünü yanlışlıkla iki
// kez girmesini yakalamak için kararlı bir hash. Ad Türkçe-duyarlı küçük harfe
// indirilir, alfasayısal-dışı atılır, boşluklar sadeleşir; satıcı + normalize
// ad + sıralı nitelikler birleştirilip SHA-1'lenir.
export function productFingerprint(
  vendorId: number,
  name: string | null | undefined,
  attrs: Record<string, string | number | null | undefined> = {},
): string {
  const normName = (name ?? "")
    .toLocaleLowerCase("tr")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
  const attrPart = Object.keys(attrs)
    .sort()
    .map((k) => `${k}=${attrs[k] ?? ""}`)
    .join("&");
  const basis = `v${vendorId}|${normName}|${attrPart}`;
  return createHash("sha1").update(basis).digest("hex");
}
