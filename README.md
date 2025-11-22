# 🌱 AutoGrowChain v2.0

**Intelligent Agricultural Vision System with AI Analysis & Immutable Data Ledger**

Một nền tảng nông nghiệp thông minh toàn diện, tích hợp công nghệ **thị giác máy tính (Computer Vision)** tiên tiến (**YOLOv8**) để phân tích sức khỏe cây trồng theo thời gian thực và sử dụng **Blockchain** (**Tree Contract** và **TPL Contract**) để xác minh và lưu trữ dữ liệu ICD (Initial Crop Data) cùng với các bản ghi backend phục vụ cho việc học liên kết.

## 📋 Quick Links

* [Overview](#-overview)
* [Key Features](#-key-features)
* [System Architecture](#-system-architecture)
* [Technology Stack](#-technology-stack)
* [Installation & Running](#-installation--running)
* [Deployment](#-deployment)

---

## 📖 Overview

**AutoGrowChain v2.0** là một nền tảng thông minh tập trung vào sức khỏe cây trồng và quản lý dữ liệu bất biến:

* **Phân tích Thị giác:** Sử dụng **YOLOv8** để nhận diện, theo dõi và phân tích sâu hơn tình trạng sức khỏe của từng cây trồng.
* **Xác minh & Lưu trữ:** Dữ liệu quan trọng, bao gồm **Initial Crop Data (ICD)** và các bản ghi backend cần thiết cho **học liên kết (Federated Learning)**, được lưu trữ trên **TPL Contract** để đảm bảo tính minh bạch và bất biến.
* **Giám sát Real-time:** Theo dõi chi tiết tình trạng cây trồng (qua ID) thông qua giao diện người dùng **WebRTC** tối ưu.

### Use Cases

✅ **Giám sát Độ chính xác** - Phát hiện sớm và phân loại các bệnh, sâu bệnh hoặc dấu hiệu thiếu hụt dinh dưỡng bằng YOLOv8.

✅ **Quản lý Vòng đời Cây trồng** - Theo dõi và ghi lại trạng thái sinh trưởng của từng cây qua ID duy nhất.

✅ **Lưu trữ Dữ liệu Bất biến (ICD)** - Lưu trữ thông tin khởi tạo cây trồng và các dữ liệu backend quan trọng trên TPL Contract, phục vụ cho **backup** và **học liên kết**.

✅ **Truy xuất Nguồn gốc** - Cung cấp hồ sơ bất biến, minh bạch cho quá trình sinh trưởng (Blockchain-verified Audit Trail).

---

## 🎯 Key Features

### 🤖 AI-Powered Vision (YOLOv8)

* **Nhận diện & Phân loại** - Nâng cấp từ YOLOv5 lên **YOLOv8** cho khả năng nhận diện đối tượng và phân loại tình trạng cây trồng chính xác hơn.
* **Theo dõi Cây trồng** - Sử dụng ID cây để theo dõi liên tục trạng thái sức khỏe qua hình ảnh video.
* **Real-time Processing** - Xử lý hình ảnh tốc độ cao qua kết nối **WebSocket**.

### ⛓️ Blockchain Data Ledger

* **Tree Contract (Port 3000)** - Hợp đồng thông minh chính, lưu trữ các bản ghi trạng thái cơ bản của cây trồng.
* **TPL Contract (Port 3005)** - Chuyên trách việc **lưu trữ ICD** (dữ liệu khởi tạo cây trồng) và các **stored backend records** quan trọng. Dữ liệu này phục vụ cho nhu cầu **backup an toàn** và hỗ trợ các mô hình **học liên kết (Federated Learning)**.
* **Dữ liệu Bất biến** - Đảm bảo tính toàn vẹn và không thể sửa đổi của các bản ghi sức khỏe và ICD.

### 🌐 Real-Time WebRTC

* **Phát trực tiếp đa nền tảng** - Hỗ trợ truyền tải video chất lượng cao từ **camera thường** hoặc **điện thoại** thông qua WebRTC.
* **Giao diện Trực quan** - Hiển thị dữ liệu phân tích AI và trạng thái cây trồng theo thời gian thực.

---

## 🏗️ System Architecture

### Luồng Dữ liệu Chính:

1. **Camera/Thiết bị** → **Giao diện `cam.html`** (WebRTC/WebSocket)
2. **`cam.html`** → **AI Service (Port 8000)** (Nhập ID cây → Phân tích hình ảnh bằng YOLOv8)
3. **AI Service (Port 8000)** → **Backend API (Port 8002)** (Gửi kết quả phân tích & Cập nhật trạng thái)
4. **Backend API (Port 8002)** → **TPL Contract (Port 3005)** (Lưu trữ ICD & Backup Data lên Blockchain)
5. **Backend API (Port 8002)** → **Tree Contract (Port 3000)** (Cập nhật trạng thái cây trồng)
6. **Backend API (Port 8002)** → **Giao diện `index.html`** (Real-time dashboard)

---

## 💻 Technology Stack

| Layer                 | Công nghệ Chính         | Chi tiết Công nghệ                           |
| --------------------- | ----------------------- | -------------------------------------------- |
| **AI/ML**             | YOLOv8                  | Python, Ultralytics YOLOv8, FastAPI, Uvicorn |
| **Backend API**       | FastAPI (Python)        | Python 3.10+, FastAPI, Uvicorn               |
| **Blockchain Bridge** | Node.js                 | Express, Web3.js/Ethers.js, Solidity         |
| **Database**          | PostgreSQL/MongoDB      | Lưu trữ tạm thời, hỗ trợ học liên kết        |
| **Frontend/UI**       | HTML/JS/WebRTC          | WebRTC, WebSocket, Live Server               |
| **Networking**        | Ngrok/Cloudflare Tunnel | Public domain phục vụ WebRTC/WebSocket       |

---

## 🚀 Installation & Running

### Prerequisites

* Python 3.10+
* Node.js 16+
* Ultralytics YOLOv8
* Ngrok hoặc Cloudflare Tunnel
* Live Server (VSCode)

---

## 1. 🤖 Chạy AI Service (YOLOv8)

```bash
cd Yolo-Training
uvicorn mainV5:app --host 0.0.0.0 --port 8000 --reload
```

### Public qua Ngrok

```bash
ngrok http 8000
```

Ví dụ domain:

```
https://d4be9e62d6b0.ngrok-free.app
```

---

## 1.1 ⚙️ Cấu hình UI `cam.html`

Mở file:

```
Yolo-Training/ui/cam.html
```

Sửa dòng:

```javascript
const WEBSOCKET_URL_BASE = "wss://<domain>/stream/ws";
```

Thành:

```javascript
const WEBSOCKET_URL_BASE = "wss://d4be9e62d6b0.ngrok-free.app/stream/ws";
```

**CAM.HTML PHẢI TRUY CẬP BẰNG DOMAIN:**

```
https://d4be9e62d6b0.ngrok-free.app/ui/cam.html
```

---

## 1.2 ⚙️ Cấu hình UI `index.html`

Mở file:

```
Yolo-Training/ui/index.html
```

Sửa:

```javascript
const WEBRTC_URL_BASE_WS = "wss://d4be9e62d6b0.ngrok-free.app/stream/ws";
```

**INDEX.HTML CŨNG PHẢI TRUY CẬP BẰNG DOMAIN:**

```
https://d4be9e62d6b0.ngrok-free.app/ui/index.html
```

---

## 2. 💻 Chạy Backend API (Pione)

```bash
cd Pione
uvicorn main:app --host 0.0.0.0 --port 8002
```

Quy trình:

1. Truy cập **cam.html** trước → nhập ID cây (vd: 7)
2. Mở **index.html** → vào Plant_A1 (ID 7)
3. Dashboard realtime hoạt động

---

## 3. ⛓️ Chạy Tree Contract (Port 3000)

```bash
cd "Tree Contract"
node server.js
```

> Backend vẫn chạy nếu contract tắt, nhưng không lưu được blockchain.

---

## 4. 🔗 Chạy TPL Contract (Port 3005)

```bash
cd TPL
node server.js
```

Dùng để lưu **ICD** & **Backup records**.

---

## 📦 Deployment Checklist

* HTTPS/SSL cho AI + Backend
* Cấu hình Firewall
* Bảo mật API Keys & ENV
* Tối ưu hóa YOLOv8 (ONNX, INT8)
* Kiểm tra WebRTC + WebSocket
* Monitoring & Logs

---

## 📄 License

MIT License — Updated 2025
