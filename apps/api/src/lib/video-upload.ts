import { randomUUID } from "node:crypto";
import { putObject } from "./storage";

export class InvalidVideoError extends Error {}

const ALLOWED_VIDEO_MIME: Record<string, string> = {
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
};

function hasIsoBaseMediaHeader(buffer: Buffer): boolean {
  return buffer.length >= 12 && buffer.subarray(4, 8).toString("ascii") === "ftyp";
}

function hasWebmHeader(buffer: Buffer): boolean {
  return buffer.length >= 4 && buffer[0] === 0x1a && buffer[1] === 0x45 && buffer[2] === 0xdf && buffer[3] === 0xa3;
}

export function isSupportedVideoContent(buffer: Buffer, mimetype: string): boolean {
  if (mimetype === "video/webm") return hasWebmHeader(buffer);
  if (mimetype === "video/mp4" || mimetype === "video/quicktime") return hasIsoBaseMediaHeader(buffer);
  return false;
}

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
  if (!isSupportedVideoContent(buffer, mimetype)) {
    throw new InvalidVideoError("Dosya içeriği seçilen video türüyle eşleşmiyor veya video bozuk");
  }
  const id = randomUUID();
  return putObject(`${subdir}/${id}.${ext}`, buffer, mimetype);
}
