import { expect, test } from "@playwright/test";

test("loads the toolbox without external network calls", async ({ page }) => {
  const external = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (!["127.0.0.1", "localhost"].includes(url.hostname)) external.push(request.url());
  });

  await page.goto("/");
  await expect(page.getByRole("heading", { name: /everyday file bench/i })).toBeVisible();
  await expect(page.getByText("Private by design")).toBeVisible();
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
  await expect(page.locator("#dataOutput")).toContainText("Alice");

  await page.locator("#dataInput").fill('{"name":"PocketBench","ok":true}');
  await page.getByRole("button", { name: "JSON → YAML" }).click();
  await expect(page.locator("#dataOutput")).toContainText("name: PocketBench");
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

test("converts a PNG image and exposes a download", async ({ page }) => {
  await page.goto("/#images");
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Z7YQAAAAASUVORK5CYII=",
    "base64",
  );
  await page.locator("#imageInput").setInputFiles({
    name: "pixel.png",
    mimeType: "image/png",
    buffer: png,
  });
  await page.getByRole("button", { name: "Convert image" }).click();
  await expect(page.locator("#imageResult").getByRole("button", { name: "Download" })).toBeVisible();
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
