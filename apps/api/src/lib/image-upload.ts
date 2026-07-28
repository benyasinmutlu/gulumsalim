import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { env } from "../config/env";

const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

export class InvalidImageError extends Error {}

// Yüklenen görsel her zaman WebP'ye çevrilip tek, optimize bir boyutta
// kaydedilir (maks. 1600px) - orijinal dosya diskte hiç tutulmaz. Bu hem
// yer kazandırır hem de dosyaya gömülü olabilecek fazladan veriyi
// (EXIF vb.) piksel verisinden yeniden kodlayarak temizler. Liste/kart
// görünümü için ayrı bir küçük boyut şimdilik yok - gerçek trafik verisi
// bunu gerektirdiğinde eklenecek.
//
// `subdir` çağırana göre değişir: satıcı ürünleri "products/{vendorId}",
// site içeriği (slider/banner) "site/{kategori}" gibi - diskteki klasör
// yapısı hangi görselin neye ait olduğunu isimden anlaşılır kılar.
export async function saveImage(subdir: string, buffer: Buffer, mimetype: string): Promise<string> {
  if (!ALLOWED_MIME.has(mimetype)) {
    throw new InvalidImageError("Desteklenmeyen dosya türü. İzin verilenler: JPEG, PNG, WebP, GIF");
  }

  const metadata = await sharp(buffer, { failOn: "none" }).metadata();
  if (!metadata.width || !metadata.height) {
    throw new InvalidImageError("Geçersiz veya bozuk görsel dosyası");
  }

  const id = randomUUID();
  const dir = path.join(env.UPLOADS_DIR, subdir);
  await mkdir(dir, { recursive: true });
  const filePath = path.join(dir, `${id}.webp`);

  await sharp(buffer)
    .rotate()
    .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 82 })
    .toFile(filePath);

  return `/uploads/${subdir}/${id}.webp`;
}
