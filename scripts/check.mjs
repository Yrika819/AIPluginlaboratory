import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const required = [
  "web/index.html",
  "web/app.js",
  "web/styles.css",
  "web/lib/core.mjs",
  "web/manifest.webmanifest",
  "web/sw.js",
  "web/icon.svg",
];

for (const file of required) {
  await access(resolve(root, file));
}

const manifest = JSON.parse(
  await readFile(resolve(root, "web/manifest.webmanifest"), "utf8"),
);

if (manifest.name !== "PocketBench") {
  throw new Error("Manifest name must be PocketBench");
}
if (manifest.display !== "standalone") {
  throw new Error("PWA manifest must use standalone display mode");
}
if (!Array.isArray(manifest.icons) || manifest.icons.length === 0) {
  throw new Error("PWA manifest must define at least one icon");
}

const html = await readFile(resolve(root, "web/index.html"), "utf8");
for (const reference of ["./styles.css", "./app.js", "./manifest.webmanifest"]) {
  if (!html.includes(reference)) {
    throw new Error("index.html is missing required reference: " + reference);
  }
}

console.log("Static checks passed.");
