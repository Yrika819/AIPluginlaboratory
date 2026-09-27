import { replaceExtension } from "./file-tools.mjs";

export function calculateDimensions(width, height, maxWidth, maxHeight, allowUpscale = false) {
  const sourceWidth = Number(width);
  const sourceHeight = Number(height);
  if (!(sourceWidth > 0) || !(sourceHeight > 0)) throw new Error("Invalid image dimensions.");

  const targetWidth = Number(maxWidth) > 0 ? Number(maxWidth) : sourceWidth;
  const targetHeight = Number(maxHeight) > 0 ? Number(maxHeight) : sourceHeight;
  const scale = Math.min(targetWidth / sourceWidth, targetHeight / sourceHeight);
  const applied = allowUpscale ? scale : Math.min(1, scale);

  return {
    width: Math.max(1, Math.round(sourceWidth * applied)),
    height: Math.max(1, Math.round(sourceHeight * applied)),
  };
}

async function loadBitmap(file) {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file);
    } catch {
      // Safari and some image types need the <img> fallback.
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
      (blob) => blob ? resolve(blob) : reject(new Error("This browser could not encode the selected image format.")),
      type,
      quality,
    );
  });
}

export async function convertImage(file, {
  type = "image/webp",
  maxWidth = 0,
  maxHeight = 0,
  quality = 0.9,
  background = "#ffffff",
} = {}) {
  if (!(file instanceof Blob)) throw new Error("Select an image file first.");
  const bitmap = await loadBitmap(file);
  const width = bitmap.width || bitmap.naturalWidth;
  const height = bitmap.height || bitmap.naturalHeight;
  const target = calculateDimensions(width, height, maxWidth, maxHeight);

  const canvas = document.createElement("canvas");
  canvas.width = target.width;
  canvas.height = target.height;
  const context = canvas.getContext("2d", { alpha: type !== "image/jpeg" });
  if (!context) throw new Error("Canvas is unavailable.");

  if (type === "image/jpeg") {
    context.fillStyle = background;
    context.fillRect(0, 0, canvas.width, canvas.height);
  }
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(bitmap, 0, 0, target.width, target.height);

  if (typeof bitmap.close === "function") bitmap.close();

  const blob = await canvasToBlob(canvas, type, Math.max(0, Math.min(1, Number(quality))));
  const extensions = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/webp": "webp",
  };
  return {
    blob,
    width: target.width,
    height: target.height,
    name: replaceExtension(file.name || "image", extensions[type] || "img"),
  };
}
