import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../catalog/search-index.service", () => ({ reindexVendorProducts: vi.fn(() => Promise.resolve()) }));
vi.mock("../notifications/vendor-activation-notification.service", () => ({ notifyVendorActivated: vi.fn() }));
vi.mock("../vendors/vendor.repository", () => ({ findVendorById: vi.fn() }));
vi.mock("./admin-vendors.repository", () => ({
  deleteVendorIfNoBusinessHistory: vi.fn(),
  updateVendorStatus: vi.fn(),
}));

import { notifyVendorActivated } from "../notifications/vendor-activation-notification.service";
import { findVendorById } from "../vendors/vendor.repository";
import { updateVendorStatus } from "./admin-vendors.repository";
import { applyVendorAction, VendorStatusChangedError } from "./admin-vendors.service";

const pendingVendor = {
  id: 7,
  status: "pending",
  email: "magaza@example.com",
  fullName: "Mağaza Yetkilisi",
  storeName: "Örnek Mağaza",
  taxId: "1234567890",
  phone: "5555555555",
  legalAddress: "İstanbul",
  emailVerifiedAt: new Date(),
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(findVendorById).mockResolvedValue(pendingVendor as never);
  vi.mocked(updateVendorStatus).mockResolvedValue({ ...pendingVendor, status: "active" } as never);
});

describe("applyVendorAction approval", () => {
  it("claims only a pending application and sends the activation message", async () => {
    await applyVendorAction(7, "approve");

    expect(updateVendorStatus).toHaveBeenCalledWith(7, "active", "pending");
    expect(notifyVendorActivated).toHaveBeenCalledOnce();
  });

  it("does not send a duplicate message when another admin won the approval race", async () => {
    vi.mocked(updateVendorStatus).mockResolvedValue(null);

    await expect(applyVendorAction(7, "approve")).rejects.toBeInstanceOf(VendorStatusChangedError);
    expect(notifyVendorActivated).not.toHaveBeenCalled();
  });

  it("does not label a later account reactivation as a new membership approval", async () => {
    vi.mocked(findVendorById).mockResolvedValue({ ...pendingVendor, status: "suspended" } as never);

    await applyVendorAction(7, "activate");

    expect(updateVendorStatus).toHaveBeenCalledWith(7, "active", undefined);
    expect(notifyVendorActivated).not.toHaveBeenCalled();
  });
});
