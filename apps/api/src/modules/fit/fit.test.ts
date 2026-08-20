import { describe, expect, it } from "vitest";
import { sizeLabelToNumeric, numericToLetter, measurementsForSize } from "./size-chart";
import { bodyFromProfile } from "./anthropometry";
import { fitConfigForCategory, matchFit, normalizeProductChart } from "./fit-matcher";
import { aggregateFeedback, learnedChart, mergeCharts, verdictToDeltaCm, isFitVerdict } from "./feedback";
import { computeFit } from "./index";

describe("size-chart", () => {
  it("etiket → numara (harf + sayı + normalize)", () => {
    expect(sizeLabelToNumeric("M")).toBe(38);
    expect(sizeLabelToNumeric(" s ")).toBe(36);
    expect(sizeLabelToNumeric("40")).toBe(40);
    expect(sizeLabelToNumeric("2XL")).toBe(44);
    expect(sizeLabelToNumeric("48")).toBe(46); // aralık dışı → en yakın
    expect(sizeLabelToNumeric("xyz")).toBeNull();
  });
  it("numara → harf", () => expect(numericToLetter(38)).toBe("M"));
  it("standart ölçü", () => expect(measurementsForSize(38)).toEqual({ bust: 90, waist: 72, hip: 98 }));
});

describe("bodyFromProfile", () => {
  it("her zamanki beden anchor (yüksek güven)", () => {
    const b = bodyFromProfile({ kadinBeden: ["M"] })!;
    expect(b.size).toBe(38);
    expect(b.source).toBe("usual_size");
    expect(b.confidence).toBeGreaterThanOrEqual(0.7);
    expect(b.bust).toBe(90);
  });
  it("çoklu beden ortalaması (S+L → M)", () => {
    expect(bodyFromProfile({ kadinBeden: ["S", "L"] })!.size).toBe(38);
  });
  it("beden yok, boy/kilo var → tahmin (düşük güven)", () => {
    const b = bodyFromProfile({ heightCm: 168, weightKg: 60 })!;
    expect(b.source).toBe("estimated");
    expect(b.confidence).toBeLessThan(0.6);
    expect(b.size).toBeGreaterThanOrEqual(34);
  });
  it("BMI rafinasyonu: aynı beden, dolgun → bel artar", () => {
    const ince = bodyFromProfile({ kadinBeden: ["M"], heightCm: 175, weightKg: 58 })!;
    const dolgun = bodyFromProfile({ kadinBeden: ["M"], heightCm: 160, weightKg: 72 })!;
    expect(dolgun.waist).toBeGreaterThan(ince.waist);
  });
  it("hiçbir sinyal yok → null", () => {
    expect(bodyFromProfile({})).toBeNull();
  });
});

describe("fitConfigForCategory", () => {
  it("elbise → 3 ölçü + boy", () => expect(fitConfigForCategory("Abiye Elbise")).toEqual({ dims: ["bust", "waist", "hip"], hasLength: true }));
  it("pantolon → bel+kalça + boy", () => expect(fitConfigForCategory("Kadın Pantolon")).toEqual({ dims: ["waist", "hip"], hasLength: true }));
  it("bluz → göğüs+bel, boy yok", () => expect(fitConfigForCategory("Bluz")).toEqual({ dims: ["bust", "waist"], hasLength: false }));
});

describe("matchFit", () => {
  const body = bodyFromProfile({ kadinBeden: ["M"], heightCm: 168 })!; // 38 anchor
  it("en yakın bedeni önerir (M)", () => {
    const r = matchFit(body, ["S", "M", "L"], fitConfigForCategory("bluz"))!;
    expect(r.recommendedSizeNumeric).toBe(38);
    expect(r.recommendedSize).toBe("M");
  });
  it("boyut-boyut fit: M vücuduna M ürün → tam", () => {
    const r = matchFit(body, ["M"], fitConfigForCategory("bluz"))!;
    expect(r.dimensions.every((d) => d.status === "fits")).toBe(true);
  });
  it("sadece büyük beden varsa → bol (loose) işaretler", () => {
    const r = matchFit(body, ["XXL"], fitConfigForCategory("bluz"))!;
    expect(r.dimensions.some((d) => d.status === "loose")).toBe(true);
  });
  it("uzun boy → elbisede 'short' notu", () => {
    const tall = bodyFromProfile({ kadinBeden: ["M"], heightCm: 182 })!;
    const r = matchFit(tall, ["M"], fitConfigForCategory("elbise"))!;
    expect(r.lengthNote).toBe("short");
  });
  it("ürün bedeni yok → null", () => {
    expect(matchFit(body, [], fitConfigForCategory("bluz"))).toBeNull();
  });
});

describe("Faz 4 — satıcı ürüne-özel tablo (productChart)", () => {
  const body = bodyFromProfile({ kadinBeden: ["M"], heightCm: 168 })!; // 38, göğüs 90

  it("normalizeProductChart: etiket→numara + geçersiz eler", () => {
    const out = normalizeProductChart({ M: { bust: 86 }, L: { bust: 99999 }, XX: { bust: 90 } });
    expect(out).toEqual({ 38: { bust: 86 } }); // L (aralık dışı) ve XX (etiket) elendi
  });

  it("dar kalıp: M ürün göğüs 86 (standart 90 yerine) → M artık DAR", () => {
    const chart = { 38: { bust: 86 } };
    const std = matchFit(body, ["M"], fitConfigForCategory("bluz"))!;
    const small = matchFit(body, ["M"], fitConfigForCategory("bluz"), chart)!;
    expect(std.dimensions.find((d) => d.dimension === "bust")!.status).toBe("fits");
    expect(small.dimensions.find((d) => d.dimension === "bust")!.status).toBe("tight");
  });

  it("dar kalıp öneriyi büyütür: kalıp bir beden küçükse üst beden önerilir", () => {
    // Ürünün her bedeni standarttan bir beden küçük (göğüs+bel) → L artık M vücuduna uyar.
    const chart = { 36: { bust: 82, waist: 64 }, 38: { bust: 86, waist: 68 }, 40: { bust: 90, waist: 72 } };
    const r = matchFit(body, ["S", "M", "L"], fitConfigForCategory("bluz"), chart)!;
    expect(r.recommendedSizeNumeric).toBe(40); // vücut 90/72 → dar kalıpta L öneriliyor
  });

  it("boş/geçersiz tablo → standart davranış", () => {
    expect(normalizeProductChart(null)).toBeUndefined();
    expect(normalizeProductChart({})).toBeUndefined();
  });
});

describe("Faz 5 — öğrenen katman (feedback)", () => {
  it("karar → delta yönü: dar negatif, bol pozitif, tam sıfır", () => {
    expect(verdictToDeltaCm("dar")).toBeLessThan(0);
    expect(verdictToDeltaCm("bol")).toBeGreaterThan(0);
    expect(verdictToDeltaCm("tam")).toBe(0);
    expect(isFitVerdict("dar")).toBe(true);
    expect(isFitVerdict("xxl")).toBe(false);
  });

  it("aggregate: yeterli örnek yoksa (< MIN) o beden yok sayılır", () => {
    const rows = [
      { sizeNumeric: 38, verdict: "dar" as const },
      { sizeNumeric: 38, verdict: "dar" as const },
    ];
    expect(aggregateFeedback(rows)).toEqual({}); // 2 örnek < 3
  });

  it("aggregate: çoğunluk 'dar' → o beden için negatif kayma", () => {
    const rows = [
      { sizeNumeric: 38, verdict: "dar" as const },
      { sizeNumeric: 38, verdict: "dar" as const },
      { sizeNumeric: 38, verdict: "cok_dar" as const },
    ];
    const agg = aggregateFeedback(rows);
    expect(agg[38]).toBeLessThan(0);
  });

  it("learnedChart: negatif kayma standart ölçüyü düşürür", () => {
    const chart = learnedChart({ 38: -2 })!;
    // standart 38 göğüs 90 → öğrenilmiş 88
    expect(chart[38]!.bust).toBe(88);
  });

  it("öğrenilmiş kalıp fit'i etkiler: hep 'çok dar' gelen M artık DAR işaretlenir", () => {
    const body = bodyFromProfile({ kadinBeden: ["M"], heightCm: 168 })!; // 38, göğüs 90
    const rows = Array(4).fill({ sizeNumeric: 38, verdict: "cok_dar" as const });
    const learned = learnedChart(aggregateFeedback(rows)); // 38 göğüs 90 → ~87
    const std = matchFit(body, ["M"], fitConfigForCategory("bluz"))!;
    const smart = matchFit(body, ["M"], fitConfigForCategory("bluz"), learned)!;
    expect(std.dimensions.find((d) => d.dimension === "bust")!.status).toBe("fits");
    expect(smart.dimensions.find((d) => d.dimension === "bust")!.status).toBe("tight");
  });

  it("mergeCharts: satıcının açık ölçüsü öğrenilmişi ezer (boyut-bazında)", () => {
    const learned = { 38: { bust: 88, waist: 70, hip: 96 } };
    const vendor = { 38: { bust: 92 } }; // sadece göğüs
    const merged = mergeCharts(learned, vendor)!;
    expect(merged[38]).toEqual({ bust: 92, waist: 70, hip: 96 }); // göğüs satıcı, gerisi öğrenilmiş
  });

  it("mergeCharts: biri yoksa diğerini döner", () => {
    expect(mergeCharts(undefined, { 38: { bust: 90 } })).toEqual({ 38: { bust: 90 } });
    expect(mergeCharts({ 40: { hip: 100 } }, undefined)).toEqual({ 40: { hip: 100 } });
  });
});

describe("computeFit (orkestratör)", () => {
  it("ölçü yok → no_measurements", () => {
    expect(computeFit({}, ["M"], "bluz").status).toBe("no_measurements");
  });
  it("ürün bedeni yok → no_sizes", () => {
    expect(computeFit({ kadinBeden: ["M"] }, [], "bluz").status).toBe("no_sizes");
  });
  it("tam sonuç → ok + öneri + skor", () => {
    const out = computeFit({ kadinBeden: ["M"], heightCm: 168, weightKg: 60 }, ["S", "M", "L"], "bluz");
    expect(out.status).toBe("ok");
    if (out.status === "ok") {
      expect(out.result.recommendedSize).toBe("M");
      expect(out.result.score).toBeGreaterThan(0);
      expect(out.anchor.source).toBe("usual_size");
    }
  });
});
