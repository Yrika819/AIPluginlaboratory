# PocketBench

PocketBench is a local-first utility toolbox that runs in a modern browser and can be installed as a PWA on Android, macOS, and Windows.

**Nothing you process is uploaded to a PocketBench server.** There is no backend, account, analytics SDK, advertising SDK, or API key.

## What it does

### Files
- Create ZIP archives from multiple files.
- GZIP a single file.
- Extract ZIP and GZIP archives.
- Calculate SHA-256, SHA-384, and SHA-512 checksums.
- Encode files as Base64 and restore Base64 text back to binary files.
- Split large files into numbered parts.
- Join numbered parts back together.

### Images
- Convert browser-supported images to PNG, JPEG, or WebP.
- Resize while preserving aspect ratio.
- Standard high-quality upscale at 1.5×, 2×, 3×, or 4×.
- **AI General x2 (beta)** using a locally executed Real-ESRGAN model.
- AI prefers WebGPU on supported Chromium browsers and falls back to WebAssembly.
- AI inference uses overlap-aware tiles and a conservative device memory budget.
- The ~4.9 MB ONNX model is generated from the official Real-ESRGAN release weight in CI, numerically verified, SHA-256 pinned, and only fetched when AI upscale is first used.
- Control JPEG/WebP quality.
- Re-encode images, which also removes common embedded metadata.

### Data
- Open CSV, TSV, JSON, YAML, and text files directly into the Data workspace.
- CSV / TSV / semicolon / pipe-delimited data to JSON.
- JSON to CSV or TSV.
- JSON to YAML.
- YAML to JSON.
- URL query strings to JSON.
- Pretty-print and minify JSON.

### Text
- Normalize whitespace.
- Trim every line.
- Remove blank lines.
- Deduplicate and naturally sort lines.
- Change case and create slugs.
- Convert LF / CRLF line endings.
- URL encode/decode.
- Base64 encode/decode UTF-8 text.
- Generate UUIDs.
- Live character, word, line, and UTF-8 byte counts.

## Privacy and safety model

PocketBench processes data in browser memory. It makes no application-level network requests for your files or text.

The production build includes an offline service worker that precaches the application shell. After a successful online load, the installed app can continue to work without a network connection.

To reduce accidental browser crashes, in-memory file operations are limited to **512 MiB per operation**. This is not a security boundary; it is a practical guardrail for phones and laptops.

## Known limitations

- Archive and hash operations currently require the selected file to fit in memory.
- Image conversion depends on formats supported by the browser.
- AI upscale is currently beta and fixed to 2× output.
- WebGPU AI acceleration currently targets supported Chromium browsers; other browsers use WASM when practical.
- AI upscale rejects images whose estimated output/memory footprint exceeds the configured safety budget.
- Animated images are flattened when re-encoded through Canvas.
- PNG ignores the quality slider because PNG encoding is lossless in browser Canvas.
- A PWA cannot replace native OS file-manager integration; downloads are still mediated by the browser.

## Development

Requirements:
- Node.js 24+

Install dependencies:

    npm install

Run unit tests:

    npm test

Run static checks:

    npm run check

Build production assets:

    npm run build

Run the local production preview:

    npm run preview

Install Playwright browsers and run end-to-end tests:

    npx playwright install chromium firefox webkit
    npm run test:e2e

## CI

GitHub Actions verifies:
- Node unit tests.
- Static project checks.
- Production builds on Ubuntu 24.04, Windows 2025, and macOS 15.
- Browser end-to-end tests on Chromium, Firefox, WebKit, and a Pixel-class mobile Chromium profile.
- Offline PWA startup smoke test.
- Runtime dependency audit.
- Verified official Real-ESRGAN → ONNX export and numerical parity check.
- Real ONNX Runtime Web inference in Chromium using the production browser bundle.
- Standard upscale on the normal cross-browser E2E matrix.
- Production artifact generation including the verified AI model.

## Third-party software

Runtime dependencies are intentionally limited to:
- [fflate](https://github.com/101arrowz/fflate) — MIT — ZIP/GZIP.
- [yaml](https://github.com/eemeli/yaml) — ISC — YAML parsing/serialization.
- [ONNX Runtime Web](https://onnxruntime.ai/) — MIT — local WebGPU/WASM inference.
- [Real-ESRGAN](https://github.com/xinntao/Real-ESRGAN) — BSD-3-Clause — AI super-resolution architecture and official model weights.

See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

## License

PocketBench is licensed under the MIT License. See [LICENSE](LICENSE).
