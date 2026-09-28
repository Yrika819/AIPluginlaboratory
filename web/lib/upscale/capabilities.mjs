export function detectUpscaleCapabilities(environment = globalThis) {
  const navigatorLike = environment.navigator ?? {};
  const userAgent = String(navigatorLike.userAgent ?? "");
  const mobile = /Android|iPhone|iPad|Mobile/i.test(userAgent);
  const webgpu = Boolean(navigatorLike.gpu);
  const wasm = typeof environment.WebAssembly === "object";
  const deviceMemoryGiB = Number(navigatorLike.deviceMemory) || 0;

  return {
    webgpu,
    wasm,
    mobile,
    deviceMemoryGiB,
    preferredBackend: webgpu ? "webgpu" : wasm ? "wasm" : "none",
  };
}

export function backendLabel(backend) {
  if (backend === "webgpu") return "WebGPU";
  if (backend === "wasm") return "WebAssembly";
  return "Unavailable";
}
