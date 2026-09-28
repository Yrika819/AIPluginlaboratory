import { expect, test } from "@playwright/test";

test("loads the toolbox without external network calls", async ({ page }) => {
  const external = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (!["127.0.0.1", "localhost"].includes(url.hostname)) external.push(request.url());
  });

  await page.goto("/");
  await expect(page.getByRole("heading", { name: /everyday file bench/i })).toBeVisible();
  await expect(page.getByText("No upload. No account. No tracking.")).toBeVisible();
  expect(external).toEqual([]);
});

test("text tools transform content and update stats", async ({ page }) => {
  await page.goto("/#text");
  const input = page.locator("#textInput");
  await input.fill("  hello   world\n\n\n next line ");
  await page.getByRole("button", { name: "Normalize", exact: true }).click();
  await expect(page.locator("#textOutput")).toHaveValue("hello world\n\nnext line");
  await expect(page.locator("#textStats")).toContainText("words");
});

test("data tools convert CSV to JSON and JSON to YAML", async ({ page }) => {
  await page.goto("/#data");
  await page.locator("#dataInput").fill('name,note\nAlice,"hello, world"');
  await page.getByRole("button", { name: "CSV / TSV → JSON" }).click();
  await expect(page.locator("#dataOutput")).toHaveValue(/Alice/);

  await page.locator("#dataInput").fill('{"name":"PocketBench","ok":true}');
  await page.getByRole("button", { name: "JSON → YAML" }).click();
  await expect(page.locator("#dataOutput")).toHaveValue(/name: PocketBench/);
});

test("loads a CSV file directly into the data workspace", async ({ page }) => {
  await page.goto("/#data");
  await page.locator("#dataFileInput").setInputFiles({
    name: "people.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("name,age\nAlice,18"),
  });
  await expect(page.locator("#dataInput")).toHaveValue("name,age\nAlice,18");
  await expect(page.locator("#dataStatus")).toContainText("people.csv loaded");
  await page.getByRole("button", { name: "CSV / TSV → JSON" }).click();
  await expect(page.locator("#dataOutput")).toHaveValue(/Alice/);
});

test("restores a file from Base64 text", async ({ page }) => {
  await page.goto("/#files");
  await page.locator("#fileInput").setInputFiles({
    name: "hello.txt.base64.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("aGVsbG8="),
  });
  await page.getByRole("button", { name: "Base64 → file" }).click();
  await expect(page.locator("#fileResults")).toContainText("hello.txt");
  await expect(page.locator("#fileResults").getByRole("button", { name: "Download" })).toBeVisible();
});

test("creates a ZIP locally from uploaded files", async ({ page }) => {
  await page.goto("/#files");
  await page.locator("#fileInput").setInputFiles([
    { name: "one.txt", mimeType: "text/plain", buffer: Buffer.from("one") },
    { name: "two.txt", mimeType: "text/plain", buffer: Buffer.from("two") },
  ]);
  await page.getByRole("button", { name: "Make ZIP" }).click();
  await expect(page.getByText("pocketbench-files.zip")).toBeVisible();
  await expect(page.locator("#fileStatus")).toHaveText("Done");
});

test("hashes an uploaded file", async ({ page }) => {
  await page.goto("/#files");
  await page.locator("#fileInput").setInputFiles({
    name: "hello.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("hello"),
  });
  await page.getByRole("button", { name: "SHA hashes" }).click();
  await expect(page.locator("#fileResults")).toContainText(
    "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
  );
});

test("converts an image and exposes a download", async ({ page }) => {
  await page.goto("/#images");
  const svg = Buffer.from(
    '<svg xmlns="http://www.w3.org/2000/svg" width="8" height="6"><rect width="8" height="6" fill="#526ee8"/></svg>',
    "utf8",
  );
  await page.locator("#imageInput").setInputFiles({
    name: "sample.svg",
    mimeType: "image/svg+xml",
    buffer: svg,
  });
  await page.locator("#imageFormat").selectOption("image/png");
  await page.getByRole("button", { name: "Convert image" }).click();
  await expect(page.locator("#imageResult").getByRole("button", { name: "Download" })).toBeVisible();
  await expect(page.locator("#imageResult")).toContainText("8×6");
});

test("standard upscale enlarges an image locally", async ({ page }) => {
  await page.goto("/#images");
  const svg = Buffer.from(
    '<svg xmlns="http://www.w3.org/2000/svg" width="8" height="6"><rect width="8" height="6" fill="#526ee8"/></svg>',
    "utf8",
  );
  await page.locator("#imageInput").setInputFiles({
    name: "small.svg",
    mimeType: "image/svg+xml",
    buffer: svg,
  });
  await page.locator("#upscaleMode").selectOption("standard");
  await page.locator("#upscaleScale").selectOption("2");
  await page.locator("#upscaleFormat").selectOption("image/png");
  await page.getByRole("button", { name: "Upscale image" }).click();
  await expect(page.locator("#upscaleResult")).toContainText("16×12");
  await expect(page.locator("#upscaleStatus")).toHaveText("Standard upscale complete");
  await expect(page.locator("#upscaleResult").getByRole("button", { name: "Download" })).toBeVisible();
});

test("works offline after the application shell is cached", async ({ page, context, browserName }) => {
  test.skip(browserName !== "chromium", "Offline service worker smoke test runs once on Chromium.");
  await page.goto("/");
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByText("PocketBench", { exact: true }).first()).toBeVisible();
  await context.setOffline(false);
});
