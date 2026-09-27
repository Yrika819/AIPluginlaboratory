import { describe, expect, test } from "vitest";
import {
  base64ToBytes,
  bytesToBase64,
  formatBytes,
  gzipBytes,
  gunzipBytes,
  hashBytes,
  joinBytes,
  replaceExtension,
  safeArchivePath,
  splitBytes,
  uniqueName,
  unzipEntries,
  zipEntries,
} from "../../web/lib/file-tools.mjs";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

describe("file tools", () => {
  test("ZIP round trips multiple entries", () => {
    const zip = zipEntries([
      { name: "hello.txt", data: encoder.encode("hello") },
      { name: "folder/data.json", data: encoder.encode('{"ok":true}') },
    ]);
    const entries = unzipEntries(zip);
    expect(entries.map((entry) => entry.name)).toEqual(["hello.txt", "folder/data.json"]);
    expect(decoder.decode(entries[0].data)).toBe("hello");
  });

  test("ZIP sanitizes unsafe paths and duplicate names", () => {
    const zip = zipEntries([
      { name: "../../secret.txt", data: encoder.encode("a") },
      { name: "secret.txt", data: encoder.encode("b") },
    ]);
    const names = unzipEntries(zip).map((entry) => entry.name);
    expect(names).toEqual(["secret.txt", "secret (2).txt"]);
  });

  test("GZIP round trips bytes", () => {
    const source = encoder.encode("PocketBench ".repeat(100));
    expect(gunzipBytes(gzipBytes(source))).toEqual(source);
  });

  test("computes standard SHA-256", async () => {
    expect(await hashBytes(encoder.encode("hello"), "SHA-256"))
      .toBe("2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824");
  });

  test("Base64 round trips binary data", () => {
    const source = Uint8Array.from([0, 1, 2, 127, 128, 255]);
    expect(base64ToBytes(bytesToBase64(source))).toEqual(source);
  });

  test("splits and joins losslessly", () => {
    const source = Uint8Array.from({ length: 25 }, (_, index) => index);
    const chunks = splitBytes(source, 7);
    expect(chunks.map((chunk) => chunk.length)).toEqual([7, 7, 7, 4]);
    expect(joinBytes(chunks)).toEqual(source);
  });

  test("sanitizes archive paths and extensions", () => {
    expect(safeArchivePath("../a/../../b.txt")).toBe("a/b.txt");
    expect(replaceExtension("photo.original.png", "webp")).toBe("photo.original.webp");
  });

  test("creates stable unique names", () => {
    const used = new Set();
    expect(uniqueName("a.txt", used)).toBe("a.txt");
    expect(uniqueName("a.txt", used)).toBe("a (2).txt");
  });

  test("formats byte sizes", () => {
    expect(formatBytes(1000)).toBe("1000 B");
    expect(formatBytes(1024)).toBe("1.00 KiB");
    expect(formatBytes(10 * 1024 * 1024)).toBe("10.0 MiB");
  });
});
