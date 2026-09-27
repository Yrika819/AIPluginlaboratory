export function normalizeText(input) {
  return String(input)
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[\t ]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function dedupeLines(input, { caseSensitive = true } = {}) {
  const seen = new Set();
  const result = [];

  for (const line of String(input).replace(/\r\n?/g, "\n").split("\n")) {
    const key = caseSensitive ? line : line.toLocaleLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      result.push(line);
    }
  }

  return result.join("\n");
}

export function sortLines(input, { descending = false, caseSensitive = false } = {}) {
  const lines = String(input).replace(/\r\n?/g, "\n").split("\n");
  const collator = new Intl.Collator(undefined, {
    sensitivity: caseSensitive ? "variant" : "base",
    numeric: true,
  });

  lines.sort((a, b) => collator.compare(a, b));
  if (descending) lines.reverse();
  return lines.join("\n");
}

export function formatJson(input, spaces = 2) {
  return JSON.stringify(JSON.parse(String(input)), null, spaces);
}

export function minifyJson(input) {
  return JSON.stringify(JSON.parse(String(input)));
}

export function encodeUrl(input) {
  return encodeURIComponent(String(input));
}

export function decodeUrl(input) {
  return decodeURIComponent(String(input));
}

function bytesToBinary(bytes) {
  let out = "";
  for (const byte of bytes) out += String.fromCharCode(byte);
  return out;
}

function binaryToBytes(binary) {
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

export function encodeBase64(input) {
  const bytes = new TextEncoder().encode(String(input));
  if (typeof btoa === "function") return btoa(bytesToBinary(bytes));
  return Buffer.from(bytes).toString("base64");
}

export function decodeBase64(input) {
  const source = String(input).replace(/\s+/g, "");
  const binary = typeof atob === "function"
    ? atob(source)
    : Buffer.from(source, "base64").toString("binary");
  return new TextDecoder("utf-8", { fatal: true }).decode(binaryToBytes(binary));
}

export function textStats(input) {
  const text = String(input);
  const trimmed = text.trim();
  const words = trimmed ? trimmed.split(/\s+/u).length : 0;
  const lines = text.length === 0 ? 0 : text.replace(/\r\n?/g, "\n").split("\n").length;

  return {
    characters: [...text].length,
    words,
    lines,
    bytes: new TextEncoder().encode(text).length,
  };
}
