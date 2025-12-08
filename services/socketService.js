const { Server } = require('socket.io');
const { supabase } = require('../config/supabase');

let io;

const initializeSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: process.env.FRONTEND_URL || "http://localhost:3000",
      methods: ["GET", "POST"],
      credentials: true
    }
  });

  // Store call state per room (appointment ID)
  const callStates = new Map(); // roomId -> { isActive: boolean, startedBy: userId }

  io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    // Join a room (appointment session)
    socket.on('join-room', async (roomId, userId, userName, userRole) => {
      try {
        // Validate appointment exists and check status
        // roomId could be meeting_room_id or appointment id
        const roomIdStr = String(roomId).trim();
        console.log(`🔍 Looking for appointment with roomId: "${roomIdStr}" (type: ${typeof roomId})`);
        
        // Try to find appointment by meeting_room_id first (if it's not a UUID format)
        let appointment = null;
        let appointmentError = null;
        
        // Check if roomId looks like a UUID (appointment id) or a room ID
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(roomIdStr);
        
        if (!isUUID) {
          // Try meeting_room_id first for non-UUID values
          console.log(`🔍 Trying meeting_room_id first (not a UUID)...`);
          const result = await supabase
            .from('appointments')
            .select('id, user_id, doctor_id, appointment_date, appointment_time, status, meeting_room_id')
            .eq('meeting_room_id', roomIdStr)
            .maybeSingle();
          
          appointment = result.data;
          appointmentError = result.error;
          
          if (appointment) {
            console.log(`✅ Found appointment by meeting_room_id: ${appointment.id}`);
          } else if (appointmentError) {
            console.log(`⚠️ Error searching by meeting_room_id:`, appointmentError);
          }
        }
        
        // If not found by meeting_room_id, try by id (works for both UUID and non-UUID)
        if (!appointment) {
          console.log(`🔍 Not found by meeting_room_id, trying by id...`);
          const result = await supabase
            .from('appointments')
            .select('id, user_id, doctor_id, appointment_date, appointment_time, status, meeting_room_id')
            .eq('id', roomIdStr)
            .maybeSingle();
          
          if (!result.error && result.data) {
            appointment = result.data;
            appointmentError = null;
            console.log(`✅ Found appointment by id: ${appointment.id}`);
          } else {
            appointmentError = result.error || appointmentError;
            if (appointmentError) {
              console.error(`❌ Appointment not found for room ${roomIdStr}:`, appointmentError);
            } else {
              console.log(`ℹ️ No appointment found with id: ${roomIdStr}`);
            }
          }
        }

        if (!appointment || appointmentError) {
          console.error(`❌ Appointment not found for room "${roomIdStr}". Error:`, appointmentError);
          console.error(`Searched for: meeting_room_id='${roomIdStr}' OR id='${roomIdStr}'`);
          
          // Log recent appointments for debugging (only if error)
          try {
            const { data: allAppointments } = await supabase
              .from('appointments')
              .select('id, meeting_room_id, status, user_id, doctor_id')
              .order('created_at', { ascending: false })
              .limit(5);
            console.log(`📋 Recent appointments:`, JSON.stringify(allAppointments, null, 2));
          } catch (debugError) {
            console.error('Error fetching debug appointments:', debugError);
          }
          
          socket.emit('error', { 
            message: `Appointment not found. Please check the appointment ID. Room ID: ${roomIdStr}` 
          });
          return;
        }

        // Check if appointment is completed
        if (appointment.status && appointment.status.toLowerCase() === 'completed') {
          console.log(`Attempt to join completed appointment ${appointment.id} by ${userName}`);
          socket.emit('error', { 
            message: 'Cannot join this appointment. It has already been completed.' 
          });
          return;
        }

        // Verify user has permission to join this appointment
        const isDoctor = userRole === 'doctor' || userRole === 'admin';
        const isPatient = appointment.user_id === userId;
        const isAppointmentDoctor = appointment.doctor_id === userId;

        if (!isPatient && !isAppointmentDoctor && !isDoctor) {
          console.log(`Unauthorized access attempt: ${userName} (${userId}) tried to join appointment ${appointment.id}`);
          socket.emit('error', { 
            message: 'You do not have permission to join this appointment.' 
          });
          return;
        }

        // Allow doctors to join even if appointment date is in the past (as long as not completed)
        // This is already handled above by checking status !== 'completed'
        
        console.log(`User ${userName} (${userId}, role: ${userRole}) joined room ${roomId} for appointment ${appointment.id}`);
        
        socket.join(roomId);
        socket.data.roomId = roomId;
        socket.data.userId = userId;
        socket.data.userName = userName;
        socket.data.userRole = userRole || 'user';
        socket.data.appointmentId = appointment.id;
        
        // Get current call state for this room
        const callState = callStates.get(roomId) || { isActive: false, startedBy: null };
        
        console.log(`Call state for room ${roomId}:`, callState);
        
        // Send current call state to the joining user
        socket.emit('call-state', {
          isActive: callState.isActive,
          startedBy: callState.startedBy
        });
        
        console.log(`Sent call-state to ${userName} (${userId}):`, { isActive: callState.isActive, startedBy: callState.startedBy });
        
        // If call is active, notify others in the room
        if (callState.isActive) {
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
        }
      } catch (error) {
        console.error('Error in join-room:', error);
        socket.emit('error', { 
          message: 'An error occurred while joining the appointment. Please try again.' 
        });
      }
    });

    // Start call (only doctors can do this)
    socket.on('start-call', async (roomId) => {
      const userRole = socket.data.userRole;
      
      if (userRole !== 'doctor' && userRole !== 'admin') {
        socket.emit('error', { message: 'Only doctors can start the call' });
        return;
      }

      try {
        // Validate appointment exists and is not completed
        // Allow doctors to start calls even if appointment date is in the past
        const roomIdStr = String(roomId).trim();
        console.log(`🔍 [start-call] Looking for appointment with roomId: "${roomIdStr}"`);
        
        // Try to find appointment by meeting_room_id first (if it's not a UUID format)
        let appointment = null;
        let appointmentError = null;
        
        // Check if roomId looks like a UUID (appointment id) or a room ID
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(roomIdStr);
        
        if (!isUUID) {
          // Try meeting_room_id first for non-UUID values
          console.log(`🔍 [start-call] Trying meeting_room_id first (not a UUID)...`);
          const result = await supabase
            .from('appointments')
            .select('id, doctor_id, status, meeting_room_id')
            .eq('meeting_room_id', roomIdStr)
            .maybeSingle();
          
          appointment = result.data;
          appointmentError = result.error;
          
          if (appointment) {
            console.log(`✅ [start-call] Found appointment by meeting_room_id: ${appointment.id}`);
          } else if (appointmentError) {
            console.log(`⚠️ [start-call] Error searching by meeting_room_id:`, appointmentError);
          }
        }
        
        // If not found by meeting_room_id, try by id (works for both UUID and non-UUID)
        if (!appointment) {
          console.log(`🔍 [start-call] Not found by meeting_room_id, trying by id...`);
          const result = await supabase
            .from('appointments')
            .select('id, doctor_id, status, meeting_room_id')
            .eq('id', roomIdStr)
            .maybeSingle();
          
          if (!result.error && result.data) {
            appointment = result.data;
            appointmentError = null;
            console.log(`✅ [start-call] Found appointment by id: ${appointment.id}`);
          } else {
            appointmentError = result.error || appointmentError;
            if (appointmentError) {
              console.error(`❌ [start-call] Appointment not found for room ${roomIdStr}:`, appointmentError);
            } else {
              console.log(`ℹ️ [start-call] No appointment found with id: ${roomIdStr}`);
            }
          }
        }

        if (!appointment || appointmentError) {
          console.error(`[start-call] Appointment not found for room "${roomIdStr}":`, appointmentError);
          socket.emit('error', { 
            message: 'Appointment not found. Cannot start call.' 
          });
          return;
        }

        // Check if appointment is completed
        if (appointment.status && appointment.status.toLowerCase() === 'completed') {
          console.log(`Attempt to start call for completed appointment ${appointment.id}`);
          socket.emit('error', { 
            message: 'Cannot start call. This appointment has already been completed.' 
          });
          return;
        }

        // Verify the doctor is authorized for this appointment
        if (appointment.doctor_id !== socket.data.userId && userRole !== 'admin') {
          console.log(`Unauthorized: ${socket.data.userName} (${socket.data.userId}) tried to start call for appointment ${appointment.id}`);
          socket.emit('error', { 
            message: 'You are not authorized to start this appointment call.' 
          });
          return;
        }

        // Mark call as active
        callStates.set(roomId, {
          isActive: true,
          startedBy: socket.data.userId
        });

        console.log(`Call started in room ${roomId} by ${socket.data.userName} for appointment ${appointment.id}`);

        // Notify all users in the room that call has started
        const room = io.sockets.adapter.rooms.get(roomId);
        const userCount = room ? Array.from(room).length : 0;
        console.log(`Broadcasting call-started to ${userCount} users in room ${roomId}`);
        
        io.to(roomId).emit('call-started', {
          startedBy: socket.data.userId,
          startedByName: socket.data.userName
        });
        
        console.log(`Call-started event sent to all users in room ${roomId}`);

        // Get all users in the room and send them to each other
        if (room) {
          const usersInRoom = Array.from(room).map(socketId => {
            const userSocket = io.sockets.sockets.get(socketId);
            return userSocket ? {
              socketId: userSocket.id,
              userId: userSocket.data.userId,
              userName: userSocket.data.userName
            } : null;
          }).filter(Boolean);

          // Send list of all users to everyone in the room
          io.to(roomId).emit('room-users', usersInRoom);
        }
      } catch (error) {
        console.error('Error in start-call:', error);
        socket.emit('error', { 
          message: 'An error occurred while starting the call. Please try again.' 
        });
      }
    });

    // End call
    socket.on('end-call', (roomId) => {
      const userRole = socket.data.userRole;
      
      if (userRole !== 'doctor' && userRole !== 'admin') {
        socket.emit('error', { message: 'Only doctors can end the call' });
        return;
      }

      // Mark call as inactive
      callStates.set(roomId, {
        isActive: false,
        startedBy: null
      });

      console.log(`Call ended in room ${roomId} by ${socket.data.userName}`);

      // Notify all users in the room that call has ended
      io.to(roomId).emit('call-ended', {
        endedBy: socket.data.userId,
        endedByName: socket.data.userName
      });
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



