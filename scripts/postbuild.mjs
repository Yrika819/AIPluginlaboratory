import { copyFile, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { relative, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const dist = resolve(root, "dist");
const pkg = JSON.parse(await readFile(resolve(root, "package.json"), "utf8"));

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = resolve(dir, entry.name);
    if (entry.isDirectory()) files.push(...await walk(path));
    else files.push(path);
  }
  return files;
}

async function copyOrtRuntime() {
  const source = resolve(root, "node_modules/onnxruntime-web/dist");
  const target = resolve(dist, "ort");
  await mkdir(target, { recursive: true });
  const names = await readdir(source);
  const selected = names.filter((name) =>
    /^ort-wasm.*\.(wasm|mjs)$/.test(name),
  );
  if (selected.length === 0) {
    throw new Error("No ONNX Runtime WebAssembly assets were found.");
  }
  await Promise.all(selected.map((name) =>
    copyFile(resolve(source, name), resolve(target, name)),
  ));
  return selected;
}

const ortFiles = await copyOrtRuntime();
const allFiles = await walk(dist);
const assets = allFiles
  .map((path) => "./" + relative(dist, path).split("\\").join("/"))
  .filter((path) =>
    path !== "./sw.js" &&
    !path.startsWith("./models/") &&
    !path.startsWith("./ort/") &&
    !path.endsWith(".map"),
  )
  .sort();

if (!assets.includes("./index.html")) assets.unshift("./index.html");
if (!assets.includes("./")) assets.unshift("./");

const cacheName = `pocketbench-v${pkg.version}`;
const serviceWorker = `const CACHE_NAME = ${JSON.stringify(cacheName)};
const APP_SHELL = ${JSON.stringify(assets, null, 2)};

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))),
    ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        if (!response || response.status !== 200 || response.type === "opaque") return response;
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      });
    }),
  );
});
`;

await writeFile(resolve(dist, "sw.js"), serviceWorker);
await writeFile(
  resolve(dist, "build-info.json"),
  JSON.stringify({
    name: "PocketBench",
    version: pkg.version,
    generatedBy: "vite + postbuild",
    precachedFiles: assets.length,
    lazyAiRuntimeFiles: ortFiles.length,
    aiModelBundled: allFiles.some((path) => path.endsWith("realesr-general-x4v3.onnx")),
  }, null, 2) + "\n",
);

console.log(
  `Production build ready: ${assets.length} app-shell files, ${ortFiles.length} lazy ONNX runtime assets.`,
);
