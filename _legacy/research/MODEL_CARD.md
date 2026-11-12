# Model card: AgroPulse olive leaf disease classifier

*Generated 2026-10-29 by `research/02_leaf_disease_model.ipynb`. Research prototype, not a medical or agronomic device.*

## Intended use
Give a farmer a **first, quick hint** from one photo of one olive leaf: healthy, peacock spot, or Aculus olearius damage.
It is a decision aid for checking the tree more closely. **It does not replace a licensed agronomist.**

## Model
* **Final model: v2.** Backbone: **EfficientNetB0** (ImageNet weights), input 224×224. Preprocessing of the final model: letterbox: padded to a square with the photo own border colour, resized to 224×224 (no crop).
* Head: global average pooling, dropout 0.3, softmax over 3 classes.
* Training (both versions): two phases (frozen backbone, then fine-tuning of the top 30 layers), early stopping on validation loss,
  class weights, same split, same seed (42), same learning rates.
* Classes: Healthy, Olive Peacock Spot, Aculus Olearius.
* **Which numbers are which:** all accuracy and F1 numbers in this card come from the **Keras** model, except the table "Keras vs TFLite" below. The shipped file `leaf_disease.tflite` is quantised (dynamic range) and scores slightly differently.
* Files: `models/leaf_disease.keras`, `models/leaf_disease.tflite` (4.6 MB), `models/labels.json`, `models/model_info.json`.

## Keras vs TFLite (final model v2, full Denizli test set, 680 images)
| Model | Accuracy on the Denizli test set |
|---|---|
| Keras (`leaf_disease.keras`) | 93.1 % |
| TFLite (`leaf_disease.tflite`, shipped to the demo and the app) | 93.2 % |

Keras and TFLite give the same prediction on **98.4 %** of the 680 test images.

## Versions
| | v1 (first run) | v2 (experiment) |
|---|---|---|
| Preprocessing | resized (squashed) to 256×256, random crop 224 in training, centre crop when predicting | **letterbox**: padded to a square with the photo's own border colour, resized to 224×224, no crop |
| Augmentation | flips, rotation 10 %, brightness ±20 %, contrast ±20 % | flips, rotation 10 %, zoom 10 %, brightness ±30 %, contrast ±30 %, saturation ±30 %, hue ±4 %, slight blur (30 % of images), random grey background (50 % of images) |
| Training data | Denizli train (85 %) | Denizli train (85 %), same images |

No Edincik image was used for training either version. Edincik was used afterwards to choose between them, so it is not a fully untouched test.

**Comparison** (same test images):

| Metric | v1 | v2 | Change |
|---|---|---|---|
| Denizli test: accuracy | 95.4 % | 93.1 % | -2.4 pts |
| Denizli test: macro F1 | 0.954 | 0.931 | -0.023 |
| Denizli de-duplicated: accuracy | 94.8 % | 92.0 % | -2.8 pts |
| Denizli de-duplicated: macro F1 | 0.944 | 0.916 | -0.027 |
| Edincik: accuracy | 57.1 % | 75.1 % | +17.9 pts |
| Edincik: macro F1 | 0.548 | 0.750 | +0.202 |
| Edincik: healthy recall | 28.8 % | 60.5 % | +31.6 pts |
| Edincik: peacock spot recall | 99.5 % | 96.9 % | -2.6 pts |

**Final model: v2**, chosen by hand and not by the rule.

* **Original rule:** keep v2 only if it is better on Edincik (macro F1) and its Denizli test accuracy stays at or above 94%.
* **What the rule said:** v2 is better on Edincik but its Denizli accuracy is 93.1 %, below the 94% gate: v1 kept. v2 reached 93.1 % on Denizli (gate 94%).
* **Why we overrode it:** v2 generalises much better to a new region (Edincik macro F1 0.750 against 0.548 for v1), which matches real use on farmers phones. The price is 2.4 points of accuracy on Denizli.
* **Caveat:** Edincik was used for this choice, so it is not a fully untouched test. Field photos are the final check.

## Data
| | Denizli (Türkiye) | Edincik (Bandırma, Balıkesir) |
|---|---|---|
| Classes | Healthy, Olive Peacock Spot, Aculus Olearius | Healthy, Peacock spot |
| Images | 3400 (official train/test split) | 954 (white background, light box) |
| Use here | training, validation, test | external test only, not used for training |
| Source / licence / citation | Kaggle "Olive Leaf Image Dataset" · [paste URL] · licence CC0 1.0 · downloaded 29 Oct 2026 | Kaggle "Olive Leaf Disease" · [paste URL] · licence unknown · downloaded 29 Oct 2026 · Diker, A., Elen, A., Közkurt, C. et al. Eur Food Res Technol (2023). https://doi.org/10.1007/s00217-023-04386-8 |

Split of the Denizli data (the official test set was never used for training or model selection; validation = 15 % of train, stratified):

| label | Train | Validation | Test (official) |
|---|---|---|---|
| Healthy | 706 | 124 | 220 |
| Olive Peacock Spot | 1020 | 180 | 260 |
| Aculus Olearius | 586 | 104 | 200 |
| Total | 2312 | 408 | 680 |

### Duplicate check (train vs test)
| Check | Test images | Found in train | Share |
|---|---|---|---|
| Exact duplicate (same file content) | 680 | 24 | 3.5 % |
| Same perceptual hash (0 bits apart) | 680 | 106 | 15.6 % |
| Near duplicate (≤ 5 bits apart) | 680 | 145 | 21.3 % |

## Results of v1 (first run)
The tables below (results, per class, confidence, Grad-CAM, examples) describe **v1**. The v1 vs v2 table above has the numbers of both.

| Test set | Images | Accuracy | Macro F1 |
|---|---|---|---|
| Denizli test (official, 3 classes) | 680 | 95.4 % | 0.954 |
| Denizli test, only Healthy vs Peacock spot | 480 | 98.1 % | 0.981 |
| Edincik (external, Healthy vs Peacock spot) | 954 | 57.1 % | 0.548 |

* Without the 145 Denizli test images that have a near duplicate in train: accuracy 94.8 %, macro F1 0.944.
* Greek field photos: not available yet.

Per class, Denizli test:

| Class | precision | recall | f1-score | support |
|---|---|---|---|---|
| Healthy | 0.951 | 0.968 | 0.959 | 220 |
| Olive Peacock Spot | 0.947 | 0.969 | 0.958 | 260 |
| Aculus Olearius | 0.968 | 0.92 | 0.944 | 200 |
| macro avg | 0.956 | 0.952 | 0.954 | 680 |

Confidence (threshold 60%):

| Test set | Images with confidence ≥ 60% | Accuracy on those | Accuracy on the rest |
|---|---|---|---|
| Denizli test | 97.2 % | 96.5 % | 57.9 % |
| Edincik (2 classes) | 93.4 % | 57.9 % | 46.0 % |

Baseline, a general vision LLM on 60 test images:

_Not run (no API key)._

Figures (in `figures/leaf/`): `confusion_denizli_test.png`, `confusion_edincik.png`, `confusion_edincik_v2.png`, `v1_vs_v2.png`, `v2_preprocessing.png`, `gradcam.png`, `examples.png`, `results_table.png`, `training_history.png`.

## Limitations
* **Turkish data only** for training (Denizli). Other regions, varieties and cultivation methods may look different.
* **Season:** the photos come from spring and summer. Autumn and winter leaves, and other stages of the disease, are not covered.
* **Leaves only.** It does not look at fruit, branches or whole trees, and it does not find olive fly, anthracnose or olive knot.
* **Edincik images are taken in a light box on a white background.** They are cleaner than field photos and are only an external check.
* **Three classes only.** A leaf with another problem (nutrient lack, sun burn, other diseases) is forced into one of the three classes.
* Photos should show **one leaf, in focus, with good light**. Blurry or dark photos give unreliable answers.
* Scores on external data are lower than on the Denizli test set; the Greek field-photo test shows the realistic level for Greece once those photos exist.
* **Not a replacement for an agronomist.**
