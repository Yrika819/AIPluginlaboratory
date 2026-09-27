import { gzipSync, gunzipSync, unzipSync, zipSync } from "fflate";

export const MAX_IN_MEMORY_BYTES = 512 * 1024 * 1024;

export function assertMemorySize(size, label = "File") {
  if (!Number.isFinite(size) || size < 0) throw new Error("Invalid file size.");
  if (size > MAX_IN_MEMORY_BYTES) {
    throw new Error(`${label} is larger than the 512 MiB in-memory safety limit.`);
  }
}

export function formatBytes(bytes) {
  const size = Number(bytes);
  if (!Number.isFinite(size) || size < 0) return "—";
  if (size < 1024) return `${size} B`;
  const units = ["KiB", "MiB", "GiB", "TiB"];
  let value = size;
  let unit = -1;
  do {
    value /= 1024;
    unit += 1;
  } while (value >= 1024 && unit < units.length - 1);
  return `${value >= 100 ? value.toFixed(0) : value >= 10 ? value.toFixed(1) : value.toFixed(2)} ${units[unit]}`;
}

export function safeArchivePath(input) {
  const parts = String(input)
    .replace(/\\/g, "/")
    .replace(/^[A-Za-z]:/, "")
    .split("/")
    .filter((part) => part && part !== "." && part !== "..");
  return parts.join("/");
}

export function uniqueName(name, used) {
  const safe = safeArchivePath(name) || "file";
  if (!used.has(safe)) {
    used.add(safe);
    return safe;
  }
  const slash = safe.lastIndexOf("/");
  const dir = slash >= 0 ? safe.slice(0, slash + 1) : "";
  const base = slash >= 0 ? safe.slice(slash + 1) : safe;
  const dot = base.lastIndexOf(".");
  const stem = dot > 0 ? base.slice(0, dot) : base;
  const ext = dot > 0 ? base.slice(dot) : "";
  let index = 2;
  let candidate;
  do {
    candidate = `${dir}${stem} (${index})${ext}`;
    index += 1;
  } while (used.has(candidate));
  used.add(candidate);
  return candidate;
}

export function zipEntries(entries, level = 6) {
  const used = new Set();
  const archive = {};
  for (const entry of entries) {
    const data = entry.data instanceof Uint8Array ? entry.data : new Uint8Array(entry.data);
    assertMemorySize(data.byteLength, entry.name || "File");
    archive[uniqueName(entry.name || "file", used)] = data;
  }
  return zipSync(archive, { level: Math.max(0, Math.min(9, Number(level) || 0)) });
}

export function unzipEntries(data) {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  assertMemorySize(bytes.byteLength, "Archive");
  const output = unzipSync(bytes);
  const used = new Set();
  return Object.entries(output)
    .filter(([name]) => !name.endsWith("/"))
    .map(([name, value]) => ({
      name: uniqueName(name, used),
      data: value,
    }));
}

export function gzipBytes(data, level = 6) {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  assertMemorySize(bytes.byteLength);
  return gzipSync(bytes, { level: Math.max(0, Math.min(9, Number(level) || 0)) });
}

export function gunzipBytes(data) {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  assertMemorySize(bytes.byteLength);
  return gunzipSync(bytes);
}

export async function hashBytes(data, algorithm = "SHA-256") {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  assertMemorySize(bytes.byteLength);
  const digest = await globalThis.crypto.subtle.digest(algorithm, bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function bytesToBase64(data) {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  if (typeof btoa === "function") {
    let binary = "";
    const step = 0x8000;
    for (let i = 0; i < bytes.length; i += step) {
      binary += String.fromCharCode(...bytes.subarray(i, i + step));
    }
    return btoa(binary);
  }
  return Buffer.from(bytes).toString("base64");
}

export function base64ToBytes(input) {
  const source = String(input).replace(/\s+/g, "");
  if (typeof atob === "function") {
    const binary = atob(source);
    return Uint8Array.from(binary, (char) => char.charCodeAt(0));
  }
  return Uint8Array.from(Buffer.from(source, "base64"));
}

export function replaceExtension(name, extension) {
  const safe = safeArchivePath(name).split("/").pop() || "file";
  const dot = safe.lastIndexOf(".");
  const stem = dot > 0 ? safe.slice(0, dot) : safe;
  const ext = String(extension).replace(/^\./, "");
  return ext ? `${stem}.${ext}` : stem;
}

export function splitBytes(data, chunkSize) {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  const size = Math.floor(Number(chunkSize));
  if (!Number.isFinite(size) || size <= 0) throw new Error("Chunk size must be greater than zero.");
  const chunks = [];
  for (let offset = 0; offset < bytes.length; offset += size) {
    chunks.push(bytes.slice(offset, offset + size));
  }
  return chunks;
}

export function joinBytes(chunks) {
  const arrays = chunks.map((value) => value instanceof Uint8Array ? value : new Uint8Array(value));
  const total = arrays.reduce((sum, value) => sum + value.length, 0);
  assertMemorySize(total, "Combined file");
  const output = new Uint8Array(total);
  let offset = 0;
  for (const value of arrays) {
    output.set(value, offset);
    offset += value.length;
  }
  return output;
}
