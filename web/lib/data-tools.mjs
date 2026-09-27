import YAML from "yaml";

export function detectDelimiter(input) {
  const firstLines = String(input)
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .filter((line) => line.trim())
    .slice(0, 5);

  const candidates = [",", "\t", ";", "|"];
  let best = ",";
  let bestScore = -1;
  for (const candidate of candidates) {
    const counts = firstLines.map((line) => countOutsideQuotes(line, candidate));
    if (counts.length === 0) continue;
    const min = Math.min(...counts);
    const max = Math.max(...counts);
    const score = min > 0 && min === max ? min * 10 : counts.reduce((a, b) => a + b, 0);
    if (score > bestScore) {
      best = candidate;
      bestScore = score;
    }
  }
  return best;
}

function countOutsideQuotes(line, delimiter) {
  let count = 0;
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    if (line[i] === '"') {
      if (quoted && line[i + 1] === '"') i += 1;
      else quoted = !quoted;
    } else if (!quoted && line[i] === delimiter) {
      count += 1;
    }
  }
  return count;
}

export function parseDelimited(input, delimiter = "auto") {
  const source = String(input).replace(/\r\n?/g, "\n");
  const sep = delimiter === "auto" ? detectDelimiter(source) : delimiter;
  if (sep.length !== 1) throw new Error("Delimiter must be one character.");

  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    if (quoted) {
      if (char === '"') {
        if (source[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      if (field.length !== 0) throw new Error("Unexpected quote in delimited data.");
      quoted = true;
    } else if (char === sep) {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }

  if (quoted) throw new Error("Unclosed quoted field.");
  if (field.length > 0 || row.length > 0 || source.endsWith(sep)) {
    row.push(field);
    rows.push(row);
  }
  return { delimiter: sep, rows };
}

function makeUniqueHeaders(headers) {
  const used = new Map();
  return headers.map((value, index) => {
    const base = String(value || `column_${index + 1}`).trim() || `column_${index + 1}`;
    const count = used.get(base) ?? 0;
    used.set(base, count + 1);
    return count === 0 ? base : `${base}_${count + 1}`;
  });
}

export function delimitedToObjects(input, delimiter = "auto") {
  const { delimiter: detected, rows } = parseDelimited(input, delimiter);
  if (rows.length === 0) return { delimiter: detected, data: [] };
  const headers = makeUniqueHeaders(rows[0]);
  const data = rows.slice(1)
    .filter((row) => row.some((value) => value.length > 0))
    .map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ""])));
  return { delimiter: detected, data };
}

function quoteCell(value, delimiter) {
  const text = value == null ? "" : typeof value === "object" ? JSON.stringify(value) : String(value);
  if (text.includes('"') || text.includes(delimiter) || /[\r\n]/.test(text)) {
    return '"' + text.replace(/"/g, '""') + '"';
  }
  return text;
}

export function objectsToDelimited(value, delimiter = ",") {
  const data = typeof value === "string" ? JSON.parse(value) : value;
  if (!Array.isArray(data)) throw new Error("JSON must be an array.");
  if (data.length === 0) return "";

  const rows = data.map((item) => {
    if (item == null || Array.isArray(item) || typeof item !== "object") {
      throw new Error("Each array item must be a JSON object.");
    }
    return item;
  });

  const headers = [];
  const seen = new Set();
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      if (!seen.has(key)) {
        seen.add(key);
        headers.push(key);
      }
    }
  }

  return [
    headers.map((cell) => quoteCell(cell, delimiter)).join(delimiter),
    ...rows.map((row) => headers.map((key) => quoteCell(row[key], delimiter)).join(delimiter)),
  ].join("\n");
}

export function jsonToYaml(input) {
  return YAML.stringify(JSON.parse(String(input)), {
    indent: 2,
    lineWidth: 0,
  });
}

export function yamlToJson(input, spaces = 2) {
  const value = YAML.parse(String(input));
  return JSON.stringify(value, null, spaces);
}

export function queryStringToJson(input) {
  const source = String(input).trim();
  let query = source;
  try {
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(source)) query = new URL(source).search;
  } catch {
    // Treat invalid URLs as raw query strings.
  }
  query = query.replace(/^\?/, "");

  const params = new URLSearchParams(query);
  const result = {};
  for (const [key, value] of params) {
    if (Object.hasOwn(result, key)) {
      result[key] = Array.isArray(result[key]) ? [...result[key], value] : [result[key], value];
    } else {
      result[key] = value;
    }
  }
  return JSON.stringify(result, null, 2);
}
