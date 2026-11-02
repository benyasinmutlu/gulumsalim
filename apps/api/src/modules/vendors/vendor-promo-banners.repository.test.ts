import { beforeEach, describe, expect, it, vi } from "vitest";

const database = vi.hoisted(() => {
  const state = { owned: false };
  const deleteRows = vi.fn(() => ({
    where: vi.fn(() => ({
      returning: vi.fn(async () => [{ id: 17 }]),
    })),
  }));
  const tx = {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(() => ({
            for: vi.fn(async () => (state.owned ? [{ id: 17 }] : [])),
          })),
        })),
      })),
    })),
    delete: deleteRows,
  };

  return {
    state,
    tx,
    deleteRows,
    db: {
      transaction: vi.fn(async (callback: (transaction: typeof tx) => Promise<boolean>) => callback(tx)),
    },
  };
});

vi.mock("../../db/client", () => ({ db: database.db }));

import { deleteVendorPromoBanner } from "./vendor-promo-banners.repository";

describe("deleteVendorPromoBanner", () => {
  beforeEach(() => {
    database.state.owned = false;
    vi.clearAllMocks();
  });

  it("does not touch dependent rows when the banner belongs to another vendor", async () => {
    await expect(deleteVendorPromoBanner(7, 17)).resolves.toBe(false);
    expect(database.deleteRows).not.toHaveBeenCalled();
  });

  it("removes homepage links, analytics, images and the owned banner atomically", async () => {
    database.state.owned = true;

    await expect(deleteVendorPromoBanner(7, 17)).resolves.toBe(true);
    expect(database.deleteRows).toHaveBeenCalledTimes(4);
    expect(database.db.transaction).toHaveBeenCalledTimes(1);
  });
});
