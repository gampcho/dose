from pathlib import Path
import json, random
import io
import os
import subprocess
import pyarrow.parquet as pq
from PIL import Image, ImageFile
from huggingface_hub import HfApi

ImageFile.LOAD_TRUNCATED_IMAGES = True

DATA = Path("data")
PARQUET_DIR = DATA / "parquets"
YOLO_DIR = DATA / "yolo"
TARGET = 640
REPO = "Elfsong/VAIPE_PILL"
REV = "d5a34a0ab693afe7267ba3829c5d907d7c2bbcd9"
BASE_URL = f"https://huggingface.co/datasets/{REPO}/resolve/{REV}"

TOKEN = ""
for line in Path(".env").read_text().strip().splitlines():
    if "=" in line and not line.strip().startswith("#"):
        k, v = line.strip().split("=", 1)
        if k.strip() == "HF_TOKEN":
            TOKEN = v.strip()


def letterbox(img, boxes):
    w, h = img.size
    scale = min(TARGET / w, TARGET / h)
    nw, nh = int(w * scale), int(h * scale)
    img = img.resize((nw, nh), Image.LANCZOS)
    pad_x = (TARGET - nw) // 2
    pad_y = (TARGET - nh) // 2
    canvas = Image.new("RGB", (TARGET, TARGET), (114, 114, 114))
    canvas.paste(img, (pad_x, pad_y))
    new_boxes = []
    for x, y, bw, bh in boxes:
        new_boxes.append([x * scale + pad_x, y * scale + pad_y, bw * scale, bh * scale])
    return canvas, new_boxes


def download_parquet(remote_path):
    local = PARQUET_DIR / remote_path.split("/")[-1]
    if local.exists():
        return local
    url = f"{BASE_URL}/{remote_path}"
    cmd = ["wget", "-c", "-q", "--show-progress", "-O", str(local), url]
    if TOKEN:
        cmd.insert(3, f"--header=Authorization: Bearer {TOKEN}")
    print(f"  Downloading {remote_path.split('/')[-1]}...", flush=True)
    subprocess.run(cmd, check=True)
    print(f"    {local.stat().st_size / 1e6:.0f} MB", flush=True)
    return local


def process_parquet(path, split_name, start_idx):
    table = pq.read_table(path, columns=["image", "labels", "bboxes", "filename"])
    rows = len(table)
    new = 0
    for i in range(rows):
        name = f"{split_name}_{start_idx + i:05d}"
        if (YOLO_DIR / "images" / split_name / f"{name}.jpg").exists():
            continue
        try:
            raw = table.column("image")[i].as_py()
            img_bytes = raw["bytes"] if isinstance(raw, dict) else raw
            labels = table.column("labels")[i].as_py()
            bboxes = table.column("bboxes")[i].as_py()
            if not labels or not bboxes:
                continue
            img = Image.open(io.BytesIO(img_bytes))
            if img.mode != "RGB":
                img = img.convert("RGB")
            img, bboxes = letterbox(img, bboxes)
            img.save(YOLO_DIR / "images" / split_name / f"{name}.jpg")
            lines = []
            for bbox, label in zip(bboxes, labels):
                x, y, bw, bh = bbox
                lines.append(f"{label} {x/TARGET:.6f} {y/TARGET:.6f} {bw/TARGET:.6f} {bh/TARGET:.6f}")
            (YOLO_DIR / "labels" / split_name / f"{name}.txt").write_text("\n".join(lines))
            new += 1
        except Exception as e:
            print(f"  Skip {name}: {e}", flush=True)
    path.unlink()
    return rows, new


def step():
    class_map = json.loads((DATA / "class_names.json").read_text())
    nc = len(class_map)
    for split in ("train", "val"):
        (YOLO_DIR / "images" / split).mkdir(parents=True, exist_ok=True)
        (YOLO_DIR / "labels" / split).mkdir(parents=True, exist_ok=True)
    PARQUET_DIR.mkdir(parents=True, exist_ok=True)

    api = HfApi()
    files = api.list_repo_files(REPO, repo_type="dataset")
    train_pqs = sorted([f for f in files if "pill/train" in f and f.endswith(".parquet")])

    totals = {"train": 0}
    start = 0
    total = len(train_pqs)
    for idx, pf in enumerate(train_pqs):
        print(f"[{idx+1}/{total}] {pf.split('/')[-1]}", flush=True)
        local = download_parquet(pf)
        rows, new = process_parquet(local, "train", start)
        totals["train"] += new
        start += rows
        if new:
            print(f"  +{new} images ({totals['train']} total)", flush=True)
        else:
            print(f"  all cached ({start} rows)", flush=True)

    train_files = sorted((YOLO_DIR / "images" / "train").glob("*.jpg"))
    train_stems = [f.stem for f in train_files]
    random.seed(42)
    random.shuffle(train_stems)
    split_idx = int(len(train_stems) * 0.9)
    val_stems = set(train_stems[split_idx:])

    moved = 0
    for stem in val_stems:
        (YOLO_DIR / "images" / "train" / f"{stem}.jpg").rename(YOLO_DIR / "images" / "val" / f"{stem}.jpg")
        (YOLO_DIR / "labels" / "train" / f"{stem}.txt").rename(YOLO_DIR / "labels" / "val" / f"{stem}.txt")
        moved += 1

    names = [class_map[str(i)] for i in range(nc)]
    yaml = (
        f"path: {YOLO_DIR.absolute()}\n"
        f"train: images/train\n"
        f"val: images/val\n"
        f"nc: {nc}\n"
        f"names: {json.dumps(names, ensure_ascii=False)}\n"
    )
    (YOLO_DIR / "dataset.yaml").write_text(yaml)
    train_count = len(list((YOLO_DIR / "images" / "train").glob("*.jpg")))
    val_count = len(list((YOLO_DIR / "images" / "val").glob("*.jpg")))
    print(f"Done: {train_count} train, {val_count} val, {nc} classes")


step()
