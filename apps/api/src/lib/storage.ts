import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type { S3Client } from "@aws-sdk/client-s3";
import { env } from "../config/env";

// Tek merkezi obje deposu. Görsel/video pipeline'ları işlenmiş veriyi buraya
// verir; sürücüye göre (local disk veya AWS S3) kaydedip herkese açık URL
// döneriz. S3'e geçiş SADECE ortam değişkenleriyle olur (STORAGE_DRIVER=s3 +
// S3_* değerleri) - uygulama kodu değişmeden. Env yoksa local'de kalır, yani
// mevcut davranış birebir korunur.

let s3ClientPromise: Promise<S3Client> | null = null;

function localObjectPath(key: string): string {
  const base = path.resolve(env.UPLOADS_DIR);
  const target = path.resolve(base, key);
  if (target !== base && !target.startsWith(`${base}${path.sep}`)) {
    throw new Error("Geçersiz storage anahtarı");
  }
  return target;
}

function requireS3Config() {
  const { S3_BUCKET, S3_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY } = env;
  if (!S3_BUCKET || !S3_REGION || !AWS_ACCESS_KEY_ID || !AWS_SECRET_ACCESS_KEY) {
    throw new Error(
      "STORAGE_DRIVER=s3 ama S3_BUCKET / S3_REGION / AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY eksik",
    );
  }
  return { S3_BUCKET, S3_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY };
}

// @aws-sdk/client-s3 yalnızca S3 sürücüsü aktifken (lazy) yüklenir - local'de
// hiç import edilmez, ekstra bağımlılık maliyeti yok.
async function getS3(): Promise<S3Client> {
  if (!s3ClientPromise) {
    const cfg = requireS3Config();
    s3ClientPromise = import("@aws-sdk/client-s3").then(
      ({ S3Client }) =>
        new S3Client({
          region: cfg.S3_REGION,
          credentials: { accessKeyId: cfg.AWS_ACCESS_KEY_ID, secretAccessKey: cfg.AWS_SECRET_ACCESS_KEY },
        }),
    );
  }
  return s3ClientPromise;
}

function s3PublicUrl(key: string): string {
  const cfg = requireS3Config();
  const base = env.S3_PUBLIC_URL?.replace(/\/+$/, "") ?? `https://${cfg.S3_BUCKET}.s3.${cfg.S3_REGION}.amazonaws.com`;
  return `${base}/${key}`;
}

// key ör. "products/12/uuid.webp" (baştaki slash olmadan). İşlenmiş dosyayı
// depoya yazar ve herkese açık URL döndürür.
export async function putObject(key: string, body: Buffer, contentType: string): Promise<string> {
  const cleanKey = key.replace(/^\/+/, "");

  if (env.STORAGE_DRIVER === "s3") {
    const cfg = requireS3Config();
    const { PutObjectCommand } = await import("@aws-sdk/client-s3");
    const client = await getS3();
    await client.send(
      new PutObjectCommand({
        Bucket: cfg.S3_BUCKET,
        Key: cleanKey,
        Body: body,
        ContentType: contentType,
        CacheControl: "public, max-age=31536000, immutable",
      }),
    );
    return s3PublicUrl(cleanKey);
  }

  // local (varsayılan): UPLOADS_DIR altına yaz, /uploads/... döndür.
  const filePath = localObjectPath(cleanKey);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, body);
  return `/uploads/${cleanKey}`;
}

// Bir objeyi (görsel/video) depodan siler - ürün görseli/videosu silinince ya
// da değişince eski dosya arkada "orphan" kalmasın diye. En iyi çaba (best
// effort): silme başarısız olsa bile çağıran isteği bozmaz. Hem eski local
// (/uploads/..) hem S3 (http) URL'lerini ele alır, böylece sürücü S3'e
// geçtikten sonra bile eski local dosyalar temizlenebilir.
export async function deleteObject(publicUrl: string): Promise<void> {
  if (!publicUrl) return;
  try {
    if (publicUrl.startsWith("/uploads/")) {
      const rel = publicUrl.replace(/^\/uploads\//, "");
      await rm(localObjectPath(rel), { force: true });
      return;
    }
    if (/^https?:\/\//i.test(publicUrl) && env.STORAGE_DRIVER === "s3") {
      const cfg = requireS3Config();
      const key = new URL(publicUrl).pathname.replace(/^\/+/, "");
      if (key) {
        const { DeleteObjectCommand } = await import("@aws-sdk/client-s3");
        const client = await getS3();
        await client.send(new DeleteObjectCommand({ Bucket: cfg.S3_BUCKET, Key: key }));
      }
    }
  } catch {
    /* orphan kalması kritik değil; isteği bozma */
  }
}
