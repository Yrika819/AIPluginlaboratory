import {
  decodeBase64,
  decodeUrl,
  dedupeLines,
  encodeBase64,
  encodeUrl,
  formatJson,
  minifyJson,
  normalizeText,
  sortLines,
  textStats,
} from "./lib/core.mjs";

const input = document.querySelector("#input");
const output = document.querySelector("#output");
const stats = document.querySelector("#stats");
const status = document.querySelector("#status");
const copyButton = document.querySelector("#copyButton");
const clearButton = document.querySelector("#clearButton");
const pasteButton = document.querySelector("#pasteButton");
const installButton = document.querySelector("#installButton");

let deferredInstallPrompt = null;

function setStatus(message, isError = false) {
  status.textContent = message;
  status.classList.toggle("error", isError);
}

function updateStats() {
  const value = textStats(input.value);
  stats.textContent =
    `${value.characters} chars · ${value.words} words · ${value.lines} lines · ${value.bytes} bytes`;
}

function putResult(value) {
  output.value = value;
  setStatus("Done");
}

const actions = {
  normalize: () => normalizeText(input.value),
  dedupe: () => dedupeLines(input.value),
  sortAsc: () => sortLines(input.value),
  sortDesc: () => sortLines(input.value, { descending: true }),
  jsonPretty: () => formatJson(input.value),
  jsonMinify: () => minifyJson(input.value),
  urlEncode: () => encodeUrl(input.value),
  urlDecode: () => decodeUrl(input.value),
  base64Encode: () => encodeBase64(input.value),
  base64Decode: () => decodeBase64(input.value),
  uuid: () => crypto.randomUUID(),
};

document.querySelector(".tool-grid").addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  try {
    const action = actions[button.dataset.action];
    putResult(action());
  } catch (error) {
    output.value = "";
    setStatus(error instanceof Error ? error.message : "Operation failed", true);
  }
});

input.addEventListener("input", updateStats);

clearButton.addEventListener("click", () => {
  input.value = "";
  output.value = "";
  updateStats();
  setStatus("Cleared");
  input.focus();
});

copyButton.addEventListener("click", async () => {
  if (!output.value) {
    setStatus("Nothing to copy", true);
    return;
  }
  try {
    await navigator.clipboard.writeText(output.value);
    setStatus("Copied");
  } catch {
    output.focus();
    output.select();
    setStatus("Select and copy manually", true);
  }
});

pasteButton.addEventListener("click", async () => {
  try {
    input.value = await navigator.clipboard.readText();
    updateStats();
    setStatus("Pasted");
  } catch {
    setStatus("Clipboard permission unavailable", true);
  }
});

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
  installButton.hidden = false;
});

installButton.addEventListener("click", async () => {
  if (!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  installButton.hidden = true;
});

window.addEventListener("appinstalled", () => {
  installButton.hidden = true;
  deferredInstallPrompt = null;
  setStatus("Installed");
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {
      setStatus("Offline cache unavailable", true);
    });
  });
}

updateStats();
