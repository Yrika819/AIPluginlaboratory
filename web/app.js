import {
  convertLineEndings,
  decodeUrl,
  dedupeLines,
  encodeUrl,
  formatJson,
  minifyJson,
  normalizeText,
  removeBlankLines,
  slugify,
  sortLines,
  textStats,
  toTitleCase,
  trimLines,
} from "./lib/core.mjs";
import {
  delimitedToObjects,
  jsonToYaml,
  objectsToDelimited,
  queryStringToJson,
  yamlToJson,
} from "./lib/data-tools.mjs";
import {
  base64ToBytes,
  bytesToBase64,
  formatBytes,
  gzipBytes,
  gunzipBytes,
  hashBytes,
  joinBytes,
  splitBytes,
  unzipEntries,
  zipEntries,
} from "./lib/file-tools.mjs";
import { convertImage } from "./lib/image-tools.mjs";
import {
  downloadBlob,
  downloadText,
  readFileBytes,
  readFileText,
} from "./lib/downloads.mjs";

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

function setStatus(element, message, error = false) {
  element.textContent = message;
  element.classList.toggle("error", error);
}

async function copyText(value, status) {
  if (!value) {
    setStatus(status, "Nothing to copy", true);
    return;
  }
  try {
    await navigator.clipboard.writeText(value);
    setStatus(status, "Copied");
  } catch {
    setStatus(status, "Clipboard permission unavailable", true);
  }
}

async function pasteInto(element, status) {
  try {
    element.value = await navigator.clipboard.readText();
    element.dispatchEvent(new Event("input"));
    setStatus(status, "Pasted");
  } catch {
    setStatus(status, "Clipboard permission unavailable", true);
  }
}

function makeDownloadRow(name, blob, detail = "") {
  const row = document.createElement("div");
  row.className = "result-row";

  const meta = document.createElement("div");
  const title = document.createElement("strong");
  title.textContent = name;
  const info = document.createElement("span");
  info.textContent = detail || formatBytes(blob.size);
  meta.append(title, info);

  const button = document.createElement("button");
  button.className = "button secondary small";
  button.textContent = "Download";
  button.addEventListener("click", () => downloadBlob(blob, name));

  row.append(meta, button);
  return row;
}

function showTextResult(container, title, content) {
  container.replaceChildren();
  container.classList.remove("empty-state");
  const block = document.createElement("div");
  block.className = "text-result";
  const heading = document.createElement("strong");
  heading.textContent = title;
  const pre = document.createElement("pre");
  pre.textContent = content;
  block.append(heading, pre);
  container.append(block);
}

function initTabs() {
  $$(".tab").forEach((button) => {
    button.addEventListener("click", () => {
      const target = button.dataset.tab;
      $$(".tab").forEach((tab) => {
        const active = tab === button;
        tab.classList.toggle("active", active);
        tab.setAttribute("aria-selected", String(active));
      });
      $$(".workspace").forEach((panel) => {
        const active = panel.dataset.panel === target;
        panel.hidden = !active;
        panel.classList.toggle("active", active);
      });
      history.replaceState(null, "", "#" + target);
    });
  });

  const requested = location.hash.slice(1);
  if (requested) {
    const target = document.querySelector('.tab[data-tab="' + CSS.escape(requested) + '"]');
    if (target) target.click();
  }
}

let selectedFiles = [];
const fileInput = $("#fileInput");
const fileList = $("#fileList");
const fileResults = $("#fileResults");
const fileStatus = $("#fileStatus");

function renderFileList() {
  fileList.replaceChildren();
  if (selectedFiles.length === 0) {
    fileList.className = "file-list empty-state";
    fileList.textContent = "No files selected.";
    return;
  }

  fileList.className = "file-list";
  selectedFiles.forEach((file, index) => {
    const row = document.createElement("div");
    row.className = "file-row";
    const number = document.createElement("span");
    number.className = "file-index";
    number.textContent = String(index + 1);
    const meta = document.createElement("div");
    const name = document.createElement("strong");
    name.textContent = file.name;
    const details = document.createElement("span");
    details.textContent = formatBytes(file.size) + " · " + (file.type || "unknown type");
    meta.append(name, details);
    row.append(number, meta);
    fileList.append(row);
  });
}

function replaceSelectedFiles(files) {
  selectedFiles = [...files];
  renderFileList();
  setStatus(fileStatus, selectedFiles.length ? selectedFiles.length + " file(s) ready" : "Ready");
}

fileInput.addEventListener("change", () => replaceSelectedFiles(fileInput.files));
$("#clearFiles").addEventListener("click", () => {
  fileInput.value = "";
  replaceSelectedFiles([]);
  fileResults.className = "results empty-state";
  fileResults.textContent = "Generated files and hashes will appear here.";
});

const dropZone = $("#dropZone");
for (const type of ["dragenter", "dragover"]) {
  dropZone.addEventListener(type, (event) => {
    event.preventDefault();
    dropZone.classList.add("dragging");
  });
}
for (const type of ["dragleave", "drop"]) {
  dropZone.addEventListener(type, (event) => {
    event.preventDefault();
    dropZone.classList.remove("dragging");
  });
}
dropZone.addEventListener("drop", (event) => {
  if (event.dataTransfer?.files?.length) replaceSelectedFiles(event.dataTransfer.files);
});

async function getEntries(files = selectedFiles) {
  const entries = [];
  for (const file of files) {
    entries.push({ name: file.name, data: await readFileBytes(file) });
  }
  return entries;
}

async function handleZip() {
  if (!selectedFiles.length) throw new Error("Select at least one file.");
  const archive = zipEntries(await getEntries(), Number($("#compressionLevel").value));
  const blob = new Blob([archive], { type: "application/zip" });
  fileResults.replaceChildren(makeDownloadRow("pocketbench-files.zip", blob));
  fileResults.className = "results";
}

async function handleGzip() {
  const file = selectedFiles[0];
  if (!file) throw new Error("Select a file first.");
  const compressed = gzipBytes(await readFileBytes(file), Number($("#compressionLevel").value));
  const name = file.name + ".gz";
  fileResults.replaceChildren(makeDownloadRow(name, new Blob([compressed], { type: "application/gzip" })));
  fileResults.className = "results";
}

async function handleExtract() {
  if (!selectedFiles.length) throw new Error("Select a ZIP or GZIP file.");
  const rows = [];
  for (const file of selectedFiles) {
    const data = await readFileBytes(file);
    if (/\.zip$/i.test(file.name) || file.type === "application/zip") {
      const entries = unzipEntries(data);
      for (const entry of entries) {
        rows.push(makeDownloadRow(entry.name, new Blob([entry.data])));
      }
    } else if (/\.(gz|gzip)$/i.test(file.name) || file.type === "application/gzip") {
      const output = gunzipBytes(data);
      const name = file.name.replace(/\.(gz|gzip)$/i, "") || "decompressed-file";
      rows.push(makeDownloadRow(name, new Blob([output])));
    } else {
      throw new Error(file.name + " is not recognized as ZIP or GZIP.");
    }
  }
  fileResults.replaceChildren(...rows);
  fileResults.className = "results";
}

async function handleHashes() {
  if (!selectedFiles.length) throw new Error("Select at least one file.");
  const lines = [];
  for (const file of selectedFiles) {
    const bytes = await readFileBytes(file);
    const values = await Promise.all([
      hashBytes(bytes, "SHA-256"),
      hashBytes(bytes, "SHA-384"),
      hashBytes(bytes, "SHA-512"),
    ]);
    lines.push(
      file.name,
      "  SHA-256  " + values[0],
      "  SHA-384  " + values[1],
      "  SHA-512  " + values[2],
      "",
    );
  }
  showTextResult(fileResults, "Checksums", lines.join("\n").trim());
}

async function handleFileBase64() {
  const file = selectedFiles[0];
  if (!file) throw new Error("Select a file first.");
  const encoded = bytesToBase64(await readFileBytes(file));
  const blob = new Blob([encoded], { type: "text/plain;charset=utf-8" });
  fileResults.replaceChildren(
    makeDownloadRow(
      file.name + ".base64.txt",
      blob,
      encoded.length.toLocaleString() + " Base64 characters",
    ),
  );
  fileResults.className = "results";
}

async function handleFileBase64Decode() {
  const file = selectedFiles[0];
  if (!file) throw new Error("Select a Base64 text file first.");
  const decoded = base64ToBytes(await readFileText(file));
  let name = file.name
    .replace(/\.base64\.txt$/i, "")
    .replace(/\.b64$/i, "")
    .replace(/\.base64$/i, "");
  if (!name || name === file.name) name = "decoded-file.bin";
  fileResults.replaceChildren(
    makeDownloadRow(name, new Blob([decoded]), "Decoded · " + formatBytes(decoded.length)),
  );
  fileResults.className = "results";
}

async function handleSplit() {
  const file = selectedFiles[0];
  if (!file) throw new Error("Select a file first.");
  const chunkMiB = Number($("#splitSize").value);
  if (!(chunkMiB >= 1 && chunkMiB <= 256)) throw new Error("Split size must be between 1 and 256 MiB.");
  const chunks = splitBytes(await readFileBytes(file), chunkMiB * 1024 * 1024);
  const width = Math.max(3, String(chunks.length).length);
  const rows = chunks.map((chunk, index) => {
    const name = file.name + ".part" + String(index + 1).padStart(width, "0");
    return makeDownloadRow(
      name,
      new Blob([chunk]),
      "Part " + (index + 1) + " of " + chunks.length + " · " + formatBytes(chunk.length),
    );
  });
  fileResults.replaceChildren(...rows);
  fileResults.className = "results";
}

async function handleJoin() {
  if (selectedFiles.length < 2) throw new Error("Select at least two parts in order.");
  const parts = [];
  for (const file of selectedFiles) parts.push(await readFileBytes(file));
  const joined = joinBytes(parts);
  const first = selectedFiles[0].name;
  const guessed = first.replace(/\.part\d+$/i, "") || "joined-file.bin";
  fileResults.replaceChildren(
    makeDownloadRow(
      guessed,
      new Blob([joined]),
      "Joined " + selectedFiles.length + " parts · " + formatBytes(joined.length),
    ),
  );
  fileResults.className = "results";
}

const fileActions = {
  zip: handleZip,
  gzip: handleGzip,
  extract: handleExtract,
  hash: handleHashes,
  base64: handleFileBase64,
  "base64-decode": handleFileBase64Decode,
  split: handleSplit,
  join: handleJoin,
};

$$("[data-file-action]").forEach((button) => {
  button.addEventListener("click", async () => {
    button.disabled = true;
    setStatus(fileStatus, "Working…");
    try {
      await fileActions[button.dataset.fileAction]();
      setStatus(fileStatus, "Done");
    } catch (error) {
      setStatus(fileStatus, error instanceof Error ? error.message : "Operation failed", true);
    } finally {
      button.disabled = false;
    }
  });
});

const imageInput = $("#imageInput");
const imagePreviewWrap = $("#imagePreviewWrap");
const imageResult = $("#imageResult");
let previewUrl = null;

imageInput.addEventListener("change", () => {
  if (previewUrl) URL.revokeObjectURL(previewUrl);
  imagePreviewWrap.replaceChildren();
  const file = imageInput.files?.[0];
  if (!file) {
    imagePreviewWrap.className = "preview-wrap empty-state";
    imagePreviewWrap.textContent = "Image preview";
    return;
  }
  previewUrl = URL.createObjectURL(file);
  const image = document.createElement("img");
  image.src = previewUrl;
  image.alt = "Selected image preview";
  const caption = document.createElement("span");
  caption.textContent = file.name + " · " + formatBytes(file.size);
  imagePreviewWrap.className = "preview-wrap";
  imagePreviewWrap.append(image, caption);
});

$("#imageQuality").addEventListener("input", (event) => {
  $("#qualityValue").textContent = event.target.value + "%";
});

$("#convertImageButton").addEventListener("click", async (event) => {
  const button = event.currentTarget;
  const file = imageInput.files?.[0];
  button.disabled = true;
  imageResult.className = "results compact-results";
  imageResult.textContent = "Converting…";
  try {
    const result = await convertImage(file, {
      type: $("#imageFormat").value,
      maxWidth: Number($("#imageWidth").value) || 0,
      maxHeight: Number($("#imageHeight").value) || 0,
      quality: Number($("#imageQuality").value) / 100,
      background: $("#imageBackground").value,
    });
    imageResult.replaceChildren(
      makeDownloadRow(
        result.name,
        result.blob,
        result.width + "×" + result.height + " · " + formatBytes(result.blob.size),
      ),
    );
  } catch (error) {
    imageResult.className = "results compact-results empty-state error-text";
    imageResult.textContent = error instanceof Error ? error.message : "Image conversion failed.";
  } finally {
    button.disabled = false;
  }
});

const dataInput = $("#dataInput");
const dataOutput = $("#dataOutput");
const dataStatus = $("#dataStatus");
const dataFileInput = $("#dataFileInput");
let dataDownload = { name: "pocketbench-output.txt", type: "text/plain;charset=utf-8" };

dataFileInput.addEventListener("change", async () => {
  const file = dataFileInput.files?.[0];
  if (!file) return;
  try {
    dataInput.value = await readFileText(file);
    dataInput.dispatchEvent(new Event("input"));
    const extension = file.name.split(".").pop()?.toLocaleLowerCase();
    if (extension === "tsv") $("#delimiter").value = "tab";
    else if (extension === "csv") $("#delimiter").value = "auto";
    setStatus(dataStatus, file.name + " loaded");
  } catch (error) {
    setStatus(dataStatus, error instanceof Error ? error.message : "Could not read file", true);
  }
});

function delimiterValue() {
  const value = $("#delimiter").value;
  return value === "tab" ? "\t" : value;
}

const dataActions = {
  "csv-json": () => {
    const result = delimitedToObjects(dataInput.value, delimiterValue());
    dataDownload = { name: "data.json", type: "application/json" };
    return JSON.stringify(result.data, null, 2);
  },
  "json-csv": () => {
    const delimiter = delimiterValue() === "auto" ? "," : delimiterValue();
    dataDownload = {
      name: delimiter === "\t" ? "data.tsv" : "data.csv",
      type: "text/csv;charset=utf-8",
    };
    return objectsToDelimited(dataInput.value, delimiter);
  },
  "json-yaml": () => {
    dataDownload = { name: "data.yaml", type: "application/yaml;charset=utf-8" };
    return jsonToYaml(dataInput.value);
  },
  "yaml-json": () => {
    dataDownload = { name: "data.json", type: "application/json" };
    return yamlToJson(dataInput.value);
  },
  "query-json": () => {
    dataDownload = { name: "query.json", type: "application/json" };
    return queryStringToJson(dataInput.value);
  },
  "pretty-json": () => {
    dataDownload = { name: "data.pretty.json", type: "application/json" };
    return formatJson(dataInput.value);
  },
  "minify-json": () => {
    dataDownload = { name: "data.min.json", type: "application/json" };
    return minifyJson(dataInput.value);
  },
};

$$("[data-data-action]").forEach((button) => {
  button.addEventListener("click", () => {
    try {
      dataOutput.value = dataActions[button.dataset.dataAction]();
      setStatus(dataStatus, "Done");
    } catch (error) {
      dataOutput.value = "";
      setStatus(dataStatus, error instanceof Error ? error.message : "Conversion failed", true);
    }
  });
});

$("#copyData").addEventListener("click", () => copyText(dataOutput.value, dataStatus));
$("#pasteData").addEventListener("click", () => pasteInto(dataInput, dataStatus));
$("#downloadData").addEventListener("click", () => {
  if (!dataOutput.value) {
    setStatus(dataStatus, "Nothing to download", true);
    return;
  }
  downloadText(dataOutput.value, dataDownload.name, dataDownload.type);
  setStatus(dataStatus, "Download ready");
});

const textInput = $("#textInput");
const textOutput = $("#textOutput");
const textStatus = $("#textStatus");

function updateTextStats() {
  const stats = textStats(textInput.value);
  $("#textStats").textContent =
    stats.characters + " chars · " +
    stats.words + " words · " +
    stats.lines + " lines · " +
    stats.bytes + " bytes";
}
textInput.addEventListener("input", updateTextStats);

const textActions = {
  normalize: () => normalizeText(textInput.value),
  trim: () => trimLines(textInput.value),
  "remove-blanks": () => removeBlankLines(textInput.value),
  dedupe: () => dedupeLines(textInput.value),
  "sort-asc": () => sortLines(textInput.value),
  "sort-desc": () => sortLines(textInput.value, { descending: true }),
  upper: () => textInput.value.toLocaleUpperCase(),
  lower: () => textInput.value.toLocaleLowerCase(),
  title: () => toTitleCase(textInput.value),
  slug: () => slugify(textInput.value),
  lf: () => convertLineEndings(textInput.value, "lf"),
  crlf: () => convertLineEndings(textInput.value, "crlf"),
  "url-encode": () => encodeUrl(textInput.value),
  "url-decode": () => decodeUrl(textInput.value),
  "base64-encode": () => bytesToBase64(new TextEncoder().encode(textInput.value)),
  "base64-decode": () => new TextDecoder("utf-8", { fatal: true }).decode(base64ToBytes(textInput.value)),
  uuid: () => crypto.randomUUID(),
};

$$("[data-text-action]").forEach((button) => {
  button.addEventListener("click", () => {
    try {
      textOutput.value = textActions[button.dataset.textAction]();
      setStatus(textStatus, "Done");
    } catch (error) {
      textOutput.value = "";
      setStatus(textStatus, error instanceof Error ? error.message : "Operation failed", true);
    }
  });
});

$("#copyText").addEventListener("click", () => copyText(textOutput.value, textStatus));
$("#pasteText").addEventListener("click", () => pasteInto(textInput, textStatus));
updateTextStats();

const installButton = $("#installButton");
let installPrompt = null;
window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  installPrompt = event;
  installButton.hidden = false;
});
installButton.addEventListener("click", async () => {
  if (!installPrompt) return;
  installPrompt.prompt();
  await installPrompt.userChoice;
  installPrompt = null;
  installButton.hidden = true;
});
window.addEventListener("appinstalled", () => {
  installPrompt = null;
  installButton.hidden = true;
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}

initTabs();
