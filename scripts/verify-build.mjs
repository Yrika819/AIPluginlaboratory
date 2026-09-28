import { access, readFile, readdir, stat } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const dist = resolve(root, "dist");
const requireModel = process.argv.includes("--require-model");

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function sha256(path) {
  const data = await readFile(path);
  return createHash("sha256").update(data).digest("hex");
}

const buildInfo = JSON.parse(await readFile(resolve(dist, "build-info.json"), "utf8"));
if (buildInfo.name !== "PocketBench") throw new Error("Unexpected build identity.");
if (buildInfo.version !== "0.3.0-alpha.1") throw new Error("Unexpected build version.");

const sw = await readFile(resolve(dist, "sw.js"), "utf8");
const match = sw.match(/const APP_SHELL = (\[[\s\S]*?\]);\n\nself\.addEventListener/);
if (!match) throw new Error("Could not parse service worker app shell.");
const appShell = JSON.parse(match[1]);

for (const forbidden of ["./models/", "./ort/"]) {
  if (appShell.some((path) => path.startsWith(forbidden))) {
    throw new Error(`Lazy AI asset leaked into app shell: ${forbidden}`);
  }
}
if (appShell.some((path) => path.includes("ort-wasm") || path.includes("ort.all.bundle") || path.endsWith(".map"))) {
  throw new Error("Lazy ONNX Runtime or source-map asset leaked into app shell.");
}

let shellBytes = 0;
for (const relativePath of appShell) {
  if (relativePath === "./") continue;
  const path = resolve(dist, relativePath.replace(/^\.\//, ""));
  const info = await stat(path);
  if (!info.isFile()) throw new Error(`App shell entry is not a file: ${relativePath}`);
  shellBytes += info.size;
}
if (shellBytes > 2 * 1024 * 1024) {
  throw new Error(`Initial app shell is unexpectedly large: ${shellBytes} bytes`);
}

const ortDir = resolve(dist, "ort");
const ortFiles = await readdir(ortDir);
if (!ortFiles.some((name) => name.endsWith(".wasm"))) throw new Error("No lazy ONNX WASM runtime was bundled.");
if (!ortFiles.some((name) => name.endsWith(".mjs"))) throw new Error("No lazy ONNX runtime module was bundled.");

const model = resolve(dist, "models/realesr-general-x4v3.onnx");
if (requireModel) {
  if (!(await exists(model))) throw new Error("Verified AI model is missing from the production build.");
  const modelInfo = await stat(model);
  if (modelInfo.size !== 4_866_426) throw new Error(`AI model size mismatch: ${modelInfo.size}`);
  const digest = await sha256(model);
  if (digest !== "d239f0d59ce61e9746143d1296c3441585756e4e9a5c10e0c2f371cda5f69a4d") {
    throw new Error(`AI model SHA-256 mismatch: ${digest}`);
  }
}

console.log(JSON.stringify({
  version: buildInfo.version,
  appShellFiles: appShell.length,
  appShellBytes: shellBytes,
  lazyOrtFiles: ortFiles.length,
  verifiedAiModel: requireModel,
}, null, 2));
