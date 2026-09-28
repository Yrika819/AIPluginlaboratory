# Third-party notices

PocketBench keeps its runtime dependency surface deliberately small.

## Runtime

- **fflate 0.8.3** — MIT License — compression, GZIP and ZIP support.
- **yaml 2.9.1** — ISC License — YAML parsing and serialization.
- **onnxruntime-web 1.30.0** — MIT License — local ONNX inference with WebGPU/WASM.

## Development and testing

- **Vite 8.3.1** — MIT License.
- **Vitest 5.0.2** — MIT License.
- **Playwright Test 1.63.0** — Apache-2.0 License.

These packages are used according to their respective licenses. PocketBench itself is licensed under the MIT License in [LICENSE](LICENSE).

## AI model source

- **Real-ESRGAN realesr-general-x4v3** — BSD-3-Clause — model architecture and official weights by Xintao Wang / Real-ESRGAN contributors.
  PocketBench converts the official release weight to ONNX in CI and verifies the result numerically before distribution.
  Upstream: https://github.com/xinntao/Real-ESRGAN

The Real-ESRGAN BSD-3-Clause notice is preserved in `licenses/Real-ESRGAN-BSD-3-Clause.txt`.
