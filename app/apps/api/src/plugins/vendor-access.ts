type VendorStatus = "pending" | "active" | "suspended" | "banned" | "closed";

export function isVendorSessionAllowed(status: VendorStatus | null): boolean {
  return status === "pending" || status === "active";
}
