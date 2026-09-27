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

function asBytes(data) {
  return data instanceof Uint8Array ? data : new Uint8Array(data);
}

function findZipEndOfCentralDirectory(bytes) {
  const minimum = 22;
  if (bytes.length < minimum) throw new Error("Invalid ZIP archive.");
  const start = Math.max(0, bytes.length - 65_557);
  for (let offset = bytes.length - minimum; offset >= start; offset -= 1) {
    if (
      bytes[offset] === 0x50 &&
      bytes[offset + 1] === 0x4b &&
      bytes[offset + 2] === 0x05 &&
      bytes[offset + 3] === 0x06
    ) {
      return offset;
    }
  }
  throw new Error("ZIP central directory was not found.");
}

export function inspectZip(data) {
  const bytes = asBytes(data);
  assertMemorySize(bytes.byteLength, "Archive");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const eocd = findZipEndOfCentralDirectory(bytes);
  const entries = view.getUint16(eocd + 10, true);
  const centralSize = view.getUint32(eocd + 12, true);
  const centralOffset = view.getUint32(eocd + 16, true);

  if (entries === 0xffff || centralSize === 0xffffffff || centralOffset === 0xffffffff) {
    throw new Error("ZIP64 archives are not supported by the safety preflight.");
  }
  if (centralOffset + centralSize > bytes.length) {
    throw new Error("ZIP central directory points outside the archive.");
  }

  let offset = centralOffset;
  let totalUncompressed = 0;
  const declared = [];

  for (let index = 0; index < entries; index += 1) {
    if (offset + 46 > bytes.length || view.getUint32(offset, true) !== 0x02014b50) {
      throw new Error("Invalid ZIP central directory entry.");
    }

    const compressedSize = view.getUint32(offset + 20, true);
    const uncompressedSize = view.getUint32(offset + 24, true);
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);

    if (compressedSize === 0xffffffff || uncompressedSize === 0xffffffff) {
      throw new Error("ZIP64 entries are not supported by the safety preflight.");
    }

    assertMemorySize(uncompressedSize, "Archive entry");
    totalUncompressed += uncompressedSize;
    assertMemorySize(totalUncompressed, "Expanded archive");

    declared.push({ compressedSize, uncompressedSize });
    offset += 46 + nameLength + extraLength + commentLength;
  }

  if (offset > centralOffset + centralSize) {
    throw new Error("ZIP central directory is malformed.");
  }

  return {
    entries,
    compressedBytes: bytes.byteLength,
    uncompressedBytes: totalUncompressed,
    declared,
  };
}

export function zipEntries(entries, level = 6) {
  const used = new Set();
  const archive = {};
  let total = 0;
  for (const entry of entries) {
    const data = asBytes(entry.data);
    assertMemorySize(data.byteLength, entry.name || "File");
    total += data.byteLength;
    assertMemorySize(total, "Combined input");
    archive[uniqueName(entry.name || "file", used)] = data;
  }
  return zipSync(archive, { level: Math.max(0, Math.min(9, Number(level) || 0)) });
}

export function unzipEntries(data) {
  const bytes = asBytes(data);
  inspectZip(bytes);
  const output = unzipSync(bytes);
  const used = new Set();
  let total = 0;
  return Object.entries(output)
    .filter(([name]) => !name.endsWith("/"))
    .map(([name, value]) => {
      total += value.byteLength;
      assertMemorySize(total, "Expanded archive");
      return {
        name: uniqueName(name, used),
        data: value,
      };
    });
}

export function gzipBytes(data, level = 6) {
  const bytes = asBytes(data);
  assertMemorySize(bytes.byteLength);
  return gzipSync(bytes, { level: Math.max(0, Math.min(9, Number(level) || 0)) });
}

export function inspectGzip(data) {
  const bytes = asBytes(data);
  assertMemorySize(bytes.byteLength, "Archive");
  if (bytes.length < 18 || bytes[0] !== 0x1f || bytes[1] !== 0x8b || bytes[2] !== 8) {
    throw new Error("Invalid GZIP archive.");
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const declaredSize = view.getUint32(bytes.length - 4, true);
  assertMemorySize(declaredSize, "Expanded GZIP");
  return { compressedBytes: bytes.byteLength, declaredUncompressedBytes: declaredSize };
}

export function gunzipBytes(data) {
  const bytes = asBytes(data);
  inspectGzip(bytes);
  const output = gunzipSync(bytes);
  assertMemorySize(output.byteLength, "Expanded GZIP");
  return output;
}

export async function hashBytes(data, algorithm = "SHA-256") {
  const bytes = asBytes(data);
  assertMemorySize(bytes.byteLength);
  const digest = await globalThis.crypto.subtle.digest(algorithm, bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function bytesToBase64(data) {
  const bytes = asBytes(data);
  assertMemorySize(bytes.byteLength);
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
  let source = String(input).replace(/\s+/g, "");
  if (!source) return new Uint8Array();
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(source)) throw new Error("Invalid Base64 input.");
  const remainder = source.length % 4;
  if (remainder === 1) throw new Error("Invalid Base64 length.");
  if (remainder > 0) source += "=".repeat(4 - remainder);

  let result;
  if (typeof atob === "function") {
    const binary = atob(source);
    result = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  } else {
    result = Uint8Array.from(Buffer.from(source, "base64"));
  }
  assertMemorySize(result.byteLength, "Decoded file");
  return result;
}

export function replaceExtension(name, extension) {
  const safe = safeArchivePath(name).split("/").pop() || "file";
  const dot = safe.lastIndexOf(".");
  const stem = dot > 0 ? safe.slice(0, dot) : safe;
  const ext = String(extension).replace(/^\./, "");
  return ext ? `${stem}.${ext}` : stem;
}

export function splitBytes(data, chunkSize) {
  const bytes = asBytes(data);
  assertMemorySize(bytes.byteLength);
  const size = Math.floor(Number(chunkSize));
  if (!Number.isFinite(size) || size <= 0) throw new Error("Chunk size must be greater than zero.");
  const chunks = [];
  for (let offset = 0; offset < bytes.length; offset += size) {
    chunks.push(bytes.slice(offset, offset + size));
  }
  return chunks;
}

export function joinBytes(chunks) {
  const arrays = chunks.map(asBytes);
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
