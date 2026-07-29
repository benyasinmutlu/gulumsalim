import { beforeEach, describe, expect, it, vi } from "vitest";

// Repository (db'ye dokunur) ve mailer (SMTP) mock'lanır - bu test infra
// gerektirmeden servis dallanma mantığını doğrular.
vi.mock("./vendor-orders.repository", () => ({ getShippedItemNotificationData: vi.fn() }));
vi.mock("../../lib/mailer", () => ({ sendMail: vi.fn() }));

import { getShippedItemNotificationData } from "./vendor-orders.repository";
import { sendMail } from "../../lib/mailer";
import { sendShippingNotification } from "./shipping-notification.service";

const mockedFetch = vi.mocked(getShippedItemNotificationData);
const mockedSend = vi.mocked(sendMail);

const complete = {
  customerEmail: "musteri@example.com",
  orderNumber: "GS-2026-000123",
  productNameSnapshot: "Çiçekli Elbise",
  quantity: 1,
  trackingCarrier: "Aras Kargo",
  trackingNumber: "TR-9",
};

beforeEach(() => vi.clearAllMocks());

describe("sendShippingNotification", () => {
  it("sends exactly one email to the customer with an order-number subject", async () => {
    mockedFetch.mockResolvedValue(complete);
    const ok = await sendShippingNotification(10);
    expect(ok).toBe(true);
    expect(mockedSend).toHaveBeenCalledTimes(1);
    const [to, subject, html] = mockedSend.mock.calls[0]!;
    expect(to).toBe("musteri@example.com");
    expect(subject).toContain("GS-2026-000123");
    expect(html).toContain("TR-9");
  });

  it("does not send when the order item is not found", async () => {
    mockedFetch.mockResolvedValue(null);
    expect(await sendShippingNotification(10)).toBe(false);
    expect(mockedSend).not.toHaveBeenCalled();
  });

  it("does not send when tracking info is missing (defensive)", async () => {
    mockedFetch.mockResolvedValue({ ...complete, trackingCarrier: null, trackingNumber: null });
    expect(await sendShippingNotification(10)).toBe(false);
    expect(mockedSend).not.toHaveBeenCalled();
  });
});
