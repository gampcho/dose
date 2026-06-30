# DOSE — AI Engineering Guide

For models working on DOSE's AI components: YOLO training, PaddleOCR pipeline, verification engine, and the rule-based prescription parser.

## What DOSE is

Vietnamese pill tray verification PWA. User photographs a prescription → system extracts expected meds → user photographs pill tray → system verifies pills match prescription → evidence card + audio guidance.

AI components:
1. **YOLO12n** — detects + classifies pills in tray (108 classes, 0-107)
2. **PP-OCRv4 ONNX** — extracts text from Vietnamese prescriptions in browser
3. **Rule-based parser** — maps OCR text → pill class IDs + quantities
4. **Verification engine** — compares expected vs detected pills → 5 scenarios
5. **LLM fallback** — Gemini Flash via Cloudflare Worker for ambiguous OCR cases

## Directory structure (AI-related only)

```
dose/
├── .env                          # MAPPING_URL, HF_TOKEN, GEMINI_API_KEY, PADDLEOCR_* (dev only)
├── pyproject.toml                # uv-managed Python deps
├── download.py                   # STEP=1: class mapping, STEP=2: YOLO dataset from VAIPE_PILL
├── train.py                      # YOLO12n training + ONNX export
├── data/
│   ├── class_names.json          # 108 classes (0-107), maps ID → Vietnamese name
│   └── yolo/                     # YOLO dataset (gitignored)
│       ├── dataset.yaml
│       ├── images/{train,val}/
│       └── labels/{train,val}/
├── models/
│   └── vaipe12n.onnx             # Final exported model (gitignored, built by train.py)
└── frontend/
    └── public/
        └── models/               # ONNX models bundled with app
            ├── det.onnx          # PP-OCRv4 detection (~5MB INT8)
            ├── rec.onnx          # PP-OCRv4 recognition (~10MB INT8)
            ├── dict.txt          # Vietnamese character set
            └── vaipe12n.onnx     # YOLO12n (~12MB)
```

## YOLO training — quick reference

**Data**: VAIPE_PILL from HuggingFace (`Elfsong/VAIPE_PILL`, config `pill`). 11k images, 108 classes (0-107).

**Class 107** = "ngoài đơn" (out-of-prescription). All others are named medicines from `mapping_standard.json` (GitHub: `lynguyenminh/VAIPE2022.Medicine-Pill-Image-Recognition`).

**Bbox format in VAIPE**: `[x, y, width, height]` — top-left corner. Convert to YOLO normalized center format:
```python
xc = (x + bw/2) / img_w
yc = (y + bh/2) / img_h
nw = bw / img_w
nh = bh / img_h
```

**Letterbox resize to 640×640**: pad with (114,114,114), scale bboxes proportionally.

**Training** (RTX 3050):
- `uv run python3 train.py`
- YOLO12n, epochs=100, batch=16 (4GB VRAM) or batch=32 (8GB)
- Export to ONNX: `model.export(format="onnx", imgsz=640, half=True)`

**Dataset YAML** (`data/yolo/dataset.yaml`):
```yaml
path: <absolute path>
train: images/train
val: images/val
nc: 108
names: ["paracetamol 500mg", ... , "ngoài đơn"]
```

## YOLO training on Kaggle (recommended)

Faster than local RTX 3050. Free P100 GPU, ~1.5 hours for 100 epochs.

**Dataset** (`kaggle/dose-yolo-dataset.zip`, ~292 MB):
```bash
cd data/yolo && zip -r ../../kaggle/dose-yolo-dataset.zip dataset.yaml images/ labels/
```

**Upload**:
1. [kaggle.com/datasets](https://kaggle.com/datasets) → New Dataset → upload zip → name: `dose-yolo-dataset`

**Notebooks** (`kaggle/train-yolo12n-200ep.ipynb` or `kaggle/train-yolo12s-200ep.ipynb`):
1. [kaggle.com/code](https://kaggle.com/code) → New Notebook → Add Input → `dose-yolo-dataset`
2. Toggle GPU ON
3. Upload notebook → Run All
4. Hyperparams: `epochs=200`, `batch=32`, `imgsz=640`, `patience=30`, `optimizer=AdamW`, `cos_lr=True`
5. Augmentation: `mixup=0.2`, `copy_paste=0.1`, `mosaic=1.0`, `close_mosaic=15`
6. **YOLO12n** (~10 hrs, ~5 MB ONNX) or **YOLO12s** (~12 hrs, ~18 MB ONNX)

**Download**:
1. Output tab → download `vaipe12n.onnx` (~12 MB)
2. Place in `frontend/public/models/vaipe12n.onnx`


## PP-OCRv4 ONNX pipeline (browser)

Two models, INT8 quantized, bundled in `frontend/public/models/`.

**Detection** (`det.onnx`):
- Input: resized prescription image (H×W×3, normalized)
- Output: probability map → threshold → connected components → bounding boxes
- Post-processing: DB (Differentiable Binarization) — threshold 0.3, min box area 50px², unclip ratio 1.5

**Recognition** (`rec.onnx`):
- Input: cropped text box, resized to (1, 48, W, 3), W varies
- Output: character probabilities → CTC greedy decode
- Character set: `dict.txt` (Vietnamese extends Latin with diacritics)

**Inference order**:
1. Det model → list of text boxes
2. For each box: crop → resize → Rec model → text string
3. Combine all lines → full OCR text

**Performance budget**: ~200-400ms det + ~50-100ms/box × ~10 boxes = ~1-1.5s total on mid-tier mobile.

**Run in Web Worker** to avoid blocking UI thread.

**Dev/test**: Use `paddleocr-text-recognition` skill (cloud API) to generate ground truth for validating browser OCR accuracy. Production never calls cloud.

## Verification engine

**Inputs**:
- `expected`: `{class_id: expected_count}` — from prescription parser
- `detected`: `[{class_id, confidence, bbox}]` — from YOLO

**Logic** (5 scenarios):
1. **correct** — every expected pill detected with matching count, no extras, all confidence ≥ 0.65
2. **missing** — expected class_id not found or count < expected
3. **extra** — detected class_id not in expected list
4. **wrong_type** — detected pill class_id ≠ expected class_id for same position
5. **unclear** — any detected pill has confidence < 0.65 → ask user to retake

**Edge cases**:
- Duplicate pills: same class detected multiple times beyond expected count → flag as "extra"
- Class 107 (ngoài đơn): always flagged as extra/wrong
- Empty tray: if YOLO detects 0 pills → "unclear_image"

**Evidence card output**:
```typescript
type PillResult = {
  class_id: number
  name: string          // from class_names.json
  expected_count: number
  detected_count: number
  confidences: number[]
  bboxes: {x: number, y: number, w: number, h: number}[]
}

type VerificationResult = {
  scenario: 'correct' | 'missing' | 'extra' | 'wrong_type' | 'unclear' | 'duplicate'
  pills: PillResult[]
  summary_vi: string    // brief: "Đúng 3/3 loại thuốc" or "Thiếu 1 viên"
  details_vi: string    // full detail for tap-to-expand
  audio_summary: string // payload for Web Speech API vi-VN
  evidence_image: string // dataURL of annotated pill tray
}
```

## Rule-based prescription parser

**Input**: PaddleOCR text lines: `[{bbox, text}]`

**Output**: `{drug_name, quantity, dosage, class_id, confidence}[]`

**Rules** (priority order):
1. Detect quantity/dosage lines: keywords `viên`, `mg`, `g`, `ml`, `lần`, `ngày`, `uống`, `sáng`, `trưa`, `chiều`, `tối`
2. Drug name = text block preceding a quantity/dosage line
3. Fuzzy match drug name against `class_names.json` (use `difflib.get_close_matches` or `rapidfuzz`)
4. Assign class_id + confidence score
5. **Fallback**: if no drug names recognized OR any pill confidence < 0.7 → send full OCR text to LLM proxy

**LLM fallback payload** to Cloudflare Worker:
```json
{
  "text": "raw OCR text from prescription",
  "class_names": ["paracetamol 500mg", "amoxicillin 500mg", ...]
}
```
**LLM response**:
```json
{
  "drugs": [
    {"name": "paracetamol 500mg", "quantity": 10, "class_id": 0, "confidence": 0.95}
  ]
}
```

## Key data sources

| Source | URL | Use |
|--------|-----|-----|
| VAIPE_PILL | `Elfsong/VAIPE_PILL` (HuggingFace) | YOLO training data (11k images, 108 classes) |
| VAIPE_P | `Elfsong/VAIPE_P` (HuggingFace) | Prescription ground truth (1,345 images + text + mappings) |
| mapping_standard.json | GitHub `lynguyenminh/VAIPE2022.Medicine-Pill-Image-Recognition` → `data/mapping_standard.json` | Class ID → Vietnamese medicine name |
| PP-OCRv4 ONNX | PaddleOCR GitHub releases or HuggingFace `PaddlePaddle/PaddleOCR-onnx` | Browser OCR models |

## Environment variables

```env
MAPPING_URL=https://raw.githubusercontent.com/lynguyenminh/VAIPE2022.Medicine-Pill-Image-Recognition/master/data/mapping_standard.json
HF_TOKEN=hf_...                          # HuggingFace token for faster downloads
GEMINI_API_KEY=...                       # For LLM fallback (Cloudflare Worker)
PADDLEOCR_OCR_API_URL=...               # Dev/testing only — never shipped
PADDLEOCR_ACCESS_TOKEN=...              # Dev/testing only — never shipped
```

## Constraints

- **108 classes**: 0-106 are named medicines, 107 is "ngoài đơn" (out-of-prescription)
- **Privacy**: OCR text (not images) sent to LLM proxy only. YOLO runs fully on-device.
- **Vietnamese-first**: All UI text, audio, prescriptions, drug names in Vietnamese
- **Evidence mandatory**: Every verification must produce an evidence card with bboxes, expected vs detected, confidence scores
- **Refusal-to-guess**: confidence < 0.65 → "Vui lòng chụp lại" (please retake photo). Never guess.
- **No comments in code** unless necessary for correctness
- **Simple, minimal code** — readable without explanation

## Python commands

```bash
# Download class mapping (run once)
uv run python3 download.py  # set STEP = 1

# Download YOLO dataset (all train parquets, then auto 90/10 split)
uv run python3 download.py  # set STEP = 2

# Train YOLO12n on RTX 3050
uv run python3 train.py

# Quick test
uv run python3 -c "from ultralytics import YOLO; m = YOLO('yolo12n.pt'); print(m)"
```
