import { InvalidImageError, saveImage } from "../../lib/image-upload";

export { InvalidImageError };

export async function saveProductImage(vendorId: number, buffer: Buffer, mimetype: string): Promise<string> {
  return saveImage(`products/${vendorId}`, buffer, mimetype);
}
