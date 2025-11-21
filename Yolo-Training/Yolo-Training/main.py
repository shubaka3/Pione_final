from fastapi import FastAPI, File, UploadFile
from fastapi.responses import StreamingResponse
from ultralytics import YOLO
from PIL import Image
from io import BytesIO
import numpy as np
import cv2

# ==========================
# 🚀 Khởi tạo FastAPI
# ==========================
app = FastAPI(title="Leaf and Apple Bounding Box Detection API")

# 🔹 Load mô hình YOLO (đường dẫn mô hình detect đã train)
# Thay đường dẫn này nếu mô hình của bạn nằm nơi khác
model = YOLO("runs/detect/apple-leaf-detect2/weights/best.pt")

# ==========================
# 🔹 API phát hiện bounding boxes
# ==========================
@app.post("/detect/")
async def detect_leaves(file: UploadFile = File(...)):
    """
    API nhận 1 ảnh, phát hiện các vật thể (lá, quả...) và trả lại ảnh có bounding boxes.
    """
    # Đọc file ảnh
    image_bytes = await file.read()
    image = Image.open(BytesIO(image_bytes)).convert("RGB")

    # Chạy dự đoán YOLO
    results = model.predict(image, verbose=False)

    # Chuyển sang BGR để vẽ bằng OpenCV
    img_bgr = cv2.cvtColor(np.array(image), cv2.COLOR_RGB2BGR)

    # Duyệt qua các bounding boxes
    for box in results[0].boxes:
        # Lấy toạ độ, nhãn và độ tin cậy
        x1, y1, x2, y2 = map(int, box.xyxy[0])
        conf = float(box.conf[0])
        cls_id = int(box.cls[0])
        label = results[0].names[cls_id]

        # Vẽ khung và nhãn
        color = (0, 255, 0)
        cv2.rectangle(img_bgr, (x1, y1), (x2, y2), color, 2)
        text = f"{label} {conf:.2f}"
        cv2.putText(img_bgr, text, (x1, y1 - 5),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.6, color, 2)

    # Mã hoá lại ảnh để trả về client
    _, buffer = cv2.imencode(".jpg", img_bgr)
    return StreamingResponse(BytesIO(buffer.tobytes()), media_type="image/jpeg")

# ==========================
# 🔹 API test (root)
# ==========================
@app.get("/")
def root():
    return {"message": "✅ Leaf & Apple Bounding Box Detection API is running!"}

# ==========================
# 🔹 Chạy server (uvicorn)
# ==========================
# Chạy bằng lệnh: uvicorn main:app --reload
