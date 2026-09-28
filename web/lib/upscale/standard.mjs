import { replaceExtension } from "../file-tools.mjs";

export function upscaleDimensions(width, height, scale) {
  const w = Number(width);
  const h = Number(height);
  const s = Number(scale);
  if (!(w > 0) || !(h > 0)) throw new Error("Invalid image dimensions.");
  if (!(s >= 1 && s <= 8)) throw new Error("Upscale factor must be between 1× and 8×.");
  return {
    width: Math.max(1, Math.round(w * s)),
    height: Math.max(1, Math.round(h * s)),
  };
}

export function progressiveSteps(scale, maxStep = 2) {
  let remaining = Number(scale);
  if (!(remaining >= 1)) throw new Error("Scale must be at least 1.");
  const steps = [];
  while (remaining > 1 + 1e-9) {
    const step = Math.min(maxStep, remaining);
    steps.push(step);
    remaining /= step;
  }
  return steps;
}

async function loadBitmap(file) {
  if (!(file instanceof Blob)) throw new Error("Select an image file first.");
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file);
    } catch {
      // Fall back for browsers/codecs that createImageBitmap cannot decode.
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

function toBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => blob ? resolve(blob) : reject(new Error("This browser could not encode the upscaled image.")),
      type,
      quality,
    );
  });
}

function makeCanvas(width, height) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

export async function standardUpscale(file, {
  scale = 2,
  type = "image/png",
  quality = 0.92,
  background = "#ffffff",
} = {}) {
  const bitmap = await loadBitmap(file);
  const sourceWidth = bitmap.width || bitmap.naturalWidth;
  const sourceHeight = bitmap.height || bitmap.naturalHeight;
  const target = upscaleDimensions(sourceWidth, sourceHeight, scale);

  let source = bitmap;
  let currentWidth = sourceWidth;
  let currentHeight = sourceHeight;
  const steps = progressiveSteps(scale);

  for (const step of steps) {
    const nextWidth = Math.min(target.width, Math.max(1, Math.round(currentWidth * step)));
    const nextHeight = Math.min(target.height, Math.max(1, Math.round(currentHeight * step)));
    const canvas = makeCanvas(nextWidth, nextHeight);
    const context = canvas.getContext("2d", { alpha: type !== "image/jpeg" });
    if (!context) throw new Error("Canvas is unavailable.");

    if (type === "image/jpeg") {
      context.fillStyle = background;
      context.fillRect(0, 0, nextWidth, nextHeight);
    }
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(source, 0, 0, nextWidth, nextHeight);

    if (source !== bitmap && source instanceof HTMLCanvasElement) {
      source.width = 1;
      source.height = 1;
    }
    source = canvas;
    currentWidth = nextWidth;
    currentHeight = nextHeight;
  }

  if (steps.length === 0) {
    const canvas = makeCanvas(sourceWidth, sourceHeight);
    const context = canvas.getContext("2d", { alpha: type !== "image/jpeg" });
    if (!context) throw new Error("Canvas is unavailable.");
    context.drawImage(source, 0, 0);
    source = canvas;
  }

  if (typeof bitmap.close === "function") bitmap.close();

  const blob = await toBlob(source, type, Math.max(0, Math.min(1, Number(quality))));
  const extensions = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };
  return {
    blob,
    width: target.width,
    height: target.height,
    scale: Number(scale),
    name: replaceExtension(file.name || "image", extensions[type] || "img"),
  };
}
