import { beforeEach, describe, expect, it, vi } from "vitest";

const database = vi.hoisted(() => {
  const state = { exists: false };
  const deleteRows = vi.fn(() => ({
    where: vi.fn(() => ({
      returning: vi.fn(async () => [{ id: 23 }]),
    })),
  }));
  const tx = {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(() => ({
            for: vi.fn(async () => (state.exists ? [{ id: 23 }] : [])),
          })),
        })),
      })),
    })),
    delete: deleteRows,
  };

  return {
    state,
    deleteRows,
    db: {
      transaction: vi.fn(async (callback: (transaction: typeof tx) => Promise<boolean>) => callback(tx)),
    },
  };
});

vi.mock("../../db/client", () => ({ db: database.db }));

import { deleteHomepageCollection } from "./admin-homepage-collections.repository";

describe("deleteHomepageCollection", () => {
  beforeEach(() => {
    database.state.exists = false;
    vi.clearAllMocks();
  });

  it("returns false without deleting memberships for a missing collection", async () => {
    await expect(deleteHomepageCollection(23)).resolves.toBe(false);
    expect(database.deleteRows).not.toHaveBeenCalled();
  });

  it("deletes memberships and parent in one transaction", async () => {
    database.state.exists = true;

    await expect(deleteHomepageCollection(23)).resolves.toBe(true);
    expect(database.deleteRows).toHaveBeenCalledTimes(2);
    expect(database.db.transaction).toHaveBeenCalledTimes(1);
  });
});
