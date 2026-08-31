import { desc, eq } from "drizzle-orm";
import { db } from "../../db/client";
import { adminAuditLog, adminUsers } from "../../db/schema/index";

// bkz. denetim raporu: "İşlem logları" - admin panelindeki en hassas/geri
// döndürülemez kararların (satıcı onayı/yasaklama, ürün moderasyonu, iade/
// ödeme kararı) kalıcı kaydı. Ateşle-unut DEĞİL (bilerek await edilir) -
// bir denetim kaydının, kaydı tetikleyen işlemden daha az güvenilir olması
// kabul edilemez.
export async function recordAdminAction(
  adminId: number,
  action: string,
  entityType: string,
  entityId: number | null,
  summary: string,
): Promise<void> {
  await db.insert(adminAuditLog).values({ adminId, action, entityType, entityId, summary });
}

export async function listAdminAuditLog(limit = 100) {
  return db
    .select({
      id: adminAuditLog.id,
      action: adminAuditLog.action,
      entityType: adminAuditLog.entityType,
      entityId: adminAuditLog.entityId,
      summary: adminAuditLog.summary,
      createdAt: adminAuditLog.createdAt,
      adminName: adminUsers.fullName,
    })
    .from(adminAuditLog)
    .innerJoin(adminUsers, eq(adminAuditLog.adminId, adminUsers.id))
    .orderBy(desc(adminAuditLog.createdAt))
    .limit(limit);
}
