// DOM Elements
const homeScreen = document.getElementById('homeScreen');
const chatContainer = document.getElementById('chatContainer');
const videoContainer = document.getElementById('videoContainer');
const startChatBtn = document.getElementById('startChatBtn');
const startVideoBtn = document.getElementById('startVideoBtn');
const termsModal = document.getElementById('termsModal');
const closeTermsModal = document.getElementById('closeTermsModal');
const agreeBtn = document.getElementById('agreeBtn');
const chatExitBtn = document.getElementById('chatExitBtn');
const videoExitBtn = document.getElementById('videoExitBtn');
const chatMessages = document.getElementById('chatMessages');
const videoChatMessages = document.getElementById('videoChatMessages');
const messageInput = document.getElementById('messageInput');
const videoMessageInput = document.getElementById('videoMessageInput');
const sendBtn = document.getElementById('sendBtn');
const videoSendBtn = document.getElementById('videoSendBtn');
const statusIndicator = document.getElementById('statusIndicator');
const statusText = document.getElementById('statusText');
const connectBtn = document.getElementById('connectBtn');
const attachBtn = document.getElementById('attachBtn');
const attachMenu = document.getElementById('attachMenu');
const sendLocation = document.getElementById('sendLocation');
const sendPhoto = document.getElementById('sendPhoto');
const sendVideo = document.getElementById('sendVideo');
const remoteVideo = document.getElementById('remoteVideo');
const localVideo = document.getElementById('localVideo');
const muteBtn = document.getElementById('muteBtn');
const cameraBtn = document.getElementById('cameraBtn');
const endCallBtn = document.getElementById('endCallBtn');
const requestPermissionBtn = document.getElementById('requestPermissionBtn');
const retryPermissionBtn = document.getElementById('retryPermissionBtn');
const videoPermissionPrompt = document.getElementById('videoPermissionPrompt');
const messageMenu = document.getElementById('messageMenu');
const deleteMessage = document.getElementById('deleteMessage');
const replyMessage = document.getElementById('replyMessage');
const termsLink = document.getElementById('termsLink');
const privacyLink = document.getElementById('privacyLink');
const dmcaLink = document.getElementById('dmcaLink');
const fileInput = document.getElementById('fileInput');

// State variables
let isConnected = false;
let isTyping = false;
let typingTimeout;
let currentChatType = null; // 'text' or 'video'
let selectedMessage = null;
let localStream = null;
let peerConnection = null;
let dataChannel = null;
let socket = null;
let strangerId = null;
let userId = Math.random().toString(36).substring(2, 15);
let interests = '';

// Configuration for WebRTC
const configuration = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' }
    ]
};

// Initialize the app
function init() {
    setupEventListeners();
    connectToSignalingServer();
}

// Connect to WebSocket signaling server
function connectToSignalingServer() {
    socket = io();

    socket.on('connect', () => {
        console.log('Connected to signaling server');
    });

    socket.on('disconnect', () => {
        console.log('Disconnected from signaling server');
        if (isConnected) {
            disconnectFromStranger();
        }
    });

    socket.on('strangerFound', (data) => {
        strangerId = data.strangerId;
        isConnected = true;
        updateConnectionStatus();
        
        if (currentChatType === 'text') {
            addSystemMessage("Connected to a stranger");
            setupDataChannel();
        } else {
            addVideoSystemMessage("Connected to a stranger");
            setupPeerConnection();
        }
    });

    socket.on('strangerDisconnected', () => {
        disconnectFromStranger();
        if (currentChatType === 'text') {
            addSystemMessage("Stranger has disconnected");
        } else {
            addVideoSystemMessage("Stranger has disconnected");
        }
    });

    socket.on('message', (message) => {
        if (currentChatType === 'text') {
            addStrangerMessage(message.text);
        } else {
            addVideoStrangerMessage(message.text);
        }
    });

    socket.on('typing', (isTyping) => {
        if (isTyping) {
            if (currentChatType === 'text') {
                addTypingIndicator();
            }
        } else {
            removeTypingIndicator();
        }
    });

    socket.on('offer', async (offer) => {
        if (!peerConnection) setupPeerConnection();
        await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        socket.emit('answer', { to: strangerId, answer: answer });
    });

    socket.on('answer', async (answer) => {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
    });

    socket.on('iceCandidate', async (candidate) => {
        try {
            await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (e) {
            console.error('Error adding received ice candidate', e);
        }
    });

    socket.on('file', (fileData) => {
        displayFile(fileData);
    });
}

// Set up event listeners
function setupEventListeners() {
    // Home screen buttons
    startChatBtn.addEventListener('click', () => {
        currentChatType = 'text';
        interests = document.getElementById('interestsInput').value.trim();
        showTermsModal();
    });
    
    startVideoBtn.addEventListener('click', () => {
        currentChatType = 'video';
        interests = document.getElementById('interestsInput').value.trim();
        showTermsModal();
    });
    
    // Terms modal
    closeTermsModal.addEventListener('click', hideTermsModal);
    agreeBtn.addEventListener('click', () => {
        hideTermsModal();
        if (currentChatType === 'text') {
            startTextChat();
        } else {
            startVideoChat();
        }
    });
    
    // Chat interface
    chatExitBtn.addEventListener('click', () => {
        disconnectFromStranger();
        showHomeScreen();
    });
    
    videoExitBtn.addEventListener('click', () => {
        endVideoCall();
        showHomeScreen();
    });
    
    // Message input
    messageInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && messageInput.value.trim()) {
            sendMessage();
        }
        
        if (!isTyping && messageInput.value) {
            isTyping = true;
            socket.emit('typing', { to: strangerId, isTyping: true });
        }
    });
    
    messageInput.addEventListener('input', () => {
        if (typingTimeout) clearTimeout(typingTimeout);
        
        if (messageInput.value) {
            if (!isTyping) {
                isTyping = true;
                socket.emit('typing', { to: strangerId, isTyping: true });
            }
            typingTimeout = setTimeout(() => {
                isTyping = false;
                socket.emit('typing', { to: strangerId, isTyping: false });
            }, 1000);
        } else {
            isTyping = false;
            socket.emit('typing', { to: strangerId, isTyping: false });
        }
    });
    
    videoMessageInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && videoMessageInput.value.trim()) {
            sendVideoMessage();
        }
    });
    
    // Send buttons
    sendBtn.addEventListener('click', sendMessage);
    videoSendBtn.addEventListener('click', sendVideoMessage);
    
    // Connect button
    connectBtn.addEventListener('click', toggleConnection);
    
    // Attachments
    attachBtn.addEventListener('click', toggleAttachMenu);
    sendLocation.addEventListener('click', () => {
        sendLocationMessage();
        hideAttachMenu();
    });
    sendPhoto.addEventListener('click', () => {
        fileInput.accept = 'image/*';
        fileInput.click();
        hideAttachMenu();
    });
    sendVideo.addEventListener('click', () => {
        fileInput.accept = 'video/*';
        fileInput.click();
        hideAttachMenu();
    });
    
    // File input
    fileInput.addEventListener('change', handleFileSelect);
    
    // Video controls
    muteBtn.addEventListener('click', toggleMute);
    cameraBtn.addEventListener('click', toggleCamera);
    endCallBtn.addEventListener('click', endVideoCall);
    requestPermissionBtn.addEventListener('click', requestPermissions);
    retryPermissionBtn.addEventListener('click', requestPermissions);
    
    // Message context menu
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.message') && !e.target.closest('.message-menu')) {
            hideMessageMenu();
        }
    });
    
    // Footer links
    termsLink.addEventListener('click', (e) => {
        e.preventDefault();
        alert("By using this website, you agree to comply with all applicable laws and not to use the service for any illegal activities. Users must be at least 18 years old or have parental permission to access the website. We reserve the right to terminate or restrict your access at any time for violating our policies or engaging in inappropriate behavior. You are solely responsible for your interactions and activities on this platform.");
    });
    
    privacyLink.addEventListener('click', (e) => {
        e.preventDefault();
        alert("We value your privacy. This website may collect minimal data such as IP address, browser type, and usage activity for analytical and security purposes. We do not sell or share your personal information with third parties, except as required by law. By using this site, you consent to the collection and use of information in accordance with this policy.");
    });
    
    dmcaLink.addEventListener('click', (e) => {
        e.preventDefault();
        alert("We respect copyright laws and comply with the Digital Millennium Copyright Act (DMCA). If you believe that any content on this site infringes upon your copyright, please contact us with proper documentation, and we will take appropriate action.");
    });
    
    // Long press for message menu
    document.addEventListener('contextmenu', (e) => {
        if (e.target.closest('.message')) {
            e.preventDefault();
            showMessageMenu(e.target.closest('.message'), e.clientX, e.clientY);
        }
    });
    
    deleteMessage.addEventListener('click', () => {
        if (selectedMessage) {
            selectedMessage.remove();
            hideMessageMenu();
        }
    });
    
    replyMessage.addEventListener('click', () => {
        if (selectedMessage) {
            const messageText = selectedMessage.textContent;
            if (currentChatType === 'text') {
                messageInput.value = `Replying to: ${messageText}`;
                messageInput.focus();
            } else {
                videoMessageInput.value = `Replying to: ${messageText}`;
                videoMessageInput.focus();
            }
            hideMessageMenu();
        }
    });
}

// Show terms modal
function showTermsModal() {
    termsModal.style.display = 'flex';
}

// Hide terms modal
function hideTermsModal() {
    termsModal.style.display = 'none';
}

// Show home screen
function showHomeScreen() {
    homeScreen.style.display = 'flex';
    chatContainer.style.display = 'none';
    videoContainer.style.display = 'none';
}

// Start text chat
function startTextChat() {
    homeScreen.style.display = 'none';
    chatContainer.style.display = 'flex';
    videoContainer.style.display = 'none';
    
    // Clear previous messages
    chatMessages.innerHTML = '';
    
    // Find a stranger
    socket.emit('findStranger', { userId, interests, type: 'text' });
}

// Start video chat
function startVideoChat() {
    homeScreen.style.display = 'none';
    chatContainer.style.display = 'none';
    videoContainer.style.display = 'flex';
    
    // Clear previous messages
    videoChatMessages.innerHTML = '';
    
    // Show permission prompt
    videoPermissionPrompt.classList.add('show');
    retryPermissionBtn.style.display = 'none';
    
    // Find a stranger
    socket.emit('findStranger', { userId, interests, type: 'video' });
}

// Request camera/mic permissions
function requestPermissions() {
    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
        .then(stream => {
            localStream = stream;
            localVideo.srcObject = stream;
            videoPermissionPrompt.classList.remove('show');
            addVideoSystemMessage("Video chat started");
            
            // Setup peer connection if we have a stranger
            if (strangerId) {
                setupPeerConnection();
            }
        })
        .catch(err => {
            console.error("Error accessing media devices:", err);
            const errorMessage = videoPermissionPrompt.querySelector('p');
            errorMessage.textContent = `Error: ${err.message}`;
            retryPermissionBtn.style.display = 'inline-block';
        });
}

// Setup WebRTC peer connection
function setupPeerConnection() {
    if (!localStream && currentChatType === 'video') {
        console.error("Local stream not available");
        return;
    }

    peerConnection = new RTCPeerConnection(configuration);

    // Add local stream to connection
    if (localStream) {
        localStream.getTracks().forEach(track => {
            peerConnection.addTrack(track, localStream);
        });
    }

    // Setup data channel for text chat in video mode
    if (currentChatType === 'video') {
        dataChannel = peerConnection.createDataChannel('chat');
        setupDataChannelListeners(dataChannel);
    }

    // ICE candidate handler
    peerConnection.onicecandidate = ({ candidate }) => {
        if (candidate && strangerId) {
            socket.emit('iceCandidate', { to: strangerId, candidate: candidate });
        }
    };

    // Track handler for remote stream
    peerConnection.ontrack = (event) => {
        remoteVideo.srcObject = event.streams[0];
    };

    // Connection state change handler
    peerConnection.onconnectionstatechange = () => {
        switch (peerConnection.connectionState) {
            case 'connected':
                addVideoSystemMessage("Video connection established");
                break;
            case 'disconnected':
            case 'failed':
                addVideoSystemMessage("Video connection lost");
                break;
        }
    };

    // Create offer if we're the initiator
    if (currentChatType === 'video' && strangerId) {
        createOffer();
    }
}

// Create WebRTC offer
async function createOffer() {
    try {
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        socket.emit('offer', { to: strangerId, offer: offer });
    } catch (err) {
        console.error("Error creating offer:", err);
    }
}

// Setup data channel
function setupDataChannel() {
    if (peerConnection) {
        dataChannel = peerConnection.createDataChannel('chat');
        setupDataChannelListeners(dataChannel);
    }
}

// Setup data channel listeners
function setupDataChannelListeners(channel) {
    channel.onopen = () => {
        console.log("Data channel opened");
    };

    channel.onclose = () => {
        console.log("Data channel closed");
    };

    channel.onmessage = (event) => {
        const message = JSON.parse(event.data);
        if (message.type === 'text') {
            if (currentChatType === 'text') {
                addStrangerMessage(message.content);
            } else {
                addVideoStrangerMessage(message.content);
            }
        } else if (message.type === 'file') {
            displayFile(message);
        }
    };
}

// Toggle connection status
function toggleConnection() {
    if (isConnected) {
        disconnectFromStranger();
    } else {
        if (currentChatType === 'text') {
            socket.emit('findStranger', { userId, interests, type: 'text' });
        } else {
            socket.emit('findStranger', { userId, interests, type: 'video' });
        }
    }
}

// Disconnect from current stranger
function disconnectFromStranger() {
    if (strangerId) {
        socket.emit('disconnectFromStranger', { strangerId });
    }
    isConnected = false;
    strangerId = null;
    updateConnectionStatus();
    
    if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
    }
    
    if (dataChannel) {
        dataChannel.close();
        dataChannel = null;
    }
    
    if (currentChatType === 'text') {
        addSystemMessage("Disconnected from stranger");
    } else {
        addVideoSystemMessage("Disconnected from stranger");
    }
}

// Update connection status UI
function updateConnectionStatus() {
    if (isConnected) {
        statusIndicator.classList.add('connected');
        statusText.textContent = 'Connected';
        connectBtn.classList.remove('disconnected');
        connectBtn.innerHTML = '<div class="connect-icon"></div><span>Disconnect</span>';
    } else {
        statusIndicator.classList.remove('connected');
        statusText.textContent = 'Disconnected';
        connectBtn.classList.add('disconnected');
        connectBtn.innerHTML = '<div class="connect-icon"></div><span>Connect</span>';
    }
}

// Send text message
function sendMessage() {
    const message = messageInput.value.trim();
    if (!message || !isConnected) return;
    
    addUserMessage(message);
    
    if (dataChannel && dataChannel.readyState === 'open') {
        dataChannel.send(JSON.stringify({ type: 'text', content: message }));
    } else {
        socket.emit('message', { to: strangerId, text: message });
    }
    
    messageInput.value = '';
    
    if (typingTimeout) clearTimeout(typingTimeout);
    isTyping = false;
    socket.emit('typing', { to: strangerId, isTyping: false });
}

// Send video chat message
function sendVideoMessage() {
    const message = videoMessageInput.value.trim();
    if (!message || !isConnected) return;
    
    addVideoUserMessage(message);
    
    if (dataChannel && dataChannel.readyState === 'open') {
        dataChannel.send(JSON.stringify({ type: 'text', content: message }));
    } else {
        socket.emit('message', { to: strangerId, text: message });
    }
    
    videoMessageInput.value = '';
}

// Send location message
function sendLocationMessage() {
    if (!isConnected) return;

    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            position => {
                const { latitude, longitude } = position.coords;
                const message = `My location: https://www.google.com/maps?q=${latitude},${longitude}`;
                
                if (currentChatType === 'text') {
                    addUserMessage(message);
                    if (dataChannel && dataChannel.readyState === 'open') {
                        dataChannel.send(JSON.stringify({ type: 'text', content: message }));
                    } else {
                        socket.emit('message', { to: strangerId, text: message });
                    }
                } else {
                    addVideoUserMessage(message);
                    if (dataChannel && dataChannel.readyState === 'open') {
                        dataChannel.send(JSON.stringify({ type: 'text', content: message }));
                    } else {
                        socket.emit('message', { to: strangerId, text: message });
                    }
                }
            },
            error => {
                console.error("Error getting location:", error);
                const errorDiv = document.createElement('div');
                errorDiv.className = 'error-message';
                errorDiv.textContent = "Could not get your location. Please check your permissions.";
                
                if (currentChatType === 'text') {
                    chatMessages.appendChild(errorDiv);
                } else {
                    videoChatMessages.appendChild(errorDiv);
                }
            }
        );
    } else {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.textContent = "Geolocation is not supported by your browser";
        
        if (currentChatType === 'text') {
            chatMessages.appendChild(errorDiv);
        } else {
            videoChatMessages.appendChild(errorDiv);
        }
    }
}

// Handle file selection
function handleFileSelect(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
        const fileData = {
            type: file.type.includes('image') ? 'image' : 'video',
            name: file.name,
            data: event.target.result
        };
        
        sendFile(fileData);
        displayFile(fileData, true);
    };
    
    if (file.type.includes('image')) {
        reader.readAsDataURL(file);
    } else if (file.type.includes('video')) {
        reader.readAsDataURL(file);
    } else {
        alert('Unsupported file type');
    }
    
    // Reset file input
    fileInput.value = '';
}

// Send file to stranger
function sendFile(fileData) {
    if (!isConnected) return;

    if (dataChannel && dataChannel.readyState === 'open') {
        dataChannel.send(JSON.stringify({ type: 'file', ...fileData }));
    } else {
        socket.emit('file', { to: strangerId, file: fileData });
    }
}

// Display file in chat
function displayFile(fileData, isUser = false) {
    const fileDiv = document.createElement('div');
    fileDiv.className = `message ${isUser ? 'user' : 'stranger'}`;
    
    const fileInfo = document.createElement('div');
    fileInfo.textContent = isUser ? 'You sent a file' : 'Stranger sent a file';
    fileDiv.appendChild(fileInfo);
    
    const fileElement = document.createElement(fileData.type === 'image' ? 'img' : 'video');
    fileElement.src = fileData.data;
    fileElement.className = 'file-preview';
    fileElement.controls = fileData.type === 'video';
    fileDiv.appendChild(fileElement);
    
    if (currentChatType === 'text') {
        chatMessages.appendChild(fileDiv);
        scrollToBottom(chatMessages);
    } else {
        videoChatMessages.appendChild(fileDiv);
        scrollToBottom(videoChatMessages);
    }
}

// Add user message to chat
function addUserMessage(text) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message user';
    messageDiv.textContent = text;
    
    // Add long press event
    messageDiv.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        showMessageMenu(messageDiv, e.clientX, e.clientY);
    });
    
    chatMessages.appendChild(messageDiv);
    scrollToBottom(chatMessages);
}

// Add stranger message to chat
function addStrangerMessage(text) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message stranger';
    messageDiv.textContent = text;
    
    // Add long press event
    messageDiv.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        showMessageMenu(messageDiv, e.clientX, e.clientY);
    });
    
    chatMessages.appendChild(messageDiv);
    scrollToBottom(chatMessages);
}

// Add system message to chat
function addSystemMessage(text) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message system';
    messageDiv.textContent = text;
    chatMessages.appendChild(messageDiv);
    scrollToBottom(chatMessages);
}

// Add typing indicator
function addTypingIndicator() {
    const typingDiv = document.createElement('div');
    typingDiv.className = 'typing-indicator';
    typingDiv.textContent = 'Stranger is typing...';
    typingDiv.id = 'typingIndicator';
    chatMessages.appendChild(typingDiv);
    scrollToBottom(chatMessages);
}

// Remove typing indicator
function removeTypingIndicator() {
    const typingDiv = document.getElementById('typingIndicator');
    if (typingDiv) typingDiv.remove();
}

// Add video user message
function addVideoUserMessage(text) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message user';
    messageDiv.textContent = text;
    
    // Add long press event
    messageDiv.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        showMessageMenu(messageDiv, e.clientX, e.clientY);
    });
    
    videoChatMessages.appendChild(messageDiv);
    scrollToBottom(videoChatMessages);
}

// Add video stranger message
function addVideoStrangerMessage(text) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message stranger';
    messageDiv.textContent = text;
    
    // Add long press event
    messageDiv.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        showMessageMenu(messageDiv, e.clientX, e.clientY);
    });
    
    videoChatMessages.appendChild(messageDiv);
    scrollToBottom(videoChatMessages);
}

// Add video system message
function addVideoSystemMessage(text) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message system';
    messageDiv.textContent = text;
    videoChatMessages.appendChild(messageDiv);
    scrollToBottom(videoChatMessages);
}

// Toggle attach menu
function toggleAttachMenu() {
    attachMenu.classList.toggle('show');
}

// Hide attach menu
function hideAttachMenu() {
    attachMenu.classList.remove('show');
}

// Toggle mute
function toggleMute() {
    if (localStream) {
        const audioTracks = localStream.getAudioTracks();
        if (audioTracks.length > 0) {
            const isMuted = audioTracks[0].enabled;
            audioTracks[0].enabled = !isMuted;
            muteBtn.textContent = isMuted ? '🔈' : '🔇';
        }
    }
}

// Toggle camera
function toggleCamera() {
    if (localStream) {
        const videoTracks = localStream.getVideoTracks();
        if (videoTracks.length > 0) {
            const isOn = videoTracks[0].enabled;
            videoTracks[0].enabled = !isOn;
            cameraBtn.textContent = isOn ? '📷' : '❌';
        }
    }
}

// End video call
function endVideoCall() {
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
        localVideo.srcObject = null;
    }
    
    if (remoteVideo.srcObject) {
        remoteVideo.srcObject.getTracks().forEach(track => track.stop());
        remoteVideo.srcObject = null;
    }
    
    disconnectFromStranger();
    addVideoSystemMessage("Video chat ended");
}

// Show message context menu
function showMessageMenu(messageElement, x, y) {
    selectedMessage = messageElement;
    messageMenu.style.left = `${x}px`;
    messageMenu.style.top = `${y}px`;
    messageMenu.classList.add('show');
}

// Hide message context menu
function hideMessageMenu() {
    messageMenu.classList.remove('show');
}

// Scroll to bottom of chat
function scrollToBottom(element) {
    element.scrollTop = element.scrollHeight;
}

// Initialize the app
init();
