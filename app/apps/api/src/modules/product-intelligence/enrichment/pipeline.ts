import type { NormalizedProduct } from "../types";
import type { EnrichmentContext, EnrichmentNeed, EnrichmentProvider, EnrichmentResult } from "./providers/provider";
import { ruleProvider } from "./providers/rule-provider";
import { mlProvider } from "./providers/ml-provider";
import { createAiProvider } from "./providers/ai-provider";

const DEFAULT_TIMEOUT_MS = 8000;

export interface EnrichOptions {
  needs?: EnrichmentNeed[];
  timeoutMs?: number;
  providers?: EnrichmentProvider[];
}

// Varsayılan katman seti (öncelik sırasına göre pipeline sıralar).
export function defaultProviders(): EnrichmentProvider[] {
  return [createAiProvider(), mlProvider, ruleProvider];
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("enrichment timeout")), ms);
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}

function isNonEmptyAttrs(a: Record<string, string> | undefined): a is Record<string, string> {
  return !!a && Object.keys(a).length > 0;
}

// Ürünü katmanlar arasında kademeli (cascade) zenginleştirir. Her ihtiyaç için
// AKTİF katmanları öncelik sırasıyla dener; ilk BOŞ-OLMAYAN sonuç kazanır. Bir
// katman hata/timeout verirse sıradakine düşülür (reliability). AI kapalıysa
// otomatik ML/RULE'a düşer. Hiçbiri sonuç vermezse o ihtiyaç boş kalır - kayıt
// ASLA bloklanmaz (zenginleştirme her zaman opsiyoneldir).
export async function enrichProduct(
  p: NormalizedProduct,
  ctx: EnrichmentContext,
  opts: EnrichOptions = {},
): Promise<EnrichmentResult> {
  const needs = opts.needs ?? ["category", "description", "attributes"];
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const providers = (opts.providers ?? defaultProviders()).filter((x) => x.isEnabled()).sort((a, b) => a.priority - b.priority);

  const result: EnrichmentResult = { sources: {} };

  for (const need of needs) {
    for (const provider of providers) {
      try {
        if (need === "category" && provider.suggestCategory) {
          const v = await withTimeout(provider.suggestCategory(p, ctx), timeoutMs);
          if (v && v.value != null) {
            result.category = v;
            result.sources.category = provider.name;
            break;
          }
        } else if (need === "description" && provider.generateDescription) {
          const v = await withTimeout(provider.generateDescription(p, ctx), timeoutMs);
          if (v && v.value != null) {
            result.description = v;
            result.sources.description = provider.name;
            break;
          }
        } else if (need === "attributes" && provider.extractAttributes) {
          const v = await withTimeout(provider.extractAttributes(p, ctx), timeoutMs);
          if (isNonEmptyAttrs(v)) {
            result.attributes = v;
            result.sources.attributes = provider.name;
            break;
          }
        }
      } catch {
        // Bu katman patladı/timeout -> sıradaki katmana düş (graceful).
        continue;
      }
    }
  }

  return result;
}
