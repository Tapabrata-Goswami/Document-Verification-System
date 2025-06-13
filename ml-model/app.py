from flask import Flask, request, jsonify
from ultralytics import YOLO
import os

app = Flask(__name__)

# Load YOLOv8n model from the local .pt file
model = YOLO("yolov8n.pt")

@app.route("/predict", methods=["POST"])
def predict():
    file = request.files["file"]
    filepath = os.path.join("temp", file.filename)
    os.makedirs("temp", exist_ok=True)
    file.save(filepath)

    # Run prediction
    results = model(filepath)

    # Check if any object was detected
    boxes = results[0].boxes
    is_valid = 1 if boxes and len(boxes) > 0 else 0

    os.remove(filepath)

    return jsonify({"prediction": is_valid})

if __name__ == "__main__":
    app.run(port=5000)
