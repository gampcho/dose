from ultralytics import YOLO

model = YOLO("yolo12n.pt")

model.train(
    data="data/yolo/dataset.yaml",
    epochs=100,
    imgsz=640,
    batch=16,
    device="cuda",
    patience=20,
    workers=4,
    name="vaipe12n",
)

model.export(format="onnx", imgsz=640, half=True)
print("Done: model trained and exported to ONNX")
