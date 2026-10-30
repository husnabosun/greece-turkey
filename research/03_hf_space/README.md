---
title: AgroPulse Olive Leaf
emoji: 🫒
colorFrom: green
colorTo: yellow
sdk: gradio
sdk_version: 5.0.0
app_file: app.py
pinned: false
license: mit
---

# AgroPulse olive leaf demo

A small Gradio app that runs the TFLite model from `research/02_leaf_disease_model.ipynb`.
You send one photo of one olive leaf and get back JSON:

```json
{
  "label": "Olive Peacock Spot",
  "confidence": 0.93,
  "top3": [
    {"label": "Olive Peacock Spot", "confidence": 0.93},
    {"label": "Healthy", "confidence": 0.05},
    {"label": "Aculus Olearius", "confidence": 0.02}
  ]
}
```

> Research prototype trained on Turkish leaf photos (Denizli). It is a hint, **not a diagnosis**. Ask a licensed agronomist.

## Files

| File | What it is |
|---|---|
| `app.py` | the Gradio app |
| `requirements.txt` | Python packages |
| `leaf_disease.tflite` | **you add this**: from the notebook outputs, `models/leaf_disease.tflite` |
| `labels.json` | **you add this**: from the notebook outputs, `models/labels.json` |
| `model_info.json` | **you add this**: from the notebook outputs, `models/model_info.json` (tells the app which preprocessing the model needs) |

## Run it on your computer first (optional)

```bash
cd research/03_hf_space
cp ../models/leaf_disease.tflite ../models/labels.json ../models/model_info.json .     # on Windows: copy the three files by hand
pip install -r requirements.txt
python app.py                                                  # opens http://127.0.0.1:7860
```

## Deploy for free on Hugging Face Spaces (step by step)

1. Make a free account at <https://huggingface.co/join>.
2. Click **New → Space** (<https://huggingface.co/new-space>).
   * Space name: `agropulse-olive-leaf`
   * SDK: **Gradio**
   * Hardware: **CPU basic (free)**
   * Visibility: Public (or Private)
   * Click **Create Space**.
3. In the Space, open the **Files** tab → **Add file → Upload files**.
4. Upload these 6 files from this folder: `app.py`, `requirements.txt`, `README.md`, `leaf_disease.tflite`, `labels.json`, `model_info.json`.
   (The two model files come from `research/models/` after you run the notebook.)
5. Click **Commit changes to main**. The Space builds for 1–3 minutes. Watch the **Logs** tab; when it says *Running on local URL*, it is live.
6. Open the Space URL: `https://huggingface.co/spaces/<your-name>/agropulse-olive-leaf`. Upload a leaf photo to try it.

### Use it as an API (JSON)

With Python:

```python
from gradio_client import Client

client = Client("<your-name>/agropulse-olive-leaf")
result = client.predict("leaf.jpg", api_name="/predict")   # use gradio_client.handle_file("leaf.jpg") on newer versions
print(result)   # {"label": ..., "confidence": ..., "top3": [...]}
```

With curl (two steps: send, then read the result):

```bash
# 1. send the image (it must be uploaded first, then referenced)
curl -s -X POST "https://<your-name>-agropulse-olive-leaf.hf.space/gradio_api/upload" -F "files=@leaf.jpg"
#    -> ["/tmp/gradio/.../leaf.jpg"]

# 2. call the function with that path and read the event id, then stream the result
curl -s -X POST "https://<your-name>-agropulse-olive-leaf.hf.space/gradio_api/call/predict" \
  -H "Content-Type: application/json" \
  -d '{"data": [{"path": "/tmp/gradio/.../leaf.jpg", "meta": {"_type": "gradio.FileData"}}]}'
#    -> {"event_id": "abc123"}
curl -N "https://<your-name>-agropulse-olive-leaf.hf.space/gradio_api/call/predict/abc123"
```

The Python client is the easiest way. Free Spaces go to sleep after some days without visitors; the first call after that takes about a minute.

## Notes

* The model expects an RGB image with values 0–255. `app.py` reads `model_info.json` and prepares the photo like in training: **v2** pads it to a square with its own border colour (letterbox) and resizes to 224×224; **v1** (no `model_info.json`) squashes it to 256×256 and the model crops the centre itself.
* Do not put API keys in this Space. The app needs none.
