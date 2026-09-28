export const GENERAL_X4V3 = Object.freeze({
  id: "realesr-general-x4v3",
  label: "Real-ESRGAN General",
  relativeUrl: "./models/realesr-general-x4v3.onnx",
  sourceUrl: "https://github.com/xinntao/Real-ESRGAN/releases/download/v0.2.5.0/realesr-general-x4v3.pth",
  sourceSha256: "8dc7edb9ac80ccdc30c3a5dca6616509367f05fbc184ad95b731f05bece96292",
  sourceBytes: 4_885_111,
  onnxSha256: "d239f0d59ce61e9746143d1296c3441585756e4e9a5c10e0c2f371cda5f69a4d",
  onnxBytes: 4_866_426,
  nativeScale: 4,
  defaultOutputScale: 2,
  license: "BSD-3-Clause",
});

export const AI_MODELS = Object.freeze([GENERAL_X4V3]);

export function resolveModelUrl(model = GENERAL_X4V3, baseUrl = globalThis.document?.baseURI) {
  if (!baseUrl) throw new Error("A base URL is required to resolve the AI model.");
  return new URL(model.relativeUrl, baseUrl).href;
}
