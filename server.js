const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public')));

// Store users waiting for connections
const textQueue = [];
const videoQueue = [];
const users = {};

// Socket.io connection handler
io.on('connection', (socket) => {
    console.log(`New connection: ${socket.id}`);
    
    // Add user to the users object
    users[socket.id] = { socket, interests: '', type: '' };
    
    // Handle finding a stranger
    socket.on('findStranger', (data) => {
        users[socket.id].interests = data.interests;
        users[socket.id].type = data.type;
        users[socket.id].userId = data.userId;
        
        const queue = data.type === 'text' ? textQueue : videoQueue;
        
        // Check if there's someone waiting with similar interests
        const matchIndex = queue.findIndex(id => {
            const user = users[id];
            return (
                user.type === data.type && 
                (user.interests === data.interests || !data.interests || !user.interests)
            );
        });
        
        if (matchIndex !== -1) {
            // Found a match
            const strangerId = queue[matchIndex];
            queue.splice(matchIndex, 1);
            
            // Pair them up
            users[socket.id].strangerId = strangerId;
            users[strangerId].strangerId = socket.id;
            
            // Notify both users
            socket.emit('strangerFound', { strangerId });
            users[strangerId].socket.emit('strangerFound', { strangerId: socket.id });
        } else {
            // No match found, add to queue
            queue.push(socket.id);
        }
    });
    
    // Handle messages between users
    socket.on('message', (data) => {
        const strangerId = users[socket.id]?.strangerId;
        if (strangerId && users[strangerId]) {
            users[strangerId].socket.emit('message', { text: data.text });
        }
    });
    
    // Handle typing indicator
    socket.on('typing', (data) => {
        const strangerId = users[socket.id]?.strangerId;
        if (strangerId && users[strangerId]) {
            users[strangerId].socket.emit('typing', data.isTyping);
        }
    });
    
    // Handle WebRTC offers
    socket.on('offer', (data) => {
        const strangerId = users[socket.id]?.strangerId;
        if (strangerId && users[strangerId]) {
            users[strangerId].socket.emit('offer', { offer: data.offer, from: socket.id });
        }
    });
    
    // Handle WebRTC answers
    socket.on('answer', (data) => {
        const strangerId = users[socket.id]?.strangerId;
        if (strangerId && users[strangerId]) {
            users[strangerId].socket.emit('answer', { answer: data.answer, from: socket.id });
        }
    });
    
    // Handle ICE candidates
    socket.on('iceCandidate', (data) => {
        const strangerId = users[socket.id]?.strangerId;
        if (strangerId && users[strangerId]) {
            users[strangerId].socket.emit('iceCandidate', { candidate: data.candidate, from: socket.id });
        }
    });
    
    // Handle file sharing
    socket.on('file', (data) => {
        const strangerId = users[socket.id]?.strangerId;
        if (strangerId && users[strangerId]) {
            users[strangerId].socket.emit('file', { file: data.file });
        }
    });
    
    // Handle disconnection from stranger
    socket.on('disconnectFromStranger', () => {
        const strangerId = users[socket.id]?.strangerId;
        if (strangerId && users[strangerId]) {
            users[strangerId].socket.emit('strangerDisconnected');
            users[strangerId].strangerId = null;
            users[socket.id].strangerId = null;
        }
    });
    
    // Handle disconnection
    socket.on('disconnect', () => {
        console.log(`Disconnected: ${socket.id}`);
        
        // Notify stranger if connected
        const strangerId = users[socket.id]?.strangerId;
        if (strangerId && users[strangerId]) {
            users[strangerId].socket.emit('strangerDisconnected');
            users[strangerId].strangerId = null;
        }
        
        // Remove from queues
        const textIndex = textQueue.indexOf(socket.id);
        if (textIndex !== -1) textQueue.splice(textIndex, 1);
        
        const videoIndex = videoQueue.indexOf(socket.id);
        if (videoIndex !== -1) videoQueue.splice(videoIndex, 1);
        
        // Remove from users
        delete users[socket.id];
    });
});

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
