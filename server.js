const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Serve index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Store waiting users
let waitingTextUsers = [];
let waitingVideoUsers = [];
let connectedPairs = new Map();

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);
    
    // Handle text chat joining
    socket.on('join-text-chat', () => {
        if (waitingTextUsers.length > 0) {
            // Match with waiting user
            const partner = waitingTextUsers.shift();
            const roomId = `text-${socket.id}-${partner.id}`;
            
            socket.join(roomId);
            partner.join(roomId);
            
            connectedPairs.set(socket.id, { partner: partner.id, room: roomId, type: 'text' });
            connectedPairs.set(partner.id, { partner: socket.id, room: roomId, type: 'text' });
            
            socket.emit('matched');
            partner.emit('matched');
            
            console.log(`Text chat matched: ${socket.id} with ${partner.id}`);
        } else {
            // Add to waiting list
            waitingTextUsers.push(socket);
            console.log(`User ${socket.id} waiting for text chat`);
        }
    });
    
    // Handle video chat joining
    socket.on('join-video-chat', () => {
        if (waitingVideoUsers.length > 0) {
            // Match with waiting user
            const partner = waitingVideoUsers.shift();
            const roomId = `video-${socket.id}-${partner.id}`;
            
            socket.join(roomId);
            partner.join(roomId);
            
            connectedPairs.set(socket.id, { partner: partner.id, room: roomId, type: 'video' });
            connectedPairs.set(partner.id, { partner: socket.id, room: roomId, type: 'video' });
            
            socket.emit('matched');
            partner.emit('matched');
            
            console.log(`Video chat matched: ${socket.id} with ${partner.id}`);
        } else {
            // Add to waiting list
            waitingVideoUsers.push(socket);
            console.log(`User ${socket.id} waiting for video chat`);
        }
    });
    
    // Handle messages
    socket.on('message', (message) => {
        const pair = connectedPairs.get(socket.id);
        if (pair) {
            socket.to(pair.room).emit('message', { message, sender: socket.id });
        }
    });
    
    // Handle typing indicator
    socket.on('typing', () => {
        const pair = connectedPairs.get(socket.id);
        if (pair) {
            socket.to(pair.room).emit('typing');
        }
    });
    
    // Handle file upload
    socket.on('file-upload', (fileData) => {
        const pair = connectedPairs.get(socket.id);
        if (pair && fileData.data && fileData.data.length <= 70000000) { // ~50MB base64 limit
            socket.to(pair.room).emit('file-received', fileData);
            console.log(`File sent: ${fileData.name} from ${socket.id}`);
        }
    });
    
    // WebRTC signaling
    socket.on('video-offer', (offer) => {
        const pair = connectedPairs.get(socket.id);
        if (pair && pair.type === 'video') {
            socket.to(pair.room).emit('video-offer', offer);
        }
    });
    
    socket.on('video-answer', (answer) => {
        const pair = connectedPairs.get(socket.id);
        if (pair && pair.type === 'video') {
            socket.to(pair.room).emit('video-answer', answer);
        }
    });
    
    socket.on('ice-candidate', (candidate) => {
        const pair = connectedPairs.get(socket.id);
        if (pair && pair.type === 'video') {
            socket.to(pair.room).emit('ice-candidate', candidate);
        }
    });
    
    // Handle manual disconnect
    socket.on('disconnect-chat', () => {
        handleDisconnection(socket);
    });
    
    // Handle socket disconnection
    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        handleDisconnection(socket);
    });
    
    function handleDisconnection(socket) {
        // Remove from waiting lists
        waitingTextUsers = waitingTextUsers.filter(user => user.id !== socket.id);
        waitingVideoUsers = waitingVideoUsers.filter(user => user.id !== socket.id);
        
        // Handle paired disconnection
        const pair = connectedPairs.get(socket.id);
        if (pair) {
            socket.to(pair.room).emit('user-disconnected');
            connectedPairs.delete(socket.id);
            connectedPairs.delete(pair.partner);
            console.log(`Pair disconnected: ${socket.id} and ${pair.partner}`);
        }
    }
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
});
