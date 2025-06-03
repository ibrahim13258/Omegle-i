const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public')));

// Store connected users waiting for a match
const waitingUsers = {
    text: [],
    video: []
};

// Store active conversations
const conversations = {};

// Socket.io connection handler
io.on('connection', (socket) => {
    console.log(`New user connected: ${socket.id}`);

    // Handle joining a chat
    socket.on('joinChat', ({ chatType, interests }) => {
        console.log(`${socket.id} wants to join ${chatType} chat`);
        
        // Add user to waiting list
        waitingUsers[chatType].push({
            socketId: socket.id,
            interests: interests || []
        });

        // Try to match users
        matchUsers(chatType);
    });

    // Handle sending a message
    socket.on('sendMessage', ({ conversationId, message }) => {
        const conversation = conversations[conversationId];
        if (conversation) {
            const otherUser = conversation.user1 === socket.id ? conversation.user2 : conversation.user1;
            io.to(otherUser).emit('receiveMessage', message);
        }
    });

    // Handle typing indicator
    socket.on('typing', ({ conversationId, isTyping }) => {
        const conversation = conversations[conversationId];
        if (conversation) {
            const otherUser = conversation.user1 === socket.id ? conversation.user2 : conversation.user1;
            io.to(otherUser).emit('typing', isTyping);
        }
    });

    // Handle disconnection
    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.id}`);
        
        // Remove from waiting lists
        Object.keys(waitingUsers).forEach(chatType => {
            waitingUsers[chatType] = waitingUsers[chatType].filter(user => user.socketId !== socket.id);
        });

        // Handle if user was in a conversation
        let conversationToEnd = null;
        Object.keys(conversations).forEach(conversationId => {
            const conversation = conversations[conversationId];
            if (conversation.user1 === socket.id || conversation.user2 === socket.id) {
                conversationToEnd = conversation;
            }
        });

        if (conversationToEnd) {
            const otherUser = conversationToEnd.user1 === socket.id ? 
                conversationToEnd.user2 : conversationToEnd.user1;
            
            io.to(otherUser).emit('strangerDisconnected');
            delete conversations[conversationToEnd.id];
        }
    });

    // WebRTC signaling handlers
    socket.on('offer', (data) => {
        io.to(data.to).emit('offer', {
            offer: data.offer,
            from: socket.id
        });
    });

    socket.on('answer', (data) => {
        io.to(data.to).emit('answer', {
            answer: data.answer,
            from: socket.id
        });
    });

    socket.on('candidate', (data) => {
        io.to(data.to).emit('candidate', {
            candidate: data.candidate,
            from: socket.id
        });
    });
});

// Match users function
function matchUsers(chatType) {
    if (waitingUsers[chatType].length >= 2) {
        // Simple matching - just take the first two users
        const user1 = waitingUsers[chatType].shift();
        const user2 = waitingUsers[chatType].shift();

        const conversationId = generateId();
        conversations[conversationId] = {
            id: conversationId,
            user1: user1.socketId,
            user2: user2.socketId,
            type: chatType,
            interests: [...user1.interests, ...user2.interests]
        };

        // Notify both users
        io.to(user1.socketId).emit('matched', { 
            conversationId,
            strangerId: user2.socketId
        });

        io.to(user2.socketId).emit('matched', { 
            conversationId,
            strangerId: user1.socketId
        });

        console.log(`Matched ${user1.socketId} with ${user2.socketId} for ${chatType} chat`);
    }
}

// Generate random ID
function generateId() {
    return Math.random().toString(36).substr(2, 9);
}

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
}); 
