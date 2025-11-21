// --- DOM Elements (Đã cập nhật) ---
const loginView = document.getElementById('login-view'), 
      appView = document.getElementById('app-view'),
      contentArea = document.getElementById('content-area'),
      dashboardView = document.getElementById('dashboard-view'), 
      detailView = document.getElementById('detail-view'),
      productGrid = document.getElementById('product-grid'), 
      loginForm = document.getElementById('login-form'),
      loginError = document.getElementById('login-error'),
      logoutBtn = document.getElementById('logout-btn'), 
      welcomeUser = document.getElementById('welcome-user'),
      backToDashboardBtn = document.getElementById('back-to-dashboard-btn'),
      treeName = document.getElementById('tree-name'),
      addProductModal = document.getElementById('add-product-modal'), 
      addProductBtn = document.getElementById('add-product-btn'),
      addProductForm = document.getElementById('add-product-form'), 
      addProductCancelBtn = document.getElementById('add-product-cancel-btn'),
      loader = document.getElementById('loader'),
      realtimeVideo = document.getElementById('realtime-video'),
      overlayCanvas = document.getElementById('overlay-canvas'),
      streamStatus = document.getElementById('stream-status'),
      viewModeNormalBtn = document.getElementById('view-mode-normal'),
      viewModeAiBtn = document.getElementById('view-mode-ai'),
      videoContainer = document.getElementById('video-container'), 
      detectionContainer = document.getElementById('detection-container');
// === DOM CHO ANALYTICS ===
const analyticsView = document.getElementById('analytics-view'),
      analyticsPlantGridView = document.getElementById('analytics-plant-grid-view'),
      analyticsProductGrid = document.getElementById('analytics-product-grid'),
      analyticsHistoryView = document.getElementById('analytics-history-view'),
      analyticsBackBtn = document.getElementById('analytics-back-btn'),
      analyticsHistoryTitle = document.getElementById('analytics-history-title'),
      historyTimeline = document.getElementById('history-timeline'),
      qrCodeDisplay = document.getElementById('qr-code-display');
// === DOM TỪ V18 ===
const floatingSidebar = document.getElementById('floating-sidebar'),
      sidebarToggleBtn = document.getElementById('sidebar-toggle-btn'),
      mainNav = document.getElementById('main-nav'),
      viewTitle = document.getElementById('view-title'),
      plantTimeEl = document.getElementById('plant-time'),
      plantWeatherEl = document.getElementById('plant-weather'),
      plantTempEl = document.getElementById('plant-temp'),
      plantHumidityEl = document.getElementById('plant-humidity'),
      plantLightEl = document.getElementById('plant-light'),
      plantWaterEl = document.getElementById('plant-water'),
      plantLocationEl = document.getElementById('plant-location'),
      aiResultsContent = document.getElementById('ai-results-content');
// === DOM CHO NÚT HÀNH ĐỘNG & TOAST ===
const waterPlantBtn = document.getElementById('water-plant-btn');
const fertilizePlantBtn = document.getElementById('fertilize-plant-btn');
const harvestPlantBtn = document.getElementById('harvest-plant-btn');
const fillWaterBtn = document.getElementById('fill-water-btn');
const toast = document.getElementById('toast-notification');
let toastTimeout = null;

// --- THÊM MỚI: DOM CHO SOUND DETECT ---
const soundView = document.getElementById('sound-view');
const soundCanvas = document.getElementById('sound-canvas');
const soundLabel = document.getElementById('sound-label');
const alertModal = document.getElementById('alert-modal');
const alertMessage = document.getElementById('alert-message');
const alertCloseBtn = document.getElementById('alert-close-btn');

// THÊM MỚI: Các element cho panel phản hồi âm thanh
const soundResponsePanel = document.getElementById('sound-response-panel');
const soundResponseDefault = document.getElementById('sound-response-default');
const soundResponseContent = document.getElementById('sound-response-content');
const soundResponseStatus = document.getElementById('sound-response-status');
const soundResponseDesc = document.getElementById('sound-response-desc');

// --- THÊM MỚI: DOM CHO AI-TOOL ---
const aiView = document.getElementById('ai-view'); // Thêm dòng này
const aiImageInput = document.getElementById('ai-image-input');
const aiImagePreview = document.getElementById('ai-image-preview');
const aiImagePreviewPlaceholder = document.getElementById('ai-image-preview-placeholder');
const aiResultsPanel = document.getElementById('ai-results-panel');
const aiProcessingOverlay = document.getElementById('ai-processing-overlay');
const aiProcessingTimer = document.getElementById('ai-processing-timer'); // Thêm dòng này
const aiResultsContentReal = document.getElementById('ai-results-content-real');

// --- API Configuration ---
const API_BASE_URL = "http://localhost:8002"; 
// const API_BASE_URL = "https://889736b0567e.ngrok-free.app"; 
const WEBRTC_URL_BASE_WS = `wss://d4be9e62d6b0.ngrok-free.app/stream/ws`; 
const WORKFLOW_WATERING_URL = "https://workflow.emg.edu.vn:5678/webhook/watering-plants";
const WORKFLOW_FILL_WATER_URL = "https://workflow.emg.edu.vn:5678/webhook/fillwater"; 
const ESP32_IP = "http://192.168.4.1";
const SOUND_WS_URL = "ws://192.168.4.1/ws"; 
let soundSocket = null;

// --- State Management ---
let state = {
    isLoggedIn: false,
    currentUser: null,
    token: null,
    products: [],
    selectedProductId: null,
    isAiDetectionActive: false,
    
    // --- THÊM MỚI: State cho Âm thanh ---
    audioContext: null,
    analyserNode: null,
    audioStream: null,
    speechRecognition: null,
    visualizationFrameId: null, // Để dừng/bắt đầu vẽ
    currentSoundLabel: "...", // Label hiện tại của âm thanh
};

let clockInterval = null; 
let dataFetchInterval = null; 

// --- WebRTC Service (Không đổi) ---
const WebRTCService = {
    ws: null,
    pc: null,
    videoElement: null,
    canvasContext: null,
    lastDetections: {},
    WEBSOCKET_URL_BASE: WEBRTC_URL_BASE_WS, 

    connect: function(roomName, videoEl, canvasEl) {
        this.videoElement = videoEl;
        this.canvasContext = canvasEl.getContext('2d');
        const clientId = `viewer_${crypto.randomUUID()}`;
        const fullUrl = `${this.WEBSOCKET_URL_BASE}/${roomName}/${clientId}`;
        streamStatus.textContent = `Connecting to room '${roomName}'...`;
        
        try {
            this.ws = new WebSocket(fullUrl);
        } catch (error) {
            console.error("WebSocket connection error:", error);
            streamStatus.textContent = "Failed to connect. (Check URL or network)";
            return;
        }

        this.ws.onopen = () => {
            streamStatus.textContent = "Connected, requesting video...";
            this.ws.send(JSON.stringify({ type: 'join_as_viewer' }));
        };
        this.ws.onmessage = async (event) => {
            try {
                const message = JSON.parse(event.data);
                if (message.type === 'offer') this.handleOffer(message.sdp);
                else if (message.error) {
                    streamStatus.textContent = `Server Error: ${message.error}`;
                    this.disconnect();
                }
            } catch (e) {
                console.warn("Received non-JSON WebSocket message:", event.data);
            }
        };
        this.ws.onclose = () => { streamStatus.textContent = "Connection lost."; this.cleanup(); };
        this.ws.onerror = (err) => { 
            console.error("WebSocket Error:", err);
            streamStatus.textContent = "Connection error."; 
            this.cleanup(); 
        };
    },

    handleOffer: async function(offerSdp) {
        try {
            if (this.pc) this.pc.close();
            this.pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
            this.pc.ontrack = (event) => {
                if (this.videoElement.srcObject !== event.streams[0]) {
                    this.videoElement.srcObject = event.streams[0];
                    streamStatus.style.display = 'none';
                    console.log("🎥 Nhận được track:", event.track.kind, event.streams);

                }
                console.log("🎥 Nhận được track:", event.track.kind, event.streams);

            };
            this.pc.onicecandidate = (event) => {
                if (event.candidate && this.ws && this.ws.readyState === WebSocket.OPEN) {
                    this.ws.send(JSON.stringify({ type: 'candidate', candidate: event.candidate.toJSON() }));
                }
            };
            // await this.pc.setRemoteDescription(new RTCSessionDescription(offerSdp));
            await this.pc.setRemoteDescription(new RTCSessionDescription({
                type: offerSdp.type,
                sdp: offerSdp.sdp
            }));

            const answer = await this.pc.createAnswer();
            await this.pc.setLocalDescription(answer);
            
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                this.ws.send(JSON.stringify({ type: 'answer', sdp: this.pc.localDescription.toJSON() }));
            }
        } catch (error) {
            console.error("Error handling offer:", error);
            streamStatus.textContent = "Error setting up video stream.";
        }
    },
    
    renderStaticDetections: function(detectionData) {
        if (!this.canvasContext || !detectionData || !detectionData.detections) return;
        const { detections, orig_shape } = detectionData;
        const canvas = this.canvasContext.canvas;
        if (!orig_shape) return;
        const scaleX = canvas.width / orig_shape[1];
        const scaleY = canvas.height / orig_shape[0];
        detections.forEach(det => {
            // (Code vẽ box V13 đã bị comment out, giữ nguyên)
        });
    },
    
    cleanup: function() {
        if (this.pc) { this.pc.close(); this.pc = null; }
        if (this.videoElement) { this.videoElement.srcObject = null; }
        if(this.canvasContext) this.canvasContext.clearRect(0, 0, this.canvasContext.canvas.width, this.canvasContext.canvas.height);
        streamStatus.style.display = 'flex';
        streamStatus.textContent = "Waiting for video stream...";
        this.lastDetections = {};
    },
    
    disconnect: function() {
        if (this.ws) { this.ws.close(); this.ws = null; }
        this.cleanup();
    }
};

const controlSpeaker = async (isOn) => {
    const stateVal = isOn ? 1 : 0;
    try {
        // Gọi API: http://192.168.4.1/api/speaker?state=1
        await fetch(`${ESP32_IP}/api/speaker?state=${stateVal}`, {
            method: 'GET',
            mode: 'no-cors' // Quan trọng: Giúp tránh lỗi CORS khi gọi từ web sang IP local
        });
        console.log(`🔊 Đã gửi lệnh loa: ${isOn ? "BẬT" : "TẮT"}`);
    } catch (error) {
        console.error("Lỗi gọi API loa ESP32:", error);
    }
};

// --- UI Functions (Đã cập nhật) ---
const showLoader = () => loader.classList.remove('view-hidden');
const hideLoader = () => loader.classList.add('view-hidden');
const showAddProductModal = () => { addProductForm.reset(); addProductModal.classList.add('modal-visible'); };
const hideAddProductModal = () => { addProductModal.classList.remove('modal-visible'); };

// THÊM MỚI: Hàm hiển thị/ẩn Alert
const showAlert = (animal) => {
    alertMessage.textContent = `Phát hiện ${animal === 'Giọng chim' ? 'tiếng chim' : 'tiếng chuột'} ở trong vườn của bạn!`;
    alertModal.classList.add('modal-visible');

    showSoundResponse(animal);
};
const hideAlert = () => {
    alertModal.classList.remove('modal-visible');
    // Reset lại label sau khi tắt alert
    // updateSoundLabel(""); 
    controlSpeaker(false);
    resetSoundResponse();
};

// Hàm Toast (Không đổi)
const showToast = (message, type = 'success') => {
    toast.textContent = message;
    toast.className = 'show';
    toast.classList.add(type);
    if (toastTimeout) clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
        toast.className = '';
    }, 3000);
};

// Hàm Navigation (Đã cập nhật)
const handleNavigation = (viewId) => {
    // Ẩn tất cả các view
    contentArea.querySelectorAll('main').forEach(view => view.classList.add('view-hidden'));
    
    // Dừng vẽ sóng âm nếu rời khỏi sound-view
    if (state.visualizationFrameId) {
        cancelAnimationFrame(state.visualizationFrameId);
        state.visualizationFrameId = null;
        resetSoundResponse();
    }

    const activeView = document.getElementById(`${viewId}-view`);
    if (activeView) {
        activeView.classList.remove('view-hidden');
        // Nếu là sound-view, bắt đầu vẽ
        if (viewId === 'sound') {
            startSoundVisualization();
        }
    } else if (viewId === 'login') {
        loginView.classList.remove('view-hidden');
        appView.classList.add('view-hidden');
    } else {
        loginView.classList.add('view-hidden');
        appView.classList.remove('view-hidden');
        if (!activeView) { 
            document.getElementById('dashboard-view').classList.remove('view-hidden');
            viewId = 'dashboard';
        }
    }
    
    mainNav.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
        if (link.dataset.view === viewId) {
            link.classList.add('active');
        }
    });
    
    const activeLink = mainNav.querySelector(`.nav-link[data-view="${viewId}"]`);
    viewTitle.textContent = activeLink ? activeLink.querySelector('span').textContent : "Login";
    
    // Dọn dẹp WebRTC khi rời detail view (Không đổi)
    if (viewId !== 'detail' && (clockInterval || dataFetchInterval)) {
        WebRTCService.disconnect();
        if (clockInterval) clearInterval(clockInterval);
        if (dataFetchInterval) clearInterval(dataFetchInterval);
        clockInterval = null;
        dataFetchInterval = null;
    }
};

// THÊM MỚI: Hàm hiển thị phản hồi của hệ thống
const showSoundResponse = (animal) => {
    soundResponseDefault.classList.add('view-hidden');   // Ẩn text mặc định
    soundResponseContent.classList.remove('view-hidden'); // Hiện nội dung phản hồi

    if (animal === 'Giọng chim') {
        soundResponseStatus.textContent = "ĐANG KÍCH HOẠT ÂM THANH THÚ DỮ";
        soundResponseStatus.className = "text-xl font-bold text-red-500 animate-pulse";
        soundResponseDesc.textContent = "Phát âm thanh động vật săn mồi để xua đuổi chim.";
    } else if (animal === 'Giọng chuột') {
        soundResponseStatus.textContent = "ĐANG PHÁT SÓNG ÂM TẦN SỐ CAO";
        soundResponseStatus.className = "text-xl font-bold text-blue-400 animate-pulse";
        soundResponseDesc.textContent = "Phát sóng siêu âm gây khó chịu để xua đuổi chuột.";
    }
};

// THÊM MỚI: Hàm reset UI phản hồi âm thanh
const resetSoundResponse = () => {
    soundResponseDefault.classList.remove('view-hidden'); // Hiện lại text mặc định
    soundResponseContent.classList.add('view-hidden');  // Ẩn nội dung phản hồi
    soundResponseStatus.textContent = "...";
    soundResponseDesc.textContent = "...";
    // Reset luôn cả sound label
    if(soundLabel) soundLabel.textContent = "..."; 
};

// --- Main Logic (Không đổi, chỉ thêm hàm mới) ---
const renderDashboard = () => { 
    if (state.products.length === 0) {
        productGrid.innerHTML = `<p class="text-gray-400 col-span-full text-center">Không tìm thấy cây nào. Hãy thêm cây mới.</p>`;
        return;
    }
    productGrid.innerHTML = state.products.map(product => `
        <div class="card p-4 flex flex-col justify-between" data-product-id="${product.productID}">
            <div class="cursor-pointer product-card-main-area">
                <div class="flex justify-between items-start">
                    <h3 class="text-lg font-bold text-white">${product.name}</h3>
                    <span class="text-xs font-bold px-2 py-1 rounded ${product.isActive ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}">${product.isActive ? 'ACTIVE' : 'INACTIVE'}</span>
                </div>
                <p class="text-sm mt-2 text-gray-300">${product.description}</p>
            </div>
            <div class="mt-4 pt-4 border-t border-gray-600 flex gap-2">
                <button class="btn ${product.isActive ? 'btn-warning' : 'btn-success'} btn-toggle-active text-sm py-1 px-3 w-full" data-product-id="${product.productID}" data-current-status="${product.isActive}">
                    ${product.isActive ? 'Deactivate' : 'Activate'}
                </button>
            </div>
        </div>`).join('');
};

const authenticatedFetch = async (url, options = {}) => {
    const headers = new Headers(options.headers || {});
    if (state.token) {
        headers.append('Authorization', `Bearer ${state.token}`);
    }
    headers.append('ngrok-skip-browser-warning', 'true');
    const response = await fetch(url, { ...options, headers });
    if (response.status === 401) {
        showToast("Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.", "error");
        handleLogout();
        throw new Error('Unauthorized');
    }
    return response;
};

const fetchTrees = async () => {
    showLoader();
    try {
        const response = await authenticatedFetch(`${API_BASE_URL}/api/trees/`);
        if (!response.ok) throw new Error('Failed to fetch trees');
        const apiData = await response.json();
        state.products = apiData.map(tree => ({
            productID: tree.tree_id,
            name: tree.name,
            description: `Loài: ${tree.species || 'N/A'} | Vị trí: ${tree.location || 'N/A'}`,
            isActive: tree.is_active
        }));
        renderDashboard();
        renderAnalyticsGrid();
    } catch (error) {
        if (error.message !== 'Unauthorized') {
            console.error("Error fetching trees:", error);
            showToast("Không thể tải danh sách cây.", "error");
        }
    } finally {
        hideLoader();
    }
};

const updateTreeStatus = async (treeId, newStatus) => {
    showLoader();
    try {
        const product = state.products.find(p => p.productID == treeId);
        if (!product) throw new Error('Product not found in state');
        const descParts = product.description.split(' | ');
        const species = descParts[0].replace('Loài: ', '');
        const location = descParts[1].replace('Vị trí: ', '');
        const response = await authenticatedFetch(`${API_BASE_URL}/api/trees/${treeId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: product.name,
                species: species,
                location: location,
                planting_date: new Date().toISOString().split('T')[0],
                is_active: newStatus 
            })
        });
        if (!response.ok) throw new Error('Failed to update status');
        const updatedTree = await response.json();
        product.isActive = updatedTree.is_active;
        renderDashboard();
        renderAnalyticsGrid();
        showToast(`Cập nhật trạng thái cây ${product.name} thành công.`, 'success');
    } catch (error) {
        console.error("Error updating tree status:", error);
        showToast("Lỗi khi cập nhật trạng thái cây.", 'error');
    } finally {
        hideLoader();
    }
};

// --- HÀM LOGIN (Đã cập nhật) ---
const handleLogin = async (e) => {
    e.preventDefault();
    showLoader();
    loginError.classList.add('view-hidden');
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const loginData = { username: username, password: password };
    try {
        const response = await fetch(`${API_BASE_URL}/api/auth/token`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'ngrok-skip-browser-warning': 'true'
            },
            body: JSON.stringify(loginData)
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'Login failed');
        }
        const data = await response.json();
        state.isLoggedIn = true;
        state.currentUser = { name: username };
        state.token = data.access_token;
        welcomeUser.textContent = `Welcome, ${state.currentUser.name}`;
        await fetchTrees();
        loginView.classList.add('view-hidden');
        appView.classList.remove('view-hidden');
        handleNavigation('dashboard');

        // --- THÊM MỚI: Tự động khởi động nhận diện âm thanh ---
        try {
            await startSoundDetection();
            showToast("Hệ thống âm thanh đã được kích hoạt.", "success");
        } catch (err) {
            console.error("Mic access failed on login:", err);
            showToast("Không thể tự động kích hoạt micro. Bạn cần cho phép trong cài đặt trình duyệt.", "error");
        }
        // --- KẾT THÚC THÊM MỚI ---

    } catch (error) {
        console.error("Login error:", error);
        loginError.textContent = `Lỗi đăng nhập: ${error.message}`;
        loginError.classList.remove('view-hidden');
    } finally {
        hideLoader();
    }
};

// --- HÀM LOGOUT (Đã cập nhật) ---
const handleLogout = () => {
    // --- THÊM MỚI: Dừng hệ thống âm thanh ---
    stopSoundDetection();
    // --- KẾT THÚC THÊM MỚI ---

    handleNavigation('dashboard'); 
    showAnalyticsGrid(); 
    state.isLoggedIn = false; 
    state.currentUser = null;
    state.token = null;
    state.products = [];
    appView.classList.add('view-hidden'); 
    loginView.classList.remove('view-hidden'); 
    handleNavigation('login');
};

// --- Detail View (Không đổi) ---
const showDetailView = (productId) => {
    const product = state.products.find(p => p.productID == productId);
    if (!product) return;
    
    state.selectedProductId = productId;
    treeName.textContent = `Live Analysis: ${product.name}`;
    
    resetDetectionInfo(); 
    handleNavigation('detail'); 
    
    WebRTCService.connect(productId, realtimeVideo, overlayCanvas);
    
    updateLiveTime(); 
    clockInterval = setInterval(updateLiveTime, 1000); 
    
    fetchTreeDetails(productId);
    fetchLatestReading(productId);
    dataFetchInterval = setInterval(() => {
        fetchLatestReading(productId);
    }, 10000); 
};

const hideFruitDetails = () => { 
    const details = document.getElementById('fruit-details-container');
    if (details) {
        details.classList.remove('visible');
        setTimeout(() => details.remove(), 300);
    }
};

const updateLiveTime = () => {
    if (plantTimeEl) {
        plantTimeEl.textContent = new Date().toLocaleTimeString('vi-VN');
    }
};

const updatePlantInfoUI = (data, location = null) => {
    // Thêm kiểm tra an toàn (?) trước khi gán textContent
    let weatherText = data.weather_info || '--';
    if (weatherText === '--' || weatherText.trim() === '') {
        const hour = new Date().getHours();
        if (hour >= 6 && hour < 12) weatherText = 'Buổi sáng, trời trong';
        else if (hour >= 12 && hour < 18) weatherText = 'Buổi chiều, có nắng';
        else weatherText = 'Buổi tối, trời mát';
    }

    if (plantWeatherEl) plantWeatherEl.textContent = weatherText;
    if (plantTempEl) plantTempEl.textContent = `${data.temperature_c ? data.temperature_c.toFixed(1) : 0} °C`;
    if (plantHumidityEl) plantHumidityEl.textContent = `${data.humidity_pct ? data.humidity_pct.toFixed(0) : 0} %`;
    if (plantLightEl) plantLightEl.textContent = `${data.light_lux ? data.light_lux.toLocaleString('vi-VN') : 0} lux`;
    if (plantWaterEl) plantWaterEl.textContent = `${data.water_level_pct ? data.water_level_pct.toFixed(0) : 0} %`;
    
    if (location && plantLocationEl) {
        plantLocationEl.textContent = location;
    }
};

const fetchLatestReading = async (treeId = null) => {
    const id = treeId || state.selectedProductId;
    if (!id) return;
    try {
        const product = state.products.find(p => p.productID == id);
        const location = product ? product.description.split(' | ')[1].replace('Vị trí: ', '') : '--';
        const response = await authenticatedFetch(`${API_BASE_URL}/api/trees/${id}/readings/?skip=0&limit=1`);
        if (!response.ok) throw new Error('Failed to fetch readings');
        const readings = await response.json();
        
        if (readings && readings.length > 0) {
            updatePlantInfoUI(readings[0], location);
        } else {
            updatePlantInfoUI({
                temperature_c: 0,
                humidity_pct: 0,
                light_lux: 0,
                water_level_pct: 0,
                weather_info: ''
            }, location);
        }
    } catch (error) {
        console.error("Error fetching plant readings:", error);
    }
};

const fetchTreeDetails = (treeId) => {
    // Gộp trong fetchLatestReading
};

// --- Control & Log (Không đổi) ---
const callWorkflowAPI = async (url, treeId) => {
    if (!treeId) {
        showToast("Lỗi: Không xác định được ID cây.", 'error');
        return; 
    }
    try {
        const response = await fetch(url, {
             method: 'POST',
             headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify({ "tree_id": treeId })
        });
        if (!response.ok) {
            let errorDetail = `Workflow API request failed (Status: ${response.status})`;
            try {
                const errorJson = await response.json();
                errorDetail = errorJson.detail || errorDetail;
            } catch (e) {}
            throw new Error(errorDetail);
        }
        const resultText = await response.text();
        showToast(resultText || "Yêu cầu thành công!", 'success');
    } catch (error) {
        console.error("Error calling workflow API:", error);
        showToast(`Lỗi API điều khiển: ${error.message}`, 'error');
    }
};

const logControlAction = async (commandType, commandValue) => {
    if (!state.selectedProductId) return;
    try {
        const response = await authenticatedFetch(`${API_BASE_URL}/api/trees/${state.selectedProductId}/control_history/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                command_type: commandType,
                command_value: commandValue,
                status: "Hoàn thành"
            })
        });
        if (!response.ok) throw new Error('Failed to log action');
        await response.json();
        showToast(`Đã ghi nhận: ${commandType}`, 'success');
    } catch (error) {
        console.error("Error logging control action:", error);
        showToast(`Lỗi khi ghi nhận ${commandType}`, 'error');
    }
};

// bắt đầu --- Analytics View (Không đổi) ---
const showAnalyticsGrid = () => {
    analyticsHistoryView.classList.add('view-hidden');
    analyticsPlantGridView.classList.remove('view-hidden');
    renderAnalyticsGrid(); 
};

const renderAnalyticsGrid = () => {
    if (state.products.length === 0) {
        analyticsProductGrid.innerHTML = `<p class="text-gray-400 col-span-full text-center">Không tìm thấy cây nào.</p>`;
        return;
    }
    analyticsProductGrid.innerHTML = state.products.map(product => `
        <div class="card p-4 flex flex-col justify-between" data-product-id="${product.productID}">
            <div class="cursor-pointer product-card-main-area-analytics">
                <div class="flex justify-between items-start">
                    <h3 class="text-lg font-bold text-white">${product.name}</h3>
                    <span class="text-xs font-bold px-2 py-1 rounded ${product.isActive ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}">${product.isActive ? 'ACTIVE' : 'INACTIVE'}</span>
                </div>
                <p class="text-sm mt-2 text-gray-300">${product.description}</p>
            </div>
            <div class="mt-4 pt-4 border-t border-gray-600 flex gap-2">
                <button class="btn ${product.isActive ? 'btn-warning' : 'btn-success'} btn-toggle-active text-sm py-1 px-3 w-full" data-product-id="${product.productID}" data-current-status="${product.isActive}">
                    ${product.isActive ? 'Deactivate' : 'Activate'}
                </button>
            </div>
        </div>`).join('');
};
// chạy ok nhưng sửa để có mã QR
// const showAnalyticsHistory = async (productId) => {
//     const product = state.products.find(p => p.productID == productId);
//     if (!product) return;
//     analyticsPlantGridView.classList.add('view-hidden');
//     analyticsHistoryView.classList.remove('view-hidden');
//     analyticsHistoryTitle.textContent = `Lịch sử chăm sóc: ${product.name}`;
//     historyTimeline.innerHTML = '';
//     showLoader();
//     try {
//         const response = await authenticatedFetch(`${API_BASE_URL}/api/trees/${productId}/control_history/`);
//         if (!response.ok) throw new Error('Failed to fetch history');
//         const historyData = await response.json();
//         renderHistoryTimeline(historyData);
//     } catch (error) {
//         console.error("Error fetching history:", error);
//         showToast("Không thể tải lịch sử.", "error");
//         historyTimeline.innerHTML = `<p class="text-gray-400">Lỗi khi tải dữ liệu lịch sử.</p>`;
//     } finally {
//         hideLoader();
//     }
// };

    const showAnalyticsHistory = async (productId) => {
        const product = state.products.find(p => p.productID == productId);
        if (!product) return;

        analyticsPlantGridView.classList.add('view-hidden');
        analyticsHistoryView.classList.remove('view-hidden');
        analyticsHistoryTitle.textContent = `Lịch sử chăm sóc: ${product.name}`;
        historyTimeline.innerHTML = ''; // Xóa timeline cũ
        qrCodeDisplay.innerHTML = ''; // Xóa mã QR cũ

        showLoader();

        try {
            const response = await authenticatedFetch(`${API_BASE_URL}/api/trees/${productId}/control_history/`);
            if (!response.ok) throw new Error('Failed to fetch history');
            const historyData = await response.json();

            // 1. Render timeline (như cũ)
            renderHistoryTimeline(historyData);

            // 2. TẠO MÃ QR (MỚI)
            // -----------------------------------------------------------------
            // !! QUAN TRỌNG: Bạn phải thay đổi URL này
            // Đây là URL công khai mà người dùng sẽ thấy khi quét mã.
            // Bạn cần tự xây dựng trang này (ví dụ: /public/history.html?id=... )
            // -----------------------------------------------------------------
            const publicHistoryUrl = `https://trang-web-cua-ban.com/history/${product.productID}`;

            try {
                new QRCode(qrCodeDisplay, {
                    text: publicHistoryUrl,
                    width: 200, // Kích thước QR (pixels)
                    height: 200,
                    colorDark : "#000000",
                    colorLight : "#ffffff",
                    correctLevel : QRCode.CorrectLevel.H // Mức độ sửa lỗi cao
                });
            } catch (qrError) {
                console.error("Lỗi tạo QR code:", qrError);
                qrCodeDisplay.innerHTML = "<p class='text-red-500 text-xs'>Lỗi tạo QR code.</p>";
            }

        } catch (error) {
            console.error("Error fetching history:", error);
            showToast("Không thể tải lịch sử.", "error");
            historyTimeline.innerHTML = `<p class="text-gray-400">Lỗi khi tải dữ liệu lịch sử.</p>`;
            qrCodeDisplay.innerHTML = "<p class='text-gray-400 text-xs text-center'>Không thể tạo QR.</p>";
        } finally {
            hideLoader();
        }
    };

const renderHistoryTimeline = (historyData) => {
    if (!historyData || historyData.length === 0) {
        historyTimeline.innerHTML = `<p class="text-gray-400">Không có dữ liệu lịch sử cho cây này.</p>`;
        return;
    }
    historyTimeline.innerHTML = historyData.map(item => {
        const commandTime = new Date(item.command_time).toLocaleString('vi-VN', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
        const valueText = item.command_value ? `<p class="text-sm text-gray-400">Giá trị: <span class="text-white">${item.command_value}</span></p>` : '';
        const statusText = item.status ? `<p class="text-sm text-gray-400">Trạng thái: <span class="text-white">${item.status}</span></p>` : '';
        return `
            <li class="timeline-item">
                <div class="timeline-dot"></div>
                <div class="timeline-card">
                    <p class="text-xs text-gray-400 mb-1">${commandTime} (User ID: ${item.user_id})</p>
                    <h4 class="text-lg font-semibold text-primary-accent mb-1">${item.command_type}</h4>
                    ${valueText}
                    ${statusText}
                </div>
            </li>
        `;
    }).join('');
};
/// kết thúc --- Analytics View ---

// --- AI/Detection Info (Không đổi) ---
// const updateDetectionInfo = (detections) => {
//     if (!detections || detections.length === 0) {
//         aiResultsContent.innerHTML = '<p>Không phát hiện đối tượng nào.</p>';
//         return;
//     }
//     const counts = detections.reduce((acc, d) => {
//         acc[d.label] = (acc[d.label] || 0) + 1;
//         return acc;
//     }, {});
//     const summaryHtml = Object.entries(counts)
//         .map(([label, count]) => `<p>Phát hiện: <span class="font-semibold text-white">${count} Cà chua Bi</span></p>`)
//         .join('');
//     aiResultsContent.innerHTML = summaryHtml;
// };
// --- Thay thế hàm updateDetectionInfo cũ ---
const updateDetectionInfo = (detections, analysisData = null) => {
    let htmlContent = '';

    // 1. Xử lý hiển thị số lượng (Nếu có detections)
    if (detections && detections.length > 0) {
        const counts = detections.reduce((acc, d) => {
            acc[d.label] = (acc[d.label] || 0) + 1;
            return acc;
        }, {});
        
        htmlContent += Object.entries(counts)
            .map(([label, count]) => `<p>Phát hiện: <span class="font-semibold text-white">${count} ${label}</span></p>`)
            .join('');
    } else {
        // Nếu không có box nhưng có data phân tích bệnh -> Vẫn hiện text
        if (!analysisData) {
            aiResultsContent.innerHTML = '<p>Không phát hiện đối tượng nào.</p>';
            return;
        }
        // Optional: Thông báo là không vẽ được khung nhưng có kết quả
        // htmlContent += '<p class="text-xs text-gray-500 mb-2">*(Không xác định được vị trí cụ thể)*</p>';
    }

    // 2. Xử lý hiển thị thông tin bệnh & đề xuất (LUÔN CHẠY nếu có analysisData)
    if (analysisData) {
        htmlContent += `<div class="mt-3 pt-3 border-t border-gray-700 space-y-3">`;

        // Hiển thị Loại / Trạng thái (Lấy từ type/status trong data nếu có)
        if (analysisData.type) {
             htmlContent += `
                <div>
                    <span class="text-gray-400 text-xs uppercase tracking-wider">Loại:</span>
                    <span class="text-white font-bold ml-2">${analysisData.type}</span>
                </div>`;
        }

        // Hiển thị Bệnh trên quả
        if (analysisData.benhTrenQua) {
            htmlContent += `
                <div>
                    <span class="text-gray-400 text-xs uppercase tracking-wider">Bệnh trên quả:</span>
                    <div class="text-white font-medium text-sm mt-1">${analysisData.benhTrenQua}</div>
                </div>`;
        }

        // Hiển thị Bệnh trên lá
        if (analysisData.benhTrenLa) {
            htmlContent += `
                <div>
                    <span class="text-gray-400 text-xs uppercase tracking-wider">Bệnh trên lá:</span>
                    <div class="text-white font-medium text-sm mt-1">${analysisData.benhTrenLa}</div>
                </div>`;
        }

        // Hiển thị Đề xuất xử lý
        if (analysisData.deXuatXuLy) {
            htmlContent += `
                <div class="bg-gray-800/50 p-2 rounded border border-gray-600">
                    <span class="text-gray-400 text-xs uppercase tracking-wider">Đề xuất xử lý:</span>
                    <div class="text-amber-400 font-medium text-sm mt-1">${analysisData.deXuatXuLy}</div>
                </div>`;
        }

        htmlContent += `</div>`;
    }

    aiResultsContent.innerHTML = htmlContent;
};

const resetDetectionInfo = () => {
    if (aiResultsContent) {
        aiResultsContent.innerHTML = '<p>Chưa có dữ liệu.</p>';
    }
};

// --- THÊM MỚI: CÁC HÀM XỬ LÝ ÂM THANH ---

/**
 * Bắt đầu nhận diện âm thanh và giọng nói (chạy ngầm)
 */
const startSoundDetection = async () => {
    // 1. Kiểm tra hỗ trợ
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const AudioContext = window.AudioContext || window.webkitAudioContext;

    if (!SpeechRecognition || !AudioContext) {
        showToast("Trình duyệt không hỗ trợ API âm thanh hoặc giọng nói.", "error");
        return Promise.reject("Unsupported browser");
    }

    // 2. Lấy quyền truy cập Micro
    // (Phải được gọi từ một sự kiện do người dùng khởi xướng như 'click')
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    state.audioStream = stream;

    // 3. Thiết lập Web Audio API (để vẽ sóng)
    state.audioContext = new AudioContext();
    const source = state.audioContext.createMediaStreamSource(stream);
    state.analyserNode = state.audioContext.createAnalyser();
    state.analyserNode.fftSize = 2048; // Kích thước mẫu
    source.connect(state.analyserNode);

    // 4. Thiết lập Web Speech API (để nhận diện giọng nói)
    state.speechRecognition = new SpeechRecognition();
    state.speechRecognition.lang = 'vi-VN';
    state.speechRecognition.continuous = true; // Chạy liên tục
    state.speechRecognition.interimResults = true; // Trả kết quả tạm thời

    // 4.1. Xử lý khi có kết quả
    state.speechRecognition.onresult = (event) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
                finalTranscript += event.results[i][0].transcript;
            } else {
                interimTranscript += event.results[i][0].transcript;
            }
        }
        
        // Ưu tiên chuỗi cuối cùng (final) nếu có
        const detectedText = finalTranscript || interimTranscript;
        updateSoundLabel(detectedText);
    };

    // 4.2. Tự động khởi động lại khi kết thúc
    state.speechRecognition.onend = () => {
        if (state.isLoggedIn) { // Chỉ khởi động lại nếu vẫn đang đăng nhập
            state.speechRecognition.start();
        }
    };
    
    // 4.3. Xử lý lỗi
    state.speechRecognition.onerror = (event) => {
        console.error("Speech recognition error:", event.error);
        if (event.error === 'no-speech') {
            // Bỏ qua lỗi không có giọng nói, nó sẽ tự khởi động lại
        }
    };

    // 5. Bắt đầu nhận diện
    state.speechRecognition.start();
    
    // 6. Cập nhật label mặc định ban đầu
    if (soundLabel) {
        soundLabel.textContent = "Đang lắng nghe...";
        soundLabel.classList.remove('detected');
    }
};

/**
 * Dừng hệ thống âm thanh khi logout
 */
const stopSoundDetection = () => {
    if (state.speechRecognition) {
        state.speechRecognition.stop();
        state.speechRecognition = null;
    }
    if (state.audioStream) {
        state.audioStream.getTracks().forEach(track => track.stop());
        state.audioStream = null;
    }
    if (state.audioContext) {
        state.audioContext.close();
        state.audioContext = null;
    }
    if (state.visualizationFrameId) {
        cancelAnimationFrame(state.visualizationFrameId);
        state.visualizationFrameId = null;
    }
};

/**
 * Cập nhật Label âm thanh và kiểm tra trigger
 */
const updateSoundLabel = (transcript) => {
    let label = "People talking"; // Mặc định
    let isDetected = false;
    
    // Kiểm tra trigger "chíp"
    if (transcript.toLowerCase().includes("chip")) {
        // Random giữa chim và chuột
        const randomAnimal = Math.random() < 0.5 ? "Giọng chim" : "Giọng chuột";
        label = randomAnimal;
        isDetected = true;
    }

    state.currentSoundLabel = label;

    if (soundLabel) {
        soundLabel.textContent = label;
        if (isDetected) {
            soundLabel.classList.add('detected');
            // Chỉ hiển thị alert nếu modal đang không bật
            controlSpeaker(true);
            if (!alertModal.classList.contains('modal-visible')) {
                showAlert(label);
            }
        } else {
            soundLabel.classList.remove('detected');
        }
    }
    console.log("Updated sound label:", label);
};

/**
 * Bắt đầu vẽ sóng âm (chỉ khi ở tab Sound Detect)
 */
const startSoundVisualization = () => {
    if (!state.analyserNode || !soundCanvas) return;
    if (state.visualizationFrameId) return; // Đã đang vẽ rồi

    const canvasCtx = soundCanvas.getContext('2d');
    const bufferLength = state.analyserNode.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
        state.visualizationFrameId = requestAnimationFrame(draw);

        state.analyserNode.getByteTimeDomainData(dataArray); // Lấy data sóng âm

        // Lấy kích thước thật của canvas
        const width = soundCanvas.clientWidth;
        const height = soundCanvas.clientHeight;
        soundCanvas.width = width;
        soundCanvas.height = height;

        // Xóa canvas
        canvasCtx.fillStyle = '#1f2937'; // Màu nền (card-color)
        canvasCtx.fillRect(0, 0, width, height);

        // Bắt đầu vẽ
        canvasCtx.lineWidth = 2;
        canvasCtx.strokeStyle = '#22c55e'; // Màu sóng (primary-accent)
        canvasCtx.beginPath();

        const sliceWidth = width * 1.0 / bufferLength;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
            const v = dataArray[i] / 128.0; // Giá trị từ 0.0 -> 2.0
            const y = v * height / 2;

            if (i === 0) {
                canvasCtx.moveTo(x, y);
            } else {
                canvasCtx.lineTo(x, y);
            }

            x += sliceWidth;
        }

        canvasCtx.lineTo(width, height / 2);
        canvasCtx.stroke();
    };

    draw();
};

const initSoundSocket = () => {
    try {
        console.log("🔌 Đang thử kết nối Sound Socket...");
        soundSocket = new WebSocket(SOUND_WS_URL);

        soundSocket.onopen = () => {
            console.log("✅ Sound Socket: Đã kết nối thành công!");
        };

        soundSocket.onmessage = (event) => {
            try {
                // Giả sử Server gửi về: {"label": "rat"} hoặc {"label": "bird"}
                // Hoặc gửi string thô: "rat", "bird"
                console.log("📩 Nhận tin hiệu âm thanh:", event.data);
                
                let detectedLabel = "";
                const dataStr = event.data.toString().toLowerCase();

                // Logic phân tích tin nhắn (tuỳ chỉnh theo code ESP32 gửi gì)
                if (dataStr.includes("rat") || dataStr.includes("chuot")) {
                    detectedLabel = "Giọng chuột";
                } else if (dataStr.includes("bird") || dataStr.includes("chim")) {
                    detectedLabel = "Giọng chim";
                }

                // Nếu phát hiện đúng từ khoá -> Kích hoạt quy trình Báo động cũ
                if (detectedLabel) {
                    // Gọi lại hàm updateSoundLabel (đã có logic gọi loa và hiện alert)
                    // Hàm này chúng ta đã sửa ở bước trước để gọi api loa rồi
                    updateSoundLabel(detectedLabel);
                }

            } catch (parseError) {
                console.warn("⚠ Lỗi xử lý dữ liệu socket:", parseError);
            }
        };

        soundSocket.onerror = (error) => {
            // Chỉ log lỗi, không làm chết app
            console.warn("⚠ Lỗi Sound Socket (Không ảnh hưởng tính năng khác):", error);
        };

        soundSocket.onclose = () => {
            console.log("🔌 Sound Socket đã đóng. Thử lại sau 5s...");
            soundSocket = null;
            // Tự động kết nối lại sau 5 giây
            setTimeout(initSoundSocket, 5000);
        };

    } catch (e) {
        console.error("❌ Không thể khởi tạo Socket:", e);
        // Thử lại sau 5 giây nếu khởi tạo thất bại
        setTimeout(initSoundSocket, 5000);
    }
};

// --- Event Listeners (Đã cập nhật) ---
document.addEventListener('DOMContentLoaded', () => {
    // Listeners (Không đổi)
    initSoundSocket();
    loginForm.addEventListener('submit', handleLogin);
    logoutBtn.addEventListener('click', handleLogout);
    
    sidebarToggleBtn.addEventListener('click', () => {
        floatingSidebar.classList.toggle('is-hidden');
    });

    mainNav.addEventListener('click', (e) => {
        const link = e.target.closest('.nav-link');
        if (link && link.dataset.view) {
            e.preventDefault();
            if (link.dataset.view === 'analytics') {
                showAnalyticsGrid();
            }
            handleNavigation(link.dataset.view);
            floatingSidebar.classList.add('is-hidden');
        }
    });
    
    document.addEventListener('click', (event) => {
        const isSidebarVisible = !floatingSidebar.classList.contains('is-hidden');
        const isClickOnToggle = event.target.closest('#sidebar-toggle-btn');
        const isClickInSidebar = event.target.closest('#floating-sidebar');
        if (isSidebarVisible && !isClickOnToggle && !isClickInSidebar) {
            floatingSidebar.classList.add('is-hidden');
        }
    });
    
    backToDashboardBtn.addEventListener('click', () => {
        WebRTCService.disconnect();
        if (clockInterval) clearInterval(clockInterval);
        if (dataFetchInterval) clearInterval(dataFetchInterval);
        clockInterval = null;
        dataFetchInterval = null;
        showAnalyticsGrid(); 
        handleNavigation('dashboard');
    });

    addProductBtn.addEventListener('click', showAddProductModal);
    addProductCancelBtn.addEventListener('click', hideAddProductModal);
    
    addProductForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        showLoader();
        const name = document.getElementById('productName').value;
        const species = document.getElementById('productSpecies').value;
        const location = document.getElementById('productLocation').value;
        const planting_date = new Date().toISOString().split('T')[0];
        try {
            const response = await authenticatedFetch(`${API_BASE_URL}/api/trees/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, species, location, planting_date })
            });
            if (!response.ok) throw new Error('Failed to create plant');
            showToast("Thêm cây mới thành công!", 'success');
            hideAddProductModal();
            await fetchTrees();
        } catch (error) {
            console.error("Error adding product:", error);
            showToast("Lỗi khi thêm cây.", 'error');
        } finally {
            hideLoader();
        }
    });

    productGrid.addEventListener('click', (e) => {
        const toggleBtn = e.target.closest('.btn-toggle-active');
        if (toggleBtn) {
            e.stopPropagation();
            const productId = toggleBtn.dataset.productId;
            const currentStatus = toggleBtn.dataset.currentStatus === 'true';
            updateTreeStatus(productId, !currentStatus);
            return;
        }
        const card = e.target.closest('.product-card-main-area');
        if (card) {
            const productId = card.closest('[data-product-id]').dataset.productId;
            showDetailView(productId);
        }
    });
    
    detectionContainer.addEventListener('click', hideFruitDetails);

    const callFruitDetailAPI = async (det, base64Image) => {
        // Cấu trúc dữ liệu mặc định nếu API lỗi hoặc chưa có backend
        const defaultData = {
            type: det.label || 'Unknown',
            quality: 'Analyzing...', // Hoặc 'Unknown'
            harvest_days: 0,
            sunlight: 0,
            confidence: 0
        };

        try {
            // Payload gửi đi: Ảnh Base64 + Tọa độ Box
            const payload = {
                image: base64Image, // Chuỗi base64 dài
                box: det.box,       // [x1, y1, x2, y2]
                label: det.label,
                confidence: det.confidence
            };

            // !! QUAN TRỌNG: Thay URL này bằng API Backend thực tế của bạn
            // Ví dụ: http://localhost:8000/api/analyze-fruit
            const API_URL = `https://workflow.emg.edu.vn:5678/webhook/api/analyze_detail_fruit`; 

            const response = await fetch(API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    // Thêm Authorization nếu backend yêu cầu
                    // 'Authorization': `Bearer ${state.token}` 
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) throw new Error('API request failed');

            const result = await response.json();
            
            // Giả sử Backend trả về format: { data: { type: "...", quality: "..." } }
            // Merge với default để đảm bảo không thiếu trường
            return { ...defaultData, ...result.data };

        } catch (error) {
            console.error("Lỗi gọi API chi tiết:", error);
            // Trả về data mặc định để UI vẫn hiện (dù là số 0)
            return defaultData; 
        }
    };

    // const renderDetections = (detections) => {
    //     detectionContainer.innerHTML = '';
    //     const staticImage = overlayCanvas; 
    //     const { clientWidth, clientHeight } = videoContainer;
    //     const naturalWidth = realtimeVideo.videoWidth;
    //     const naturalHeight = realtimeVideo.videoHeight;
    //     if (!naturalWidth || !naturalHeight) return;

    //     const imageAspect = naturalWidth / naturalHeight;
    //     const containerAspect = clientWidth / clientHeight;
    //     let scale, offsetX = 0, offsetY = 0;

    //     if (imageAspect > containerAspect) {
    //         scale = clientWidth / naturalWidth;
    //         offsetY = (clientHeight - naturalHeight * scale) / 2;
    //     } else {
    //         scale = clientHeight / naturalHeight;
    //         offsetX = (clientWidth - naturalWidth * scale) / 2;
    //     }

    //     const allowedFruits = ['apple', 'orange', 'fruit', 'tomato', 'grape']; 
    //     const fruitDetections = detections.filter(d => allowedFruits.includes(d.label));

    //     fruitDetections.forEach((det) => {
    //         const [x1, y1, x2, y2] = det.box;
    //         const centerX = ((x1 + x2) / 2) * scale + offsetX;
    //         const centerY = ((y1 + y2) / 2) * scale + offsetY;

    //         const marker = document.createElement('div');
    //         marker.className = 'detection-marker';
    //         marker.style.left = `${centerX}px`;
    //         marker.style.top = `${centerY}px`;

    //         marker.addEventListener('click', (e) => {
    //             e.stopPropagation();
    //             hideFruitDetails();

    //             const sunExposure = Math.round(85 - (centerY / clientHeight) * 20);
    //             const qualityValue = (det.box[0] + det.box[1]) % 2 === 0 ? 'Good' : 'Avg';
    //             const harvestValue = `${Math.round((det.box[2] % 10) + 5)} days`;

    //             // ✅ Luôn hiển thị tên là “Cà chua bi”
    //             const fruitName = 'Cà chua bi';

    //             const details = [
    //                 { label: 'Type', value: fruitName },
    //                 { label: 'Quality', value: qualityValue },
    //                 { label: 'Harvest in', value: harvestValue },
    //                 { label: 'Sunlight', value: `${sunExposure}%` },
    //                 { label: 'Confidence', value: `${(det.confidence * 100).toFixed(0)}%` }
    //             ];

    //             const detailsContainer = document.createElement('div');
    //             detailsContainer.id = 'fruit-details-container';
    //             detailsContainer.style.left = `${centerX}px`;
    //             detailsContainer.style.top = `${centerY}px`;

    //             const isNearHorizontalEdge = centerX < 160 || centerX > clientWidth - 160;
    //             const isNearVerticalEdge = centerY < 160 || centerY > clientHeight - 160;
    //             const baseAngle = isNearHorizontalEdge
    //                 ? (centerX < 160 ? -90 : 90)
    //                 : (isNearVerticalEdge ? (centerY < 160 ? 0 : 180) : 0);
    //             const angleSpan = (isNearHorizontalEdge || isNearVerticalEdge) ? 180 : 360;
    //             const angleIncrement = angleSpan / details.length;

    //             details.forEach((item, i) => {
    //                 const angle = (baseAngle + i * angleIncrement) * (Math.PI / 180);
    //                 const ringX = 160 + Math.cos(angle) * 120;
    //                 const ringY = 160 + Math.sin(angle) * 120;
    //                 detailsContainer.innerHTML += `
    //                     <div class="info-ring" style="left: ${ringX - 40}px; top: ${ringY - 40}px;">
    //                         <svg class="info-ring-svg" width="80" height="80" viewBox="0 0 90 90" style="animation-delay: ${i * 0.1}s">
    //                             <circle cx="45" cy="45" r="35"/>
    //                         </svg>
    //                         <span class="info-value">${item.value}</span>
    //                         <span class="info-label">${item.label}</span>
    //                     </div>
    //                     <svg class="absolute inset-0 w-full h-full">
    //                         <line class="connector-line" x1="160" y1="160" x2="${ringX}" y2="${ringY}" />
    //                     </svg>
    //                 `;
    //             });

    //             detectionContainer.appendChild(detailsContainer);
    //             setTimeout(() => detailsContainer.classList.add('visible'), 50);
    //         });

    //         detectionContainer.appendChild(marker);
    //     });
    // };
const renderDetections = (detections) => {
    detectionContainer.innerHTML = '';
    
    const { clientWidth, clientHeight } = videoContainer;
    const naturalWidth = realtimeVideo.videoWidth;
    const naturalHeight = realtimeVideo.videoHeight;
    if (!naturalWidth || !naturalHeight) return;

    // Tính toán tỷ lệ scale
    const imageAspect = naturalWidth / naturalHeight;
    const containerAspect = clientWidth / clientHeight;
    let scale, offsetX = 0, offsetY = 0;

    if (imageAspect > containerAspect) {
        scale = clientWidth / naturalWidth;
        offsetY = (clientHeight - naturalHeight * scale) / 2;
    } else {
        scale = clientHeight / naturalHeight;
        offsetX = (clientWidth - naturalWidth * scale) / 2;
    }

    const allowedFruits = ['apple', 'orange', 'fruit', 'tomato', 'grape']; 
    const fruitDetections = detections.filter(d => allowedFruits.includes(d.label));

    fruitDetections.forEach((det) => {
        const [x1, y1, x2, y2] = det.box;
        const centerX = ((x1 + x2) / 2) * scale + offsetX;
        const centerY = ((y1 + y2) / 2) * scale + offsetY;

        const marker = document.createElement('div');
        marker.className = 'detection-marker';
        marker.style.left = `${centerX}px`;
        marker.style.top = `${centerY}px`;

        // --- SỰ KIỆN CLICK ---
        marker.addEventListener('click', async (e) => {
            e.stopPropagation();
            hideFruitDetails();

            // 1. Tạo container hiển thị
            const detailsContainer = document.createElement('div');
            detailsContainer.id = 'fruit-details-container';
            detailsContainer.style.left = `${centerX}px`;
            detailsContainer.style.top = `${centerY}px`;
            
            // 2. Hiển thị Loading
            detailsContainer.innerHTML = `
                <div class="info-ring" style="width:120px; top:-60px; left:-60px; justify-content:center;">
                    <span class="info-label" style="position:static; margin-top:0;">Analyzing...</span>
                </div>`;
            detectionContainer.appendChild(detailsContainer);
            setTimeout(() => detailsContainer.classList.add('visible'), 10);

            // 3. Lấy ảnh & Gọi API
            const base64Image = overlayCanvas.toDataURL('image/png');
            const data = await callFruitDetailAPI(det, base64Image);

            // 4. Map dữ liệu cho các Vòng Tròn
            const displayDetails = [
                { label: 'Type', value: data.type ? (data.type.charAt(0).toUpperCase() + data.type.slice(1)) : 'Unknown' },
                { label: 'Quality', value: data.quality || 'Unknown' },
                { label: 'Harvest', value: data.harvest_days > 0 ? `${data.harvest_days} days` : 'Check' },
                { label: 'Sun', value: data.sunlight > 0 ? `${data.sunlight}%` : '--' },
                // Bỏ bớt confidence để đỡ rối nếu muốn
            ];

            // 5. Xóa loading & Render các vòng tròn
            detailsContainer.innerHTML = ''; 
            
            const isNearHorizontalEdge = centerX < 160 || centerX > clientWidth - 160;
            const isNearVerticalEdge = centerY < 160 || centerY > clientHeight - 160;
            const baseAngle = isNearHorizontalEdge ? (centerX < 160 ? -90 : 90) : (isNearVerticalEdge ? (centerY < 160 ? 0 : 180) : 0);
            const angleSpan = (isNearHorizontalEdge || isNearVerticalEdge) ? 180 : 360;
            const angleIncrement = angleSpan / displayDetails.length;

            displayDetails.forEach((item, i) => {
                const angle = (baseAngle + i * angleIncrement) * (Math.PI / 180);
                const ringX = 160 + Math.cos(angle) * 120;
                const ringY = 160 + Math.sin(angle) * 120;
                detailsContainer.innerHTML += `
                    <div class="info-ring" style="left: ${ringX - 40}px; top: ${ringY - 40}px;">
                        <svg class="info-ring-svg" width="80" height="80" viewBox="0 0 90 90" style="animation-delay: ${i * 0.1}s"><circle cx="45" cy="45" r="35"/></svg>
                        <span class="info-value">${item.value}</span><span class="info-label">${item.label}</span>
                    </div>
                    <svg class="absolute inset-0 w-full h-full"><line class="connector-line" x1="160" y1="160" x2="${ringX}" y2="${ringY}" /></svg>
                `;
            });

            // 6. [MỚI] RENDER HỘP THÔNG TIN BỆNH (Đã chỉnh vị trí thông minh)
            const hasDisease = (data.benhTrenQua && data.benhTrenQua !== 'Không') || 
                               (data.benhTrenLa && data.benhTrenLa !== 'Không');
            const hasAdvice = data.deXuatXuLy && data.deXuatXuLy !== 'Không cần xử lý';

            // Tính toán vị trí hiển thị dựa trên vị trí quả trên màn hình
            // Nếu quả ở nửa dưới màn hình (> 60% chiều cao) -> Hiển thị hộp thông tin ở TRÊN
            // Ngược lại -> Hiển thị ở DƯỚI
            const isLowerHalf = centerY > (clientHeight * 0.6);
            
            // Tọa độ Top: 
            // - Nếu hiển thị ở dưới: 160 (tâm) + 120 (bán kính ring) + 40 (khoảng hở) = 320px
            // - Nếu hiển thị ở trên: 160 (tâm) - 120 (bán kính ring) - chiều cao box (~150px) = -110px
            const boxTopPosition = isLowerHalf ? '-160px' : '340px';

            if (hasDisease || hasAdvice) {
                const healthBox = document.createElement('div');
                healthBox.style.cssText = `
                    position: absolute;
                    top: ${boxTopPosition}; 
                    left: 160px; /* Canh giữa theo hệ tọa độ của container (tâm là 160,160) */
                    transform: translateX(-50%);
                    background: rgba(17, 24, 39, 0.95);
                    border: 1px solid ${hasDisease ? '#ef4444' : '#22c55e'};
                    border-radius: 8px;
                    padding: 12px;
                    width: 300px;
                    color: white;
                    font-size: 13px;
                    z-index: 100;
                    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.5);
                    pointer-events: auto;
                    transition: all 0.3s ease;
                `;

                let healthContent = `<h4 style="font-weight:bold; margin-bottom:8px; color:${hasDisease ? '#fca5a5' : '#86efac'}; text-transform:uppercase; border-bottom:1px solid #374151; padding-bottom:4px;">Kết quả phân tích sức khỏe</h4>`;

                if (data.benhTrenQua && data.benhTrenQua !== 'Không') {
                    healthContent += `<p style="margin-bottom:4px;"><span style="color:#9ca3af;">Quả:</span> <span style="color:#fff; font-weight:500">${data.benhTrenQua}</span></p>`;
                }
                if (data.benhTrenLa && data.benhTrenLa !== 'Không') {
                    healthContent += `<p style="margin-bottom:4px;"><span style="color:#9ca3af;">Lá:</span> <span style="color:#fff; font-weight:500">${data.benhTrenLa}</span></p>`;
                }
                if (data.deXuatXuLy) {
                    healthContent += `<div style="margin-top:8px; padding-top:8px; border-top:1px dashed #374151;">
                        <span style="color:#fbbf24; font-weight:bold;">Đề xuất:</span>
                        <p style="margin-top:2px; line-height:1.4;">${data.deXuatXuLy.replace(/;/g, '.<br>')}</p>
                    </div>`;
                }

                healthBox.innerHTML = healthContent;
                detailsContainer.appendChild(healthBox);
            } else {
                 // Hộp thông báo "Khỏe mạnh" cũng cần chỉnh vị trí
                 const healthyBox = document.createElement('div');
                 healthyBox.style.cssText = `
                    position: absolute;
                    top: ${boxTopPosition};
                    left: 160px;
                    transform: translateX(-50%);
                    background: rgba(6, 78, 59, 0.9);
                    border: 1px solid #34d399;
                    border-radius: 20px;
                    padding: 6px 16px;
                    color: #d1fae5;
                    font-size: 12px;
                    white-space: nowrap;
                    z-index: 100;
                 `;
                 healthyBox.innerHTML = `✨ Cây phát triển khỏe mạnh`;
                 detailsContainer.appendChild(healthyBox);
            }
        });
        
        detectionContainer.appendChild(marker);
    });
};


    viewModeNormalBtn.addEventListener('click', () => {
        state.isAiDetectionActive = false;
        detectionContainer.innerHTML = '';
        hideFruitDetails();
        resetDetectionInfo();
        WebRTCService.canvasContext.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
        overlayCanvas.style.opacity = 0;
        realtimeVideo.style.opacity = 1;
        viewModeNormalBtn.classList.replace('btn-secondary', 'btn-primary');
        viewModeAiBtn.classList.replace('btn-primary', 'btn-secondary');
    });

    // viewModeAiBtn.addEventListener('click', async () => {
    //     if (state.isAiDetectionActive) return;
    //     showLoader();

    //     const video = realtimeVideo;
    //     const canvas = overlayCanvas;
    //     const ctx = canvas.getContext('2d');
    //     const videoWidth = video.videoWidth;
    //     const videoHeight = video.videoHeight;

    //     if (videoWidth === 0 || videoHeight === 0) {
    //         showToast("Không thể chụp ảnh, video chưa sẵn sàng.", "error");
    //         hideLoader();
    //         return;
    //     }

    //     canvas.width = videoWidth;
    //     canvas.height = videoHeight;
    //     ctx.drawImage(video, 0, 0, videoWidth, videoHeight);
        
    //     canvas.toBlob(async (blob) => {
    //         if (!blob) {
    //             showToast("Không thể tạo ảnh từ video.", "error");
    //             hideLoader();
    //             return;
    //         }

    //         const formData = new FormData();
    //         formData.append('file', blob, 'snapshot.png');

    //         try {
    //             const response = await fetch('/predict/image', { 
    //                 method: 'POST',
    //                 body: formData,
    //             });

    //             if (!response.ok) throw new Error(`Server error: ${response.statusText}`);
    //             const results = await response.json();
                
    //             if (results && results.detections && results.detections.length > 0) {
    //                 state.isAiDetectionActive = true;
    //                 video.style.opacity = 0;
    //                 canvas.style.opacity = 1;
    //                 viewModeAiBtn.classList.replace('btn-secondary', 'btn-primary');
    //                 viewModeNormalBtn.classList.replace('btn-primary', 'btn-secondary');
                    
    //                 renderDetections(results.detections);
    //                 WebRTCService.renderStaticDetections(results);
    //                 updateDetectionInfo(results.detections);
                    
    //                 try {
    //                     const captureFormData = new FormData();
    //                     captureFormData.append('file', blob, 'snapshot.png');
    //                     const allowedFruits = ['apple', 'orange', 'fruit', 'tomato', 'grape'];
    //                     const fruitCount = results.detections.filter(d => allowedFruits.includes(d.label)).length;
    //                     captureFormData.append('total_fruit_count', fruitCount);

    //                     const captureResponse = await authenticatedFetch(`${API_BASE_URL}/api/trees/${state.selectedProductId}/captures/`, {
    //                         method: 'POST',
    //                         body: captureFormData
    //                     });
                        
    //                     if (!captureResponse.ok) throw new Error('Failed to save capture');
                        
    //                     const captureData = await captureResponse.json();
    //                     showToast(`Đã lưu ảnh chụp (ID: ${captureData.capture_id}) với ${fruitCount} trái.`, 'success');
                        
    //                 } catch (captureError) {
    //                     console.error("Error saving capture:", captureError);
    //                     showToast("Phân tích AI thành công, nhưng lỗi khi lưu ảnh.", "error");
    //                 }
    //             } else {
    //                 showToast("Không phát hiện đối tượng nào.", "success");
    //                 updateDetectionInfo([]);
    //                 ctx.clearRect(0, 0, canvas.width, canvas.height);
    //             }
    //         } catch (error) {
    //             console.error("AI analysis error:", error);
    //             showToast("Lỗi trong quá trình phân tích ảnh.", "error");
    //             ctx.clearRect(0, 0, canvas.width, canvas.height);
    //         } finally {
    //             hideLoader();
    //         }
    //     }, 'image/png');
    // });
    viewModeAiBtn.addEventListener('click', async (e) => {
        // 1. Chặn hành vi mặc định để không bị reload trang
        if(e) e.preventDefault(); 
        
        if (state.isAiDetectionActive) return;
        showLoader();

        const video = realtimeVideo;
        const canvas = overlayCanvas;
        const ctx = canvas.getContext('2d');
        const videoWidth = video.videoWidth;
        const videoHeight = video.videoHeight;

        if (videoWidth === 0 || videoHeight === 0) {
            showToast("Không thể chụp ảnh, video chưa sẵn sàng.", "error");
            hideLoader();
            return;
        }

        canvas.width = videoWidth;
        canvas.height = videoHeight;
        ctx.drawImage(video, 0, 0, videoWidth, videoHeight);
        
        canvas.toBlob(async (blob) => {
            if (!blob) {
                showToast("Không thể tạo ảnh từ video.", "error");
                hideLoader();
                return;
            }

            const formData = new FormData();
            formData.append('file', blob, 'snapshot.png');

            try {
                // Lưu ý: Dùng API_BASE_URL để tránh lỗi 404/405 nếu chạy local
                const response = await fetch(`/predict/image`, { 
                    method: 'POST',
                    body: formData,
                });

                if (!response.ok) throw new Error(`Server error: ${response.statusText}`);
                const results = await response.json();
                
                // --- SỬA ĐIỀU KIỆN IF ---
                // Chấp nhận nếu có detections HOẶC có data bệnh
                const hasDetections = results.detections && results.detections.length > 0;
                const hasData = results.data && Object.keys(results.data).length > 0;

                if (results && (hasDetections || hasData)) {
                    state.isAiDetectionActive = true;
                    video.style.opacity = 0;
                    canvas.style.opacity = 1;
                    viewModeAiBtn.classList.replace('btn-secondary', 'btn-primary');
                    viewModeNormalBtn.classList.replace('btn-primary', 'btn-secondary');
                    
                    // Nếu có detections thì vẽ, không thì truyền mảng rỗng để tránh lỗi
                    const safeDetections = results.detections || [];
                    
                    renderDetections(safeDetections);
                    WebRTCService.renderStaticDetections(results);
                    
                    // Cập nhật thông tin (Truyền mảng detections rỗng cũng được, miễn là có results.data)
                    updateDetectionInfo(safeDetections, results.data);
                    
                    // ... (Phần lưu capture giữ nguyên) ...
                     try {
                        const captureFormData = new FormData();
                        captureFormData.append('file', blob, 'snapshot.png');
                        const allowedFruits = ['apple', 'orange', 'fruit', 'tomato', 'grape'];
                        // Đếm số lượng (nếu không có detection thì là 0)
                        const fruitCount = safeDetections.filter(d => allowedFruits.includes(d.label)).length;
                        captureFormData.append('total_fruit_count', fruitCount);

                        const captureResponse = await authenticatedFetch(`${API_BASE_URL}/api/trees/${state.selectedProductId}/captures/`, {
                            method: 'POST',
                            body: captureFormData
                        });
                        
                        if (!captureResponse.ok) throw new Error('Failed to save capture');
                        const captureData = await captureResponse.json();
                        showToast(`Đã lưu ảnh chụp (ID: ${captureData.capture_id}).`, 'success');
                        
                    } catch (captureError) {
                        console.error("Error saving capture:", captureError);
                        showToast("Phân tích AI thành công (Lỗi lưu lịch sử).", "warning");
                    }

                } else {
                    showToast("Không phát hiện đối tượng nào.", "success");
                    updateDetectionInfo([], null);
                    ctx.clearRect(0, 0, canvas.width, canvas.height);
                }
            } catch (error) {
                console.error("AI analysis error:", error);
                showToast("Lỗi trong quá trình phân tích ảnh.", "error");
                ctx.clearRect(0, 0, canvas.width, canvas.height);
            } finally {
                hideLoader();
            }
        }, 'image/png');
    });
    
    analyticsProductGrid.addEventListener('click', (e) => {
        const toggleBtn = e.target.closest('.btn-toggle-active');
        if (toggleBtn) {
            e.stopPropagation();
            const productId = toggleBtn.dataset.productId;
            const currentStatus = toggleBtn.dataset.currentStatus === 'true';
            updateTreeStatus(productId, !currentStatus);
            return;
        }
        const card = e.target.closest('.product-card-main-area-analytics');
        if (card) {
            const productId = card.closest('[data-product-id]').dataset.productId;
            showAnalyticsHistory(productId);
        }
    });

    analyticsBackBtn.addEventListener('click', showAnalyticsGrid);
    
    waterPlantBtn.addEventListener('click', async () => {
        showLoader();
        try {
            await callWorkflowAPI(WORKFLOW_WATERING_URL, state.selectedProductId);
            await logControlAction('tưới cây', '100ml');
        } catch (error) {
            console.error("Watering action failed:", error);
        } finally {
            hideLoader();
        }
    });
    
    fertilizePlantBtn.addEventListener('click', async () => {
        showLoader();
        try {
            await logControlAction('bón phân', '10g');
        } catch (error) {
            console.error("Fertilizing action failed:", error);
        } finally {
            hideLoader();
        }
    });

    harvestPlantBtn.addEventListener('click', async () => {
        showLoader();
         try {
            await logControlAction('thu hoạch', '');
        } catch (error) {
            console.error("Harvesting action failed:", error);
        } finally {
            hideLoader();
        }
    });
    
    fillWaterBtn.addEventListener('click', async () => {
        showLoader();
        try {
            await callWorkflowAPI(WORKFLOW_FILL_WATER_URL, state.selectedProductId);
            await logControlAction('đổ đầy bình chứa', '');
        } catch (error) {
            console.error("Fill water action failed:", error);
        } finally {
            hideLoader();
        }
    });

    // --- THÊM MỚI: Listener cho nút đóng Alert ---
    alertCloseBtn.addEventListener('click', hideAlert);



let aiProcessingTimeout = null; // Biến để lưu timeout mô phỏng
let aiProcessingInterval = null; // Biến để cập nhật timer

// --- THÊM MỚI: HÀM CHO AI-TOOL ---

/**
 * Hiển thị lớp overlay xử lý và bắt đầu đếm ngược giả
 * @param {number} duration - Thời gian xử lý (ms)
 */
function showAiProcessing(duration) {
    aiProcessingOverlay.classList.remove('view-hidden');
    aiResultsContentReal.classList.add('view-hidden');
    aiResultsContentReal.innerHTML = ''; // Xóa kết quả cũ

    let remainingTime = Math.ceil(duration / 1000); // Giây
    aiProcessingTimer.textContent = `(Ước tính: ~${remainingTime} giây)`;

    // Xóa interval cũ nếu có
    if (aiProcessingInterval) {
        clearInterval(aiProcessingInterval);
    }

    // Bắt đầu interval mới để cập nhật timer
    aiProcessingInterval = setInterval(() => {
        remainingTime--;
        if (remainingTime > 0) {
            aiProcessingTimer.textContent = `(Ước tính: ~${remainingTime} giây)`;
        } else {
            aiProcessingTimer.textContent = `(Hoàn tất...)`;
            clearInterval(aiProcessingInterval);
            aiProcessingInterval = null;
        }
    }, 1000);
}

/**
 * Ẩn lớp overlay xử lý và dừng timer (nếu còn chạy)
 */
function hideAiProcessing() {
     aiProcessingOverlay.classList.add('view-hidden');
     aiResultsContentReal.classList.remove('view-hidden');
     if (aiProcessingInterval) {
        clearInterval(aiProcessingInterval);
        aiProcessingInterval = null;
     }
}

/**
 * Hiển thị kết quả phân tích
 * @param {object} resultData - Đối tượng kết quả từ aiAnalysisDatabase
 * @param {string} fileName - Tên tệp gốc để hiển thị lỗi
 */
/**
 * Hiển thị kết quả phân tích thực tế từ AI
 * @param {string} markdownContent - Nội dung Markdown trả về từ API
 */
// --- HÀM CHUYỂN ĐỔI MARKDOWN ĐƠN GIẢN ---
function parseMarkdown(markdown) {
    if (!markdown) return '';
    
    let html = markdown
        // Escaping (để an toàn)
        .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
        
        // Headers (# h1, ## h2, ...)
        .replace(/^# (.*$)/gim, '<h1 class="text-2xl font-bold text-primary-accent mb-2">$1</h1>')
        .replace(/^## (.*$)/gim, '<h2 class="text-xl font-bold text-white mt-4 mb-2">$1</h2>')
        .replace(/^### (.*$)/gim, '<h3 class="text-lg font-bold text-gray-200 mt-3 mb-1">$1</h3>')
        
        // Bold (**text**)
        .replace(/\*\*(.*?)\*\*/gim, '<strong class="text-amber-400">$1</strong>')
        
        // Italic (*text*)
        .replace(/\*(.*?)\*/gim, '<em>$1</em>')
        
        // List items (- item)
        .replace(/^\s*-\s+(.*$)/gim, '<li class="ml-4 text-gray-300 list-disc">$1</li>')
        
        // Code blocks (`code`)
        .replace(/`([^`]+)`/gim, '<code class="bg-gray-700 px-1 rounded text-sm text-green-400">$1</code>')
        
        // Line breaks
        .replace(/\n/gim, '<br>');

    return `<div class="markdown-body space-y-2">${html}</div>`;
}

function renderAiAnalysisResults(markdownContent) {
    hideAiProcessing(); 

    if (!markdownContent) {
        aiResultsContentReal.innerHTML = `<p class="text-red-400 text-center">Không nhận được phản hồi từ AI.</p>`;
        return;
    }

    // Chuyển Markdown sang HTML
    const htmlContent = parseMarkdown(markdownContent);

    aiResultsContentReal.innerHTML = `
        <div class="bg-gray-900/50 p-6 rounded-lg border border-gray-700 shadow-inner">
            <div class="flex items-center gap-3 mb-4 border-b border-gray-700 pb-3">
                <svg class="w-8 h-8 text-primary-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z"></path></svg>
                <h3 class="text-xl font-bold text-white">Kết quả Phân tích AI</h3>
            </div>
            <div class="text-gray-300 leading-relaxed">
                ${htmlContent}
            </div>
        </div>
    `;
}

 // --- Cấu hình URL API Phân tích ---
    // Đây là URL Webhook (n8n) hoặc Backend Python của bạn
    // Nó sẽ thực hiện logic: Nhận ảnh -> YOLO -> Gemini/GPT -> Trả về JSON { "markdown": "..." }
    const ANALYZE_API_URL = "https://workflow.emg.edu.vn:5678/webhook/analyze-plant"; 

    aiImageInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // Kiểm tra định dạng
        if (!file.type.startsWith('image/')) {
            showToast("Vui lòng chọn file ảnh (.jpg, .png)", "error");
            return;
        }

        // 1. Hiển thị Preview
        const reader = new FileReader();
        reader.onload = (event) => {
            aiImagePreview.innerHTML = `<img src="${event.target.result}" class="max-h-full rounded-lg shadow-lg" alt="Preview">`;
        };
        reader.readAsDataURL(file);

        // 2. Hiển thị trạng thái đang xử lý
        showAiProcessing(15000); // Hiển thị countdown giả 15s trong lúc chờ API thật

        // 3. Chuẩn bị dữ liệu gửi đi
        const formData = new FormData();
        formData.append('file', file); // Gửi file gốc
        // formData.append('image', file); // Tùy backend của bạn yêu cầu key là 'file' hay 'image'

        try {
            // 4. Gọi API thực tế
            const response = await fetch(ANALYZE_API_URL, {
                method: 'POST',
                body: formData
                // Lưu ý: Khi dùng FormData, không cần set Content-Type, browser tự làm
            });

            if (!response.ok) {
                throw new Error(`Lỗi Server: ${response.status}`);
            }

            const data = await response.json();
            
            // Giả sử API trả về JSON dạng: { "result": "# Tiêu đề\nNội dung phân tích..." }
            // Hoặc { "markdown": "..." }
            const markdownResult = data.output || data.result || data.message || "**Không có dữ liệu phản hồi**";

            // 5. Render kết quả thật
            renderAiAnalysisResults(markdownResult);
            
            showToast("Phân tích hoàn tất!", "success");

        } catch (error) {
            console.error("Analysis Error:", error);
            hideAiProcessing();
            showToast("Lỗi khi gọi AI phân tích.", "error");
            
            aiResultsContentReal.innerHTML = `
                <div class="text-center p-6">
                    <p class="text-red-500 font-bold mb-2">Đã xảy ra lỗi!</p>
                    <p class="text-gray-400 text-sm">${error.message}</p>
                    <button onclick="document.getElementById('ai-image-input').click()" class="mt-4 text-primary-accent underline">Thử lại</button>
                </div>
            `;
        } finally {
            // Reset input để có thể chọn lại cùng file nếu muốn
            aiImageInput.value = ''; 
        }
    });

    // Khởi động app
    handleNavigation('login'); 
    viewModeNormalBtn.click(); 
    showAnalyticsGrid(); 

    const API_URL = "http://192.168.4.1/api/sensors"; 

    // Hàm cập nhật dữ liệu cây trồng
    async function updatePlantData() {
        try {
            const response = await fetch(API_URL);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();

            // 1. Cập nhật Thời gian (Lấy giờ hiện tại của trình duyệt)
            const now = new Date();
            document.getElementById('plant-time').innerText = now.toLocaleTimeString('vi-VN');

            // 2. Cập nhật Độ ẩm (Từ dữ liệu 'humidity')
            // Cập nhật text
            document.getElementById('plant-humidity').innerText = `${Math.round(data.humidity)} %`;
            // Nếu có thanh progress bar, cập nhật width (ví dụ)
            // document.getElementById('humidity-bar').style.width = `${data.humidity}%`;

            // 3. Cập nhật Mực nước (Từ dữ liệu 'waterLevel')
            document.getElementById('plant-water').innerText = `${Math.round(data.waterLevel)} %`;

            // 4. Cập nhật Thời tiết (Logic dựa trên cảm biến Mưa 'rain')
            // Giá trị analogRain: 4095 (khô) -> 0 (mưa rất to)
            let weatherText = "Nắng ráo";
            if (data.rain < 1500) {
                weatherText = "Mưa to";
            } else if (data.rain < 2500) {
                weatherText = "Có mưa nhỏ";
            } else if (data.rain < 3500) {
                weatherText = "Nhiều mây";
            }
            document.getElementById('plant-weather').innerText = weatherText;

            // 5. Các thông số CHƯA CÓ trong code C++ (Temperature, Light)
            // Vì code C++ chưa đọc các cảm biến này, ta tạm để nguyên hoặc hiển thị N/A
            // Bạn cần bổ sung code đọc DHT11/DHT22 vào C++ để có nhiệt độ thật
            document.getElementById('plant-temp').innerText = "-- °C"; 
            document.getElementById('plant-light').innerText = "-- lux";

            // 6. Vị trí (Có thể dùng dữ liệu 'distance' để phỏng đoán hoặc để cố định)
            // Ví dụ: Khoảng cách < 10cm nghĩa là có vật cản gần -> Cây đang được chăm sóc
            const locationStatus = data.distance < 10 ? "Đang chăm sóc" : "Vườn 1";
            document.getElementById('plant-location').innerText = locationStatus;

            console.log("Đã cập nhật dữ liệu:", data);

        } catch (error) {
            console.error("Lỗi khi gọi API IoT:", error);
            // Có thể hiển thị thông báo lỗi lên giao diện nếu cần
        }
    }

    // Gọi hàm cập nhật mỗi 3 giây (3000ms)
    setInterval(updatePlantData, 3000);

    // Gọi ngay lập tức khi trang vừa tải xong
    document.addEventListener('DOMContentLoaded', updatePlantData);
});