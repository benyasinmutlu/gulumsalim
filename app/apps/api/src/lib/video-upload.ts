import { randomUUID } from "node:crypto";
import { putObject } from "./storage";

export class InvalidVideoError extends Error {}

const ALLOWED_VIDEO_MIME: Record<string, string> = {
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
};

// Ürün tanıtım videosu: görsellerin aksine yeniden kodlanmaz (sharp yok),
// doğrudan storage katmanına (S3/local) yazılır. Boyut sınırı multipart
// eklentisinde uygulanır (plugins/upload.ts, 50MB). MP4/WebM/MOV kabul edilir.
// `subdir` ör. "videos/{vendorId}" - obje anahtarı bu önekle oluşur.
export async function saveVideo(subdir: string, buffer: Buffer, mimetype: string): Promise<string> {
  const ext = ALLOWED_VIDEO_MIME[mimetype];
  if (!ext) {
    throw new InvalidVideoError("Desteklenmeyen video türü. İzin verilenler: MP4, WebM, MOV");
  }
  if (buffer.length === 0) {
    throw new InvalidVideoError("Boş video dosyası");
  }
  const id = randomUUID();
  return putObject(`${subdir}/${id}.${ext}`, buffer, mimetype);
}
