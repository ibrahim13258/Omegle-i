const express = require('express');
const WebSocket = require('ws');
const http = require('http');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public')));

// User queues for text and video chat
const queues = {
    text: [],
    video: []
};

// Active connections
const connections = new Map();

// Handle WebSocket connections
wss.on('connection', (ws) => {
    console.log('New client connected');
    const userId = generateUserId();
    connections.set(userId, { ws, partner: null, chatType: null, interests: null });

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            handleMessage(userId, data);
        } catch (error) {
            console.error('Error parsing message:', error);
        }
    });

    ws.on('close', () => {
        console.log('Client disconnected');
        handleDisconnect(userId);
    });
});

function handleMessage(userId, data) {
    const user = connections.get(userId);
    if (!user) return;

    switch (data.type) {
        case 'join':
            handleJoin(userId, data);
            break;
        case 'find':
            handleFind(userId);
            break;
        case 'message':
            handleChatMessage(userId, data);
            break;
        case 'typing':
            handleTyping(userId, data);
            break;
        case 'offer':
        case 'answer':
        case 'ice-candidate':
            forwardSignalingMessage(userId, data);
            break;
        case 'file':
            forwardFile(userId, data);
            break;
        case 'disconnect':
            handleDisconnect(userId);
            break;
        default:
            console.log('Unknown message type:', data.type);
    }
}

function handleJoin(userId, data) {
    const user = connections.get(userId);
    if (!user) return;

    user.chatType = data.chatType;
    user.interests = data.interests || null;

    // Add to appropriate queue
    queues[data.chatType].push(userId);
    console.log(`User ${userId} joined ${data.chatType} queue`);

    // Try to match users
    tryMatchUsers(data.chatType);
}

function handleFind(userId) {
    const user = connections.get(userId);
    if (!user || !user.chatType) return;

    // Add to appropriate queue if not already in it
    if (!queues[user.chatType].includes(userId)) {
        queues[user.chatType].push(userId);
        console.log(`User ${userId} rejoined ${user.chatType} queue`);
    }

    // Try to match users
    tryMatchUsers(user.chatType);
}

function tryMatchUsers(chatType) {
    const queue = queues[chatType];
    if (queue.length >= 2) {
        const user1Id = queue.shift();
        const user2Id = queue.shift();

        const user1 = connections.get(user1Id);
        const user2 = connections.get(user2Id);

        if (user1 && user2) {
            // Pair the users
            user1.partner = user2Id;
            user2.partner = user1Id;

            // Notify both users
            sendToUser(user1Id, { type: 'connected', chatType });
            sendToUser(user2Id, { type: 'connected', chatType });

            console.log(`Matched ${user1Id} with ${user2Id} for ${chatType} chat`);
        } else {
            // If one user is no longer connected, try again
            if (!user1) queue.push(user2Id);
            if (!user2) queue.push(user1Id);
            tryMatchUsers(chatType);
        }
    }
}

function handleChatMessage(userId, data) {
    const user = connections.get(userId);
    if (!user || !user.partner) return;

    const partner = connections.get(user.partner);
    if (!partner) {
        handleDisconnect(userId);
        return;
    }

    sendToUser(user.partner, {
        type: 'message',
        message: data.message
    });
}

function handleTyping(userId, data) {
    const user = connections.get(userId);
    if (!user || !user.partner) return;

    const partner = connections.get(user.partner);
    if (!partner) {
        handleDisconnect(userId);
        return;
    }

    sendToUser(user.partner, {
        type: 'typing',
        isTyping: data.isTyping
    });
}

function forwardSignalingMessage(userId, data) {
    const user = connections.get(userId);
    if (!user || !user.partner) return;

    const partner = connections.get(user.partner);
    if (!partner) {
        handleDisconnect(userId);
        return;
    }

    sendToUser(user.partner, data);
}

function forwardFile(userId, data) {
    const user = connections.get(userId);
    if (!user || !user.partner) return;

    const partner = connections.get(user.partner);
    if (!partner) {
        handleDisconnect(userId);
        return;
    }

    sendToUser(user.partner, {
        type: 'file',
        fileType: data.fileType,
        fileData: data.fileData
    });
}

function handleDisconnect(userId) {
    const user = connections.get(userId);
    if (!user) return;

    // Notify partner if connected
    if (user.partner) {
        const partner = connections.get(user.partner);
        if (partner) {
            sendToUser(user.partner, { type: 'disconnected' });
            partner.partner = null;
            
            // Add partner back to queue if they want to continue
            if (partner.chatType) {
                queues[partner.chatType].push(user.partner);
                tryMatchUsers(partner.chatType);
            }
        }
    }

    // Remove from queue if present
    if (user.chatType) {
        const index = queues[user.chatType].indexOf(userId);
        if (index !== -1) {
            queues[user.chatType].splice(index, 1);
        }
    }

    connections.delete(userId);
    console.log(`User ${userId} disconnected`);
}

function sendToUser(userId, data) {
    const user = connections.get(userId);
    if (!user || !user.ws || user.ws.readyState !== WebSocket.OPEN) {
        return false;
    }

    try {
        user.ws.send(JSON.stringify(data));
        return true;
    } catch (error) {
        console.error('Error sending message to user:', error);
        return false;
    }
}

function generateUserId() {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
