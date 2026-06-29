from pathlib import Path
import shutil
from huggingface_hub import hf_hub_download

MODELS_DIR = Path("frontend/public/models")
DET_REPO = "PaddlePaddle/PP-OCRv5_mobile_det_onnx"
REC_REPO = "monkt/paddleocr-onnx"

MODELS_DIR.mkdir(parents=True, exist_ok=True)

det_src = hf_hub_download(DET_REPO, "inference.onnx")
shutil.copy(det_src, MODELS_DIR / "det.onnx")
print(f"det.onnx: {Path(det_src).stat().st_size / 1e6:.1f} MB")

for f, name in [("languages/latin/rec.onnx", "rec.onnx"), ("languages/latin/dict.txt", "dict.txt")]:
    src = hf_hub_download(REC_REPO, f)
    shutil.copy(src, MODELS_DIR / name)
    print(f"{name}: {Path(src).stat().st_size / 1e3:.0f} KB")

print("Done. Models in frontend/public/models/")