import { describe, expect, it } from "vitest";
import { isSupportedVideoContent } from "./video-upload";

describe("video content signature", () => {
  it("accepts ISO base media for MP4/MOV and EBML for WebM", () => {
    const iso = Buffer.from([0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d]);
    const webm = Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0x01]);
    expect(isSupportedVideoContent(iso, "video/mp4")).toBe(true);
    expect(isSupportedVideoContent(iso, "video/quicktime")).toBe(true);
    expect(isSupportedVideoContent(webm, "video/webm")).toBe(true);
  });

  it("rejects MIME spoofing and mismatched containers", () => {
    expect(isSupportedVideoContent(Buffer.from("<script>alert(1)</script>"), "video/mp4")).toBe(false);
    expect(isSupportedVideoContent(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]), "video/mp4")).toBe(false);
    expect(isSupportedVideoContent(Buffer.from([0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70]), "video/webm")).toBe(false);
  });
});
