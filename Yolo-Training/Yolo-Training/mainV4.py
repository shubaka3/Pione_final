from fastapi import FastAPI, WebSocket, WebSocketDisconnect, APIRouter
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from ultralytics import YOLO
from PIL import Image
import numpy as np
import logging
import asyncio

# Thư viện quan trọng cho WebRTC trên Python
from aiortc import RTCPeerConnection, RTCSessionDescription
from aiortc.mediastreams import MediaStreamTrack

# Để chuyển đổi frame aiortc sang PIL/Numpy (cần opencv-python, av)
# Lưu ý: Các thư viện này cần được cài đặt nếu chưa có: pip install opencv-python av
# Tuy nhiên, ta dùng frame.to_ndarray() của aiortc để đơn giản hóa.

# --- CẤU HÌNH ---
router = APIRouter()
model = YOLO("yolov8n.pt")
logging.basicConfig(level=logging.INFO)

# --- DANH SÁCH TÁI PHÂN LOẠI (Giữ nguyên) ---
FRUIT_LABELS_TO_BE_APPLE = ["APPLE", "ORANGE", "BALL", "GRAPE"]
# Dictionary để lưu trữ các Peer Connection đang hoạt động
peer_connections: dict[str, RTCPeerConnection] = {}
# Set để lưu trữ các WebSocket client cho signaling
signaling_websockets: dict[str, WebSocket] = {}

# --- LỚP XỬ LÝ VIDEO VỚI YOLOV8 ---
# Lớp này kế thừa từ MediaStreamTrack của aiortc để xử lý từng frame
class YOLOv8DetectionTrack(MediaStreamTrack):
    """Một luồng video tùy chỉnh để xử lý YOLOv8 trên các frame nhận được."""
    kind = "video"

    def __init__(self, track_from_broadcaster, ws_to_send_results):
        super().__init__()
        self.track = track_from_broadcaster  # Luồng video nhận từ người phát sóng
        self.ws = ws_to_send_results         # WebSocket để gửi kết quả JSON về client
        self.yolo_model = model              # Load mô hình YOLOv8
        self.relabel_labels = FRUIT_LABELS_TO_BE_APPLE
        self.frame_skip = 3                  # Bỏ qua 3 frame, chỉ xử lý 1 frame (ví dụ 10 FPS thay vì 30 FPS)
        self._counter = 0

    async def recv(self):
        # Lấy frame tiếp theo từ luồng video WebRTC
        frame = await self.track.recv()
        self._counter += 1

        if self._counter % self.frame_skip != 0:
            # Bỏ qua frame để giảm tải xử lý và mô phỏng real-time tốt hơn
            return frame 
        
        try:
            # 1. Chuyển đổi frame aiortc sang numpy array (RGB)
            img_np = frame.to_ndarray(format="rgb24")
            image = Image.fromarray(img_np)

            # 2. Chạy YOLOv8
            # Giảm kích thước ảnh đầu vào để tăng tốc độ xử lý
            results = self.yolo_model.predict(source=image, conf=0.25, verbose=False, imgsz=480) 

            detections = []
            for r in results:
                for box in r.boxes:
                    x1, y1, x2, y2 = map(float, box.xyxy[0])
                    conf = float(box.conf[0])
                    cls_id = int(box.cls[0])
                    original_label = self.yolo_model.names[cls_id]

                    # 3. ÁP DỤNG LOGIC TÁI PHÂN LOẠI
                    if original_label.upper() in self.relabel_labels:
                        final_label = "apple"
                    else:
                        final_label = original_label

                    detections.append({
                        "label": final_label,
                        "confidence": conf,
                        "x1": x1, "y1": y1, "x2": x2, "y2": y2
                    })
            
            # 4. Gửi kết quả JSON về client (người xem) qua WebSocket
            if self.ws and detections:
                await self.ws.send_json({"type": "detection_result", "detections": detections})
                
        except Exception as e:
            logging.error(f"Lỗi xử lý YOLOv8 frame: {e}")
        
        # Trả lại frame gốc (hoặc frame đã được vẽ bounding box)
        return frame 


# --- WEBSOCKET ENDPOINT CHO SIGNALING VÀ XỬ LÝ WEBRTC ---
@router.websocket("/webrtc/ws/{room_name}")
async def websocket_endpoint(websocket: WebSocket, room_name: str):
    await websocket.accept()
    signaling_websockets[room_name] = websocket
    logging.info(f"Signaling Client đã kết nối: {room_name}")

    try:
        while True:
            data = await websocket.receive_json()
            
            # --- XỬ LÝ OFFER TỪ CLIENT (Người phát sóng) ---
            if 'offer' in data:
                offer_sdp = data['offer']
                
                # Tạo RTCPeerConnection mới
                pc = RTCPeerConnection()
                peer_connections[room_name] = pc
                
                @pc.on("icecandidate")
                async def on_icecandidate(candidate):
                    # Gửi ICE Candidate về cho client
                    if candidate:
                        await websocket.send_json({"iceCandidate": candidate.json()})

                @pc.on("track")
                async def on_track(track):
                    logging.info(f"Đã nhận luồng {track.kind} từ người phát sóng")
                    if track.kind == "video":
                        # Khởi tạo lớp xử lý YOLOv8
                        yolo_track = YOLOv8DetectionTrack(track, websocket)
                        # Bắt đầu xử lý frame video
                        await yolo_track.recv() 

                # Thiết lập Offer và tạo Answer
                await pc.setRemoteDescription(RTCSessionDescription(**offer_sdp))
                answer = await pc.createAnswer()
                await pc.setLocalDescription(answer)

                # Gửi Answer về cho client
                await websocket.send_json({"answer": pc.localDescription.json()})

            # --- XỬ LÝ ICE CANDIDATE TỪ CLIENT ---
            elif 'iceCandidate' in data:
                if pc := peer_connections.get(room_name):
                    await pc.addIceCandidate(RTCIceCandidate(**data['iceCandidate']))

    except WebSocketDisconnect:
        logging.info(f"Signaling Client đã ngắt kết nối: {room_name}")
    finally:
        if room_name in peer_connections:
            await peer_connections[room_name].close()
            del peer_connections[room_name]
        if room_name in signaling_websockets:
             del signaling_websockets[room_name]


# --- TÍCH HỢP VÀO FASTAPI CHÍNH ---
app = FastAPI(title="YOLOv8 Real-time WebRTC Detection")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])
app.include_router(router)

@app.get("/")
def root():
    return {"message": "✅ YOLOv8 Real-time WebRTC Server is running!"}