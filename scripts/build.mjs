import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const source = resolve(root, "web");
const target = resolve(root, "dist");

await rm(target, { recursive: true, force: true });
await mkdir(target, { recursive: true });
await cp(source, target, { recursive: true });

await writeFile(
  resolve(target, "build-info.json"),
  JSON.stringify(
    {
      name: "PocketBench",
      version: "0.1.0",
      generatedBy: "npm run build",
    },
    null,
    2,
  ) + "\n",
);

console.log("PocketBench build complete: dist/");
