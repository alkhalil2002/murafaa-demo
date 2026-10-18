import { describe, expect, it } from "vitest";
import {
  docKindForMime,
  MAX_PORTAL_UPLOAD_BYTES,
  MAX_UPLOAD_BYTES,
  contentMatchesMime,
  uploadRejection,
} from "../src/uploads.js";

describe("uploads", () => {
  it("maps MIME types to document kinds", () => {
    expect(docKindForMime("image/png")).toBe("IMAGE");
    expect(docKindForMime("application/pdf")).toBe("DOCUMENT");
    expect(docKindForMime("text/plain")).toBe("TEXT");
    expect(docKindForMime("application/msword")).toBe("FILE");
  });

  it("rejects disallowed types, empty files and oversize files per source", () => {
    expect(uploadRejection({ mime: "application/x-msdownload", bytes: 10 }, "staff")).toBe("type");
    expect(uploadRejection({ mime: "application/pdf", bytes: 0 }, "staff")).toBe("empty");
    expect(
      uploadRejection({ mime: "application/pdf", bytes: MAX_UPLOAD_BYTES }, "staff"),
    ).toBeNull();
    expect(
      uploadRejection({ mime: "application/pdf", bytes: MAX_PORTAL_UPLOAD_BYTES + 1 }, "portal"),
    ).toBe("size");
  });
});

describe("content sniffing", () => {
  const enc = (s: string) => new TextEncoder().encode(s);
  it("accepts real signatures and refuses mismatches", () => {
    expect(contentMatchesMime(enc("%PDF-1.7\n..."), "application/pdf")).toBe(true);
    expect(contentMatchesMime(enc("MZ\x90\x00"), "application/pdf")).toBe(false);
    expect(
      contentMatchesMime(
        new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]),
        "image/png",
      ),
    ).toBe(true);
    expect(contentMatchesMime(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]), "image/jpeg")).toBe(true);
    expect(contentMatchesMime(enc("RIFF\0\0\0\0WEBPVP8 "), "image/webp")).toBe(true);
    expect(
      contentMatchesMime(
        enc("PK\x03\x04"),
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ),
    ).toBe(true);
    expect(contentMatchesMime(enc("ملاحظات الجلسة"), "text/plain")).toBe(true);
    expect(contentMatchesMime(new Uint8Array([0x61, 0x00, 0x62]), "text/plain")).toBe(false);
    expect(contentMatchesMime(new Uint8Array([0xc3, 0x28]), "text/plain")).toBe(false);
    expect(contentMatchesMime(enc("x"), "application/zip")).toBe(false);
  });
});
