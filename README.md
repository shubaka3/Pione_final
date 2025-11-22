backend: https://github.com/shubaka3/pione.git
vì code dính .git của file đấy nên mình gửi lại ở đây 

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

1.  **Camera/Thiết bị** $\to$ **Giao diện `cam.html`** (WebRTC/WebSocket)
2.  **`cam.html`** $\to$ **AI Service (Port 8000)** (Nhập ID cây $\to$ Phân tích hình ảnh bằng **YOLOv8**)
3.  **AI Service (Port 8000)** $\to$ **Backend API (Port 8002)** (Gửi kết quả phân tích & Cập nhật trạng thái)
4.  **Backend API (Port 8002)** $\to$ **TPL Contract (Port 3005)** (Lưu trữ **ICD** và **Backup Data** lên Blockchain)
5.  **Backend API (Port 8002)** $\to$ **Tree Contract (Port 3000)** (Cập nhật trạng thái cây trồng)
6.  **Backend API (Port 8002)** $\to$ **Giao diện `index.html`** (Hiển thị dữ liệu Real-time)

---

## 💻 Technology Stack

| Layer | Công nghệ Chính | Chi tiết Công nghệ |
| :--- | :--- | :--- |
| **AI/ML** | **YOLOv8** | Python, Ultralytics YOLOv8, TensorFlow/PyTorch (phụ thuộc vào implementation), **Uvicorn** (cho Service), **FastAPI** (cho API). |
| **Backend API** | **Python (FastAPI)** | Python 3.10+, FastAPI (cung cấp API chính), Uvicorn, Thư viện xử lý dữ liệu. |
| **Blockchain Bridge** | **Node.js** | Node.js (Express), **Web3.js/Ethers.js** (tương tác với Smart Contracts), **Solidity** (Smart Contracts). |
| **Database/Storage**| PostgreSQL/MongoDB | Lưu trữ tạm thời (Local DB), phục vụ cho **backup** và **học liên kết**. |
| **Frontend/UI** | **HTML/JS (WebRTC)** | HTML5, JavaScript, **WebRTC** (truyền video), **WebSocket** (truyền dữ liệu AI), **Live Server** (phát triển). |
| **Networking/Tunnel** | **Ngrok/Cloudflare** | Ngrok, Cloudflare Tunnel (public API/AI Service), WebSocket/WebRTC Protocols. |

---

## 🚀 Installation & Running

Thực hiện các bước sau để khởi động đầy đủ các dịch vụ của **AutoGrowChain**.

### Prerequisites

* Node.js (16+ trở lên)
* Python (3.10+ trở lên)
* Các thư viện Python cần thiết cho YOLOv8 (bao gồm `ultralytics`)
* Git
* Ngrok hoặc Cloudflare Tunnel (để public AI Service)

### 1. 🤖 Chạy AI Service (YOLOv8)

Đây là dịch vụ phân tích hình ảnh chính sử dụng **YOLOv8**.

1.  **Chạy Service:**
    ```bash
    cd Yolo-Training
    uvicorn mainV5:app --host 0.0.0.0 --port 8000 --reload
    ```
2.  **Public Service:**
    * Sử dụng **Ngrok** hoặc **Cloudflare Tunnel** để tạo tên miền công khai cho **Port 8000**.
3.  **Cấu hình UI (`cam.html`):**
    * Tìm trong file **`ui/cam.html`** dòng:
        ```javascript
        const WEBSOCKET_URL_BASE = "ws://<DOMAIN_CUA_BAN>/"
        ```
    * Thay thế `<DOMAIN_CUA_BAN>` bằng domain vừa host cho port 8000.

### 2. 💻 Chạy Backend API (Pione)

Đây là cổng nhận dữ liệu từ AI và điều phối việc lưu trữ (Local và Blockchain).

1.  **Chạy Service:**
    ```bash
    cd Pione
    uvicorn main:app --host 0.0.0.0 --port 8002
    ```

### 1.1 & 2.1. 🌐 Chạy UI/Giao diện (Frontend)

1.  **Cấu hình UI (`index.html`):**
    * Tìm trong file **`ui/index.html`** dòng:
        ```javascript
        const WEBRTC_URL_BASE_WS = "ws://<DOMAIN_CUA_BAN>/"
        ```
    * Thay thế `<DOMAIN_CUA_BAN>` bằng domain vừa host cho port 8000 (giống bước 1.2).
2.  **Chạy Frontend:**
    * Sử dụng **Live Server** hoặc tương tự để chạy file **`index.html`**.

### 3. ⛓️ Chạy Tree Contract Service (Ghi nhận Trạng thái Cây)

1.  **Chạy Service:**
    ```bash
    cd "Tree Contract"
    node server.js
    ```
    * Đảm bảo dịch vụ chạy trên **Port 3000**.
    * > **Lưu ý:** Backend API (Port 8002) vẫn chạy OK nếu contract không khởi động, nhưng sẽ không lưu dữ liệu lên Contract.

### 4. 🔗 Chạy TPL Contract Service (Lưu trữ ICD & Backup Data)

1.  **Chạy Service:**
    ```bash
    cd TPL
    node server.js
    ```
    * Đảm bảo dịch vụ chạy trên **Port 3005**. Dịch vụ này thực hiện việc **lưu trữ ICD** và **backup records** phục vụ cho **học liên kết**.

### ⚙️ Quy trình Vận hành

1.  Truy cập giao diện **`cam.html`** trước.
2.  Nhập **ID của cây** (ví dụ: `7`).
3.  Truy cập giao diện **`index.html`**.
4.  Vào phần theo dõi cây tương ứng (ví dụ: `Plant_A1 (ID 7)`).
5.  Bạn sẽ thấy dữ liệu Real-time được cập nhật.

---

## 📦 Deployment

### Production Checklist

* Thiết lập **HTTPS/SSL** cho tất cả các dịch vụ (AI, Backend).
* Cấu hình **Firewall Rules** chính xác và bảo mật.
* Bảo mật các khóa API và biến môi trường (**Environment Variables**).
* Tối ưu hóa mô hình **YOLOv8** cho môi trường sản xuất (ví dụ: dùng ONNX).
* Kiểm tra tính năng **WebRTC** và **WebSocket** trên môi trường Production.
* Thiết lập **Giám sát & Cảnh báo** cho các dịch vụ.

---

## 🤝 Contributing

Quy trình đóng góp (Contributing) tiêu chuẩn:

1.  Fork repository.
2.  Tạo branch mới (e.g., `git checkout -b feature/yolov8-optimization`).
3.  Commit các thay đổi (e.g., `git commit -m 'Optimize YOLOv8 inference speed'`).
4.  Push lên branch (e.g., `git push origin feature/yolov8-optimization`).
5.  Mở **Pull Request**.

## 📄 License

MIT License - xem file `LICENSE` để biết chi tiết.

**Version:** 2.0.0 | **Last Updated:** November 2025
