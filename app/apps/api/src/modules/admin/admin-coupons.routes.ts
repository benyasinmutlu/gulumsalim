import { FastifyPluginAsync } from "fastify";
import { createCoupon, listCoupons, updateCoupon } from "../orders/coupon.repository";
import { couponIdParamsSchema, createCouponSchema, updateCouponSchema } from "./admin-coupons.schemas";

// bkz. kullanıcı isteği: "kupon kodu... admin panelde kontrol edebilelim" -
// admin oluşturur/düzenler/pasifleştirir. Hard DELETE yok - bir kupon
// kullanılmış olabilir (coupon_redemptions/orders FK'leri), bu yüzden
// sadece isActive:false ile "pasifleştirme" desteklenir (ürün/mağaza
// status alanlarındaki soft-disable deseniyle aynı).
const adminCouponsRoutes: FastifyPluginAsync = async (app) => {
  app.get("/admin/coupons", { preHandler: app.requireAdmin }, async (_request, reply) => {
    return reply.send(await listCoupons());
  });

  app.post("/admin/coupons", { preHandler: [app.requireAdmin, app.csrfProtection] }, async (request, reply) => {
    const input = createCouponSchema.parse(request.body);
    const coupon = await createCoupon({
      code: input.code,
      type: input.type,
      value: input.value.toFixed(2),
      minOrderAmount: input.minOrderAmount?.toFixed(2),
      maxUsesTotal: input.maxUsesTotal,
      maxUsesPerCustomer: input.maxUsesPerCustomer,
      startsAt: input.startsAt ? new Date(input.startsAt) : undefined,
      endsAt: input.endsAt ? new Date(input.endsAt) : undefined,
      isActive: input.isActive,
      isFeatured: input.isFeatured,
    });
    return reply.status(201).send(coupon);
  });

  app.patch("/admin/coupons/:id", { preHandler: [app.requireAdmin, app.csrfProtection] }, async (request, reply) => {
    const { id } = couponIdParamsSchema.parse(request.params);
    const input = updateCouponSchema.parse(request.body);
    const coupon = await updateCoupon(id, {
      ...(input.type !== undefined && { type: input.type }),
      ...(input.value !== undefined && { value: input.value.toFixed(2) }),
      ...(input.minOrderAmount !== undefined && { minOrderAmount: input.minOrderAmount === null ? null : input.minOrderAmount.toFixed(2) }),
      ...(input.maxUsesTotal !== undefined && { maxUsesTotal: input.maxUsesTotal }),
      ...(input.maxUsesPerCustomer !== undefined && { maxUsesPerCustomer: input.maxUsesPerCustomer }),
      ...(input.startsAt !== undefined && { startsAt: input.startsAt === null ? null : new Date(input.startsAt) }),
      ...(input.endsAt !== undefined && { endsAt: input.endsAt === null ? null : new Date(input.endsAt) }),
      ...(input.isActive !== undefined && { isActive: input.isActive }),
      ...(input.isFeatured !== undefined && { isFeatured: input.isFeatured }),
    });
    if (!coupon) return reply.status(404).send({ error: { message: "Kupon bulunamadı" } });
    return reply.send(coupon);
  });
};

export default adminCouponsRoutes;
