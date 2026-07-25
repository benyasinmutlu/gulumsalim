type VendorStatus = "pending" | "active" | "suspended" | "banned";

export function isVendorSessionAllowed(status: VendorStatus | null): boolean {
  return status === "pending" || status === "active";
}
