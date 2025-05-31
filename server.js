 const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = 'instronova_secret_key_2024';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));

// Create uploads directory if it doesn't exist
if (!fs.existsSync('uploads')) {
    fs.mkdirSync('uploads');
}

// In-memory data storage (in production, use a database)
let users = [];
let posts = [];
let stories = [];
let messages = [];
let notifications = [];

// OTP storage (in production, use Redis or database with TTL)
let otpStore = new Map(); // { phoneNumber: { otp, expiresAt, attempts } }

// Fast2SMS Configuration (you'll need to set these in Replit Secrets)
const FAST2SMS_API_KEY = process.env.FAST2SMS_API_KEY || '';
const FAST2SMS_SENDER_ID = process.env.FAST2SMS_SENDER_ID || 'INSTRONOVA';

// Multer configuration for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage: storage,
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image and video files are allowed'));
        }
    },
    limits: {
        fileSize: 50 * 1024 * 1024 // 50MB limit
    }
});

// Authentication middleware
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid token' });
        }
        req.user = user;
        next();
    });
};

// Utility functions
const generateId = () => Date.now() + Math.random().toString(36).substr(2, 9);

const formatUser = (user) => {
    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword;
};

// OTP utility functions
const generateOTP = () => {
    return Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit OTP
};

const isValidPhoneNumber = (phone) => {
    // Indian phone number validation (10 digits)
    const phoneRegex = /^[6-9]\d{9}$/;
    return phoneRegex.test(phone.replace(/\D/g, ''));
};

const cleanupExpiredOTPs = () => {
    const now = new Date();
    for (const [phone, data] of otpStore.entries()) {
        if (now > data.expiresAt) {
            otpStore.delete(phone);
        }
    }
};

// Send SMS using Fast2SMS
const sendSMS = async (phone, message) => {
    if (!FAST2SMS_API_KEY) {
        // For development/testing without API key
        console.log(`SMS to ${phone}: ${message}`);
        return { success: true, message: 'SMS sent (dev mode)' };
    }

    try {
        const response = await fetch('https://www.fast2sms.com/dev/bulkV2', {
            method: 'POST',
            headers: {
                'authorization': FAST2SMS_API_KEY,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                route: 'v3',
                sender_id: FAST2SMS_SENDER_ID,
                message: message,
                language: 'english',
                flash: 0,
                numbers: phone
            })
        });

        const data = await response.json();
        
        if (data.return === true) {
            return { success: true, message: 'SMS sent successfully' };
        } else {
            throw new Error(data.message || 'Failed to send SMS');
        }
    } catch (error) {
        console.error('SMS Error:', error);
        return { success: false, error: error.message };
    }
};

// Initialize with dummy data
const initializeDummyData = () => {
    // Create dummy users
    const dummyUsers = [
        {
            id: 'user1',
            name: 'John Doe',
            username: 'john_doe',
            email: 'john@example.com',
            password: bcrypt.hashSync('password123', 10),
            phone: '+1234567890',
            bio: 'Photography enthusiast 📸',
            gender: 'male',
            profilePicture: 'https://picsum.photos/200/200?random=1',
            followers: 1234,
            following: 567,
            posts: 89,
            isPrivate: false,
            createdAt: new Date().toISOString()
        },
        {
            id: 'user2',
            name: 'Jane Smith',
            username: 'jane_smith',
            email: 'jane@example.com',
            password: bcrypt.hashSync('password123', 10),
            phone: '+1234567891',
            bio: 'Coffee lover ☕ | Travel addict ✈️',
            gender: 'female',
            profilePicture: 'https://picsum.photos/200/200?random=2',
            followers: 2345,
            following: 678,
            posts: 156,
            isPrivate: false,
            createdAt: new Date().toISOString()
        }
    ];

    users = [...dummyUsers];

    // Create dummy posts
    const dummyPosts = [
        {
            id: 'post1',
            userId: 'user1',
            username: 'john_doe',
            userAvatar: 'https://picsum.photos/40/40?random=1',
            image: 'https://picsum.photos/400/400?random=1',
            caption: 'Beautiful sunset today! 🌅 #nature #sunset #photography',
            likes: 1234,
            comments: 89,
            likedBy: [],
            savedBy: [],
            location: 'New York, NY',
            timestamp: new Date(Date.now() - 3600000).toISOString()
        },
        {
            id: 'post2',
            userId: 'user2',
            username: 'jane_smith',
            userAvatar: 'https://picsum.photos/40/40?random=2',
            image: 'https://picsum.photos/400/400?random=2',
            caption: 'Coffee and good vibes ☕️ #coffee #morning #mood',
            likes: 2345,
            comments: 156,
            likedBy: [],
            savedBy: [],
            location: 'Los Angeles, CA',
            timestamp: new Date(Date.now() - 7200000).toISOString()
        }
    ];

    posts = [...dummyPosts];

    // Create dummy stories
    const dummyStories = [
        {
            id: 'story1',
            userId: 'user1',
            username: 'john_doe',
            userAvatar: 'https://picsum.photos/60/60?random=1',
            image: 'https://picsum.photos/300/500?random=1',
            timestamp: new Date(Date.now() - 7200000).toISOString(),
            expiresAt: new Date(Date.now() + 86400000).toISOString()
        }
    ];

    stories = [...dummyStories];

    // Create dummy messages
    const dummyMessages = [
        {
            id: 'msg1',
            senderId: 'user1',
            receiverId: 'user2',
            text: 'Hey! How are you doing?',
            timestamp: new Date(Date.now() - 120000).toISOString(),
            status: 'delivered'
        }
    ];

    messages = [...dummyMessages];
};

// API Routes

// Authentication Routes

// Check username availability
app.post('/api/auth/check-username', (req, res) => {
    try {
        const { username } = req.body;
        
        if (!username) {
            return res.status(400).json({ error: 'Username is required' });
        }
        
        // Check if username is valid format
        const usernameRegex = /^[a-z0-9_]+$/;
        if (!usernameRegex.test(username) || username.length < 3 || username.length > 20) {
            return res.status(400).json({ 
                error: 'Username must be 3-20 characters long and contain only lowercase letters, numbers, and underscores',
                available: false 
            });
        }
        
        // Check if username already exists
        const existingUser = users.find(u => u.username.toLowerCase() === username.toLowerCase());
        
        if (existingUser) {
            return res.json({ 
                available: false, 
                error: 'Username already taken, please choose another' 
            });
        }
        
        res.json({ available: true, message: 'Username is available' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/auth/register', async (req, res) => {
    try {
        const { name, username, email, phone, password } = req.body;

        // Validate input
        if (!name || !username || !email || !phone || !password) {
            return res.status(400).json({ error: 'All fields are required' });
        }

        // Check if user already exists
        const existingUser = users.find(u => u.email === email || u.username === username);
        if (existingUser) {
            return res.status(400).json({ error: 'User already exists' });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create new user
        const newUser = {
            id: generateId(),
            name,
            username,
            email,
            phone,
            password: hashedPassword,
            bio: '',
            gender: '',
            profilePicture: '',
            followers: 0,
            following: 0,
            posts: 0,
            isPrivate: false,
            createdAt: new Date().toISOString()
        };

        users.push(newUser);

        // Generate JWT token
        const token = jwt.sign({ userId: newUser.id }, JWT_SECRET, { expiresIn: '7d' });

        res.status(201).json({
            message: 'User registered successfully',
            token,
            user: formatUser(newUser)
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        // Find user
        const user = users.find(u => u.email === email || u.username === email);
        if (!user) {
            return res.status(400).json({ error: 'Invalid credentials' });
        }

        // Check password
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(400).json({ error: 'Invalid credentials' });
        }

        // Generate JWT token
        const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });

        res.json({
            message: 'Login successful',
            token,
            user: formatUser(user)
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/auth/forgot-password', (req, res) => {
    const { email } = req.body;
    
    const user = users.find(u => u.email === email);
    if (!user) {
        return res.status(404).json({ error: 'User not found' });
    }

    // In a real app, send email with OTP
    res.json({ message: 'OTP sent to your email', otp: '1234' });
});

app.post('/api/auth/verify-otp', (req, res) => {
    const { email, otp } = req.body;
    
    // Simple OTP verification (in real app, verify against stored OTP)
    if (otp === '1234') {
        res.json({ message: 'OTP verified successfully' });
    } else {
        res.status(400).json({ error: 'Invalid OTP' });
    }
});

// OTP Routes
app.post('/api/send-otp', async (req, res) => {
    try {
        const { phone } = req.body;

        if (!phone) {
            return res.status(400).json({ error: 'Phone number is required' });
        }

        // Clean phone number (remove spaces, special characters)
        const cleanPhone = phone.replace(/\D/g, '');

        if (!isValidPhoneNumber(cleanPhone)) {
            return res.status(400).json({ error: 'Invalid phone number format' });
        }

        // Clean up expired OTPs
        cleanupExpiredOTPs();

        // Check if OTP was recently sent (rate limiting)
        const existingOTP = otpStore.get(cleanPhone);
        if (existingOTP) {
            const timeDiff = new Date() - new Date(existingOTP.sentAt);
            if (timeDiff < 60000) { // 1 minute cooldown
                return res.status(429).json({ 
                    error: 'Please wait before requesting another OTP',
                    remainingTime: Math.ceil((60000 - timeDiff) / 1000)
                });
            }
        }

        // Generate new OTP
        const otp = generateOTP();
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
        const sentAt = new Date();

        // Store OTP
        otpStore.set(cleanPhone, {
            otp,
            expiresAt,
            sentAt,
            attempts: 0,
            verified: false
        });

        // Create SMS message
        const message = `Your Instronova verification code is: ${otp}. Valid for 5 minutes. Do not share this code.`;

        // Send SMS
        const smsResult = await sendSMS(cleanPhone, message);

        if (smsResult.success) {
            res.json({
                message: 'OTP sent successfully',
                phone: cleanPhone,
                expiresIn: 300 // 5 minutes in seconds
            });
        } else {
            // Remove OTP from store if SMS failed
            otpStore.delete(cleanPhone);
            res.status(500).json({ error: 'Failed to send OTP. Please try again.' });
        }

    } catch (error) {
        console.error('Send OTP Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.post('/api/verify-otp', (req, res) => {
    try {
        const { phone, otp } = req.body;

        if (!phone || !otp) {
            return res.status(400).json({ error: 'Phone number and OTP are required' });
        }

        // Clean phone number
        const cleanPhone = phone.replace(/\D/g, '');

        if (!isValidPhoneNumber(cleanPhone)) {
            return res.status(400).json({ error: 'Invalid phone number format' });
        }

        // Clean up expired OTPs
        cleanupExpiredOTPs();

        // Get stored OTP
        const storedOTPData = otpStore.get(cleanPhone);

        if (!storedOTPData) {
            return res.status(400).json({ error: 'OTP not found or expired. Please request a new one.' });
        }

        // Check if OTP is expired
        if (new Date() > storedOTPData.expiresAt) {
            otpStore.delete(cleanPhone);
            return res.status(400).json({ error: 'OTP has expired. Please request a new one.' });
        }

        // Check if already verified
        if (storedOTPData.verified) {
            return res.status(400).json({ error: 'OTP already used. Please request a new one.' });
        }

        // Check attempts limit
        if (storedOTPData.attempts >= 3) {
            otpStore.delete(cleanPhone);
            return res.status(400).json({ error: 'Too many incorrect attempts. Please request a new OTP.' });
        }

        // Verify OTP
        if (storedOTPData.otp === otp.toString()) {
            // Mark as verified
            storedOTPData.verified = true;
            storedOTPData.verifiedAt = new Date();
            otpStore.set(cleanPhone, storedOTPData);

            res.json({
                message: 'OTP verified successfully',
                phone: cleanPhone,
                verified: true
            });
        } else {
            // Increment attempts
            storedOTPData.attempts += 1;
            otpStore.set(cleanPhone, storedOTPData);

            res.status(400).json({
                error: 'Invalid OTP',
                attemptsRemaining: 3 - storedOTPData.attempts
            });
        }

    } catch (error) {
        console.error('Verify OTP Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get OTP status (for debugging/development)
app.get('/api/otp-status/:phone', (req, res) => {
    const { phone } = req.params;
    const cleanPhone = phone.replace(/\D/g, '');
    
    const otpData = otpStore.get(cleanPhone);
    
    if (!otpData) {
        return res.json({ exists: false });
    }

    res.json({
        exists: true,
        verified: otpData.verified,
        attempts: otpData.attempts,
        expiresAt: otpData.expiresAt,
        expired: new Date() > otpData.expiresAt
    });
});

// User Routes
app.get('/api/user/profile', authenticateToken, (req, res) => {
    const user = users.find(u => u.id === req.user.userId);
    if (!user) {
        return res.status(404).json({ error: 'User not found' });
    }
    res.json(formatUser(user));
});

app.put('/api/user/profile', authenticateToken, upload.single('profilePicture'), (req, res) => {
    try {
        const userIndex = users.findIndex(u => u.id === req.user.userId);
        if (userIndex === -1) {
            return res.status(404).json({ error: 'User not found' });
        }

        const { name, bio, gender } = req.body;
        const updates = {};

        if (name) updates.name = name;
        if (bio) updates.bio = bio;
        if (gender) updates.gender = gender;
        if (req.file) updates.profilePicture = `/uploads/${req.file.filename}`;

        users[userIndex] = { ...users[userIndex], ...updates };

        res.json({
            message: 'Profile updated successfully',
            user: formatUser(users[userIndex])
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/user/search', authenticateToken, (req, res) => {
    const { q } = req.query;
    
    if (!q) {
        return res.json({ users: [], posts: [], hashtags: [] });
    }

    const searchQuery = q.toLowerCase();
    
    const foundUsers = users
        .filter(u => 
            u.username.toLowerCase().includes(searchQuery) ||
            u.name.toLowerCase().includes(searchQuery)
        )
        .map(formatUser);

    const foundPosts = posts.filter(p =>
        p.caption.toLowerCase().includes(searchQuery) ||
        p.username.toLowerCase().includes(searchQuery)
    );

    const hashtags = ['#instronova', '#social', '#media', '#trending']
        .filter(tag => tag.includes(searchQuery));

    res.json({
        users: foundUsers,
        posts: foundPosts,
        hashtags
    });
});

// Posts Routes
app.get('/api/posts', authenticateToken, (req, res) => {
    const { page = 1, limit = 10 } = req.query;
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + parseInt(limit);

    const paginatedPosts = posts
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        .slice(startIndex, endIndex);

    res.json({
        posts: paginatedPosts,
        hasMore: endIndex < posts.length
    });
});

app.post('/api/posts', authenticateToken, upload.single('image'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'Image is required' });
        }

        const user = users.find(u => u.id === req.user.userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const { caption, location } = req.body;

        const newPost = {
            id: generateId(),
            userId: user.id,
            username: user.username,
            userAvatar: user.profilePicture || 'https://picsum.photos/40/40?random=1',
            image: `/uploads/${req.file.filename}`,
            caption: caption || '',
            location: location || '',
            likes: 0,
            comments: 0,
            likedBy: [],
            savedBy: [],
            timestamp: new Date().toISOString()
        };

        posts.unshift(newPost);
        
        // Update user's post count
        const userIndex = users.findIndex(u => u.id === user.id);
        users[userIndex].posts += 1;

        res.status(201).json({
            message: 'Post created successfully',
            post: newPost
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/posts/:postId/like', authenticateToken, (req, res) => {
    const { postId } = req.params;
    const userId = req.user.userId;

    const postIndex = posts.findIndex(p => p.id === postId);
    if (postIndex === -1) {
        return res.status(404).json({ error: 'Post not found' });
    }

    const post = posts[postIndex];
    const isLiked = post.likedBy.includes(userId);

    if (isLiked) {
        post.likedBy = post.likedBy.filter(id => id !== userId);
        post.likes -= 1;
    } else {
        post.likedBy.push(userId);
        post.likes += 1;
    }

    posts[postIndex] = post;

    res.json({
        message: isLiked ? 'Post unliked' : 'Post liked',
        post,
        liked: !isLiked
    });
});

app.post('/api/posts/:postId/save', authenticateToken, (req, res) => {
    const { postId } = req.params;
    const userId = req.user.userId;

    const postIndex = posts.findIndex(p => p.id === postId);
    if (postIndex === -1) {
        return res.status(404).json({ error: 'Post not found' });
    }

    const post = posts[postIndex];
    const isSaved = post.savedBy.includes(userId);

    if (isSaved) {
        post.savedBy = post.savedBy.filter(id => id !== userId);
    } else {
        post.savedBy.push(userId);
    }

    posts[postIndex] = post;

    res.json({
        message: isSaved ? 'Post unsaved' : 'Post saved',
        saved: !isSaved
    });
});

// Stories Routes
app.get('/api/stories', authenticateToken, (req, res) => {
    const activeStories = stories.filter(story => 
        new Date(story.expiresAt) > new Date()
    );

    res.json({ stories: activeStories });
});

app.post('/api/stories', authenticateToken, upload.single('image'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'Image is required' });
        }

        const user = users.find(u => u.id === req.user.userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const newStory = {
            id: generateId(),
            userId: user.id,
            username: user.username,
            userAvatar: user.profilePicture || 'https://picsum.photos/60/60?random=1',
            image: `/uploads/${req.file.filename}`,
            timestamp: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 hours
        };

        stories.push(newStory);

        res.status(201).json({
            message: 'Story created successfully',
            story: newStory
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Messages Routes
app.get('/api/messages', authenticateToken, (req, res) => {
    const userId = req.user.userId;
    
    // Get all conversations for the user
    const userMessages = messages.filter(msg => 
        msg.senderId === userId || msg.receiverId === userId
    );

    // Group messages by conversation
    const conversations = {};
    
    userMessages.forEach(msg => {
        const otherUserId = msg.senderId === userId ? msg.receiverId : msg.senderId;
        
        if (!conversations[otherUserId]) {
            const otherUser = users.find(u => u.id === otherUserId);
            conversations[otherUserId] = {
                userId: otherUserId,
                username: otherUser?.username || 'Unknown',
                avatar: otherUser?.profilePicture || 'https://picsum.photos/50/50?random=1',
                lastMessage: msg.text,
                timestamp: msg.timestamp,
                status: msg.status,
                online: Math.random() > 0.5 // Random online status
            };
        } else {
            // Update with latest message
            if (new Date(msg.timestamp) > new Date(conversations[otherUserId].timestamp)) {
                conversations[otherUserId].lastMessage = msg.text;
                conversations[otherUserId].timestamp = msg.timestamp;
                conversations[otherUserId].status = msg.status;
            }
        }
    });

    res.json({ conversations: Object.values(conversations) });
});

app.get('/api/messages/:userId', authenticateToken, (req, res) => {
    const { userId: otherUserId } = req.params;
    const userId = req.user.userId;

    const conversationMessages = messages
        .filter(msg => 
            (msg.senderId === userId && msg.receiverId === otherUserId) ||
            (msg.senderId === otherUserId && msg.receiverId === userId)
        )
        .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    res.json({ messages: conversationMessages });
});

app.post('/api/messages', authenticateToken, (req, res) => {
    const { receiverId, text } = req.body;
    const senderId = req.user.userId;

    if (!receiverId || !text) {
        return res.status(400).json({ error: 'Receiver ID and text are required' });
    }

    const newMessage = {
        id: generateId(),
        senderId,
        receiverId,
        text,
        timestamp: new Date().toISOString(),
        status: 'delivered'
    };

    messages.push(newMessage);

    res.status(201).json({
        message: 'Message sent successfully',
        messageData: newMessage
    });
});

// Reels Routes
app.get('/api/reels', authenticateToken, (req, res) => {
    // Mock reels data
    const reels = [
        {
            id: 'reel1',
            userId: 'user1',
            username: 'john_doe',
            userAvatar: 'https://picsum.photos/40/40?random=1',
            video: 'https://example.com/reel1.mp4',
            caption: 'Amazing reel content!',
            likes: 1234,
            comments: 89,
            shares: 45,
            timestamp: new Date().toISOString()
        }
    ];

    res.json({ reels });
});

// Notifications Routes
app.get('/api/notifications', authenticateToken, (req, res) => {
    const userNotifications = notifications.filter(n => n.userId === req.user.userId);
    res.json({ notifications: userNotifications });
});

// Trending Posts
app.get('/api/trending', authenticateToken, (req, res) => {
    const trendingPosts = posts
        .sort((a, b) => b.likes - a.likes)
        .slice(0, 9);

    res.json({ posts: trendingPosts });
});

// Error handling middleware
app.use((error, req, res, next) => {
    if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ error: 'File too large' });
        }
    }
    res.status(500).json({ error: error.message });
});

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({ error: 'API endpoint not found' });
});

// Initialize dummy data
initializeDummyData();

// Start server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Instronova API Server running on port ${PORT}`);
    console.log(`📱 Frontend: http://localhost:3000`);
    console.log(`🔗 API Base URL: http://localhost:${PORT}/api`);
    console.log(`📂 File uploads: http://localhost:${PORT}/uploads`);
});

module.exports = app;
