import { beforeEach, describe, expect, it, vi } from "vitest";

const database = vi.hoisted(() => {
  const state = { owned: false };
  const deleteRows = vi.fn(() => ({
    where: vi.fn(() => ({
      returning: vi.fn(async () => [{ id: 44 }]),
    })),
  }));
  const tx = {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(async () => (state.owned ? [{ id: 44 }] : [])),
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

import { deleteCollection } from "./vendor-collections.repository";

describe("deleteCollection tenant isolation", () => {
  beforeEach(() => {
    database.state.owned = false;
    vi.clearAllMocks();
  });

  it("does not delete product links when the collection belongs to another vendor", async () => {
    await expect(deleteCollection(7, 44)).resolves.toBe(false);
    expect(database.deleteRows).not.toHaveBeenCalled();
  });

  it("deletes links and the collection after ownership is verified", async () => {
    database.state.owned = true;

    await expect(deleteCollection(7, 44)).resolves.toBe(true);
    expect(database.deleteRows).toHaveBeenCalledTimes(2);
  });
});
