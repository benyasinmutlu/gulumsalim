import { z } from "zod";

// bkz. kullanıcı isteği (2026-08-02): "bireysel satıcıları admin panelinden
// ayrı yönetelim" - mevcut durum filtresinin yanına tür filtresi eklendi.
export const vendorStatusFilterSchema = z.object({
  status: z.enum(["pending", "active", "suspended", "banned"]).optional(),
  vendorType: z.enum(["business", "individual"]).optional(),
});

export const updateVendorStatusSchema = z.object({
  action: z.enum(["approve", "activate", "suspend", "ban"]),
});

export const vendorIdParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

// bkz. kullanıcı isteği: "her satıcıya admin üzerinden farklı komisyon
// oranları belirlenebilecek" - null gönderilirse platform varsayılanına
// (bkz. vendor-orders.service.ts DEFAULT_COMMISSION_RATE) döner.
export const updateVendorCommissionSchema = z.object({
  commissionRate: z.number().min(0).max(100).nullable(),
});
