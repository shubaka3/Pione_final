from fastapi import FastAPI, File, UploadFile
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image
from io import BytesIO
from ultralytics import YOLO
import numpy as np

app = FastAPI(title="YOLOv8 Object Detection API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # hoặc ["http://localhost:3000"] nếu bạn muốn giới hạn
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 🔹 Load model YOLO (có thể đổi sang yolov8s.pt hoặc custom model)
model = YOLO("yolov8n.pt")

@app.post("/detect/")
async def detect_object(file: UploadFile = File(...)):
    """
    Nhận 1 ảnh, chạy YOLO detect, và trả lại danh sách toạ độ bounding boxes.
    """
    # Đọc ảnh từ request
    image_bytes = await file.read()
    image = Image.open(BytesIO(image_bytes)).convert("RGB")

    # Chạy YOLO detect
    results = model.predict(source=image, conf=0.25, verbose=False)

    detections = []
    for r in results:
        for box in r.boxes:
            x1, y1, x2, y2 = map(float, box.xyxy[0])  # dùng float để chính xác hơn
            conf = float(box.conf[0])
            cls_id = int(box.cls[0])
            label = model.names[cls_id]

            detections.append({
                "label": label,
                "confidence": conf,
                "x1": x1,
                "y1": y1,
                "x2": x2,
                "y2": y2
            })

    return JSONResponse(content={"detections": detections})

@app.get("/")
def root():
    return {"message": "✅ YOLOv8 Object Detection API is running!"}
