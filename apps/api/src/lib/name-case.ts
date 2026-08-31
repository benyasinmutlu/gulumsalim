// bkz. denetim raporu madde 6: "kullanıcı/satıcı isimleri standardize
// edilmeli" - "zeynep sümengen" gibi tamamen küçük harfle girilen adlar
// olduğu gibi kaydediliyordu. Türkçe'de İ/I çiftinin normal
// toUpperCase/toLowerCase ile bozulması klasik bir hata olduğu için
// (bkz. "i".toUpperCase() === "I", Türkçe'de "İ" olmalı) locale'e duyarlı
// tr-TR metodları kullanılır.
export function toTitleCaseTr(value: string): string {
  return value
    .split(/(\s+)/)
    .map((part) => {
      if (part.trim() === "") return part;
      const lower = part.toLocaleLowerCase("tr-TR");
      return lower.charAt(0).toLocaleUpperCase("tr-TR") + lower.slice(1);
    })
    .join("");
}
