 
// Global variables
let socket;
let localStream;
let remoteStream;
let peerConnection;
let currentChatType = null;
let isConnected = false;

// Initialize when page loads
document.addEventListener('DOMContentLoaded', function() {
    initializeSocket();
});

// Socket initialization
function initializeSocket() {
    socket = io();
    
    socket.on('connect', function() {
        console.log('Connected to server');
    });
    
    socket.on('matched', function() {
        updateStatus('Connected', 'connected');
        isConnected = true;
        updateConnectButton();
    });
    
    socket.on('message', function(data) {
        displayMessage(data.message, 'stranger');
    });
    
    socket.on('user-disconnected', function() {
        updateStatus('Stranger disconnected', 'disconnected');
        isConnected = false;
        updateConnectButton();
    });
    
    socket.on('typing', function() {
        updateStatus('User is typing...', 'typing');
        setTimeout(() => {
            if (isConnected) {
                updateStatus('Connected', 'connected');
            }
        }, 2000);
    });
    
    socket.on('file-received', function(data) {
        displayFileMessage(data, 'stranger');
    });
    
    // Video chat events
    socket.on('video-offer', handleVideoOffer);
    socket.on('video-answer', handleVideoAnswer);
    socket.on('ice-candidate', handleIceCandidate);
}

// Start text chat
function startTextChat() {
    currentChatType = 'text';
    showTermsModal();
}

// Start video chat
function startVideoChat() {
    currentChatType = 'video';
    showTermsModal();
}

// Show terms modal
function showTermsModal() {
    document.getElementById('termsModal').style.display = 'block';
}

// Close modal
function closeModal() {
    document.getElementById('termsModal').style.display = 'none';
}

// Agree to terms
function agreeTerms() {
    closeModal();
    if (currentChatType === 'text') {
        openChatInterface();
    } else if (currentChatType === 'video') {
        openVideoInterface();
    }
}

// Open chat interface
function openChatInterface() {
    document.querySelector('.container').style.display = 'none';
    document.getElementById('chatInterface').classList.remove('hidden');
    socket.emit('join-text-chat');
    updateStatus('Looking for stranger...', 'disconnected');
}

// Open video interface
async function openVideoInterface() {
    document.querySelector('.container').style.display = 'none';
    document.getElementById('videoInterface').classList.remove('hidden');
    
    try {
        await requestMediaPermissions();
        socket.emit('join-video-chat');
        updateVideoStatus('Looking for stranger...', 'disconnected');
    } catch (error) {
        alert('Camera and microphone access required for video chat');
        goBackToHome();
    }
}

// Request media permissions
async function requestMediaPermissions() {
    try {
        localStream = await navigator.mediaDevices.getUserMedia({ 
            video: true, 
            audio: true 
        });
        document.getElementById('localVideo').srcObject = localStream;
        return true;
    } catch (error) {
        throw new Error('Media access denied');
    }
}

// Send message
function sendMessage() {
    const input = document.getElementById('messageInput');
    const message = input.value.trim();
    
    if (message && isConnected) {
        socket.emit('message', message);
        displayMessage(message, 'user');
        input.value = '';
    }
}

// Send video message
function sendVideoMessage() {
    const input = document.getElementById('videoMessageInput');
    const message = input.value.trim();
    
    if (message && isConnected) {
        socket.emit('message', message);
        displayVideoMessage(message, 'user');
        input.value = '';
    }
}

// Handle key press
function handleKeyPress(event) {
    if (event.key === 'Enter') {
        sendMessage();
    } else {
        socket.emit('typing');
    }
}

// Handle video key press
function handleVideoKeyPress(event) {
    if (event.key === 'Enter') {
        sendVideoMessage();
    } else {
        socket.emit('typing');
    }
}

// Display message
function displayMessage(message, sender) {
    const messagesContainer = document.getElementById('chatMessages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}`;
    messageDiv.textContent = message;
    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Display video message
function displayVideoMessage(message, sender) {
    const messagesContainer = document.getElementById('videoChatMessages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}`;
    messageDiv.textContent = message;
    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Update status
function updateStatus(text, className) {
    const status = document.getElementById('connectionStatus');
    if (status) {
        status.textContent = text;
        status.className = `status ${className}`;
    }
}

// Update video status
function updateVideoStatus(text, className) {
    const status = document.getElementById('videoConnectionStatus');
    if (status) {
        status.textContent = text;
        status.className = `status ${className}`;
    }
}

// Toggle connection
function toggleConnection() {
    if (isConnected) {
        socket.emit('disconnect-chat');
        updateStatus('Disconnected', 'disconnected');
        isConnected = false;
    } else {
        socket.emit('join-text-chat');
        updateStatus('Looking for stranger...', 'disconnected');
    }
    updateConnectButton();
}

// Toggle video connection
function toggleVideoConnection() {
    if (isConnected) {
        socket.emit('disconnect-chat');
        updateVideoStatus('Disconnected', 'disconnected');
        isConnected = false;
        if (peerConnection) {
            peerConnection.close();
            peerConnection = null;
        }
    } else {
        socket.emit('join-video-chat');
        updateVideoStatus('Looking for stranger...', 'disconnected');
    }
    updateVideoConnectButton();
}

// Update connect button
function updateConnectButton() {
    const btn = document.getElementById('connectBtn');
    if (isConnected) {
        btn.textContent = 'Disconnect';
        btn.classList.add('disconnect');
    } else {
        btn.textContent = 'Connect';
        btn.classList.remove('disconnect');
    }
}

// Update video connect button
function updateVideoConnectButton() {
    const btn = document.getElementById('videoConnectBtn');
    if (isConnected) {
        btn.textContent = 'Disconnect';
        btn.classList.add('disconnect');
    } else {
        btn.textContent = 'Connect';
        btn.classList.remove('disconnect');
    }
}

// File selection
function selectFile() {
    document.getElementById('fileInput').click();
}

function selectVideoFile() {
    document.getElementById('videoFileInput').click();
}

// Handle file select
function handleFileSelect(event) {
    const file = event.target.files[0];
    if (file && file.size <= 50 * 1024 * 1024) { // 50MB limit
        const reader = new FileReader();
        reader.onload = function(e) {
            const fileData = {
                name: file.name,
                type: file.type,
                data: e.target.result
            };
            socket.emit('file-upload', fileData);
            displayFileMessage(fileData, 'user');
        };
        reader.readAsDataURL(file);
    } else {
        alert('File size must be less than 50MB');
    }
}

// Handle video file select
function handleVideoFileSelect(event) {
    const file = event.target.files[0];
    if (file && file.size <= 50 * 1024 * 1024) { // 50MB limit
        const reader = new FileReader();
        reader.onload = function(e) {
            const fileData = {
                name: file.name,
                type: file.type,
                data: e.target.result
            };
            socket.emit('file-upload', fileData);
            displayVideoFileMessage(fileData, 'user');
        };
        reader.readAsDataURL(file);
    } else {
        alert('File size must be less than 50MB');
    }
}

// Display file message
function displayFileMessage(fileData, sender) {
    const messagesContainer = document.getElementById('chatMessages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}`;
    
    if (fileData.type.startsWith('image/')) {
        messageDiv.innerHTML = `<img src="${fileData.data}" alt="${fileData.name}" style="max-width: 200px; border-radius: 10px;">`;
    } else if (fileData.type.startsWith('video/')) {
        messageDiv.innerHTML = `<video src="${fileData.data}" controls style="max-width: 200px; border-radius: 10px;"></video>`;
    } else {
        messageDiv.textContent = `File: ${fileData.name}`;
    }
    
    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Display video file message
function displayVideoFileMessage(fileData, sender) {
    const messagesContainer = document.getElementById('videoChatMessages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}`;
    
    if (fileData.type.startsWith('image/')) {
        messageDiv.innerHTML = `<img src="${fileData.data}" alt="${fileData.name}" style="max-width: 150px; border-radius: 10px;">`;
    } else if (fileData.type.startsWith('video/')) {
        messageDiv.innerHTML = `<video src="${fileData.data}" controls style="max-width: 150px; border-radius: 10px;"></video>`;
    } else {
        messageDiv.textContent = `File: ${fileData.name}`;
    }
    
    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// WebRTC functions
async function createPeerConnection() {
    peerConnection = new RTCPeerConnection({
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' }
        ]
    });
    
    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            socket.emit('ice-candidate', event.candidate);
        }
    };
    
    peerConnection.ontrack = (event) => {
        document.getElementById('remoteVideo').srcObject = event.streams[0];
    };
    
    if (localStream) {
        localStream.getTracks().forEach(track => {
            peerConnection.addTrack(track, localStream);
        });
    }
}

async function handleVideoOffer(offer) {
    await createPeerConnection();
    await peerConnection.setRemoteDescription(offer);
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    socket.emit('video-answer', answer);
}

async function handleVideoAnswer(answer) {
    await peerConnection.setRemoteDescription(answer);
}

async function handleIceCandidate(candidate) {
    if (peerConnection) {
        await peerConnection.addIceCandidate(candidate);
    }
}

// Footer functions
function showTerms() {
    alert('By using this website, you agree to comply with all applicable laws and not to use the service for any illegal activities. Users must be at least 18 years old or have parental permission to access the website. We reserve the right to terminate or restrict your access at any time for violating our policies or engaging in inappropriate behavior. You are solely responsible for your interactions and activities on this platform.');
}

function showPrivacy() {
    alert('We value your privacy. This website may collect minimal data such as IP address, browser type, and usage activity for analytical and security purposes. We do not sell or share your personal information with third parties, except as required by law. By using this site, you consent to the collection and use of information in accordance with this policy.');
}

function showDMCA() {
    alert('We respect copyright laws and comply with the Digital Millennium Copyright Act (DMCA). If you believe that any content on this site infringes upon your copyright, please contact us with proper documentation, and we will take appropriate action.');
}

function showAdultWarning() {
    alert('This is a family-friendly platform. Please use appropriate language and behavior.');
}

// Go back to home
function goBackToHome() {
    document.querySelector('.container').style.display = 'block';
    document.getElementById('chatInterface').classList.add('hidden');
    document.getElementById('videoInterface').classList.add('hidden');
    
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
    }
    
    if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
    }
    
    isConnected = false;
    currentChatType = null;
}

