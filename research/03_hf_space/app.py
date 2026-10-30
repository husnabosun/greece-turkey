"""AgroPulse olive leaf demo: a small Gradio app around the TFLite model.

Input: one photo of one olive leaf.
Output (JSON): {"label": ..., "confidence": ..., "top3": [{"label": ..., "confidence": ...}, ...]}

Also available as an API: POST /call/predict (see the README).
"""
import json
from pathlib import Path

import gradio as gr
import numpy as np
from PIL import Image, ImageOps

try:  # small runtime, no full TensorFlow needed
    from ai_edge_litert.interpreter import Interpreter
except ImportError:  # fallback if TensorFlow is installed instead
    from tensorflow.lite import Interpreter  # type: ignore

HERE = Path(__file__).parent
# On Hugging Face the model files sit next to app.py. Locally they are in research/models/ (the notebook output).
MODEL_DIR = HERE if (HERE / "leaf_disease.tflite").exists() else HERE.parent / "models"
LABELS = json.loads((MODEL_DIR / "labels.json").read_text())

interpreter = Interpreter(model_path=str(MODEL_DIR / "leaf_disease.tflite"))
interpreter.allocate_tensors()
INPUT = interpreter.get_input_details()[0]
OUTPUT = interpreter.get_output_details()[0]
SIZE = int(INPUT["shape"][1])  # v1: 256 (the model crops to 224 itself), v2: 224

INFO_FILE = MODEL_DIR / "model_info.json"  # written by the notebook; older v1 exports have none
PREPROCESS = json.loads(INFO_FILE.read_text())["preprocess"] if INFO_FILE.exists() else "resize_center_crop"


def letterbox(img: Image.Image, size: int) -> Image.Image:
    """Pad to a square with the photo's own border colour (same as the notebook), then resize."""
    a = np.asarray(img)
    h, w = a.shape[:2]
    ring = max(2, int(0.02 * min(h, w)))
    border = np.concatenate([a[:ring].reshape(-1, 3), a[-ring:].reshape(-1, 3), a[:, :ring].reshape(-1, 3), a[:, -ring:].reshape(-1, 3)])
    side = max(h, w)
    canvas = np.empty((side, side, 3), dtype=np.uint8)
    canvas[:] = np.median(border, axis=0).astype(np.uint8)
    top, left = (side - h) // 2, (side - w) // 2
    canvas[top:top + h, left:left + w] = a
    return Image.fromarray(canvas).resize((size, size), Image.BILINEAR)


def predict(image: Image.Image) -> dict:
    """Classify one leaf photo."""
    if image is None:
        return {"error": "Send a photo of one olive leaf."}
    img = ImageOps.exif_transpose(image).convert("RGB")
    img = letterbox(img, SIZE) if PREPROCESS == "letterbox" else img.resize((SIZE, SIZE), Image.BILINEAR)
    x = np.asarray(img, dtype=np.float32)[None]  # values 0..255, like in training
    interpreter.set_tensor(INPUT["index"], x)
    interpreter.invoke()
    probs = interpreter.get_tensor(OUTPUT["index"])[0]
    order = np.argsort(-probs)
    top3 = [{"label": LABELS[i], "confidence": round(float(probs[i]), 4)} for i in order[:3]]
    return {"label": top3[0]["label"], "confidence": top3[0]["confidence"], "top3": top3}


demo = gr.Interface(
    fn=predict,
    inputs=gr.Image(type="pil", label="Photo of one olive leaf"),
    outputs=gr.JSON(label="Result"),
    title="AgroPulse olive leaf check",
    description=(
        "Upload a photo of one olive leaf: healthy, peacock spot, or Aculus olearius damage. "
        "Research prototype trained on Turkish leaf photos. It is a hint, not a diagnosis: "
        "please ask a licensed agronomist."
    ),
    api_name="predict",
)

if __name__ == "__main__":
    demo.launch()
