import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { putObject } from "./storage";

const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

export class InvalidImageError extends Error {}

// Yüklenen görsel her zaman WebP'ye çevrilip tek, optimize bir boyutta
// (maks. 1600px) kaydedilir - orijinal dosya hiç saklanmaz. Bu hem yer
// kazandırır hem de dosyaya gömülü olabilecek fazladan veriyi (EXIF vb.)
// piksel verisinden yeniden kodlayarak temizler. İşlenmiş görsel depoya
// (local disk veya S3) storage katmanı üzerinden yazılır (bkz. lib/storage.ts)
// - sürücü env ile seçilir, çağıran kod aynı kalır.
//
// `subdir` çağırana göre değişir: satıcı ürünleri "products/{vendorId}",
// site içeriği (slider/banner) "site/{kategori}" gibi - obje anahtarı bu
// önekle oluşur, hangi görselin neye ait olduğunu isimden anlaşılır kılar.
export async function saveImage(subdir: string, buffer: Buffer, mimetype: string): Promise<string> {
  if (!ALLOWED_MIME.has(mimetype)) {
    throw new InvalidImageError("Desteklenmeyen dosya türü. İzin verilenler: JPEG, PNG, WebP, GIF");
  }

  const metadata = await sharp(buffer, { failOn: "none" }).metadata();
  if (!metadata.width || !metadata.height) {
    throw new InvalidImageError("Geçersiz veya bozuk görsel dosyası");
  }

  const id = randomUUID();
  const webp = await sharp(buffer)
    .rotate()
    .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer();

  return putObject(`${subdir}/${id}.webp`, webp, "image/webp");
}
