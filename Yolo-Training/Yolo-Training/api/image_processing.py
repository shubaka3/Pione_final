# /my_streaming_project/api/image_processing.py

from fastapi import APIRouter, File, UploadFile
from ultralytics import YOLO
from PIL import Image
import io
import logging

router = APIRouter()
model = YOLO("yolov8n.pt") 

@router.post("/image")
async def predict_image(file: UploadFile = File(...)):
    """
    Nhận một file ảnh, chạy YOLOv8 và trả về kết quả phát hiện.
    """
    logging.info("Nhận được yêu cầu xử lý ảnh...")
    try:
        # Đọc nội dung file ảnh
        contents = await file.read()
        image = Image.open(io.BytesIO(contents))

        # Chạy model. Chạy trên CPU sẽ chậm hơn.
        results = model.predict(source=image, conf=0.25, verbose=False, imgsz=640)

        # Trích xuất kết quả
        detections = []
        if results and len(results) > 0:
            r = results[0]
            orig_shape = r.orig_shape
            for box in r.boxes:
                x1, y1, x2, y2 = map(float, box.xyxy[0])
                conf = float(box.conf[0])
                cls_id = int(box.cls[0])
                label = model.names[cls_id]
                detections.append({"label": label, "confidence": conf, "box": [x1, y1, x2, y2]})
        
        logging.info(f"Phát hiện được: {detections}")
        return {"detections": detections, "orig_shape": orig_shape}

    except Exception as e:
        logging.error(f"Lỗi khi xử lý ảnh: {e}")
        return {"error": "Không thể xử lý ảnh."}