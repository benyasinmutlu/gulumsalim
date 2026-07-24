import { describe, expect, it } from "vitest";
import {
  canTransition,
  InvalidTryOnTransitionError,
  mockTryOnAdapter,
  transition,
  TRY_ON_MAX_UPLOAD_BYTES,
  validateUploadDescriptor,
  type TryOnJob,
} from "./contract";

function job(status: TryOnJob["status"]): TryOnJob {
  return {
    id: "job-1",
    customerId: 5,
    status,
    createdAt: 0,
    expiresAt: 3600,
    consentToProcess: true,
    garmentProductId: 7,
  };
}

describe("try-on state machine", () => {
  it("allows valid transitions", () => {
    expect(canTransition("created", "uploaded")).toBe(true);
    expect(transition(job("uploaded"), "processing").status).toBe("processing");
    expect(canTransition("processing", "completed")).toBe(true);
  });

  it("rejects invalid transitions", () => {
    expect(canTransition("completed", "processing")).toBe(false);
    expect(() => transition(job("failed"), "processing")).toThrow(InvalidTryOnTransitionError);
    expect(() => transition(job("created"), "completed")).toThrow();
  });
});

describe("validateUploadDescriptor", () => {
  it("accepts an allowed image within size bounds", () => {
    expect(validateUploadDescriptor({ mime: "image/jpeg", byteSize: 1024 })).toEqual({ ok: true });
  });
  it("rejects an unsupported mime (e.g. svg/html spoof)", () => {
    expect(validateUploadDescriptor({ mime: "image/svg+xml", byteSize: 1024 })).toEqual({
      ok: false,
      reason: "unsupported_mime",
    });
  });
  it("rejects oversize and empty uploads", () => {
    expect(validateUploadDescriptor({ mime: "image/png", byteSize: TRY_ON_MAX_UPLOAD_BYTES + 1 }).ok).toBe(false);
    expect(validateUploadDescriptor({ mime: "image/png", byteSize: 0 }).ok).toBe(false);
  });
});

describe("mockTryOnAdapter", () => {
  it("returns an approximate result referencing the job (no real AI)", async () => {
    const res = await mockTryOnAdapter().process({
      jobId: "job-1",
      personImageRef: "priv/person",
      garmentImageRef: "priv/garment",
    });
    expect(res.approximate).toBe(true);
    expect(res.resultImageRef).toContain("job-1");
  });
});
