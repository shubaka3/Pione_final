from fastapi import FastAPI, File, UploadFile
from fastapi.responses import StreamingResponse
from PIL import Image
from io import BytesIO
from ultralytics import YOLO
import cv2
import numpy as np

app = FastAPI(title="YOLOv8 Object Detection API")

# 🔹 Load model YOLO (bạn có thể đổi sang yolov8s.pt hoặc custom model)
model = YOLO("yolov8n.pt")

@app.post("/detect/")
async def detect_object(file: UploadFile = File(...)):
    """
    Nhận 1 ảnh, chạy YOLO detect, và trả lại ảnh có bounding boxes.
    """
    # Đọc ảnh từ request
    image_bytes = await file.read()
    image = Image.open(BytesIO(image_bytes)).convert("RGB")

    # Chạy YOLO detect
    results = model.predict(source=image, conf=0.25, verbose=False)

    # Chuyển ảnh sang BGR để vẽ
    img_bgr = cv2.cvtColor(np.array(image), cv2.COLOR_RGB2BGR)

    # Duyệt qua kết quả
    for r in results:
        for box in r.boxes:
            x1, y1, x2, y2 = map(int, box.xyxy[0])
            conf = float(box.conf[0])
            cls_id = int(box.cls[0])
            label = model.names[cls_id]

            # Vẽ khung và nhãn
            color = (0, 255, 0)
            cv2.rectangle(img_bgr, (x1, y1), (x2, y2), color, 2)
            cv2.putText(
                img_bgr,
                f"{label} {conf:.2f}",
                (x1, y1 - 5),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.6,
                color,
                2
            )

    # Mã hoá lại ảnh để gửi về client
    _, buffer = cv2.imencode(".jpg", img_bgr)
    return StreamingResponse(BytesIO(buffer.tobytes()), media_type="image/jpeg")

@app.get("/")
def root():
    return {"message": "✅ YOLOv8 Object Detection API is running!"}
