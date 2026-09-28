export function createTilePlan(width, height, {
  coreSize = 96,
  padding = 12,
  modelScale = 4,
  outputScale = 2,
} = {}) {
  const w = Math.floor(Number(width));
  const h = Math.floor(Number(height));
  const core = Math.floor(Number(coreSize));
  const pad = Math.floor(Number(padding));
  if (!(w > 0) || !(h > 0)) throw new Error("Invalid source dimensions.");
  if (!(core >= 16)) throw new Error("Tile core must be at least 16 pixels.");
  if (!(pad >= 0 && pad < core)) throw new Error("Tile padding must be smaller than the tile core.");
  if (!(modelScale >= 1) || !(outputScale >= 1) || outputScale > modelScale) {
    throw new Error("Invalid model/output scale.");
  }

  const tiles = [];
  for (let y = 0; y < h; y += core) {
    for (let x = 0; x < w; x += core) {
      const coreWidth = Math.min(core, w - x);
      const coreHeight = Math.min(core, h - y);
      const sourceX = Math.max(0, x - pad);
      const sourceY = Math.max(0, y - pad);
      const sourceRight = Math.min(w, x + coreWidth + pad);
      const sourceBottom = Math.min(h, y + coreHeight + pad);
      const sourceWidth = sourceRight - sourceX;
      const sourceHeight = sourceBottom - sourceY;
      const cropLeft = (x - sourceX) * modelScale;
      const cropTop = (y - sourceY) * modelScale;

      tiles.push({
        index: tiles.length,
        core: { x, y, width: coreWidth, height: coreHeight },
        source: { x: sourceX, y: sourceY, width: sourceWidth, height: sourceHeight },
        modelCrop: {
          x: cropLeft,
          y: cropTop,
          width: coreWidth * modelScale,
          height: coreHeight * modelScale,
        },
        destination: {
          x: x * outputScale,
          y: y * outputScale,
          width: coreWidth * outputScale,
          height: coreHeight * outputScale,
        },
      });
    }
  }

  return {
    width: w,
    height: h,
    outputWidth: w * outputScale,
    outputHeight: h * outputScale,
    coreSize: core,
    padding: pad,
    modelScale,
    outputScale,
    tiles,
  };
}

export function chooseTileSize({
  backend = "wasm",
  deviceMemoryGiB = 0,
  mobile = false,
} = {}) {
  const memory = Number(deviceMemoryGiB) || 0;
  if (backend === "webgpu") {
    if (mobile || (memory > 0 && memory <= 4)) return 64;
    if (memory >= 12) return 128;
    return 96;
  }
  if (mobile || (memory > 0 && memory <= 4)) return 48;
  return 64;
}
