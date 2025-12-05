const { Server } = require('socket.io');

let io;

const initializeSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: process.env.FRONTEND_URL || "http://localhost:3000",
      methods: ["GET", "POST"],
      credentials: true
    }
  });

  io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    // Join a room (appointment session)
    socket.on('join-room', (roomId, userId, userName) => {
      socket.join(roomId);
      socket.data.roomId = roomId;
      socket.data.userId = userId;
      socket.data.userName = userName;
      
      console.log(`User ${userName} (${userId}) joined room ${roomId}`);
      
      // Notify others in the room
      socket.to(roomId).emit('user-joined', {
        userId,
        userName,
        socketId: socket.id
      });

      // Get all users in the room
      const room = io.sockets.adapter.rooms.get(roomId);
      if (room) {
        const usersInRoom = Array.from(room).map(socketId => {
          const userSocket = io.sockets.sockets.get(socketId);
          return userSocket ? {
            socketId: userSocket.id,
            userId: userSocket.data.userId,
            userName: userSocket.data.userName
          } : null;
        }).filter(Boolean);

        // Send list of existing users to the new user
        socket.emit('room-users', usersInRoom.filter(u => u.socketId !== socket.id));
      }
    });

    // Handle WebRTC offer
    socket.on('offer', (data) => {
      socket.to(data.target).emit('offer', {
        offer: data.offer,
        sender: socket.id,
        senderId: socket.data.userId,
        senderName: socket.data.userName
      });
    });

    // Handle WebRTC answer
    socket.on('answer', (data) => {
      socket.to(data.target).emit('answer', {
        answer: data.answer,
        sender: socket.id,
        senderId: socket.data.userId,
        senderName: socket.data.userName
      });
    });

    // Handle ICE candidates
    socket.on('ice-candidate', (data) => {
      socket.to(data.target).emit('ice-candidate', {
        candidate: data.candidate,
        sender: socket.id
      });
    });

    // Handle user leaving
    socket.on('disconnect', () => {
      const roomId = socket.data.roomId;
      if (roomId) {
        socket.to(roomId).emit('user-left', {
          userId: socket.data.userId,
          userName: socket.data.userName,
          socketId: socket.id
        });
        console.log(`User ${socket.data.userName} left room ${roomId}`);
      }
      console.log(`User disconnected: ${socket.id}`);
    });

    // Handle mute/unmute status
    socket.on('user-audio-status', (data) => {
      socket.to(socket.data.roomId).emit('user-audio-status', {
        userId: socket.data.userId,
        userName: socket.data.userName,
        isMuted: data.isMuted
      });
    });

    // Handle video on/off status
    socket.on('user-video-status', (data) => {
      socket.to(socket.data.roomId).emit('user-video-status', {
        userId: socket.data.userId,
        userName: socket.data.userName,
        isVideoOff: data.isVideoOff
      });
    });
  });

  return io;
};

const getIO = () => {
  if (!io) {
    throw new Error('Socket.io not initialized');
  }
  return io;
};

module.exports = {
  initializeSocket,
  getIO
};

