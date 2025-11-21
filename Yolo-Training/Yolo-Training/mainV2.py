from fastapi import FastAPI, File, UploadFile
from fastapi.responses import JSONResponse, StreamingResponse
from PIL import Image
from io import BytesIO
from ultralytics import YOLO
import cv2
import numpy as np

app = FastAPI(title="YOLOv8 Object Detection API")

# 🔹 Load YOLOv8 model (COCO pre-trained)
model = YOLO("yolov8n.pt")  # có thể đổi sang yolov8s.pt, yolov8m.pt,...

@app.post("/detect/")
async def detect_object(file: UploadFile = File(...)):
    """
    API nhận ảnh, nhận diện đối tượng bằng YOLOv8 và trả về ảnh có bounding box + JSON kết quả
    """
    # Đọc file ảnh từ request
    image_bytes = await file.read()
    image = Image.open(BytesIO(image_bytes)).convert("RGB")
    image_np = np.array(image)

    # 🔹 Chạy YOLO detect
    results = model.predict(source=image_np, conf=0.3, verbose=False)

    detections = []
    annotated_image = image_np.copy()

    # 🔹 Vẽ khung + nhãn
    for r in results:
        for box in r.boxes:
            cls_id = int(box.cls[0])
            label = model.names[cls_id]
            conf = float(box.conf[0])
            x1, y1, x2, y2 = map(int, box.xyxy[0])

            # Ghi nhận dữ liệu
            detections.append({
                "label": label,
                "confidence": round(conf, 2),
                "bbox": [x1, y1, x2, y2]
            })

            # 🔹 Vẽ khung bounding box
            color = (0, 255, 0)  # xanh lá
            cv2.rectangle(annotated_image, (x1, y1), (x2, y2), color, 2)

            # 🔹 Hiển thị nhãn
            text = f"{label} {conf:.2f}"
            (tw, th), _ = cv2.getTextSize(text, cv2.FONT_HERSHEY_SIMPLEX, 0.6, 2)
            cv2.rectangle(annotated_image, (x1, y1 - 20), (x1 + tw, y1), color, -1)
            cv2.putText(annotated_image, text, (x1, y1 - 5),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 0), 2)

    # 🔹 Chuyển ảnh annotated sang dạng JPEG
    _, buffer = cv2.imencode(".jpg", cv2.cvtColor(annotated_image, cv2.COLOR_RGB2BGR))
    image_bytes_out = BytesIO(buffer.tobytes())

    # 🔹 Trả kết quả: JSON + Ảnh (ở dạng multipart)
    return StreamingResponse(image_bytes_out, media_type="image/jpeg")

@app.get("/")
def root():
    return {"message": "YOLOv8 Detection API is running!"}
