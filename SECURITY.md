# Security

PocketBench is designed to keep user files on-device.

## Data handling

- There is no PocketBench backend.
- File contents are processed in browser memory.
- The application does not intentionally transmit selected files, pasted text, generated hashes, or converted output.
- Third-party runtime code is bundled into the production build rather than loaded from a CDN.

## Reporting a vulnerability

Please open a GitHub issue with enough detail to reproduce the problem, but do not include private files, credentials, tokens, or other sensitive data.

## Untrusted archives

PocketBench sanitizes archive paths before presenting extracted entries. It also inspects declared ZIP/GZIP expansion sizes and rejects archives that exceed the in-memory safety limit before normal extraction. Extraction happens in browser memory and does not write archive paths directly to the operating-system filesystem.
