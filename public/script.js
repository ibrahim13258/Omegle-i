
// Global Variables
let currentUser = null;
let posts = [];
let stories = [];
let messages = [];
let currentStoryIndex = 0;
let storyTimer = null;
let authToken = null;

// API Base URL
const API_BASE_URL = window.location.origin.includes('localhost') 
    ? 'http://localhost:5000/api' 
    : '/api';

// Initialize App
document.addEventListener('DOMContentLoaded', function() {
    // Show loading screen first
    setTimeout(() => {
        document.getElementById('loadingScreen').classList.add('hidden');
        initializeApp();
    }, 2000);
});

function initializeApp() {
    // Check if user is logged in
    const savedUser = localStorage.getItem('currentUser');
    const savedToken = localStorage.getItem('authToken');
    
    if (savedUser && savedToken) {
        currentUser = JSON.parse(savedUser);
        authToken = savedToken;
        showPage('homePage');
        loadUserProfile();
        loadPosts();
        loadStories();
        loadMessages();
    } else {
        showPage('loginPage');
    }
    
    // Initialize event listeners
    initializeEventListeners();
}

// API utility functions
async function apiRequest(endpoint, options = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    const defaultOptions = {
        headers: {
            'Content-Type': 'application/json',
            ...(authToken && { 'Authorization': `Bearer ${authToken}` })
        }
    };
    
    const mergedOptions = {
        ...defaultOptions,
        ...options,
        headers: {
            ...defaultOptions.headers,
            ...options.headers
        }
    };
    
    try {
        const response = await fetch(url, mergedOptions);
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Request failed');
        }
        
        return data;
    } catch (error) {
        throw error;
    }
}

async function uploadFile(endpoint, file, additionalData = {}) {
    const formData = new FormData();
    formData.append('image', file);
    
    Object.keys(additionalData).forEach(key => {
        formData.append(key, additionalData[key]);
    });
    
    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`
            },
            body: formData
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Upload failed');
        }
        
        return data;
    } catch (error) {
        throw error;
    }
}

function initializeEventListeners() {
    // Login Form
    document.getElementById('loginForm').addEventListener('submit', handleLogin);
    
    // Signup Form
    document.getElementById('signupForm').addEventListener('submit', handleSignup);
    
    // Profile Setup Form
    document.getElementById('profileSetupForm').addEventListener('submit', handleProfileSetup);
    
    // Forgot Password Form
    document.getElementById('forgotPasswordForm').addEventListener('submit', handleForgotPassword);
    
    // OTP Form
    document.getElementById('otpForm').addEventListener('submit', handleOTPVerification);
    
    // Bio character counter
    document.getElementById('profileBio').addEventListener('input', updateCharCount);
    
    // Profile tabs
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', () => switchProfileTab(tab.dataset.tab));
    });
    
    // Search functionality
    document.getElementById('searchInput').addEventListener('input', debounce(performSearch, 300));
    
    // Filter buttons
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => setActiveFilter(btn));
    });
    
    // Settings toggles
    document.getElementById('darkModeToggle').addEventListener('change', toggleDarkMode);
    
    // Message input
    document.getElementById('messageInput').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });
    
    // Profile picture upload
    document.getElementById('profilePictureInput').addEventListener('change', previewProfilePicture);
}

// Authentication Functions
async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    
    if (!email || !password) {
        showToast('Please fill all fields', 'error');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            authToken = data.token;
            currentUser = data.user;
            localStorage.setItem('authToken', authToken);
            localStorage.setItem('currentUser', JSON.stringify(currentUser));
            showPage('homePage');
            loadUserProfile();
            loadPosts();
            showToast('Welcome back!', 'success');
        } else {
            showToast(data.error || 'Login failed', 'error');
        }
    } catch (error) {
        showToast('Network error. Please try again.', 'error');
    }
}

async function handleSignup(e) {
    e.preventDefault();
    const formData = {
        name: document.getElementById('signupName').value,
        username: document.getElementById('signupUsername').value,
        email: document.getElementById('signupEmail').value,
        phone: document.getElementById('signupPhone').value,
        password: document.getElementById('signupPassword').value
    };
    
    // Validate fields
    if (!validateSignupForm(formData)) {
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/auth/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        });
        
        const data = await response.json();
        
        if (response.ok) {
            // Save user data temporarily for profile setup
            sessionStorage.setItem('tempUser', JSON.stringify(formData));
            showOTPModal('signup');
            showToast('Registration successful! Please verify OTP.', 'success');
        } else {
            showToast(data.error || 'Registration failed', 'error');
        }
    } catch (error) {
        showToast('Network error. Please try again.', 'error');
    }
}

function validateSignupForm(data) {
    if (!data.name || !data.username || !data.email || !data.phone || !data.password) {
        showToast('Please fill all fields', 'error');
        return false;
    }
    
    if (!isValidEmail(data.email)) {
        showToast('Please enter a valid email', 'error');
        return false;
    }
    
    if (data.password.length < 6) {
        showToast('Password must be at least 6 characters', 'error');
        return false;
    }
    
    return true;
}

function handleProfileSetup(e) {
    e.preventDefault();
    const bio = document.getElementById('profileBio').value;
    const gender = document.getElementById('profileGender').value;
    
    // Update current user
    currentUser.bio = bio;
    currentUser.gender = gender;
    currentUser.profilePicture = document.getElementById('profilePreview').src;
    
    // Save to localStorage
    localStorage.setItem('currentUser', JSON.stringify(currentUser));
    
    // Save to users array
    const users = JSON.parse(localStorage.getItem('users') || '[]');
    const userIndex = users.findIndex(u => u.email === currentUser.email);
    if (userIndex !== -1) {
        users[userIndex] = currentUser;
        localStorage.setItem('users', JSON.stringify(users));
    }
    
    showPage('homePage');
    loadUserProfile();
    loadPosts();
    showToast('Profile setup complete!', 'success');
}

function handleForgotPassword(e) {
    e.preventDefault();
    const email = document.getElementById('forgotEmail').value;
    
    if (isValidEmail(email)) {
        showOTPModal('forgot');
        closeForgotPasswordModal();
        showToast('OTP sent to your email', 'success');
    } else {
        showToast('Please enter a valid email', 'error');
    }
}

function handleOTPVerification(e) {
    e.preventDefault();
    const otpInputs = document.querySelectorAll('.otp-input');
    const otp = Array.from(otpInputs).map(input => input.value).join('');
    
    // Simulate OTP verification (in real app, this would be validated server-side)
    if (otp === '1234') {
        const tempUser = JSON.parse(sessionStorage.getItem('tempUser'));
        if (tempUser) {
            // Complete signup
            completeSignup(tempUser);
        } else {
            // Forgot password flow
            showToast('Password reset successful', 'success');
            closeOtpModal();
            showPage('loginPage');
        }
    } else {
        showToast('Invalid OTP', 'error');
    }
}

function completeSignup(userData) {
    // Create new user
    const newUser = {
        id: Date.now(),
        ...userData,
        profilePicture: '',
        bio: '',
        gender: '',
        followers: 0,
        following: 0,
        posts: 0,
        createdAt: new Date().toISOString()
    };
    
    // Save to users array
    const users = JSON.parse(localStorage.getItem('users') || '[]');
    users.push(newUser);
    localStorage.setItem('users', JSON.stringify(users));
    
    // Set as current user
    currentUser = newUser;
    localStorage.setItem('currentUser', JSON.stringify(currentUser));
    
    // Clear temp data
    sessionStorage.removeItem('tempUser');
    
    // Close modal and redirect
    closeOtpModal();
    showPage('profileSetupPage');
    
    // Pre-fill profile setup form
    document.getElementById('profileName').value = newUser.name;
    document.getElementById('profileUsername').value = newUser.username;
    
    showToast('Account created successfully!', 'success');
}

// Page Navigation
function showPage(pageId) {
    // Hide all pages
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    });
    
    // Show selected page
    document.getElementById(pageId).classList.add('active');
    
    // Update bottom navigation
    updateBottomNavigation(pageId);
}

function updateBottomNavigation(pageId) {
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });
    
    const navMap = {
        'homePage': 0,
        'searchPage': 1,
        'reelsPage': 3,
        'profilePage': 4
    };
    
    if (navMap[pageId] !== undefined) {
        document.querySelectorAll('.nav-item')[navMap[pageId]].classList.add('active');
    }
}

// User Profile Functions
function loadUserProfile() {
    if (!currentUser) return;
    
    // Update profile header
    document.getElementById('profileHeaderUsername').textContent = currentUser.username;
    
    // Update profile info
    document.getElementById('profileDisplayName').textContent = currentUser.name;
    document.getElementById('profileBioText').textContent = currentUser.bio || 'No bio yet...';
    
    // Update profile picture
    if (currentUser.profilePicture) {
        document.getElementById('profilePictureLarge').src = currentUser.profilePicture;
    }
    
    // Update stats
    document.getElementById('postsCount').textContent = currentUser.posts || 0;
    document.getElementById('followersCount').textContent = formatNumber(currentUser.followers || 0);
    document.getElementById('followingCount').textContent = formatNumber(currentUser.following || 0);
}

function editProfile() {
    showToast('Edit profile feature coming soon!', 'info');
}

function shareProfile() {
    if (navigator.share) {
        navigator.share({
            title: `${currentUser.name} (@${currentUser.username})`,
            text: `Check out ${currentUser.name}'s profile on Instronova!`,
            url: window.location.href
        });
    } else {
        // Fallback for browsers without native sharing
        navigator.clipboard.writeText(window.location.href);
        showToast('Profile link copied to clipboard!', 'success');
    }
}

// Posts Functions
async function loadPosts() {
    const postsContainer = document.getElementById('postsContainer');
    if (!postsContainer) return;
    
    try {
        const response = await fetch(`${API_BASE_URL}/posts`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        const data = await response.json();
        
        if (response.ok) {
            posts = data.posts;
            postsContainer.innerHTML = '';
            
            posts.forEach(post => {
                const postElement = createPostElement(post);
                postsContainer.appendChild(postElement);
            });
        } else {
            showToast('Failed to load posts', 'error');
        }
    } catch (error) {
        showToast('Network error loading posts', 'error');
    }
}

function createPostElement(post) {
    const postDiv = document.createElement('div');
    postDiv.className = 'post';
    postDiv.innerHTML = `
        <div class="post-header">
            <img src="${post.userAvatar}" alt="${post.username}" class="post-avatar">
            <div class="post-user-info">
                <div class="post-username">${post.username}</div>
                <div class="post-location">${post.location || ''}</div>
            </div>
            <i class="fas fa-ellipsis-h post-menu"></i>
        </div>
        <img src="${post.image}" alt="Post" class="post-image" ondblclick="likePost(${post.id})">
        <div class="post-actions">
            <button class="post-action like-btn ${post.liked ? 'liked' : ''}" onclick="likePost(${post.id})">
                <i class="fas fa-heart"></i>
            </button>
            <button class="post-action comment-btn" onclick="openComments(${post.id})">
                <i class="fas fa-comment"></i>
            </button>
            <button class="post-action share-btn" onclick="sharePost(${post.id})">
                <i class="fas fa-paper-plane"></i>
            </button>
            <button class="post-action save-btn ${post.saved ? 'saved' : ''}" onclick="savePost(${post.id})">
                <i class="fas fa-bookmark"></i>
            </button>
        </div>
        <div class="post-likes">${formatNumber(post.likes)} likes</div>
        <div class="post-caption">
            <span class="post-username-caption">${post.username}</span>
            ${post.caption}
        </div>
        <div class="post-comments">View all ${post.comments} comments</div>
        <div class="post-time">${formatTime(post.timestamp)}</div>
    `;
    return postDiv;
}

async function likePost(postId) {
    try {
        const response = await fetch(`${API_BASE_URL}/posts/${postId}/like`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        const data = await response.json();
        
        if (response.ok) {
            // Update local post data
            const postIndex = posts.findIndex(p => p.id === postId);
            if (postIndex !== -1) {
                posts[postIndex] = data.post;
            }
            
            // Update UI
            const postElement = document.querySelector(`[onclick="likePost('${postId}')"]`);
            if (postElement) {
                postElement.classList.toggle('liked', data.liked);
                
                // Update likes count
                const likesElement = postElement.closest('.post').querySelector('.post-likes');
                likesElement.textContent = `${formatNumber(data.post.likes)} likes`;
                
                // Add heart animation
                if (data.liked) {
                    showHeartAnimation(postElement);
                }
            }
        } else {
            showToast('Failed to like post', 'error');
        }
    } catch (error) {
        showToast('Network error', 'error');
    }
}

function savePost(postId) {
    const post = posts.find(p => p.id === postId);
    if (post) {
        post.saved = !post.saved;
        
        // Update UI
        const saveButton = document.querySelector(`.save-btn[onclick="savePost(${postId})"]`);
        if (saveButton) {
            saveButton.classList.toggle('saved');
        }
        
        showToast(post.saved ? 'Post saved!' : 'Post unsaved!', 'success');
    }
}

function sharePost(postId) {
    showToast('Share feature coming soon!', 'info');
}

function openComments(postId) {
    showToast('Comments feature coming soon!', 'info');
}

// Stories Functions
function loadStories() {
    // Stories are already loaded with dummy data
}

function openStoryViewer(storyId) {
    const modal = document.getElementById('storyViewerModal');
    const story = stories.find(s => s.id === storyId);
    
    if (story) {
        document.getElementById('storyUserAvatar').src = story.userAvatar;
        document.getElementById('storyUsername').textContent = story.username;
        document.getElementById('storyTime').textContent = story.time;
        document.getElementById('storyImage').src = story.image;
        
        modal.classList.add('active');
        startStoryProgress();
    }
}

function closeStoryViewer() {
    const modal = document.getElementById('storyViewerModal');
    modal.classList.remove('active');
    stopStoryProgress();
}

function startStoryProgress() {
    const progressBar = document.querySelector('.progress-bar');
    let progress = 0;
    
    storyTimer = setInterval(() => {
        progress += 2;
        progressBar.style.width = progress + '%';
        
        if (progress >= 100) {
            nextStory();
        }
    }, 100);
}

function stopStoryProgress() {
    if (storyTimer) {
        clearInterval(storyTimer);
        storyTimer = null;
    }
}

function nextStory() {
    stopStoryProgress();
    currentStoryIndex++;
    
    if (currentStoryIndex < stories.length) {
        openStoryViewer(stories[currentStoryIndex].id);
    } else {
        closeStoryViewer();
        currentStoryIndex = 0;
    }
}

function previousStory() {
    stopStoryProgress();
    currentStoryIndex--;
    
    if (currentStoryIndex >= 0) {
        openStoryViewer(stories[currentStoryIndex].id);
    } else {
        currentStoryIndex = 0;
        startStoryProgress();
    }
}

function openCreateStory() {
    showToast('Create story feature coming soon!', 'info');
}

// Search Functions
function performSearch() {
    const query = document.getElementById('searchInput').value.toLowerCase();
    const resultsContainer = document.getElementById('searchResults');
    
    if (!query) {
        loadTrendingPosts();
        return;
    }
    
    // Simulate search results
    const searchResults = {
        users: [
            { id: 1, username: 'john_doe', name: 'John Doe', avatar: 'https://picsum.photos/50/50?random=1' },
            { id: 2, username: 'jane_smith', name: 'Jane Smith', avatar: 'https://picsum.photos/50/50?random=2' }
        ],
        posts: posts.filter(post => 
            post.caption.toLowerCase().includes(query) ||
            post.username.toLowerCase().includes(query)
        ),
        hashtags: ['#instronova', '#social', '#media', '#trending']
    };
    
    displaySearchResults(searchResults);
}

function displaySearchResults(results) {
    const container = document.getElementById('searchResults');
    container.innerHTML = `
        <div class="search-results-section">
            <h3>Users</h3>
            ${results.users.map(user => `
                <div class="search-result-item user-result">
                    <img src="${user.avatar}" alt="${user.username}">
                    <div>
                        <div class="username">${user.username}</div>
                        <div class="name">${user.name}</div>
                    </div>
                </div>
            `).join('')}
        </div>
        <div class="search-results-section">
            <h3>Posts</h3>
            <div class="search-posts-grid">
                ${results.posts.map(post => `
                    <div class="search-post-item">
                        <img src="${post.image}" alt="Post">
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

function loadTrendingPosts() {
    const trendingGrid = document.getElementById('trendingGrid');
    if (!trendingGrid) return;
    
    trendingGrid.innerHTML = '';
    
    // Create trending posts from existing posts
    posts.slice(0, 9).forEach(post => {
        const trendingItem = document.createElement('div');
        trendingItem.className = 'trending-item';
        trendingItem.innerHTML = `<img src="${post.image}" alt="Trending Post">`;
        trendingItem.onclick = () => openPost(post.id);
        trendingGrid.appendChild(trendingItem);
    });
}

function setActiveFilter(button) {
    document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
    button.classList.add('active');
    
    const filter = button.dataset.filter;
    // Implement filter logic here
    showToast(`Filtering by: ${filter}`, 'info');
}

// Messages Functions
function loadMessages() {
    const chatsList = document.getElementById('chatsList');
    if (!chatsList) return;
    
    chatsList.innerHTML = '';
    
    messages.forEach(chat => {
        const chatElement = createChatElement(chat);
        chatsList.appendChild(chatElement);
    });
}

function createChatElement(chat) {
    const chatDiv = document.createElement('div');
    chatDiv.className = 'chat-item';
    chatDiv.onclick = () => openChat(chat.id);
    chatDiv.innerHTML = `
        <img src="${chat.avatar}" alt="${chat.username}" class="chat-avatar">
        <div class="chat-info">
            <div class="chat-username">${chat.username}</div>
            <div class="chat-last-message">${chat.lastMessage}</div>
        </div>
        <div class="chat-meta">
            <div class="chat-time">${chat.time}</div>
            <div class="chat-status">${chat.status}</div>
        </div>
    `;
    return chatDiv;
}

function openChat(chatId) {
    const chat = messages.find(c => c.id === chatId);
    if (chat) {
        document.getElementById('chatUserAvatar').src = chat.avatar;
        document.getElementById('chatUsername').textContent = chat.username;
        document.getElementById('chatUserStatus').textContent = chat.online ? 'Active now' : 'Last seen recently';
        
        loadChatMessages(chatId);
        document.getElementById('chatModal').classList.add('active');
    }
}

function closeChatModal() {
    document.getElementById('chatModal').classList.remove('active');
}

function loadChatMessages(chatId) {
    const messagesContainer = document.getElementById('chatMessages');
    messagesContainer.innerHTML = '';
    
    // Load existing messages for this chat
    const chatMessages = [
        { id: 1, text: 'Hey! How are you?', sent: false, time: '10:30 AM' },
        { id: 2, text: 'I\'m good, thanks! How about you?', sent: true, time: '10:32 AM' },
        { id: 3, text: 'Doing great! Want to catch up later?', sent: false, time: '10:35 AM' },
        { id: 4, text: 'Sure! Let\'s meet at 6 PM', sent: true, time: '10:37 AM' }
    ];
    
    chatMessages.forEach(message => {
        const messageElement = createMessageElement(message);
        messagesContainer.appendChild(messageElement);
    });
    
    // Scroll to bottom
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function createMessageElement(message) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${message.sent ? 'sent' : 'received'}`;
    messageDiv.innerHTML = `
        <div class="message-bubble">${message.text}</div>
        <div class="message-time">${message.time}</div>
    `;
    return messageDiv;
}

function sendMessage() {
    const input = document.getElementById('messageInput');
    const text = input.value.trim();
    
    if (text) {
        const message = {
            id: Date.now(),
            text: text,
            sent: true,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        
        const messageElement = createMessageElement(message);
        document.getElementById('chatMessages').appendChild(messageElement);
        
        // Clear input
        input.value = '';
        
        // Scroll to bottom
        const container = document.getElementById('chatMessages');
        container.scrollTop = container.scrollHeight;
        
        // Simulate response after 2 seconds
        setTimeout(() => {
            const response = {
                id: Date.now(),
                text: 'Thanks for your message!',
                sent: false,
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            };
            
            const responseElement = createMessageElement(response);
            document.getElementById('chatMessages').appendChild(responseElement);
            container.scrollTop = container.scrollHeight;
        }, 2000);
    }
}

function openNewMessage() {
    showToast('New message feature coming soon!', 'info');
}

// Reels Functions
function loadReels() {
    const reelsContainer = document.getElementById('reelsContainer');
    if (!reelsContainer) return;
    
    // Create dummy reels
    const reels = [
        { id: 1, video: 'https://example.com/reel1.mp4', username: 'john_doe', likes: 1234, comments: 89 },
        { id: 2, video: 'https://example.com/reel2.mp4', username: 'jane_smith', likes: 2345, comments: 156 },
        { id: 3, video: 'https://example.com/reel3.mp4', username: 'mike_wilson', likes: 3456, comments: 234 }
    ];
    
    reelsContainer.innerHTML = '';
    
    reels.forEach(reel => {
        const reelElement = createReelElement(reel);
        reelsContainer.appendChild(reelElement);
    });
}

function createReelElement(reel) {
    const reelDiv = document.createElement('div');
    reelDiv.className = 'reel';
    reelDiv.innerHTML = `
        <video src="${reel.video}" loop muted></video>
        <div class="reel-overlay">
            <div class="reel-info">
                <div class="reel-username">@${reel.username}</div>
                <div class="reel-caption">Amazing reel content!</div>
            </div>
        </div>
        <div class="reel-actions">
            <button class="reel-action like-btn">
                <i class="fas fa-heart"></i>
                <span>${formatNumber(reel.likes)}</span>
            </button>
            <button class="reel-action comment-btn">
                <i class="fas fa-comment"></i>
                <span>${reel.comments}</span>
            </button>
            <button class="reel-action share-btn">
                <i class="fas fa-share"></i>
            </button>
            <button class="reel-action save-btn">
                <i class="fas fa-bookmark"></i>
            </button>
        </div>
    `;
    return reelDiv;
}

// Create Post Functions
function openCreatePost() {
    document.getElementById('createPostModal').classList.add('active');
}

function closeCreatePostModal() {
    document.getElementById('createPostModal').classList.remove('active');
}

function selectPostType(type) {
    closeCreatePostModal();
    
    switch(type) {
        case 'post':
            showToast('Create post feature coming soon!', 'info');
            break;
        case 'reel':
            showToast('Create reel feature coming soon!', 'info');
            break;
        case 'story':
            showToast('Create story feature coming soon!', 'info');
            break;
    }
}

// Modal Functions
function openForgotPasswordModal() {
    document.getElementById('forgotPasswordModal').classList.add('active');
}

function closeForgotPasswordModal() {
    document.getElementById('forgotPasswordModal').classList.remove('active');
}

function showOTPModal(type) {
    document.getElementById('otpModal').classList.add('active');
    startOTPTimer();
}

function closeOtpModal() {
    document.getElementById('otpModal').classList.remove('active');
    stopOTPTimer();
}

function startOTPTimer() {
    let timeLeft = 30;
    const timerElement = document.getElementById('otpTimer');
    
    const timer = setInterval(() => {
        timeLeft--;
        timerElement.textContent = timeLeft;
        
        if (timeLeft <= 0) {
            clearInterval(timer);
            showToast('OTP expired. Please request a new one.', 'error');
            closeOtpModal();
        }
    }, 1000);
}

function stopOTPTimer() {
    // Timer is cleared automatically when modal closes
}

// Notifications
function openNotifications() {
    showToast('Notifications feature coming soon!', 'info');
}

// Settings Functions
function toggleDarkMode() {
    const isDark = document.getElementById('darkModeToggle').checked;
    document.body.classList.toggle('dark-mode', isDark);
    localStorage.setItem('darkMode', isDark);
}

function changePassword() {
    showToast('Change password feature coming soon!', 'info');
}

function deactivateAccount() {
    if (confirm('Are you sure you want to deactivate your account?')) {
        showToast('Account deactivated', 'success');
        // In real app, this would call an API
    }
}

function deleteAccount() {
    if (confirm('Are you sure you want to permanently delete your account? This action cannot be undone.')) {
        // Clear user data
        localStorage.removeItem('currentUser');
        showToast('Account deleted', 'success');
        showPage('loginPage');
    }
}

function switchProfileTab(tab) {
    // Update active tab
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelector(`[data-tab="${tab}"]`).classList.add('active');
    
    // Load content for selected tab
    const contentContainer = document.getElementById('profileContent');
    
    switch(tab) {
        case 'posts':
            loadProfilePosts();
            break;
        case 'reels':
            loadProfileReels();
            break;
        case 'tagged':
            loadTaggedPosts();
            break;
    }
}

function loadProfilePosts() {
    const container = document.getElementById('profileContent');
    container.innerHTML = `
        <div class="profile-posts-grid">
            ${posts.slice(0, 6).map(post => `
                <div class="profile-post-item">
                    <img src="${post.image}" alt="Post">
                    <div class="post-overlay">
                        <div class="post-stats">
                            <span><i class="fas fa-heart"></i> ${formatNumber(post.likes)}</span>
                            <span><i class="fas fa-comment"></i> ${post.comments}</span>
                        </div>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

function loadProfileReels() {
    const container = document.getElementById('profileContent');
    container.innerHTML = `
        <div class="profile-reels-grid">
            <div class="empty-state">
                <i class="fas fa-video"></i>
                <p>No reels yet</p>
            </div>
        </div>
    `;
}

function loadTaggedPosts() {
    const container = document.getElementById('profileContent');
    container.innerHTML = `
        <div class="profile-tagged-grid">
            <div class="empty-state">
                <i class="fas fa-user-tag"></i>
                <p>No tagged posts yet</p>
            </div>
        </div>
    `;
}

// Utility Functions
function togglePassword(inputId) {
    const input = document.getElementById(inputId);
    const icon = input.nextElementSibling;
    
    if (input.type === 'password') {
        input.type = 'text';
        icon.classList.remove('fa-eye');
        icon.classList.add('fa-eye-slash');
    } else {
        input.type = 'password';
        icon.classList.remove('fa-eye-slash');
        icon.classList.add('fa-eye');
    }
}

function updateCharCount() {
    const bio = document.getElementById('profileBio');
    const counter = document.querySelector('.char-count');
    counter.textContent = `${bio.value.length}/150`;
}

function previewProfilePicture(input) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) {
            document.getElementById('profilePreview').src = e.target.result;
        };
        reader.readAsDataURL(input.files[0]);
    }
}

function moveToNext(current, index) {
    if (current.value.length === 1) {
        const nextInput = current.parentElement.children[index + 1];
        if (nextInput) {
            nextInput.focus();
        }
    }
}

function formatNumber(num) {
    if (num >= 1000000) {
        return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
        return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
}

function formatTime(timestamp) {
    const now = new Date();
    const postTime = new Date(timestamp);
    const diffInSeconds = Math.floor((now - postTime) / 1000);
    
    if (diffInSeconds < 60) {
        return 'Just now';
    } else if (diffInSeconds < 3600) {
        return `${Math.floor(diffInSeconds / 60)}m`;
    } else if (diffInSeconds < 86400) {
        return `${Math.floor(diffInSeconds / 3600)}h`;
    } else {
        return `${Math.floor(diffInSeconds / 86400)}d`;
    }
}

function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function showToast(message, type = 'info') {
    // Create toast element
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
        <div class="toast-content">
            <i class="fas fa-${getToastIcon(type)}"></i>
            <span>${message}</span>
        </div>
    `;
    
    // Add to body
    document.body.appendChild(toast);
    
    // Show toast
    setTimeout(() => toast.classList.add('show'), 100);
    
    // Remove toast after 3 seconds
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => document.body.removeChild(toast), 300);
    }, 3000);
}

function getToastIcon(type) {
    const icons = {
        success: 'check-circle',
        error: 'exclamation-circle',
        warning: 'exclamation-triangle',
        info: 'info-circle'
    };
    return icons[type] || 'info-circle';
}

function showHeartAnimation(element) {
    const heart = document.createElement('div');
    heart.innerHTML = '❤️';
    heart.style.cssText = `
        position: absolute;
        font-size: 2rem;
        pointer-events: none;
        animation: heartFloat 1s ease-out forwards;
        z-index: 1000;
    `;
    
    const rect = element.getBoundingClientRect();
    heart.style.left = rect.left + rect.width / 2 + 'px';
    heart.style.top = rect.top + rect.height / 2 + 'px';
    
    document.body.appendChild(heart);
    
    setTimeout(() => {
        if (heart.parentNode) {
            heart.parentNode.removeChild(heart);
        }
    }, 1000);
}

function openPost(postId) {
    showToast('Full post view coming soon!', 'info');
}

// Generate Dummy Data
function generateDummyData() {
    // Generate dummy posts
    posts = [
        {
            id: 1,
            username: 'john_doe',
            userAvatar: 'https://picsum.photos/40/40?random=1',
            image: 'https://picsum.photos/400/400?random=1',
            caption: 'Beautiful sunset today! 🌅 #nature #sunset #photography',
            likes: 1234,
            comments: 89,
            liked: false,
            saved: false,
            timestamp: new Date(Date.now() - 3600000).toISOString(),
            location: 'New York, NY'
        },
        {
            id: 2,
            username: 'jane_smith',
            userAvatar: 'https://picsum.photos/40/40?random=2',
            image: 'https://picsum.photos/400/400?random=2',
            caption: 'Coffee and good vibes ☕️ #coffee #morning #mood',
            likes: 2345,
            comments: 156,
            liked: true,
            saved: false,
            timestamp: new Date(Date.now() - 7200000).toISOString(),
            location: 'Los Angeles, CA'
        },
        {
            id: 3,
            username: 'mike_wilson',
            userAvatar: 'https://picsum.photos/40/40?random=3',
            image: 'https://picsum.photos/400/400?random=3',
            caption: 'Weekend adventures! 🏔️ #hiking #adventure #outdoors',
            likes: 3456,
            comments: 234,
            liked: false,
            saved: true,
            timestamp: new Date(Date.now() - 10800000).toISOString(),
            location: 'Colorado, USA'
        },
        {
            id: 4,
            username: 'sarah_jones',
            userAvatar: 'https://picsum.photos/40/40?random=4',
            image: 'https://picsum.photos/400/400?random=4',
            caption: 'New recipe turned out amazing! 🍝 #cooking #food #homemade',
            likes: 987,
            comments: 67,
            liked: false,
            saved: false,
            timestamp: new Date(Date.now() - 14400000).toISOString(),
            location: 'Chicago, IL'
        },
        {
            id: 5,
            username: 'alex_brown',
            userAvatar: 'https://picsum.photos/40/40?random=5',
            image: 'https://picsum.photos/400/400?random=5',
            caption: 'Working on something exciting! 💻 #coding #development #tech',
            likes: 1876,
            comments: 123,
            liked: true,
            saved: true,
            timestamp: new Date(Date.now() - 18000000).toISOString(),
            location: 'San Francisco, CA'
        }
    ];
    
    // Generate dummy stories
    stories = [
        {
            id: 1,
            username: 'john_doe',
            userAvatar: 'https://picsum.photos/60/60?random=1',
            image: 'https://picsum.photos/300/500?random=1',
            time: '2h'
        },
        {
            id: 2,
            username: 'jane_smith',
            userAvatar: 'https://picsum.photos/60/60?random=2',
            image: 'https://picsum.photos/300/500?random=2',
            time: '4h'
        },
        {
            id: 3,
            username: 'mike_wilson',
            userAvatar: 'https://picsum.photos/60/60?random=3',
            image: 'https://picsum.photos/300/500?random=3',
            time: '6h'
        }
    ];
    
    // Generate dummy messages
    messages = [
        {
            id: 1,
            username: 'john_doe',
            avatar: 'https://picsum.photos/50/50?random=1',
            lastMessage: 'Hey! How are you doing?',
            time: '2m',
            status: 'Delivered',
            online: true
        },
        {
            id: 2,
            username: 'jane_smith',
            avatar: 'https://picsum.photos/50/50?random=2',
            lastMessage: 'Thanks for the recommendation!',
            time: '1h',
            status: 'Seen',
            online: false
        },
        {
            id: 3,
            username: 'mike_wilson',
            avatar: 'https://picsum.photos/50/50?random=3',
            lastMessage: 'Let\'s catch up soon',
            time: '3h',
            status: 'Delivered',
            online: true
        },
        {
            id: 4,
            username: 'sarah_jones',
            avatar: 'https://picsum.photos/50/50?random=4',
            lastMessage: 'Great photo!',
            time: '1d',
            status: 'Seen',
            online: false
        }
    ];
    
    // Load trending posts after generating data
    setTimeout(() => {
        loadTrendingPosts();
    }, 100);
}

// Add CSS for toast notifications and animations
const additionalCSS = `
/* Toast Notifications */
.toast {
    position: fixed;
    top: 20px;
    right: 20px;
    background: var(--card-bg);
    color: var(--text-primary);
    padding: 1rem 1.5rem;
    border-radius: 12px;
    box-shadow: var(--shadow);
    transform: translateX(100%);
    transition: transform 0.3s ease;
    z-index: 10000;
    border-left: 4px solid var(--accent-color);
}

.toast.show {
    transform: translateX(0);
}

.toast-success {
    border-left-color: var(--success-color);
}

.toast-error {
    border-left-color: var(--danger-color);
}

.toast-warning {
    border-left-color: #F59E0B;
}

.toast-content {
    display: flex;
    align-items: center;
    gap: 0.5rem;
}

/* Heart Animation */
@keyframes heartFloat {
    0% {
        transform: translateY(0) scale(1);
        opacity: 1;
    }
    100% {
        transform: translateY(-100px) scale(1.5);
        opacity: 0;
    }
}

/* Profile Posts Grid */
.profile-posts-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 2px;
}

.profile-post-item {
    aspect-ratio: 1;
    position: relative;
    overflow: hidden;
    cursor: pointer;
}

.profile-post-item img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    transition: transform 0.3s ease;
}

.profile-post-item:hover img {
    transform: scale(1.05);
}

.post-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0;
    transition: opacity 0.3s ease;
}

.profile-post-item:hover .post-overlay {
    opacity: 1;
}

.post-stats {
    display: flex;
    gap: 1rem;
    color: white;
    font-weight: 600;
}

.post-stats span {
    display: flex;
    align-items: center;
    gap: 0.25rem;
}

/* Empty State */
.empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 3rem;
    text-align: center;
    color: var(--text-secondary);
}

.empty-state i {
    font-size: 3rem;
    margin-bottom: 1rem;
    opacity: 0.5;
}

/* Search Results */
.search-results-section {
    margin-bottom: 2rem;
}

.search-results-section h3 {
    padding: 0 1rem 1rem;
    color: var(--text-primary);
    border-bottom: 1px solid var(--border-color);
    margin-bottom: 1rem;
}

.user-result {
    display: flex;
    align-items: center;
    padding: 1rem;
    gap: 1rem;
    cursor: pointer;
    transition: background 0.3s ease;
}

.user-result:hover {
    background: var(--card-bg);
}

.user-result img {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    object-fit: cover;
}

.user-result .username {
    font-weight: 600;
    color: var(--text-primary);
}

.user-result .name {
    color: var(--text-secondary);
    font-size: 0.9rem;
}

.search-posts-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 2px;
    padding: 0 1rem;
}

.search-post-item {
    aspect-ratio: 1;
    cursor: pointer;
    overflow: hidden;
}

.search-post-item img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    transition: transform 0.3s ease;
}

.search-post-item:hover img {
    transform: scale(1.05);
}
`;

// Add the additional CSS to the document
const styleSheet = document.createElement('style');
styleSheet.textContent = additionalCSS;
document.head.appendChild(styleSheet);

// Initialize the app when DOM is loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    initializeApp();
}
