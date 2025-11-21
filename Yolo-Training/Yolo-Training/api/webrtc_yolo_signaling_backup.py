# /my_streaming_project/api/webrtc_yolo_signaling_corrected.py

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from typing import Dict, Set, Optional
import logging
import asyncio
from aiortc import RTCPeerConnection, RTCSessionDescription, MediaStreamTrack, RTCConfiguration, RTCIceServer
from aiortc.sdp import candidate_from_sdp
from ultralytics import YOLO
from PIL import Image

# --- CẤU HÌNH ---
router = APIRouter()
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
model = YOLO("yolov8n.pt") 
STUN_SERVER = RTCConfiguration([
    RTCIceServer(urls="stun:stun.l.google.com:19302")
])

# --- LỚP XỬ LÝ YOLO ---
class YOLOv8FrameProcessor(MediaStreamTrack):
    kind = "video"

    def __init__(self, track: MediaStreamTrack, room_name: str, clients: Set[WebSocket]):
        super().__init__()
        self.track = track
        self.room_name = room_name
        self.clients = clients
        self.yolo_model = model
        self.frame_skip = 2
        self._counter = 0

    async def recv(self):
        frame = await self.track.recv()
        self._counter += 1
        
        if self._counter % self.frame_skip != 0:
            return frame

        try:
            img = frame.to_image()
            results = self.yolo_model.predict(source=img, conf=0.4, verbose=False)
            
            detections = []
            if results and len(results) > 0:
                r = results[0]
                orig_shape = r.orig_shape
                for box in r.boxes:
                    x1, y1, x2, y2 = map(float, box.xyxy[0])
                    conf = float(box.conf[0])
                    cls_id = int(box.cls[0])
                    label = self.yolo_model.names[cls_id]
                    detections.append({"label": label, "confidence": conf, "box": [x1, y1, x2, y2]})
            
            if detections and self.clients:
                message = {"type": "yolo_results", "detections": detections, "orig_shape": orig_shape}
                tasks = [client.send_json(message) for client in self.clients if client.client_state.name == 'OPEN']
                await asyncio.gather(*tasks, return_exceptions=True)

        except Exception as e:
            logging.error(f"Lỗi xử lý YOLO trong phòng '{self.room_name}': {e}")
        
        return frame

# --- QUẢN LÝ TRẠNG THÁI PHÒNG ---
class Room:
    def __init__(self, room_name: str):
        self.room_name = room_name
        self.broadcaster_pc: Optional[RTCPeerConnection] = None
        self.broadcaster_ws: Optional[WebSocket] = None
        self.viewer_pcs: Dict[str, RTCPeerConnection] = {}
        self.viewers_ws: Dict[str, WebSocket] = {}
        self.clients_for_yolo: Set[WebSocket] = set()
        self.video_track: Optional[MediaStreamTrack] = None

    async def close(self):
        logging.info(f"Đóng phòng '{self.room_name}' và dọn dẹp.")
        if self.broadcaster_pc: await self.broadcaster_pc.close()
        for pc in self.viewer_pcs.values(): await pc.close()
        self.viewer_pcs.clear(); self.viewers_ws.clear(); self.clients_for_yolo.clear()

rooms: Dict[str, Room] = {}

# --- LOGIC XỬ LÝ WEBSOCKET ---
@router.websocket("/ws/{room_name}/{client_id}")
async def websocket_endpoint(websocket: WebSocket, room_name: str, client_id: str):
    await websocket.accept()
    
    if room_name not in rooms: rooms[room_name] = Room(room_name)
    room = rooms[room_name]

    try:
        data = await websocket.receive_json()
        msg_type = data.get("type")

        # === XỬ LÝ BROADCASTER (CAMERA) ===
        if msg_type == "offer":
            logging.info(f"Camera '{client_id}' kết nối tới phòng '{room_name}'")
            if room.broadcaster_pc:
                await websocket.send_json({"error": "Phòng đã có camera phát."}); return
            
            room.broadcaster_ws = websocket
            pc = RTCPeerConnection(STUN_SERVER)
            room.broadcaster_pc = pc

            @pc.on("track")
            async def on_track(track):
                if track.kind == "video":
                    logging.info(f"Nhận video track từ camera cho phòng '{room_name}'")
                    room.video_track = YOLOv8FrameProcessor(track, room.room_name, room.clients_for_yolo)
                    for viewer_id, viewer_pc in list(room.viewer_pcs.items()):
                        viewer_pc.addTrack(room.video_track)
                        offer = await viewer_pc.createOffer()
                        await viewer_pc.setLocalDescription(offer)
                        await room.viewers_ws[viewer_id].send_json({"type": "offer", "sdp": {"sdp": offer.sdp, "type": offer.type}})

            await pc.setRemoteDescription(RTCSessionDescription(sdp=data["sdp"]["sdp"], type=data["sdp"]["type"]))
            answer = await pc.createAnswer()
            await pc.setLocalDescription(answer)
            await websocket.send_json({"type": "answer", "sdp": {"sdp": pc.localDescription.sdp, "type": pc.localDescription.type}})

            # Vòng lặp lắng nghe ICE candidate từ broadcaster
            while True:
                data = await websocket.receive_json()
                if data.get("type") == "candidate" and data.get("candidate"):
                    cand = candidate_from_sdp(data["candidate"]['candidate'].split(":", 1)[1])
                    cand.sdpMid = data["candidate"]['sdpMid']
                    cand.sdpMLineIndex = data["candidate"]['sdpMLineIndex']
                    await pc.addIceCandidate(cand)

        # === XỬ LÝ VIEWER (NGƯỜI XEM) ===
        elif msg_type == "join_as_viewer":
            logging.info(f"Người xem '{client_id}' tham gia phòng '{room_name}'")
            room.viewers_ws[client_id] = websocket
            room.clients_for_yolo.add(websocket)
            pc = RTCPeerConnection(configuration=STUN_SERVER)
            room.viewer_pcs[client_id] = pc

            if room.video_track:
                pc.addTrack(room.video_track)
                offer = await pc.createOffer()
                await pc.setLocalDescription(offer)
                await websocket.send_json({"type": "offer", "sdp": {"sdp": offer.sdp, "type": offer.type}})
            
            # Vòng lặp lắng nghe answer và ICE candidate từ viewer
            while True:
                data = await websocket.receive_json()
                msg_type = data.get("type")
                if msg_type == "answer":
                    await pc.setRemoteDescription(RTCSessionDescription(sdp=data["sdp"]["sdp"], type=data["sdp"]["type"]))
                elif msg_type == "candidate" and data.get("candidate"):
                    cand = candidate_from_sdp(data["candidate"]['candidate'].split(":", 1)[1])
                    cand.sdpMid = data["candidate"]['sdpMid']
                    cand.sdpMLineIndex = data["candidate"]['sdpMLineIndex']
                    await pc.addIceCandidate(cand)

    except WebSocketDisconnect:
        logging.info(f"Client '{client_id}' đã ngắt kết nối khỏi phòng '{room_name}'")
    finally:
        if room_name in rooms:
            room = rooms[room_name]
            if room.broadcaster_ws == websocket:
                logging.info(f"Camera phòng '{room_name}' đã rời đi. Đóng phòng.")
                await room.close()
                if room_name in rooms: del rooms[room_name]
            elif client_id in room.viewer_pcs:
                logging.info(f"Viewer '{client_id}' đã rời phòng '{room_name}'.")
                await room.viewer_pcs[client_id].close()
                del room.viewer_pcs[client_id]
                del room.viewers_ws[client_id]
                room.clients_for_yolo.remove(websocket)