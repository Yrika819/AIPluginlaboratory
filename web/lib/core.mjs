export function normalizeText(input) {
  return String(input)
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[\t ]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function dedupeLines(input, { caseSensitive = true, dropEmpty = false } = {}) {
  const seen = new Set();
  const result = [];
  for (const line of String(input).replace(/\r\n?/g, "\n").split("\n")) {
    if (dropEmpty && line.length === 0) continue;
    const key = caseSensitive ? line : line.toLocaleLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      result.push(line);
    }
  }
  return result.join("\n");
}

export function sortLines(input, { descending = false, caseSensitive = false, dropEmpty = false } = {}) {
  const lines = String(input)
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .filter((line) => !dropEmpty || line.length > 0);
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

export function textStats(input) {
  const text = String(input);
  const trimmed = text.trim();
  return {
    characters: [...text].length,
    words: trimmed ? trimmed.split(/\s+/u).length : 0,
    lines: text.length === 0 ? 0 : text.replace(/\r\n?/g, "\n").split("\n").length,
    bytes: new TextEncoder().encode(text).length,
  };
}

export function convertLineEndings(input, style = "lf") {
  const normalized = String(input).replace(/\r\n?/g, "\n");
  if (style === "crlf") return normalized.replace(/\n/g, "\r\n");
  if (style === "cr") return normalized.replace(/\n/g, "\r");
  return normalized;
}

export function slugify(input) {
  return String(input)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

export function toTitleCase(input) {
  return String(input).replace(/\p{L}[\p{L}\p{M}'’-]*/gu, (word) => {
    const chars = [...word];
    return (chars[0]?.toLocaleUpperCase() ?? "") + chars.slice(1).join("").toLocaleLowerCase();
  });
}

export function trimLines(input) {
  return String(input)
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .join("\n");
}

export function removeBlankLines(input) {
  return String(input)
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .join("\n");
}
