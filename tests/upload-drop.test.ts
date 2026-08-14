import { describe, expect, it } from "vitest";
import { UPLOAD_MIME_ALLOW, MAX_UPLOAD_BYTES } from "@/server/documents";

/**
 * The drop zone's local pre-checks, mirrored here.
 *
 * These exist to avoid pushing 25MB up the wire only to be refused. They are
 * NOT the security boundary: uploadDocument re-checks both, because a browser's
 * reported MIME type is a hint and a client can send whatever it likes.
 */
type Code = "UPLOAD_NO_FILE" | "UPLOAD_SIZE_REJECTED" | "UPLOAD_MIME_REJECTED" | null;

function preCheck(file: { size: number; type: string }): Code {
  if (file.size === 0) return "UPLOAD_NO_FILE";
  if (file.size > MAX_UPLOAD_BYTES) return "UPLOAD_SIZE_REJECTED";
  if (file.type && !UPLOAD_MIME_ALLOW.has(file.type)) return "UPLOAD_MIME_REJECTED";
  return null;
}

describe("drop-zone pre-checks", () => {
  it("accepts the formats a law office actually receives", () => {
    for (const type of [
      "application/pdf",
      "image/jpeg",
      "image/png",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ]) {
      expect(preCheck({ size: 1000, type })).toBeNull();
    }
  });

  it("rejects an executable dressed as an attachment", () => {
    expect(preCheck({ size: 1000, type: "application/x-msdownload" })).toBe("UPLOAD_MIME_REJECTED");
  });

  it("rejects an empty file", () => {
    expect(preCheck({ size: 0, type: "application/pdf" })).toBe("UPLOAD_NO_FILE");
  });

  it("rejects a file over the cap", () => {
    expect(preCheck({ size: MAX_UPLOAD_BYTES + 1, type: "application/pdf" })).toBe(
      "UPLOAD_SIZE_REJECTED",
    );
  });

  it("accepts a file exactly at the cap — the limit is inclusive", () => {
    expect(preCheck({ size: MAX_UPLOAD_BYTES, type: "application/pdf" })).toBeNull();
  });

  it("lets an unknown-type file through to the server rather than guessing", () => {
    // Browsers report "" for extensions they do not recognise. Refusing here
    // would block legitimate files the server would have accepted; the server
    // makes the real decision.
    expect(preCheck({ size: 1000, type: "" })).toBeNull();
  });

  it("size cap is 25MB, matching the hint shown to the user", () => {
    expect(MAX_UPLOAD_BYTES).toBe(25 * 1024 * 1024);
  });
});
