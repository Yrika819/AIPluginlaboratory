#!/usr/bin/env python3
"""
Export the official Real-ESRGAN realesr-general-x4v3 weights to ONNX.

The SRVGGNetCompact architecture is derived from xinntao/Real-ESRGAN
(BSD-3-Clause). See THIRD_PARTY_NOTICES.md.
"""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
from urllib.request import urlopen

import numpy as np
import onnx
import onnxruntime as ort
import torch
from torch import nn
from torch.nn import functional as F

MODEL_URL = (
    "https://github.com/xinntao/Real-ESRGAN/releases/download/"
    "v0.2.5.0/realesr-general-x4v3.pth"
)
EXPECTED_BYTES = 4_885_111
EXPECTED_SOURCE_SHA256 = "8dc7edb9ac80ccdc30c3a5dca6616509367f05fbc184ad95b731f05bece96292"
EXPECTED_ONNX_SHA256 = "d239f0d59ce61e9746143d1296c3441585756e4e9a5c10e0c2f371cda5f69a4d"


class SRVGGNetCompact(nn.Module):
    def __init__(
        self,
        num_in_ch: int = 3,
        num_out_ch: int = 3,
        num_feat: int = 64,
        num_conv: int = 32,
        upscale: int = 4,
    ) -> None:
        super().__init__()
        self.upscale = upscale
        body: list[nn.Module] = [nn.Conv2d(num_in_ch, num_feat, 3, 1, 1), nn.PReLU(num_feat)]
        for _ in range(num_conv):
            body.extend([nn.Conv2d(num_feat, num_feat, 3, 1, 1), nn.PReLU(num_feat)])
        body.append(nn.Conv2d(num_feat, num_out_ch * upscale * upscale, 3, 1, 1))
        self.body = nn.ModuleList(body)
        self.upsampler = nn.PixelShuffle(upscale)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        out = x
        for layer in self.body:
            out = layer(out)
        out = self.upsampler(out)
        return out + F.interpolate(x, scale_factor=self.upscale, mode="nearest")


def download(url: str, destination: Path) -> tuple[str, int]:
    destination.parent.mkdir(parents=True, exist_ok=True)
    digest = hashlib.sha256()
    size = 0
    with urlopen(url) as response, destination.open("wb") as handle:
        while chunk := response.read(1024 * 1024):
            digest.update(chunk)
            size += len(chunk)
            handle.write(chunk)
    return digest.hexdigest(), size


def load_weights(path: Path) -> dict[str, torch.Tensor]:
    checkpoint = torch.load(path, map_location="cpu", weights_only=True)
    if "params_ema" in checkpoint:
        checkpoint = checkpoint["params_ema"]
    elif "params" in checkpoint:
        checkpoint = checkpoint["params"]
    if not isinstance(checkpoint, dict):
        raise TypeError("Unexpected Real-ESRGAN checkpoint structure")
    return checkpoint


def export_model(model: nn.Module, output: Path) -> None:
    output.parent.mkdir(parents=True, exist_ok=True)
    model.eval()
    sample = torch.linspace(0, 1, 3 * 32 * 32, dtype=torch.float32).reshape(1, 3, 32, 32)
    torch.onnx.export(
        model,
        sample,
        output,
        input_names=["input"],
        output_names=["output"],
        opset_version=18,
        do_constant_folding=True,
        dynamic_axes={
            "input": {2: "height", 3: "width"},
            "output": {2: "output_height", 3: "output_width"},
        },
        dynamo=False,
    )


def verify(model: nn.Module, onnx_path: Path) -> dict[str, float | list[int]]:
    onnx_model = onnx.load(onnx_path)
    onnx.checker.check_model(onnx_model)

    generator = torch.Generator().manual_seed(20260928)
    sample = torch.rand((1, 3, 24, 20), generator=generator, dtype=torch.float32)
    with torch.inference_mode():
        expected = model(sample).numpy()

    session = ort.InferenceSession(str(onnx_path), providers=["CPUExecutionProvider"])
    actual = session.run(["output"], {"input": sample.numpy()})[0]

    max_abs_error = float(np.max(np.abs(expected - actual)))
    mean_abs_error = float(np.mean(np.abs(expected - actual)))
    if actual.shape != expected.shape:
        raise AssertionError(f"Shape mismatch: {actual.shape} != {expected.shape}")
    if max_abs_error > 2e-4:
        raise AssertionError(f"ONNX numerical mismatch: max_abs_error={max_abs_error}")

    return {
        "input_shape": list(sample.shape),
        "output_shape": list(actual.shape),
        "max_abs_error": max_abs_error,
        "mean_abs_error": mean_abs_error,
    }


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        while chunk := handle.read(1024 * 1024):
            digest.update(chunk)
    return digest.hexdigest()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--weights", type=Path, default=Path(".cache/ai/realesr-general-x4v3.pth"))
    parser.add_argument("--metadata", type=Path, required=True)
    args = parser.parse_args()

    if not args.weights.exists():
        weight_sha, weight_bytes = download(MODEL_URL, args.weights)
    else:
        weight_sha = sha256(args.weights)
        weight_bytes = args.weights.stat().st_size

    if weight_bytes != EXPECTED_BYTES:
        raise AssertionError(f"Unexpected official weight size: {weight_bytes} != {EXPECTED_BYTES}")
    if weight_sha != EXPECTED_SOURCE_SHA256:
        raise AssertionError(f"Official weight SHA-256 mismatch: {weight_sha}")

    model = SRVGGNetCompact(num_conv=32, upscale=4)
    state = load_weights(args.weights)
    missing, unexpected = model.load_state_dict(state, strict=False)
    if missing or unexpected:
        raise AssertionError(f"Weight mismatch. missing={missing}, unexpected={unexpected}")
    model.eval()

    export_model(model, args.output)
    verification = verify(model, args.output)
    model_sha = sha256(args.output)
    if model_sha != EXPECTED_ONNX_SHA256:
        raise AssertionError(f"Exported ONNX SHA-256 mismatch: {model_sha}")

    metadata = {
        "id": "realesr-general-x4v3",
        "source": MODEL_URL,
        "source_sha256": weight_sha,
        "source_bytes": weight_bytes,
        "onnx_sha256": model_sha,
        "onnx_bytes": args.output.stat().st_size,
        "native_scale": 4,
        "license": "BSD-3-Clause",
        "verification": verification,
    }
    args.metadata.parent.mkdir(parents=True, exist_ok=True)
    args.metadata.write_text(json.dumps(metadata, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(metadata, indent=2))


if __name__ == "__main__":
    main()
