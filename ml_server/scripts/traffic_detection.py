"""
Smart Traffic Vehicle Detection API
Uses custom-trained YOLOv8 model to detect vehicles in uploaded images.
Model classes: car, threewheel, bus, truck, motorbike, van
Returns real detection counts + annotated images with bounding boxes.
"""
import os
import io
import base64
import cv2
import numpy as np
from flask import Flask, request, jsonify
from flask_cors import CORS
from ultralytics import YOLO

app = Flask(__name__)
CORS(app)

# ─── Load Custom Trained Models ───────────────────────────────────────
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODELS_DIR = os.path.join(BASE_DIR, '..', 'models')

# Vehicle detection model (custom trained)
VEHICLE_MODEL_PATH = os.path.join(MODELS_DIR, 'vehical_model.pt')
vehicle_model = YOLO(VEHICLE_MODEL_PATH)
VEHICLE_CLASSES = vehicle_model.names  # {0: 'car', 1: 'threewheel', 2: 'bus', 3: 'truck', 4: 'motorbike', 5: 'van'}

# Number plate detection model (custom trained)
PLATE_MODEL_PATH = os.path.join(MODELS_DIR, 'number_plate_model.pt')
plate_model = YOLO(PLATE_MODEL_PATH)

print(f"✅ Vehicle model loaded: {VEHICLE_MODEL_PATH}")
print(f"   Classes: {VEHICLE_CLASSES}")
print(f"✅ Plate model loaded: {PLATE_MODEL_PATH}")
print(f"   Classes: {plate_model.names}")

UPLOAD_DIR = os.path.join(BASE_DIR, '..', 'temp_uploads')
os.makedirs(UPLOAD_DIR, exist_ok=True)

# Bounding box colors per class (BGR for OpenCV)
CLASS_COLORS = {
    'car':        (0, 200, 0),      # Green
    'threewheel': (0, 200, 255),    # Orange
    'bus':        (255, 100, 0),     # Blue
    'truck':      (0, 0, 255),      # Red
    'motorbike':  (255, 255, 0),    # Cyan
    'van':        (200, 0, 200),    # Purple
    'license_plate': (0, 255, 255), # Yellow
}


def annotate_image(image_path, results, class_names):
    """
    Draw bounding boxes on the image and return as base64 JPEG string.
    """
    img = cv2.imread(image_path)
    if img is None:
        return None

    for result in results:
        if result.boxes is not None:
            for box in result.boxes:
                cls_id = int(box.cls[0])
                cls_name = class_names.get(cls_id, 'unknown')
                confidence = float(box.conf[0])
                x1, y1, x2, y2 = map(int, box.xyxy[0].tolist())

                color = CLASS_COLORS.get(cls_name, (255, 255, 255))

                # Draw filled rectangle behind text
                label = f"{cls_name} {confidence:.0%}"
                (tw, th), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.5, 1)
                cv2.rectangle(img, (x1, y1 - th - 8), (x1 + tw + 4, y1), color, -1)
                cv2.putText(img, label, (x1 + 2, y1 - 4),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1, cv2.LINE_AA)

                # Draw bounding box
                cv2.rectangle(img, (x1, y1), (x2, y2), color, 2)

    # Encode to JPEG base64
    _, buffer = cv2.imencode('.jpg', img, [cv2.IMWRITE_JPEG_QUALITY, 85])
    b64 = base64.b64encode(buffer).decode('utf-8')
    return f"data:image/jpeg;base64,{b64}"


@app.route('/detect', methods=['POST'])
def detect_vehicles():
    """
    Detect vehicles in an uploaded image using custom trained model.
    Returns count of each vehicle type + annotated image with bounding boxes.
    """
    if 'image' not in request.files:
        return jsonify({'error': 'No image file provided'}), 400

    file = request.files['image']
    if file.filename == '':
        return jsonify({'error': 'Empty filename'}), 400

    # Save temporarily
    filepath = os.path.join(UPLOAD_DIR, f"detect_{os.getpid()}_{file.filename}")
    file.save(filepath)

    try:
        # Run detection with custom vehicle model
        results = vehicle_model(filepath, verbose=False, conf=0.25)

        counts = {name: 0 for name in VEHICLE_CLASSES.values()}

        detections = []
        for result in results:
            if result.boxes is not None:
                for box in result.boxes:
                    cls_id = int(box.cls[0])
                    cls_name = VEHICLE_CLASSES.get(cls_id, 'unknown')
                    confidence = float(box.conf[0])
                    x1, y1, x2, y2 = map(int, box.xyxy[0].tolist())

                    if cls_name in counts:
                        counts[cls_name] += 1

                    detections.append({
                        'class': cls_name,
                        'confidence': round(confidence, 3),
                        'bbox': [x1, y1, x2, y2]
                    })

        # Generate annotated image
        annotated = annotate_image(filepath, results, VEHICLE_CLASSES)

        total = sum(counts.values())

        return jsonify({
            **counts,
            'total': total,
            'detections': detections,
            'annotated_image': annotated
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 500

    finally:
        # Cleanup temp file
        if os.path.exists(filepath):
            os.remove(filepath)


@app.route('/detect-plates', methods=['POST'])
def detect_plates():
    """
    Detect number plates in an uploaded image using custom trained model.
    Returns plate count, bounding boxes, and annotated image.
    """
    if 'image' not in request.files:
        return jsonify({'error': 'No image file provided'}), 400

    file = request.files['image']
    if file.filename == '':
        return jsonify({'error': 'Empty filename'}), 400

    filepath = os.path.join(UPLOAD_DIR, f"plate_{os.getpid()}_{file.filename}")
    file.save(filepath)

    try:
        results = plate_model(filepath, verbose=False, conf=0.25)

        plates = []
        for result in results:
            if result.boxes is not None:
                for box in result.boxes:
                    confidence = float(box.conf[0])
                    x1, y1, x2, y2 = map(int, box.xyxy[0].tolist())
                    plates.append({
                        'confidence': round(confidence, 3),
                        'bbox': [x1, y1, x2, y2]
                    })

        annotated = annotate_image(filepath, results, plate_model.names)

        return jsonify({
            'plate_count': len(plates),
            'plates': plates,
            'annotated_image': annotated
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 500

    finally:
        if os.path.exists(filepath):
            os.remove(filepath)


@app.route('/detect-batch', methods=['POST'])
def detect_batch():
    """
    Detect vehicles in multiple images at once.
    Expects multipart form with files keyed by direction names.
    Returns counts per direction + annotated images.
    """
    results_dict = {}

    for key in request.files:
        file = request.files[key]
        filepath = os.path.join(UPLOAD_DIR, f"batch_{os.getpid()}_{key}_{file.filename}")
        file.save(filepath)

        try:
            results = vehicle_model(filepath, verbose=False, conf=0.25)
            counts = {name: 0 for name in VEHICLE_CLASSES.values()}

            for result in results:
                if result.boxes is not None:
                    for box in result.boxes:
                        cls_id = int(box.cls[0])
                        cls_name = VEHICLE_CLASSES.get(cls_id, 'unknown')
                        if cls_name in counts:
                            counts[cls_name] += 1

            counts['total'] = sum(counts.values())

            # Generate annotated image
            annotated = annotate_image(filepath, results, VEHICLE_CLASSES)
            counts['annotated_image'] = annotated

            results_dict[key] = counts

        except Exception as e:
            results_dict[key] = {
                'error': str(e),
                **{name: 0 for name in VEHICLE_CLASSES.values()},
                'total': 0,
                'annotated_image': None
            }

        finally:
            if os.path.exists(filepath):
                os.remove(filepath)

    return jsonify(results_dict)


@app.route('/health', methods=['GET'])
def health():
    return jsonify({
        'status': 'ok',
        'vehicle_model': os.path.basename(VEHICLE_MODEL_PATH),
        'vehicle_classes': VEHICLE_CLASSES,
        'plate_model': os.path.basename(PLATE_MODEL_PATH),
        'service': 'traffic-detection'
    })


if __name__ == '__main__':
    port = int(os.environ.get('TRAFFIC_ML_PORT', 5001))
    print(f"\n🚦 Traffic Vehicle Detection API running on port {port}")
    print(f"   Vehicle Model: {VEHICLE_MODEL_PATH}")
    print(f"   Vehicle Classes: {list(VEHICLE_CLASSES.values())}")
    print(f"   Plate Model: {PLATE_MODEL_PATH}")
    print(f"   Endpoints:")
    print(f"     POST /detect        - Single image vehicle detection")
    print(f"     POST /detect-plates - Number plate detection")
    print(f"     POST /detect-batch  - Multi-image batch detection")
    print(f"     GET  /health        - Health check\n")
    app.run(host='0.0.0.0', port=port, debug=False)
