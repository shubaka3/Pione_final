# # /my_streaming_project/api/webrtc_signaling_simple.py (ĐÃ SỬA LỖI DỰA TRÊN PHIÊN BẢN HOÀN THIỆN)

# from fastapi import APIRouter, WebSocket, WebSocketDisconnect
# from typing import Dict, Optional, List
# import logging
# from aiortc import RTCPeerConnection, RTCSessionDescription, MediaStreamTrack, RTCConfiguration, RTCIceServer
# from aiortc.sdp import candidate_from_sdp

# router = APIRouter()
# logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# STUN_SERVER = RTCConfiguration([
#     RTCIceServer(urls="stun:stun.l.google.com:19302")
# ])

# class Room:
#     def __init__(self):
#         self.broadcaster_pc: Optional[RTCPeerConnection] = None
#         self.viewer_pcs: Dict[str, RTCPeerConnection] = {}
#         # *** THAY ĐỔI QUAN TRỌNG: Thêm biến để lưu trữ luồng video ***
#         self.video_track: Optional[MediaStreamTrack] = None

#     async def close(self):
#         if self.broadcaster_pc: await self.broadcaster_pc.close()
#         for pc in self.viewer_pcs.values(): await pc.close()
#         self.viewer_pcs.clear()

# rooms: Dict[str, Room] = {}

# @router.websocket("/ws/{room_name}/{client_id}")
# async def websocket_endpoint(websocket: WebSocket, room_name: str, client_id: str):
#     await websocket.accept()
#     if room_name not in rooms: rooms[room_name] = Room()
#     room = rooms[room_name]
    
#     is_broadcaster = False
#     pc = None

#     try:
#         while True:
#             data = await websocket.receive_json()
#             msg_type = data.get("type")

#             if msg_type == "offer":
#                 is_broadcaster = True
#                 pc = RTCPeerConnection(STUN_SERVER)
#                 room.broadcaster_pc = pc
                
#                 @pc.on("track")
#                 async def on_track(track):
#                     if track.kind == "video":
#                         logging.info(f"Đã nhận Video Track cho phòng '{room_name}'")
#                         # 1. Lưu track lại
#                         room.video_track = track
#                         # 2. Gửi track cho tất cả viewer đang chờ
#                         for viewer_pc in room.viewer_pcs.values():
#                             viewer_pc.addTrack(track)
                
#                 await pc.setRemoteDescription(RTCSessionDescription(**data["sdp"]))
#                 answer = await pc.createAnswer()
#                 await pc.setLocalDescription(answer)
#                 await websocket.send_json({"type": "answer", "sdp": pc.localDescription.__dict__})

#             elif msg_type == "join_as_viewer":
#                 pc = RTCPeerConnection(STUN_SERVER)
#                 room.viewer_pcs[client_id] = pc

#                 # 3. Nếu track đã có sẵn, thêm nó vào ngay lập tức
#                 if room.video_track:
#                     logging.info(f"Gửi track đã có cho viewer '{client_id}'")
#                     pc.addTrack(room.video_track)
                
#                 offer = await pc.createOffer()
#                 await pc.setLocalDescription(offer)
#                 await websocket.send_json({"type": "offer", "sdp": pc.localDescription.__dict__})

#             elif msg_type == "answer":
#                 if client_id in room.viewer_pcs:
#                     await room.viewer_pcs[client_id].setRemoteDescription(RTCSessionDescription(**data["sdp"]))
            
#             elif msg_type == "candidate" and data.get("candidate"):
#                 pc_to_update = room.broadcaster_pc if is_broadcaster else room.viewer_pcs.get(client_id)
#                 if pc_to_update:
#                     cand = candidate_from_sdp(data["candidate"]['candidate'].split(":", 1)[1])
#                     cand.sdpMid = data["candidate"]['sdpMid']
#                     cand.sdpMLineIndex = data["candidate"]['sdpMLineIndex']
#                     await pc_to_update.addIceCandidate(cand)

#     except WebSocketDisconnect:
#         logging.info(f"Client '{client_id}' ngắt kết nối.")
#     finally:
#         # Dọn dẹp
#         if room_name in rooms:
#             if is_broadcaster:
#                 await rooms[room_name].close()
#                 if room_name in rooms: del rooms[room_name]
#             elif client_id in rooms[room_name].viewer_pcs:
#                 await rooms[room_name].viewer_pcs[client_id].close()
#                 del rooms[room_name].viewer_pcs[client_id]

# /my_streaming_project/api/webrtc_signaling_simple.py (ĐÃ SỬA LỖI LOGIC)

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from typing import Dict, Optional, List
import logging
from aiortc import RTCPeerConnection, RTCSessionDescription, MediaStreamTrack, RTCConfiguration, RTCIceServer
from aiortc.sdp import candidate_from_sdp

router = APIRouter()
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

STUN_SERVER = RTCConfiguration([
    RTCIceServer(urls="stun:stun.l.google.com:19302")
])

class Room:
    def __init__(self):
        self.broadcaster_pc: Optional[RTCPeerConnection] = None
        # *** THAY ĐỔI: Lưu cả PC và Websocket của Viewer ***
        self.viewer_connections: Dict[str, Dict] = {} # { client_id: {"pc": pc, "ws": ws} }
        self.video_track: Optional[MediaStreamTrack] = None

    async def close(self):
        if self.broadcaster_pc: await self.broadcaster_pc.close()
        for conn in self.viewer_connections.values(): await conn["pc"].close()
        self.viewer_connections.clear()

rooms: Dict[str, Room] = {}

@router.websocket("/ws/{room_name}/{client_id}")
async def websocket_endpoint(websocket: WebSocket, room_name: str, client_id: str):
    await websocket.accept()
    logging.info(f"Client '{client_id}' kết nối vào phòng '{room_name}'.")
    
    if room_name not in rooms: rooms[room_name] = Room()
    room = rooms[room_name]
    
    is_broadcaster = False
    pc: Optional[RTCPeerConnection] = None

    try:
        while True:
            data = await websocket.receive_json()
            msg_type = data.get("type")

            if msg_type == "offer":
                # --- XỬ LÝ BROADCASTER ---
                is_broadcaster = True
                pc = RTCPeerConnection(STUN_SERVER)
                room.broadcaster_pc = pc
                
                @pc.on("track")
                async def on_track(track):
                    if track.kind == "video":
                        logging.info(f"Đã nhận Video Track cho phòng '{room_name}'")
                        room.video_track = track
                        
                        # *** SỬA LỖI: Gửi offer cho tất cả viewer đang chờ ***
                        for viewer_id, conn in room.viewer_connections.items():
                            try:
                                viewer_pc = conn["pc"]
                                viewer_ws = conn["ws"]
                                
                                # 1. Thêm track
                                viewer_pc.addTrack(track)
                                
                                # 2. Tạo offer (BÂY GIỜ MỚI HỢP LỆ)
                                offer = await viewer_pc.createOffer()
                                await viewer_pc.setLocalDescription(offer)
                                
                                # 3. Gửi offer cho viewer
                                await viewer_ws.send_json({"type": "offer", "sdp": viewer_pc.localDescription.__dict__})
                                logging.info(f"Đã gửi offer (với track) cho viewer '{viewer_id}'.")
                            except Exception as e:
                                logging.error(f"Lỗi khi gửi offer cho viewer '{viewer_id}': {e}")
                
                await pc.setRemoteDescription(RTCSessionDescription(**data["sdp"]))
                answer = await pc.createAnswer()
                await pc.setLocalDescription(answer)
                await websocket.send_json({"type": "answer", "sdp": pc.localDescription.__dict__})

            elif msg_type == "join_as_viewer":
                # --- XỬ LÝ VIEWER ---
                pc = RTCPeerConnection(STUN_SERVER)
                # *** SỬA LỖI: Lưu cả PC và Websocket ***
                room.viewer_connections[client_id] = {"pc": pc, "ws": websocket}

                # *** SỬA LỖI: Chỉ gửi offer NẾU track đã có sẵn ***
                if room.video_track:
                    logging.info(f"Gửi track (đã có) cho viewer '{client_id}'")
                    pc.addTrack(room.video_track)
                    
                    offer = await pc.createOffer()
                    await pc.setLocalDescription(offer)
                    await websocket.send_json({"type": "offer", "sdp": pc.localDescription.__dict__})
                else:
                    # Nếu track chưa có, chỉ cần chờ.
                    logging.info(f"Viewer '{client_id}' đang chờ broadcaster...")

            elif msg_type == "answer":
                # --- XỬ LÝ ANSWER TỪ VIEWER ---
                if client_id in room.viewer_connections:
                    viewer_pc = room.viewer_connections[client_id]["pc"]
                    await viewer_pc.setRemoteDescription(RTCSessionDescription(**data["sdp"]))
            
            elif msg_type == "candidate" and data.get("candidate"):
                # --- XỬ LÝ ICE CANDIDATE ---
                pc_to_update = None
                if is_broadcaster:
                    pc_to_update = room.broadcaster_pc
                elif client_id in room.viewer_connections:
                    pc_to_update = room.viewer_connections[client_id]["pc"]
                
                if pc_to_update:
                    try:
                        cand_data = data["candidate"]
                        # Xử lý định dạng candidate linh hoạt hơn
                        if isinstance(cand_data, dict):
                            cand = candidate_from_sdp(cand_data['candidate'].split(":", 1)[1])
                            cand.sdpMid = cand_data['sdpMid']
                            cand.sdpMLineIndex = cand_data['sdpMLineIndex']
                            await pc_to_update.addIceCandidate(cand)
                        elif isinstance(cand_data, str):
                            cand = candidate_from_sdp(cand_data.split(":", 1)[1])
                            await pc_to_update.addIceCandidate(cand)
                    except Exception as e:
                        logging.warning(f"Lỗi khi thêm ICE candidate: {e} - Data: {data.get('candidate')}")

    except WebSocketDisconnect:
        logging.info(f"Client '{client_id}' ngắt kết nối.")
    finally:
        # Dọn dẹp
        if room_name in rooms:
            if is_broadcaster:
                logging.info(f"Broadcaster phòng '{room_name}' đã rời. Đóng phòng.")
                await rooms[room_name].close()
                if room_name in rooms: del rooms[room_name]
            elif client_id in rooms[room_name].viewer_connections:
                logging.info(f"Viewer '{client_id}' đã rời.")
                conn = rooms[room_name].viewer_connections.pop(client_id)
                await conn["pc"].close()