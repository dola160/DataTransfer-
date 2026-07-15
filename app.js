name=app.js
// ============================================
// DEVICE DATA TRANSFER APP - JavaScript
// ============================================

// State Management
const appState = {
    role: 'sender',
    files: [],
    permissions: {
        location: false,
        camera: false,
        bluetooth: false
    },
    connectionId: null,
    currentQR: null,
    cameraStream: null,
    receivedFiles: [],
    isConnected: false
};

// ============================================
// UTILITY FUNCTIONS
// ============================================

function generateConnectionId() {
    return 'CONN-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9).toUpperCase();
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

function showMessage(message, type = 'info') {
    const statusEl = document.getElementById('statusMessage');
    statusEl.textContent = message;
    statusEl.className = `status-message active ${type}`;
    
    if (type !== 'info') {
        setTimeout(() => {
            statusEl.classList.remove('active');
        }, 5000);
    }
}

// ============================================
// PERMISSION HANDLERS
// ============================================

function updatePermissionUI(section) {
    const container = document.getElementById(`${section}Permissions`);
    container.innerHTML = '';

    if (section === 'sender') {
        const locationStatus = document.createElement('div');
        locationStatus.className = `permission-status ${appState.permissions.location ? 'granted' : ''}`;
        locationStatus.innerHTML = `
            <span class="status-icon">${appState.permissions.location ? '✅' : '⏳'}</span>
            <span>Vị trí: ${appState.permissions.location ? 'Đã cấp' : 'Chưa cấp'}</span>
        `;
        container.appendChild(locationStatus);
    } else {
        const cameraStatus = document.createElement('div');
        cameraStatus.className = `permission-status ${appState.permissions.camera ? 'granted' : ''}`;
        cameraStatus.innerHTML = `
            <span class="status-icon">${appState.permissions.camera ? '✅' : '⏳'}</span>
            <span>Camera: ${appState.permissions.camera ? 'Đã cấp' : 'Chưa cấp'}</span>
        `;
        container.appendChild(cameraStatus);

        const locationStatus = document.createElement('div');
        locationStatus.className = `permission-status ${appState.permissions.location ? 'granted' : ''}`;
        locationStatus.innerHTML = `
            <span class="status-icon">${appState.permissions.location ? '✅' : '⏳'}</span>
            <span>Vị trí: ${appState.permissions.location ? 'Đã cấp' : 'Chưa cấp'}</span>
        `;
        container.appendChild(locationStatus);

        if (navigator.bluetooth) {
            const bluetoothStatus = document.createElement('div');
            bluetoothStatus.className = `permission-status ${appState.permissions.bluetooth ? 'granted' : ''}`;
            bluetoothStatus.innerHTML = `
                <span class="status-icon">${appState.permissions.bluetooth ? '✅' : '⏳'}</span>
                <span>Bluetooth: ${appState.permissions.bluetooth ? 'Có hỗ trợ' : 'Không hỗ trợ'}</span>
            `;
            container.appendChild(bluetoothStatus);
        }
    }
}

// Request Location Permission
async function requestLocation() {
    try {
        const position = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject);
        });
        
        appState.permissions.location = true;
        updatePermissionUI(appState.role);
        showMessage(`📍 Vị trí: ${position.coords.latitude.toFixed(4)}, ${position.coords.longitude.toFixed(4)}`, 'success');
    } catch (error) {
        showMessage('❌ Quyền truy cập vị trí bị từ chối', 'error');
    }
}

// Request Camera Permission
async function requestCamera() {
    try {
        const constraints = { video: { facingMode: 'environment' } };
        appState.cameraStream = await navigator.mediaDevices.getUserMedia(constraints);
        
        appState.permissions.camera = true;
        updatePermissionUI('receiver');
        
        const video = document.getElementById('cameraPreview');
        video.srcObject = appState.cameraStream;
        video.classList.add('active');
        document.getElementById('cameraControls').style.display = 'flex';
        
        showMessage('✅ Camera đã bật', 'success');
        startQRScanning();
    } catch (error) {
        showMessage('❌ Quyền truy cập camera bị từ chối', 'error');
    }
}

function stopCamera() {
    if (appState.cameraStream) {
        appState.cameraStream.getTracks().forEach(track => track.stop());
        appState.cameraStream = null;
    }
    document.getElementById('cameraPreview').classList.remove('active');
    document.getElementById('cameraControls').style.display = 'none';
}

// ============================================
// FILE HANDLING (SENDER)
// ============================================

function handleFileInput(files) {
    for (let file of files) {
        if (!appState.files.find(f => f.name === file.name && f.size === file.size)) {
            appState.files.push(file);
        }
    }
    updateFileList();
}

function updateFileList() {
    const fileList = document.getElementById('fileList');
    const fileContainer = fileList.querySelector('div') || fileList;
    
    if (appState.files.length === 0) {
        fileList.style.display = 'none';
        return;
    }

    fileList.style.display = 'block';
    fileContainer.innerHTML = appState.files.map((file, index) => `
        <div class="file-item">
            <span class="file-item-name">📄 ${file.name}</span>
            <span class="file-item-size">${formatFileSize(file.size)}</span>
            <button class="file-item-remove" onclick="removeFile(${index})">Xóa</button>
        </div>
    `).join('');
}

function removeFile(index) {
    appState.files.splice(index, 1);
    updateFileList();
}

// Drag and Drop
function setupDragAndDrop() {
    const fileInput = document.getElementById('fileInput');
    const label = document.querySelector('.file-input-label');

    label.addEventListener('dragover', (e) => {
        e.preventDefault();
        label.style.borderColor = '#667eea';
        label.style.background = '#e5e7eb';
    });

    label.addEventListener('dragleave', () => {
        label.style.borderColor = '#d1d5db';
        label.style.background = '#f3f4f6';
    });

    label.addEventListener('drop', (e) => {
        e.preventDefault();
        label.style.borderColor = '#d1d5db';
        label.style.background = '#f3f4f6';
        handleFileInput(e.dataTransfer.files);
    });

    fileInput.addEventListener('change', (e) => {
        handleFileInput(e.target.files);
    });
}

// ============================================
// QR CODE GENERATION & SCANNING
// ============================================

function generateQRCode(connectionData) {
    const qrContainer = document.getElementById('qrCode');
    qrContainer.innerHTML = '';
    
    const qr = new QRCode(qrContainer, {
        text: JSON.stringify(connectionData),
        width: 250,
        height: 250,
        colorDark: '#000000',
        colorLight: '#ffffff',
        correctLevel: QRCode.CorrectLevel.H
    });

    document.getElementById('qrContainer').classList.add('active');
    document.getElementById('connectionId').textContent = connectionData.connectionId;
}

function startQRScanning() {
    const video = document.getElementById('cameraPreview');
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    const scan = () => {
        if (video.readyState === video.HAVE_ENOUGH_DATA) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

            try {
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const code = jsQRCode(canvas.width, canvas.height, imageData.data);
                
                if (code) {
                    const scannedData = JSON.parse(code);
                    displayScanResult(scannedData);
                    stopCamera();
                    return;
                }
            } catch (e) {
                // Continue scanning
            }
        }
        requestAnimationFrame(scan);
    };

    scan();
}

function displayScanResult(data) {
    const resultContainer = document.getElementById('scanResultContainer');
    const resultDiv = document.getElementById('scanResult');
    
    resultDiv.innerHTML = `
        <p><strong>ID Kết nối:</strong> ${data.connectionId}</p>
        <p><strong>IP Người gửi:</strong> ${data.senderIP || 'N/A'}</p>
        <p><strong>Vị trí:</strong> ${data.senderLocation?.lat.toFixed(4)}, ${data.senderLocation?.lon.toFixed(4)}</p>
        <p><strong>Số tệp:</strong> ${data.fileCount}</p>
    `;
    
    resultContainer.classList.add('active');
    appState.isConnected = true;
    showMessage('✅ Đã kết nối thành công', 'success');
    
    simulateTransfer('receiver');
}

// ============================================
// TRANSFER SIMULATION
// ============================================

function startSenderMode() {
    if (appState.files.length === 0) {
        showMessage('⚠️ Vui lòng tải lên ít nhất một tệp', 'error');
        return;
    }

    if (!appState.permissions.location) {
        showMessage('⚠️ Vui lòng cấp quyền truy cập vị trí', 'error');
        return;
    }

    appState.connectionId = generateConnectionId();

    // Get Location for QR
    navigator.geolocation.getCurrentPosition((position) => {
        const connectionData = {
            connectionId: appState.connectionId,
            senderIP: 'Device IP',
            senderLocation: {
                lat: position.coords.latitude,
                lon: position.coords.longitude,
                accuracy: position.coords.accuracy
            },
            fileCount: appState.files.length,
            timestamp: Date.now()
        };

        generateQRCode(connectionData);
        document.getElementById('stopSenderBtn').style.display = 'flex';
        showMessage('✅ Mã QR đã tạo. Chờ người nhận quét mã', 'success');
        
        simulateTransfer('sender');
    });
}

function simulateTransfer(mode) {
    const progressContainer = mode === 'sender' 
        ? document.getElementById('transferProgress')
        : document.getElementById('transferProgressReceiver');
    const progressFill = mode === 'sender'
        ? document.getElementById('progressFill')
        : document.getElementById('progressFillReceiver');
    const progressText = mode === 'sender'
        ? document.getElementById('progressText')
        : document.getElementById('progressTextReceiver');

    progressContainer.classList.add('active');
    let progress = 0;

    const interval = setInterval(() => {
        progress += Math.random() * 30;
        if (progress > 100) progress = 100;

        progressFill.style.width = progress + '%';
        progressText.textContent = Math.floor(progress) + '%';

        if (progress === 100) {
            clearInterval(interval);
            showMessage('✅ Chuyển dữ liệu thành công', 'success');
            
            if (mode === 'receiver') {
                displayReceivedFiles();
            }
        }
    }, 500);
}

function displayReceivedFiles() {
    const container = document.getElementById('receivedFilesContainer');
    container.innerHTML = appState.files.map(file => `
        <div class="file-item">
            <span class="file-item-name">📄 ${file.name}</span>
            <span class="file-item-size">${formatFileSize(file.size)}</span>
        </div>
    `).join('');
    
    document.getElementById('receivedFilesList').style.display = 'block';
}

// ============================================
// BLUETOOTH HANDLER
// ============================================

async function connectBluetooth() {
    try {
        const device = await navigator.bluetooth.requestDevice({
            acceptAllDevices: true
        });
        
        const server = await device.gatt.connect();
        appState.permissions.bluetooth = true;
        updatePermissionUI('receiver');
        showMessage(`✅ Đã kết nối Bluetooth: ${device.name || 'Unknown'}`, 'success');
    } catch (error) {
        showMessage('❌ Không thể kết nối Bluetooth', 'error');
    }
}

// ============================================
// EVENT LISTENERS
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    // Initialize
    updatePermissionUI('sender');
    setupDragAndDrop();

    // Role Selection
    document.querySelectorAll('.role-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.role-btn').forEach(b => b.classList.remove('active'));
            e.target.closest('.role-btn').classList.add('active');
            
            appState.role = e.target.closest('.role-btn').dataset.role;
            
            document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
            if (appState.role === 'sender') {
                document.getElementById('senderSection').classList.add('active');
                updatePermissionUI('sender');
            } else {
                document.getElementById('receiverSection').classList.add('active');
                updatePermissionUI('receiver');
            }
        });
    });

    // Sender Controls
    document.getElementById('requestLocationBtn').addEventListener('click', requestLocation);
    document.getElementById('startSenderBtn').addEventListener('click', startSenderMode);
    document.getElementById('stopSenderBtn').addEventListener('click', () => {
        document.getElementById('qrContainer').classList.remove('active');
        document.getElementById('transferProgress').classList.remove('active');
        document.getElementById('stopSenderBtn').style.display = 'none';
        appState.files = [];
        updateFileList();
        showMessage('⏹️ Đã dừng kết nối', 'info');
    });

    // Receiver Controls
    document.getElementById('requestCameraBtn').addEventListener('click', requestCamera);
    document.getElementById('stopCameraBtn').addEventListener('click', stopCamera);
    document.getElementById('requestLocationBtnReceiver').addEventListener('click', requestLocation);
    
    if (navigator.bluetooth) {
        document.getElementById('bluetoothBtn').style.display = 'flex';
        document.getElementById('bluetoothBtn').addEventListener('click', connectBluetooth);
    }

    document.getElementById('stopReceiverBtn').addEventListener('click', () => {
        stopCamera();
        document.getElementById('scanResultContainer').classList.remove('active');
        document.getElementById('transferProgressReceiver').classList.remove('active');
        document.getElementById('receivedFilesList').style.display = 'none';
        document.getElementById('stopReceiverBtn').style.display = 'none';
        appState.isConnected = false;
        showMessage('⏹️ Đã dừng kết nối', 'info');
    });
});
