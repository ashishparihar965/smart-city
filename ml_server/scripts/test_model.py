from ultralytics import YOLO

model = YOLO("/home/ashish/devdisk/Client-Project-WorkSpace/SmartCity_CodeStorm_Hackathon/ml_server/models/number_plate_model.pt")
results = model("../License-Plate-Data/test/images/Cars.png", save=True)