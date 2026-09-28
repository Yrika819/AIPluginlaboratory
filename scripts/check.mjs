import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const required = [
  "web/index.html",
  "web/app.js",
  "web/styles.css",
  "web/lib/core.mjs",
  "web/lib/data-tools.mjs",
  "web/lib/file-tools.mjs",
  "web/lib/image-tools.mjs",
  "web/lib/downloads.mjs",
  "web/lib/upscale/standard.mjs",
  "web/lib/upscale/tiling.mjs",
  "web/lib/upscale/memory-budget.mjs",
  "web/lib/upscale/capabilities.mjs",
  "web/lib/upscale/model-registry.mjs",
  "web/lib/upscale/ai-engine.mjs",
  "scripts/ai/export_realesrgan_general_x4v3.py",
  "scripts/ai/requirements.txt",
  "playwright.ai.config.mjs",
  "licenses/Real-ESRGAN-BSD-3-Clause.txt",
  "web/public/manifest.webmanifest",
  "web/public/icon.svg",
  "vite.config.mjs",
  "playwright.config.mjs"
];

for (const file of required) {
  await access(resolve(root, file));
}

const pkg = JSON.parse(await readFile(resolve(root, "package.json"), "utf8"));
if (pkg.version !== "0.3.0-alpha.1") throw new Error("Unexpected package version.");
if (pkg.dependencies.fflate !== "0.8.3") throw new Error("fflate must be pinned.");
if (pkg.dependencies.yaml !== "2.9.1") throw new Error("yaml must be pinned.");
if (pkg.dependencies["onnxruntime-web"] !== "1.30.0") throw new Error("onnxruntime-web must be pinned.");

const manifest = JSON.parse(
  await readFile(resolve(root, "web/public/manifest.webmanifest"), "utf8"),
);
if (manifest.name !== "PocketBench") throw new Error("Manifest name mismatch.");
if (manifest.display !== "standalone") throw new Error("PWA must be standalone.");
if (!Array.isArray(manifest.icons) || manifest.icons.length === 0) {
  throw new Error("PWA manifest needs an icon.");
}

const html = await readFile(resolve(root, "web/index.html"), "utf8");
for (const token of ["./styles.css", "./app.js", "./manifest.webmanifest"]) {
  if (!html.includes(token)) throw new Error("index.html missing " + token);
}

console.log("Static checks passed.");
