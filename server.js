// server.js
require('dotenv').config();
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Store connected users and rooms
const users = {};
const rooms = {};

// WebSocket connection handler
wss.on('connection', (ws) => {
    console.log('New WebSocket connection');

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            handleMessage(ws, data);
        } catch (err) {
            console.error('Error parsing message:', err);
        }
    });

    ws.on('close', () => {
        cleanupUser(ws);
    });
});

function handleMessage(ws, data) {
    switch (data.type) {
        case 'register':
            handleRegister(ws, data);
            break;
        case 'offer':
        case 'answer':
        case 'candidate':
            handleSignalingData(ws, data);
            break;
        case 'chat':
            handleChatMessage(ws, data);
            break;
        case 'disconnect':
            cleanupUser(ws);
            break;
        default:
            console.log('Unknown message type:', data.type);
    }
}

function handleRegister(ws, data) {
    const userId = data.userId;
    const interest = data.interest || 'general';
    
    users[userId] = {
        ws,
        userId,
        interest,
        pairedWith: null
    };
    
    // Try to pair users with same interest
    pairUsers(interest, userId);
    
    ws.send(JSON.stringify({
        type: 'registered',
        userId,
        interest
    }));
}

function pairUsers(interest, newUserId) {
    const availableUsers = Object.values(users).filter(user => 
        user.interest === interest && 
        user.userId !== newUserId && 
        !user.pairedWith
    );
    
    if (availableUsers.length > 0) {
        const user1 = users[newUserId];
        const user2 = availableUsers[0];
        
        // Create a room
        const roomId = `${newUserId}-${user2.userId}`;
        rooms[roomId] = {
            user1: newUserId,
            user2: user2.userId
        };
        
        // Update user pairing info
        user1.pairedWith = user2.userId;
        user2.pairedWith = newUserId;
        
        // Notify both users
        user1.ws.send(JSON.stringify({
            type: 'paired',
            partnerId: user2.userId,
            roomId
        }));
        
        user2.ws.send(JSON.stringify({
            type: 'paired',
            partnerId: newUserId,
            roomId
        }));
    }
}

function handleSignalingData(ws, data) {
    const targetUserId = data.targetUserId;
    const senderUserId = data.senderUserId;
    
    if (users[targetUserId] && users[targetUserId].ws) {
        users[targetUserId].ws.send(JSON.stringify({
            type: data.type,
            [data.type]: data[data.type],
            senderUserId
        }));
    }
}

function handleChatMessage(ws, data) {
    const targetUserId = data.targetUserId;
    const senderUserId = data.senderUserId;
    const message = data.message;
    
    if (users[targetUserId] && users[targetUserId].ws) {
        users[targetUserId].ws.send(JSON.stringify({
            type: 'chat',
            message,
            senderUserId
        }));
    }
}

function cleanupUser(ws) {
    const userId = Object.keys(users).find(id => users[id].ws === ws);
    
    if (userId) {
        const user = users[userId];
        
        // Notify paired user if exists
        if (user.pairedWith && users[user.pairedWith]) {
            users[user.pairedWith].ws.send(JSON.stringify({
                type: 'partnerDisconnected'
            }));
            users[user.pairedWith].pairedWith = null;
        }
        
        // Clean up room if exists
        const roomId = Object.keys(rooms).find(id => 
            rooms[id].user1 === userId || rooms[id].user2 === userId
        );
        
        if (roomId) {
            delete rooms[roomId];
        }
        
        delete users[userId];
        console.log(`User ${userId} disconnected`);
    }
}

// API Routes
app.get('/api/ice-servers', (req, res) => {
    // In production, you should use your own STUN/TURN servers
    res.json({
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' }
            // Add your TURN servers here if needed
        ]
    });
});

// Serve frontend
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
