# /my_streaming_project/main.py

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

# Import router từ file chứa logic của bạn
from api import webrtc_yolo_signaling, image_processing

# --- 1. KHỞI TẠO ỨNG DỤNG FASTAPI CHÍNH ---
app = FastAPI(
    title="YOLOv8 WebRTC Streaming API",
    description="Một server real-time để xử lý video stream với YOLOv8 qua WebRTC.",
    version="1.0.0"
)

# --- 2. CẤU HÌNH MIDDLEWARE (CORS) ---
# Cực kỳ quan trọng: Cho phép trình duyệt kết nối tới server từ các nguồn khác nhau.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Trong sản phẩm thực tế, hãy giới hạn lại (ví dụ: ["http://localhost:3000"])
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- 3. GẮN ROUTER VÀO ỨNG DỤNG ---
# Tất cả các endpoint trong webrtc_yolo_signaling sẽ có tiền tố là /stream
app.mount("/ui", StaticFiles(directory="ui"), name="ui")


app.include_router(
    webrtc_yolo_signaling.router,
    prefix="/stream",
    tags=["WebRTC YOLOv8 Streaming"]
)

# Gắn router xử lý ảnh
app.include_router(
    image_processing.router,
    prefix="/predict",
    tags=["YOLO Prediction"]
)

# --- ENDPOINT GỐC ĐỂ KIỂM TRA SỨC KHỎE ---
@app.get("/api/status", tags=["Root"])
def read_root():
    return {"status": "✅ Server is running!"}

# --- 4. CHẠY SERVER (Tùy chọn, để tiện phát triển) ---
if __name__ == "__main__":
    # Chạy server với Uvicorn trên cổng 8000
    uvicorn.run(app, host="0.0.0.0", port=8000)