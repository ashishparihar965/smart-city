"""
Smart Traffic Vehicle Detection API
Uses YOLOv8 to detect vehicles (car, bike, bus, truck) in uploaded images.
"""
import os
import sys
from flask import Flask, request, jsonify
from flask_cors import CORS
from ultralytics import YOLO

app = Flask(__name__)
CORS(app)

# Load YOLOv8 model (use the pre-trained YOLOv8n for fast inference)
MODEL_PATH = os.path.join(os.path.dirname(__file__), '..', 'yolov8n.pt')
model = YOLO(MODEL_PATH)

# COCO class indices for vehicles
# 2=car, 3=motorcycle, 5=bus, 7=truck
VEHICLE_CLASSES = {
    2: 'car',
    3: 'bike',
    5: 'bus',
    7: 'truck'
}

UPLOAD_DIR = os.path.join(os.path.dirname(__file__), '..', 'temp_uploads')
os.makedirs(UPLOAD_DIR, exist_ok=True)


@app.route('/detect', methods=['POST'])
def detect_vehicles():
    """
    Detect vehicles in an uploaded image.
    Returns count of each vehicle type.
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
        # Run detection
        results = model(filepath, verbose=False)

        counts = {
            'car': 0,
            'bike': 0,
            'bus': 0,
            'truck': 0
        }

        for result in results:
            if result.boxes is not None:
                for box in result.boxes:
                    cls_id = int(box.cls[0])
                    if cls_id in VEHICLE_CLASSES:
                        vehicle_type = VEHICLE_CLASSES[cls_id]
                        counts[vehicle_type] += 1

        return jsonify(counts)

    except Exception as e:
        return jsonify({'error': str(e)}), 500

    finally:
        # Cleanup
        if os.path.exists(filepath):
            os.remove(filepath)


@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok', 'model': 'yolov8n', 'service': 'traffic-detection'})


@app.route('/detect-batch', methods=['POST'])
def detect_batch():
    """
    Detect vehicles in multiple images at once.
    Expects multipart form with files keyed by direction names.
    Returns counts per direction.
    """
    results_dict = {}

    for key in request.files:
        file = request.files[key]
        filepath = os.path.join(UPLOAD_DIR, f"batch_{os.getpid()}_{key}_{file.filename}")
        file.save(filepath)

        try:
            results = model(filepath, verbose=False)
            counts = {'car': 0, 'bike': 0, 'bus': 0, 'truck': 0}

            for result in results:
                if result.boxes is not None:
                    for box in result.boxes:
                        cls_id = int(box.cls[0])
                        if cls_id in VEHICLE_CLASSES:
                            counts[VEHICLE_CLASSES[cls_id]] += 1

            counts['total'] = sum(counts.values())
            results_dict[key] = counts

        except Exception as e:
            results_dict[key] = {'error': str(e), 'car': 0, 'bike': 0, 'bus': 0, 'truck': 0, 'total': 0}

        finally:
            if os.path.exists(filepath):
                os.remove(filepath)

    return jsonify(results_dict)


if __name__ == '__main__':
    port = int(os.environ.get('TRAFFIC_ML_PORT', 5001))
    print(f"\n🚦 Traffic Vehicle Detection API running on port {port}")
    print(f"   Model: {MODEL_PATH}")
    print(f"   Endpoints:")
    print(f"     POST /detect       - Single image detection")
    print(f"     POST /detect-batch - Multi-image batch detection")
    print(f"     GET  /health       - Health check\n")
    app.run(host='0.0.0.0', port=port, debug=False)
