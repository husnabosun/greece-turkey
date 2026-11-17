#!/usr/bin/env python3
"""Local olive-leaf TFLite classifier (same as research/03_hf_space).

Reads one image path from argv[1], prints one JSON object to stdout:
  {"label": "...", "confidence": 0.93, "top3": [...]}
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageOps

try:
    from ai_edge_litert.interpreter import Interpreter
except ImportError:  # pragma: no cover
    from tensorflow.lite import Interpreter  # type: ignore

ROOT = Path(__file__).resolve().parents[1]
MODEL_DIR = ROOT / "_legacy" / "research" / "models"
LABELS = json.loads((MODEL_DIR / "labels.json").read_text(encoding="utf-8"))
INFO = json.loads((MODEL_DIR / "model_info.json").read_text(encoding="utf-8"))
PREPROCESS = INFO.get("preprocess", "letterbox")
SIZE = int(INFO.get("input_size", 224))

interpreter = Interpreter(model_path=str(MODEL_DIR / "leaf_disease.tflite"))
interpreter.allocate_tensors()
INPUT = interpreter.get_input_details()[0]
OUTPUT = interpreter.get_output_details()[0]


def letterbox(img: Image.Image, size: int) -> Image.Image:
    a = np.asarray(img)
    h, w = a.shape[:2]
    ring = max(2, int(0.02 * min(h, w)))
    border = np.concatenate(
        [
            a[:ring].reshape(-1, 3),
            a[-ring:].reshape(-1, 3),
            a[:, :ring].reshape(-1, 3),
            a[:, -ring:].reshape(-1, 3),
        ]
    )
    side = max(h, w)
    canvas = np.empty((side, side, 3), dtype=np.uint8)
    canvas[:] = np.median(border, axis=0).astype(np.uint8)
    top, left = (side - h) // 2, (side - w) // 2
    canvas[top : top + h, left : left + w] = a
    return Image.fromarray(canvas).resize((size, size), Image.BILINEAR)


def predict(path: Path) -> dict:
    img = ImageOps.exif_transpose(Image.open(path)).convert("RGB")
    img = letterbox(img, SIZE) if PREPROCESS == "letterbox" else img.resize((SIZE, SIZE), Image.BILINEAR)
    x = np.asarray(img, dtype=np.float32)[None]
    interpreter.set_tensor(INPUT["index"], x)
    interpreter.invoke()
    probs = interpreter.get_tensor(OUTPUT["index"])[0]
    order = np.argsort(-probs)
    top3 = [{"label": LABELS[i], "confidence": round(float(probs[i]), 4)} for i in order[:3]]
    return {"label": top3[0]["label"], "confidence": top3[0]["confidence"], "top3": top3}


def main() -> int:
    if len(sys.argv) < 2:
        print(json.dumps({"error": "usage: leaf-infer.py <image>"}), flush=True)
        return 2
    path = Path(sys.argv[1])
    if not path.is_file():
        print(json.dumps({"error": f"missing image: {path}"}), flush=True)
        return 2
    try:
        print(json.dumps(predict(path)), flush=True)
        return 0
    except Exception as exc:  # pragma: no cover
        print(json.dumps({"error": str(exc)}), flush=True)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
