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
    !path.includes("ort-wasm") &&
    !path.includes("ort.all.bundle") &&
    !path.endsWith(".map"),
  )
  .sort();

if (!assets.includes("./index.html")) assets.unshift("./index.html");
if (!assets.includes("./")) assets.unshift("./");

const cacheName = `pocketbench-v${pkg.version}`;
const aiCacheName = "pocketbench-ai-v1";
const serviceWorker = `const CACHE_NAME = ${JSON.stringify(cacheName)};
const AI_CACHE_NAME = ${JSON.stringify(aiCacheName)};
const APP_SHELL = ${JSON.stringify(assets, null, 2)};

function isAiAsset(requestUrl) {
  const url = new URL(requestUrl);
  return (
    url.pathname.includes("/models/") ||
    url.pathname.includes("/ort/") ||
    url.pathname.includes("ort-wasm") ||
    url.pathname.includes("ort.all.bundle")
  );
}

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key.startsWith("pocketbench-v") && key !== CACHE_NAME)
          .map((key) => caches.delete(key)),
      ),
    ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  if (isAiAsset(event.request.url)) {
    event.respondWith(
      caches.open(AI_CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(event.request);
        if (cached) return cached;

        const response = await fetch(event.request, { cache: "no-store" });
        if (!response || response.status !== 200 || response.type === "opaque") return response;
        await cache.put(event.request, response.clone());
        return response;
      }),
    );
    return;
  }

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(event.request);
      if (cached) return cached;
      const response = await fetch(event.request);
      if (!response || response.status !== 200 || response.type === "opaque") return response;
      await cache.put(event.request, response.clone());
      return response;
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
