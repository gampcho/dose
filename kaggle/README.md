# Kaggle Upload + Training Guide

## Step 1: Package Dataset Locally (already done)

`kaggle/dose-yolo-dataset.zip` — 279 MB, includes `class_names.json`.

## Step 2: Upload to Kaggle Datasets

### Web UI (easiest)
1. Go to [kaggle.com/datasets](https://kaggle.com/datasets)
2. Click **New Dataset**
3. Drag `kaggle/dose-yolo-dataset.zip` into the upload area
4. Set dataset name: `dose-yolo-dataset`
5. Click **Create**

## Step 3: Create Training Notebook

### Option A: YOLOv12n (small, fast) — 200 epochs
1. [kaggle.com/code](https://kaggle.com/code) → New Notebook
2. Add Input → Datasets → `dose-yolo-dataset`
3. Toggle GPU ON
4. Upload `kaggle/train-yolo12n-200ep.ipynb`
5. Run All
6. ~10 hours on P100

### Option B: YOLOv12s (larger, more accurate) — 200 epochs
1. [kaggle.com/code](https://kaggle.com/code) → New Notebook
2. Add Input → Datasets → `dose-yolo-dataset`
3. Toggle GPU ON
4. Upload `kaggle/train-yolo12s-200ep.ipynb`
5. Run All
6. ~12 hours on P100

### Both notebooks include:
- Benchmarking: mAP50, mAP50-95, per-class CSV
- Full val inference: 16 random + 16 worst-performing samples
- AdamW optimizer, mixup=0.2, copy_paste=0.1

## Step 4: Download ONNX

After training:
1. Output tab → download `vaipe.onnx` (~5 MB for 12n, ~18 MB for 12s)
2. Place in `frontend/public/models/vaipe.onnx`

## Timeline

| Model | Epochs | Time (P100) | ONNX size |
|-------|--------|-------------|-----------|
| YOLOv12n | 200 | ~10 hrs | ~5 MB |
| YOLOv12s | 200 | ~12 hrs | ~18 MB |

## Troubleshooting

- **OOM with batch=32?** Reduce to `batch=16` in the notebook
- **Dataset not found?** Check slug is exactly `dose-yolo-dataset`
- **Session timeout?** Kaggle notebooks run ~9 hours. Keep tab open
- **DataFrame error?** Should be fixed — uses `metrics.box.ap` (always length 108)
