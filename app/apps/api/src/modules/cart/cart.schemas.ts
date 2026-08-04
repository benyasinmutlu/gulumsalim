import { z } from "zod";

// "productId:variantId" formatında virgülle ayrılmış kalem anahtarları
// (bkz. cart.service.ts lineKey) - GET /cart?selected= için.
export const cartQuerySchema = z.object({
  selected: z.string().optional(),
});

export const addToCartSchema = z.object({
  productId: z.number().int().positive(),
  variantId: z.number().int().positive().optional(),
  quantity: z.number().int().positive().max(20).default(1),
});

export const updateCartItemSchema = z.object({
  productId: z.number().int().positive(),
  variantId: z.number().int().positive().optional(),
  quantity: z.number().int().min(0).max(20),
});

export const removeCartItemSchema = z.object({
  productId: z.number().int().positive(),
  variantId: z.number().int().positive().optional(),
});

export const applyCouponSchema = z.object({
  code: z.string().trim().min(3).max(30),
});
