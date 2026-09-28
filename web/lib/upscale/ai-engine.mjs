import { replaceExtension } from "../file-tools.mjs";
import { detectUpscaleCapabilities } from "./capabilities.mjs";
import { createTilePlan, chooseTileSize } from "./tiling.mjs";
import { validateAiBudget } from "./memory-budget.mjs";
import { GENERAL_X4V3, resolveModelUrl } from "./model-registry.mjs";

let ortPromise;

async function getOrt() {
  if (!ortPromise) {
    ortPromise = import("onnxruntime-web/all").then((ort) => {
      const base = new URL("./ort/", document.baseURI).href;
      ort.env.wasm.wasmPaths = base;
      ort.env.wasm.numThreads = globalThis.crossOriginIsolated
        ? Math.max(1, Math.min(4, Number(navigator.hardwareConcurrency) || 1))
        : 1;
      ort.env.logLevel = "warning";
      return ort;
    });
  }
  return ortPromise;
}

export async function sha256Hex(data) {
  const bytes = data instanceof ArrayBuffer
    ? data
    : data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("");
}

export async function fetchVerifiedModel(model = GENERAL_X4V3, {
  baseUrl = document.baseURI,
  fetchImpl = fetch,
} = {}) {
  const url = resolveModelUrl(model, baseUrl);
  const response = await fetchImpl(url, { cache: "force-cache" });
  if (!response.ok) throw new Error(`AI model download failed (HTTP ${response.status}).`);
  const buffer = await response.arrayBuffer();
  if (buffer.byteLength !== model.onnxBytes) {
    throw new Error(`AI model size mismatch: ${buffer.byteLength} bytes.`);
  }
  const digest = await sha256Hex(buffer);
  if (digest !== model.onnxSha256) {
    throw new Error("AI model integrity check failed.");
  }
  return { buffer, digest, url };
}

export async function createAiSession({
  model = GENERAL_X4V3,
  preferredBackend,
  onStatus,
} = {}) {
  const capabilities = detectUpscaleCapabilities();
  const preferred = preferredBackend || capabilities.preferredBackend;
  if (preferred === "none") throw new Error("This browser cannot run local AI inference.");

  onStatus?.("Downloading and verifying AI model…");
  const verified = await fetchVerifiedModel(model);
  const ort = await getOrt();
  const candidates = preferred === "webgpu" ? ["webgpu", "wasm"] : ["wasm"];
  let lastError;

  for (const backend of candidates) {
    try {
      // ONNX Runtime recommends proxying heavy WASM work to a Web Worker to
      // keep the UI responsive. The proxy mode cannot be combined with WebGPU.
      ort.env.wasm.proxy = backend === "wasm";
      onStatus?.(`Starting ${backend === "webgpu" ? "WebGPU" : "WebAssembly worker"} AI engine…`);
      const session = await ort.InferenceSession.create(verified.buffer, {
        executionProviders: [backend],
        graphOptimizationLevel: "all",
      });
      return { ort, session, backend, model, capabilities };
    } catch (error) {
      lastError = error;
      if (backend !== "webgpu") break;
      onStatus?.("WebGPU initialization failed; falling back to WebAssembly…");
    }
  }
  throw new Error(`AI engine initialization failed: ${lastError instanceof Error ? lastError.message : lastError}`);
}

function abortIfNeeded(signal) {
  if (signal?.aborted) throw new DOMException("AI upscale cancelled.", "AbortError");
}

function imageDataToTensor(ort, imageData) {
  const { width, height, data } = imageData;
  const plane = width * height;
  const tensorData = new Float32Array(plane * 3);
  for (let index = 0; index < plane; index += 1) {
    const pixel = index * 4;
    tensorData[index] = data[pixel] / 255;
    tensorData[plane + index] = data[pixel + 1] / 255;
    tensorData[plane * 2 + index] = data[pixel + 2] / 255;
  }
  return new ort.Tensor("float32", tensorData, [1, 3, height, width]);
}

function tensorToCanvas(tensor) {
  const dims = tensor.dims.map(Number);
  if (dims.length !== 4 || dims[0] !== 1 || dims[1] !== 3) {
    throw new Error(`Unexpected AI output shape: ${dims.join("×")}`);
  }
  const height = dims[2];
  const width = dims[3];
  const plane = width * height;
  const source = tensor.data;
  const pixels = new Uint8ClampedArray(plane * 4);
  for (let index = 0; index < plane; index += 1) {
    const pixel = index * 4;
    pixels[pixel] = Math.round(Math.max(0, Math.min(1, source[index])) * 255);
    pixels[pixel + 1] = Math.round(Math.max(0, Math.min(1, source[plane + index])) * 255);
    pixels[pixel + 2] = Math.round(Math.max(0, Math.min(1, source[plane * 2 + index])) * 255);
    pixels[pixel + 3] = 255;
  }
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas is unavailable.");
  context.putImageData(new ImageData(pixels, width, height), 0, 0);
  return canvas;
}

async function loadBitmap(file) {
  if (!(file instanceof Blob)) throw new Error("Select an image file first.");
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file);
    } catch {
      // Fall through for codecs that need an HTMLImageElement.
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.decoding = "async";
    image.src = url;
    await image.decode();
    return image;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => blob ? resolve(blob) : reject(new Error("Could not encode AI output.")),
      type,
      quality,
    );
  });
}

function pickSafePlan(width, height, sessionInfo, outputScale) {
  const { capabilities, model, backend } = sessionInfo;
  const preferred = chooseTileSize({
    backend,
    deviceMemoryGiB: capabilities.deviceMemoryGiB,
    mobile: capabilities.mobile,
  });
  const candidates = [...new Set([preferred, 128, 96, 64, 48, 32])]
    .filter((value) => value <= preferred)
    .sort((a, b) => b - a);

  for (const coreSize of candidates) {
    const input = {
      width,
      height,
      coreSize,
      padding: Math.min(12, Math.floor(coreSize / 4)),
      modelScale: model.nativeScale,
      outputScale,
    };
    const budget = validateAiBudget(input, { mobile: capabilities.mobile });
    if (budget.safe) {
      return {
        plan: createTilePlan(width, height, input),
        budget,
      };
    }
  }
  throw new Error("This image is too large for the current AI memory safety budget.");
}

export async function aiUpscale(file, {
  outputScale = GENERAL_X4V3.defaultOutputScale,
  type = "image/png",
  quality = 0.92,
  preferredBackend,
  signal,
  onProgress,
  onStatus,
} = {}) {
  const started = performance.now();
  const bitmap = await loadBitmap(file);
  const width = bitmap.width || bitmap.naturalWidth;
  const height = bitmap.height || bitmap.naturalHeight;
  const sourceCanvas = document.createElement("canvas");
  sourceCanvas.width = width;
  sourceCanvas.height = height;
  const sourceContext = sourceCanvas.getContext("2d", { willReadFrequently: true });
  if (!sourceContext) throw new Error("Canvas is unavailable.");
  sourceContext.drawImage(bitmap, 0, 0);
  if (typeof bitmap.close === "function") bitmap.close();

  const sessionInfo = await createAiSession({ preferredBackend, onStatus });
  const { ort, session, model, backend } = sessionInfo;
  const { plan, budget } = pickSafePlan(width, height, sessionInfo, Number(outputScale));

  const output = document.createElement("canvas");
  output.width = plan.outputWidth;
  output.height = plan.outputHeight;
  const outputContext = output.getContext("2d", { alpha: true });
  if (!outputContext) throw new Error("Canvas is unavailable.");
  outputContext.imageSmoothingEnabled = true;
  outputContext.imageSmoothingQuality = "high";

  const inputName = session.inputNames[0];
  const outputName = session.outputNames[0];

  for (const tile of plan.tiles) {
    abortIfNeeded(signal);
    onStatus?.(`AI tile ${tile.index + 1} of ${plan.tiles.length}…`);

    const patch = document.createElement("canvas");
    patch.width = tile.source.width;
    patch.height = tile.source.height;
    const patchContext = patch.getContext("2d", { willReadFrequently: true });
    if (!patchContext) throw new Error("Canvas is unavailable.");
    patchContext.drawImage(
      sourceCanvas,
      tile.source.x, tile.source.y, tile.source.width, tile.source.height,
      0, 0, tile.source.width, tile.source.height,
    );

    const input = imageDataToTensor(ort, patchContext.getImageData(0, 0, patch.width, patch.height));
    const result = await session.run({ [inputName]: input });
    abortIfNeeded(signal);
    const tileCanvas = tensorToCanvas(result[outputName]);

    outputContext.drawImage(
      tileCanvas,
      tile.modelCrop.x,
      tile.modelCrop.y,
      tile.modelCrop.width,
      tile.modelCrop.height,
      tile.destination.x,
      tile.destination.y,
      tile.destination.width,
      tile.destination.height,
    );

    patch.width = 1;
    patch.height = 1;
    tileCanvas.width = 1;
    tileCanvas.height = 1;
    onProgress?.((tile.index + 1) / plan.tiles.length);
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  // Restore the source alpha channel at final resolution.
  const alphaCanvas = document.createElement("canvas");
  alphaCanvas.width = output.width;
  alphaCanvas.height = output.height;
  const alphaContext = alphaCanvas.getContext("2d", { willReadFrequently: true });
  if (alphaContext) {
    alphaContext.imageSmoothingEnabled = true;
    alphaContext.imageSmoothingQuality = "high";
    alphaContext.drawImage(sourceCanvas, 0, 0, output.width, output.height);
    const alpha = alphaContext.getImageData(0, 0, output.width, output.height);
    const rendered = outputContext.getImageData(0, 0, output.width, output.height);
    for (let index = 3; index < rendered.data.length; index += 4) {
      rendered.data[index] = alpha.data[index];
    }
    outputContext.putImageData(rendered, 0, 0);
  }

  const blob = await canvasToBlob(output, type, Math.max(0, Math.min(1, Number(quality))));
  const extensions = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };
  return {
    blob,
    width: output.width,
    height: output.height,
    name: replaceExtension(file.name || "image", extensions[type] || "img"),
    backend,
    modelId: model.id,
    tileSize: plan.coreSize,
    tileCount: plan.tiles.length,
    estimatedMemoryBytes: budget.estimatedBytes,
    elapsedMs: performance.now() - started,
  };
}
