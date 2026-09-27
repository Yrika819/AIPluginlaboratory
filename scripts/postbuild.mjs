import { readdir, writeFile } from "node:fs/promises";
import { relative, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const dist = resolve(root, "dist");

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

const allFiles = await walk(dist);
const assets = allFiles
  .filter((path) => !path.endsWith("/sw.js") && !path.endsWith("\\sw.js"))
  .map((path) => "./" + relative(dist, path).split("\\").join("/"))
  .sort();

if (!assets.includes("./index.html")) assets.unshift("./index.html");
if (!assets.includes("./")) assets.unshift("./");

const serviceWorker = `const CACHE_NAME = "pocketbench-v2";
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
    version: "0.2.0",
    generatedBy: "vite + postbuild",
    precachedFiles: assets.length,
  }, null, 2) + "\n",
);

console.log(`Production build ready with ${assets.length} precached files.`);
