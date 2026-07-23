import { desc, eq } from "drizzle-orm";
import { db } from "../../db/client";
import { customers, vendorComplaints, vendors } from "../../db/schema/index";

export async function insertVendorComplaint(data: { vendorId: number; customerId: number; reason: string; message: string }) {
  const [row] = await db.insert(vendorComplaints).values(data).returning();
  if (!row) throw new Error("Şikayet kaydedilemedi");
  return row;
}

export async function listAllComplaints() {
  return db
    .select({
      id: vendorComplaints.id,
      vendorId: vendorComplaints.vendorId,
      vendorStoreName: vendors.storeName,
      customerName: customers.fullName,
      reason: vendorComplaints.reason,
      message: vendorComplaints.message,
      status: vendorComplaints.status,
      adminNote: vendorComplaints.adminNote,
      createdAt: vendorComplaints.createdAt,
    })
    .from(vendorComplaints)
    .innerJoin(vendors, eq(vendorComplaints.vendorId, vendors.id))
    .innerJoin(customers, eq(vendorComplaints.customerId, customers.id))
    .orderBy(desc(vendorComplaints.createdAt));
}

export async function updateComplaintStatus(id: number, status: "reviewed" | "dismissed", adminNote?: string) {
  const [row] = await db
    .update(vendorComplaints)
    .set({ status, adminNote: adminNote ?? null })
    .where(eq(vendorComplaints.id, id))
    .returning({ id: vendorComplaints.id });
  return row ?? null;
}

export async function countPendingComplaints() {
  const rows = await db.select({ id: vendorComplaints.id }).from(vendorComplaints).where(eq(vendorComplaints.status, "pending"));
  return rows.length;
}
