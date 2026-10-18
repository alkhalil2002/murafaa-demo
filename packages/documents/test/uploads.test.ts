import { describe, expect, it } from "vitest";
import {
  docKindForMime,
  MAX_PORTAL_UPLOAD_BYTES,
  MAX_UPLOAD_BYTES,
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
