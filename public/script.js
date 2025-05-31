// DOM Elements
const homePage = document.getElementById('homePage');
const chatPage = document.getElementById('chatPage');
const videoPage = document.getElementById('videoPage');
const termsModal = document.getElementById('termsModal');
const connectionStatus = document.getElementById('connectionStatus');
const videoConnectionStatus = document.getElementById('videoConnectionStatus');
const chatMessages = document.getElementById('chatMessages');
const videoChatMessages = document.getElementById('videoChatMessages');
const messageInput = document.getElementById('messageInput');
const videoMessageInput = document.getElementById('videoMessageInput');
const fileInput = document.getElementById('fileInput');
const videoFileInput = document.getElementById('videoFileInput');
const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');
const micBtn = document.getElementById('micBtn');
const cameraBtn = document.getElementById('cameraBtn');

// State variables
let currentAction = '';
let micActive = true;
let cameraActive = true;
let localStream = null;
let peerConnection = null;
let dataChannel = null;

// Initialize the app
document.addEventListener('DOMContentLoaded', () => {
    // Initialize Lucide icons
    lucide.createIcons();
    
    // Set up event listeners
    setupEventListeners();
});

function setupEventListeners() {
    // Message input keypress (Enter to send)
    messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendMessage();
    });
    
    videoMessageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendVideoMessage();
    });
    
    // File input changes
    fileInput.addEventListener('change', handleFileUpload);
    videoFileInput.addEventListener('change', handleVideoFileUpload);
    
    // Simulate connection status changes
    simulateConnectionStatus();
}

// Navigation functions
function showTermsForChat() {
    currentAction = 'chat';
    termsModal.style.display = 'block';
}

function showTermsForVideo() {
    currentAction = 'video';
    termsModal.style.display = 'block';
}

function agreeTerms() {
    termsModal.style.display = 'none';
    
    if (currentAction === 'chat') {
        homePage.classList.remove('active');
        chatPage.classList.add('active');
        startChat();
    } else if (currentAction === 'video') {
        homePage.classList.remove('active');
        videoPage.classList.add('active');
        startVideoCall();
    }
}

// Chat functions
function startChat() {
    connectionStatus.textContent = 'Connecting...';
    
    // Simulate connection process
    setTimeout(() => {
        connectionStatus.textContent = 'Connected';
        addSystemMessage('You are now chatting with a random stranger. Say hi!');
    }, 1500);
}

function sendMessage() {
    const message = messageInput.value.trim();
    if (message) {
        addMessage(message, 'sent');
        messageInput.value = '';
        
        // Simulate response after a delay
        setTimeout(() => {
            const responses = [
                "Hello there!",
                "How are you today?",
                "Nice to meet you!",
                "What brings you here?",
                "I'm just browsing around."
            ];
            const randomResponse = responses[Math.floor(Math.random() * responses.length)];
            addMessage(randomResponse, 'received');
        }, 1000 + Math.random() * 2000);
    }
}

function addMessage(text, type) {
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('message', type);
    messageDiv.textContent = (type === 'sent' ? 'You: ' : 'Stranger: ') + text;
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function addSystemMessage(text) {
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('message', 'info');
    messageDiv.textContent = text;
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function newChat() {
    chatMessages.innerHTML = '';
    connectionStatus.textContent = 'Connecting to new stranger...';
    
    // Simulate new connection
    setTimeout(() => {
        connectionStatus.textContent = 'Connected';
        addSystemMessage('You are now chatting with a new stranger. Say hi!');
    }, 1500);
}

function endChat() {
    chatPage.classList.remove('active');
    homePage.classList.add('active');
}

// Video Call functions
async function startVideoCall() {
    videoConnectionStatus.textContent = 'Connecting...';
    
    try {
        // Get user media (simulated in this demo)
        localStream = await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: true
        });
        
        // For demo purposes, we'll just show black video
        localVideo.srcObject = localStream;
        remoteVideo.srcObject = createBlackVideoStream();
        
        // Simulate connection process
        setTimeout(() => {
            videoConnectionStatus.textContent = 'Connected';
            addVideoSystemMessage('You are now connected with a stranger.');
            
            // Initialize WebRTC (simulated)
            initializeWebRTC();
        }, 2000);
    } catch (err) {
        console.error('Error accessing media devices:', err);
        videoConnectionStatus.textContent = 'Failed to access camera/mic';
    }
}

function createBlackVideoStream() {
    // Create a black video stream for demo purposes
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 480;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    const stream = canvas.captureStream();
    return stream;
}

function initializeWebRTC() {
    // In a real app, this would set up RTCPeerConnection
    // For demo, we'll just simulate the connection
    peerConnection = {
        // Simulated peer connection
        createDataChannel: function() {
            dataChannel = {
                send: function(message) {
                    console.log('Message sent:', message);
                    // Simulate receiving a message
                    setTimeout(() => {
                        const event = { data: "Thanks for your message!" };
                        if (dataChannel.onmessage) dataChannel.onmessage(event);
                    }, 1000);
                },
                onmessage: null,
                onopen: null
            };
            
            // Simulate data channel opening
            setTimeout(() => {
                if (dataChannel.onopen) dataChannel.onopen();
            }, 500);
            
            return dataChannel;
        }
    };
    
    // Create a data channel for text chat
    dataChannel = peerConnection.createDataChannel('chat');
    dataChannel.onmessage = handleDataChannelMessage;
    dataChannel.onopen = handleDataChannelOpen;
}

function handleDataChannelOpen() {
    console.log('Data channel opened');
    addVideoSystemMessage('Chat connection established');
}

function handleDataChannelMessage(event) {
    addVideoMessage(event.data, 'received');
}

function sendVideoMessage() {
    const message = videoMessageInput.value.trim();
    if (message && dataChannel) {
        addVideoMessage(message, 'sent');
        videoMessageInput.value = '';
        
        // Send through data channel (simulated)
        dataChannel.send(message);
    }
}

function addVideoMessage(text, type) {
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('message', type);
    messageDiv.textContent = (type === 'sent' ? 'You: ' : 'Stranger: ') + text;
    videoChatMessages.appendChild(messageDiv);
    videoChatMessages.scrollTop = videoChatMessages.scrollHeight;
}

function addVideoSystemMessage(text) {
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('message', 'info');
    messageDiv.textContent = text;
    videoChatMessages.appendChild(messageDiv);
    videoChatMessages.scrollTop = videoChatMessages.scrollHeight;
}

// Control functions
function toggleMic() {
    micActive = !micActive;
    const micIcon = micBtn.querySelector('i');
    
    if (micActive) {
        micIcon.setAttribute('data-lucide', 'mic');
        micBtn.classList.remove('active');
        if (localStream) {
            localStream.getAudioTracks().forEach(track => {
                track.enabled = true;
            });
        }
    } else {
        micIcon.setAttribute('data-lucide', 'mic-off');
        micBtn.classList.add('active');
        if (localStream) {
            localStream.getAudioTracks().forEach(track => {
                track.enabled = false;
            });
        }
    }
    
    lucide.createIcons();
}

function toggleCamera() {
    cameraActive = !cameraActive;
    const cameraIcon = cameraBtn.querySelector('i');
    
    if (cameraActive) {
        cameraIcon.setAttribute('data-lucide', 'video');
        cameraBtn.classList.remove('active');
        if (localStream) {
            localStream.getVideoTracks().forEach(track => {
                track.enabled = true;
            });
            localVideo.style.opacity = '1';
        }
    } else {
        cameraIcon.setAttribute('data-lucide', 'video-off');
        cameraBtn.classList.add('active');
        if (localStream) {
            localStream.getVideoTracks().forEach(track => {
                track.enabled = false;
            });
            localVideo.style.opacity = '0';
        }
    }
    
    lucide.createIcons();
}

function endVideoCall() {
    // Stop all media tracks
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
    }
    
    // Clean up WebRTC connection (simulated)
    peerConnection = null;
    dataChannel = null;
    
    // Reset UI
    localVideo.srcObject = null;
    remoteVideo.srcObject = null;
    videoChatMessages.innerHTML = '';
    videoMessageInput.value = '';
    
    // Return to home page
    videoPage.classList.remove('active');
    homePage.classList.add('active');
}

// File handling
function handleFileUpload(e) {
    const file = e.target.files[0];
    if (file) {
        addSystemMessage(`File uploaded: ${file.name} (${formatFileSize(file.size)})`);
        // In a real app, you would send the file to the peer
    }
    e.target.value = ''; // Reset input
}

function handleVideoFileUpload(e) {
    const file = e.target.files[0];
    if (file) {
        addVideoSystemMessage(`File uploaded: ${file.name} (${formatFileSize(file.size)})`);
        // In a real app, you would send the file to the peer
    }
    e.target.value = ''; // Reset input
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2) + ' ' + sizes[i];
}

// Simulate connection status changes
function simulateConnectionStatus() {
    if (connectionStatus) {
        setTimeout(() => {
            connectionStatus.textContent = 'Connected';
        }, 2000);
    }
    
    if (videoConnectionStatus) {
        setTimeout(() => {
            videoConnectionStatus.textContent = 'Connected';
        }, 2000);
    }
}

// Other UI functions
function showAdultWarning() {
    alert("This is just a demo. No adult content available.");
}

function showTermsPolicy() {
    alert("Terms and conditions would be displayed here.");
}

function showPrivacyPolicy() {
    alert("Privacy policy would be displayed here.");
}

function showDMCADisclaimer() {
    alert("DMCA disclaimer would be displayed here.");
}
