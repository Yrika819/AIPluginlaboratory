# PocketBench

PocketBench is a small, local-first toolbox for text and lightweight data work.

It runs as an installable Progressive Web App (PWA) on Android, macOS, and Windows. All transformations happen in your browser. There is no backend, account, telemetry, or API key.

## Features

- Normalize whitespace and line endings
- Remove duplicate lines
- Sort lines ascending or descending
- Pretty-print and minify JSON
- URL encode and decode text
- Base64 encode and decode UTF-8 text
- Generate UUIDs
- Live character, word, line, and UTF-8 byte counts
- Offline support after the first successful load

## Run locally

Any static web server works. For example:

    python -m http.server 8080 -d web

Then open http://localhost:8080.

## Test and build

Requires Node.js 24 or newer.

    npm test
    npm run check
    npm run build

The production-ready static bundle is written to `dist/`.

## Install

Open the deployed site in a modern browser and choose the browser's install / add-to-home-screen option.

- Android: Chrome or another PWA-capable browser
- Windows: Edge/Chrome
- macOS: Safari/Chrome/Edge

## Privacy

PocketBench does not send your input anywhere. The app has no network API calls. The service worker only caches the app's own static files so it can work offline.

## License

MIT. See [LICENSE](LICENSE).
