import { describe, expect, test } from "vitest";
import { progressiveSteps, upscaleDimensions } from "../../web/lib/upscale/standard.mjs";
import { createTilePlan, chooseTileSize } from "../../web/lib/upscale/tiling.mjs";
import { estimateAiMemory, validateAiBudget } from "../../web/lib/upscale/memory-budget.mjs";
import { backendLabel, detectUpscaleCapabilities } from "../../web/lib/upscale/capabilities.mjs";
import { GENERAL_X4V3, resolveModelUrl } from "../../web/lib/upscale/model-registry.mjs";
import { fetchVerifiedModel, sha256Hex } from "../../web/lib/upscale/ai-engine.mjs";

describe("standard upscale planning", () => {
  test("calculates scaled dimensions", () => {
    expect(upscaleDimensions(640, 480, 2)).toEqual({ width: 1280, height: 960 });
    expect(upscaleDimensions(5, 7, 1.5)).toEqual({ width: 8, height: 11 });
  });

  test("breaks large interpolation into progressive steps", () => {
    expect(progressiveSteps(1)).toEqual([]);
    expect(progressiveSteps(2)).toEqual([2]);
    expect(progressiveSteps(4)).toEqual([2, 2]);
    expect(progressiveSteps(3)).toEqual([2, 1.5]);
  });
});

describe("AI tile planning", () => {
  test("covers non-divisible image edges without gaps", () => {
    const plan = createTilePlan(250, 170, {
      coreSize: 96,
      padding: 12,
      modelScale: 4,
      outputScale: 2,
    });
    expect(plan.outputWidth).toBe(500);
    expect(plan.outputHeight).toBe(340);
    expect(plan.tiles).toHaveLength(6);
    expect(plan.tiles[0].core).toEqual({ x: 0, y: 0, width: 96, height: 96 });
    expect(plan.tiles.at(-1).core).toEqual({ x: 192, y: 96, width: 58, height: 74 });
    expect(plan.tiles.at(-1).destination).toEqual({ x: 384, y: 192, width: 116, height: 148 });
  });

  test("padding never points outside the source", () => {
    const plan = createTilePlan(100, 80, { coreSize: 64, padding: 12 });
    for (const tile of plan.tiles) {
      expect(tile.source.x).toBeGreaterThanOrEqual(0);
      expect(tile.source.y).toBeGreaterThanOrEqual(0);
      expect(tile.source.x + tile.source.width).toBeLessThanOrEqual(100);
      expect(tile.source.y + tile.source.height).toBeLessThanOrEqual(80);
    }
  });

  test("chooses smaller tiles for mobile and WASM", () => {
    expect(chooseTileSize({ backend: "webgpu", mobile: false, deviceMemoryGiB: 16 })).toBe(128);
    expect(chooseTileSize({ backend: "webgpu", mobile: true, deviceMemoryGiB: 8 })).toBe(64);
    expect(chooseTileSize({ backend: "wasm", mobile: true })).toBe(48);
  });
});

describe("AI memory budget", () => {
  test("returns a finite working-set estimate", () => {
    const result = estimateAiMemory({
      width: 1000,
      height: 750,
      coreSize: 96,
      padding: 12,
      modelScale: 4,
      outputScale: 2,
    });
    expect(result.estimatedBytes).toBeGreaterThan(0);
    expect(result.outputPixels).toBe(3_000_000);
  });

  test("rejects oversized output before inference", () => {
    const result = validateAiBudget({
      width: 8000,
      height: 6000,
      coreSize: 64,
      padding: 8,
      modelScale: 4,
      outputScale: 2,
    });
    expect(result.safe).toBe(false);
    expect(result.reason).toMatch(/too large|memory/i);
  });
});

describe("capability detection", () => {
  test("prefers WebGPU when available", () => {
    const result = detectUpscaleCapabilities({
      WebAssembly: {},
      navigator: {
        gpu: {},
        userAgent: "Mozilla/5.0 Android",
        deviceMemory: 8,
      },
    });
    expect(result).toMatchObject({
      webgpu: true,
      wasm: true,
      mobile: true,
      preferredBackend: "webgpu",
    });
    expect(backendLabel(result.preferredBackend)).toBe("WebGPU");
  });

  test("falls back to WASM", () => {
    const result = detectUpscaleCapabilities({
      WebAssembly: {},
      navigator: { userAgent: "Desktop" },
    });
    expect(result.preferredBackend).toBe("wasm");
  });
});

describe("verified model registry", () => {
  test("pins official source and exported ONNX metadata", () => {
    expect(GENERAL_X4V3.sourceSha256).toBe(
      "8dc7edb9ac80ccdc30c3a5dca6616509367f05fbc184ad95b731f05bece96292",
    );
    expect(GENERAL_X4V3.onnxSha256).toBe(
      "d239f0d59ce61e9746143d1296c3441585756e4e9a5c10e0c2f371cda5f69a4d",
    );
    expect(GENERAL_X4V3.onnxBytes).toBe(4_866_426);
    expect(resolveModelUrl(GENERAL_X4V3, "https://example.test/tools/"))
      .toBe("https://example.test/tools/models/realesr-general-x4v3.onnx");
  });

  test("hashes bytes and accepts a correctly pinned fetched model", async () => {
    const bytes = new TextEncoder().encode("hello");
    const hash = "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824";
    expect(await sha256Hex(bytes)).toBe(hash);

    const model = {
      ...GENERAL_X4V3,
      relativeUrl: "./model.onnx",
      onnxBytes: bytes.byteLength,
      onnxSha256: hash,
    };
    const fetched = await fetchVerifiedModel(model, {
      baseUrl: "https://example.test/",
      fetchImpl: async () => new Response(bytes, { status: 200 }),
    });
    expect(fetched.digest).toBe(hash);
  });

  test("rejects modified model bytes", async () => {
    const bytes = new TextEncoder().encode("tampered");
    const model = {
      ...GENERAL_X4V3,
      relativeUrl: "./model.onnx",
      onnxBytes: bytes.byteLength,
      onnxSha256: "0".repeat(64),
    };
    await expect(fetchVerifiedModel(model, {
      baseUrl: "https://example.test/",
      fetchImpl: async () => new Response(bytes, { status: 200 }),
    })).rejects.toThrow(/integrity/i);
  });
});
