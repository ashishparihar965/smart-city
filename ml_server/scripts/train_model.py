from ultralytics import YOLO

model = YOLO("yolov8n.pt")

model.train(
    data="License-Plate-Data/data.yaml",
    epochs=80,
    imgsz=640,
    batch=16,
    workers=4,
    augment=True
)