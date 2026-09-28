import { expect, test } from "@playwright/test";

test("AI x2 performs real local ONNX inference and exposes a download", async ({ page }) => {
  await page.goto("/#images");

  const svg = Buffer.from(
    '<svg xmlns="http://www.w3.org/2000/svg" width="8" height="6">' +
      '<rect width="8" height="6" fill="#526ee8"/>' +
      '<circle cx="3" cy="3" r="2" fill="#ffffff"/>' +
    "</svg>",
    "utf8",
  );

  await page.locator("#imageInput").setInputFiles({
    name: "ai-fixture.svg",
    mimeType: "image/svg+xml",
    buffer: svg,
  });
  await page.locator("#upscaleMode").selectOption("ai");
  await expect(page.locator("#upscaleScale")).toBeDisabled();
  await expect(page.locator("#aiUpscaleInfo")).toBeVisible();

  await page.getByRole("button", { name: "Upscale image" }).click();

  await expect(page.locator("#upscaleStatus")).toHaveText("AI upscale complete", {
    timeout: 90_000,
  });
  await expect(page.locator("#upscaleResult")).toContainText("16×12");
  await expect(page.locator("#upscaleResult")).toContainText(/WASM|WEBGPU/);
  await expect(page.locator("#upscaleResult").getByRole("button", { name: "Download" })).toBeVisible();
  await expect(page.locator("#upscaleProgress")).toHaveJSProperty("value", 1);
});

test("AI model and ONNX runtime are same-origin and removable from cache", async ({ page }) => {
  const requests = [];
  page.on("request", (request) => requests.push(request.url()));
  await page.goto("/#images");
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();

  const svg = Buffer.from(
    '<svg xmlns="http://www.w3.org/2000/svg" width="4" height="4"><rect width="4" height="4" fill="#222"/></svg>',
    "utf8",
  );
  await page.locator("#imageInput").setInputFiles({
    name: "origin-fixture.svg",
    mimeType: "image/svg+xml",
    buffer: svg,
  });
  await page.locator("#upscaleMode").selectOption("ai");
  await page.getByRole("button", { name: "Upscale image" }).click();
  await expect(page.locator("#upscaleStatus")).toHaveText("AI upscale complete", { timeout: 90_000 });

  const nonLocal = requests.filter((value) => {
    const url = new URL(value);
    if (url.protocol === "blob:") return false;
    return !["127.0.0.1", "localhost"].includes(url.hostname);
  });
  expect(nonLocal).toEqual([]);
  expect(requests.some((value) => value.includes("/models/realesr-general-x4v3.onnx"))).toBe(true);

  const before = await page.evaluate(async () => (await caches.keys()).filter((name) => name.startsWith("pocketbench-ai-")));
  expect(before).toContain("pocketbench-ai-v1");

  await page.getByRole("button", { name: "Clear AI cache" }).click();
  await expect(page.locator("#aiCacheStatus")).toContainText("AI cache cleared");
  const after = await page.evaluate(async () => (await caches.keys()).filter((name) => name.startsWith("pocketbench-ai-")));
  expect(after).toEqual([]);
});
