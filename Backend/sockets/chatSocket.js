const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const geminiService = require('../utils/gemini');

class ChatSocket {
  constructor(server) {
    this.io = new Server(server, {
      cors: {
        origin: "*", // Change this to your frontend URL in production
        methods: ["GET", "POST"]
      }
    });

    this.connectedUsers = new Map(); // userId -> socketId
    this.userSockets = new Map(); // socketId -> user data

    this.initializeMiddleware();
    this.initializeHandlers();
  }

  // Socket authentication middleware
  initializeMiddleware() {
    this.io.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth.token;
        
        if (!token) {
          return next(new Error('Authentication error: No token provided'));
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.userId).select('-password');
        
        if (!user) {
          return next(new Error('Authentication error: User not found'));
        }

        socket.userId = user._id.toString();
        socket.user = user;
        next();
      } catch (error) {
        next(new Error('Authentication error: Invalid token'));
      }
    });
  }

  initializeHandlers() {
    this.io.on('connection', (socket) => {
      console.log(`User ${socket.user.username} connected with socket ID: ${socket.id}`);

      this.connectedUsers.set(socket.userId, socket.id);
      this.userSockets.set(socket.id, socket.user);

      socket.emit('connected', {
        success: true,
        message: 'Successfully connected to chat server',
        user: {
          id: socket.user._id,
          username: socket.user.username,
          email: socket.user.email
        }
      });

      socket.join(`user_${socket.userId}`);

      socket.on('create_conversation', async (data, callback) => {
        await this.handleCreateConversation(socket, data, callback);
      });

      socket.on('send_message', async (data, callback) => {
        await this.handleSendMessage(socket, data, callback);
      });

      socket.on('join_conversation', async (data) => {
        await this.handleJoinConversation(socket, data);
      });

      // Handle leave conversation
      socket.on('leave_conversation', async (data) => {
        await this.handleLeaveConversation(socket, data);
      });

      socket.on('typing_start', (data) => {
        this.handleTypingStart(socket, data);
      });

      socket.on('typing_stop', (data) => {
        this.handleTypingStop(socket, data);
      });

      // Handle disconnect
      socket.on('disconnect', () => {
        this.handleDisconnect(socket);
      });

      // Handle error
      socket.on('error', (error) => {
        console.error(`Socket error for user ${socket.userId}:`, error);
        socket.emit('error', {
          success: false,
          error: 'An error occurred'
        });
      });
    });
  }

  async handleCreateConversation(socket, data, callback) {
    try {
      const { title = 'New Conversation' } = data;

      const conversation = new Conversation({
        userId: socket.userId,
        title
      });

      await conversation.save();

      // Add conversation to user's chat history
      await User.findByIdAndUpdate(
        socket.userId,
        { $push: { chatHistory: conversation._id } }
      );

      // Join the conversation room
      socket.join(`conversation_${conversation._id}`);

      if (callback) {
        callback({
          success: true,
          data: {
            conversation: {
              id: conversation._id,
              title: conversation.title,
              createdAt: conversation.createdAt
            }
          }
        });
      }

      socket.emit('conversation_created', {
        success: true,
        data: {
          conversation: {
            id: conversation._id,
            title: conversation.title,
            createdAt: conversation.createdAt
          }
        }
      });

    } catch (error) {
      console.error('Create conversation error:', error);
      if (callback) {
        callback({
          success: false,
          error: error.message
        });
      }
      socket.emit('error', {
        success: false,
        error: 'Failed to create conversation'
      });
    }
  }

  async handleSendMessage(socket, data, callback) {
    try {
      const { conversationId, message, messageId } = data;

      if (!message || message.trim().length === 0) {
        if (callback) {
          callback({
            success: false,
            error: 'Message cannot be empty'
          });
        }
        return;
      }

      // Verify conversation ownership
      const conversation = await Conversation.findOne({
        _id: conversationId,
        userId: socket.userId
      });

      if (!conversation) {
        if (callback) {
          callback({
            success: false,
            error: 'Conversation not found'
          });
        }
        return;
      }

      // Generate temporary message ID if not provided
      const tempMessageId = messageId || `temp_${Date.now()}`;

      // Emit user message immediately for real-time feel
      socket.to(`conversation_${conversationId}`).emit('user_message', {
        messageId: tempMessageId,
        content: message,
        role: 'user',
        timestamp: new Date(),
        conversationId,
        userId: socket.userId,
        username: socket.user.username
      });

      // Save user message to database
      const userMessage = new Message({
        conversationId: conversation._id,
        content: message,
        role: 'user'
      });
      await userMessage.save();

      // Add message to conversation
      conversation.messages.push(userMessage._id);
      await conversation.save();

      // Get conversation history for context
      const previousMessages = await Message.find({
        conversationId: conversation._id
      }).sort({ createdAt: 1 }).limit(20);

      const history = previousMessages.map(msg => ({
        role: msg.role,
        content: msg.content
      }));

      // Emit typing indicator
      socket.to(`conversation_${conversationId}`).emit('assistant_typing', {
        conversationId,
        isTyping: true
      });

      // Get response from Gemini
      const geminiResponse = await geminiService.sendMessage(
        conversationId,
        message,
        history
      );

      // Stop typing indicator
      socket.to(`conversation_${conversationId}`).emit('assistant_typing', {
        conversationId,
        isTyping: false
      });

      if (!geminiResponse.success) {
        socket.emit('error', {
          success: false,
          error: geminiResponse.error,
          conversationId
        });
        return;
      }

      // Save assistant response
      const assistantMessage = new Message({
        conversationId: conversation._id,
        content: geminiResponse.message,
        role: 'assistant',
        tokens: geminiResponse.tokens
      });
      await assistantMessage.save();

      // Add assistant message to conversation
      conversation.messages.push(assistantMessage._id);
      await conversation.save();

      // Emit assistant response
      this.io.to(`conversation_${conversationId}`).emit('assistant_message', {
        messageId: assistantMessage._id,
        content: assistantMessage.content,
        role: 'assistant',
        timestamp: assistantMessage.createdAt,
        conversationId,
        tokens: assistantMessage.tokens
      });

      if (callback) {
        callback({
          success: true,
          data: {
            userMessage: {
              id: userMessage._id,
              content: userMessage.content,
              role: userMessage.role,
              timestamp: userMessage.createdAt
            },
            assistantMessage: {
              id: assistantMessage._id,
              content: assistantMessage.content,
              role: assistantMessage.role,
              timestamp: assistantMessage.createdAt
            }
          }
        });
      }

    } catch (error) {
      console.error('Send message error:', error);
      
      // Stop typing indicator in case of error
      socket.to(`conversation_${data.conversationId}`).emit('assistant_typing', {
        conversationId: data.conversationId,
        isTyping: false
      });

      if (callback) {
        callback({
          success: false,
          error: error.message
        });
      }
      
      socket.emit('error', {
        success: false,
        error: 'Failed to send message'
      });
    }
  }

  async handleJoinConversation(socket, data) {
    try {
      const { conversationId } = data;

      const conversation = await Conversation.findOne({
        _id: conversationId,
        userId: socket.userId
      });

      if (!conversation) {
        socket.emit('error', {
          success: false,
          error: 'Conversation not found'
        });
        return;
      }

      socket.join(`conversation_${conversationId}`);
      
      socket.emit('conversation_joined', {
        success: true,
        conversationId,
        message: 'Successfully joined conversation'
      });

    } catch (error) {
      console.error('Join conversation error:', error);
      socket.emit('error', {
        success: false,
        error: 'Failed to join conversation'
      });
    }
  }

  async handleLeaveConversation(socket, data) {
    try {
      const { conversationId } = data;
      socket.leave(`conversation_${conversationId}`);
      
      socket.emit('conversation_left', {
        success: true,
        conversationId,
        message: 'Successfully left conversation'
      });

    } catch (error) {
      console.error('Leave conversation error:', error);
      socket.emit('error', {
        success: false,
        error: 'Failed to leave conversation'
      });
    }
  }

  handleTypingStart(socket, data) {
    const { conversationId } = data;
    socket.to(`conversation_${conversationId}`).emit('user_typing', {
      userId: socket.userId,
      username: socket.user.username,
      conversationId,
      isTyping: true
    });
  }

  handleTypingStop(socket, data) {
    const { conversationId } = data;
    socket.to(`conversation_${conversationId}`).emit('user_typing', {
      userId: socket.userId,
      username: socket.user.username,
      conversationId,
      isTyping: false
    });
  }

  handleDisconnect(socket) {
    console.log(`User ${socket.user.username} disconnected`);
    
    // Remove from connected users
    this.connectedUsers.delete(socket.userId);
    this.userSockets.delete(socket.id);

    // Notify other users in the same conversations
    socket.rooms.forEach(room => {
      if (room.startsWith('conversation_')) {
        socket.to(room).emit('user_offline', {
          userId: socket.userId,
          username: socket.user.username
        });
      }
    });
  }

  // Utility method to send message to specific user
  sendToUser(userId, event, data) {
    const socketId = this.connectedUsers.get(userId);
    if (socketId) {
      this.io.to(socketId).emit(event, data);
    }
  }

  // Utility method to broadcast to all users in conversation
  broadcastToConversation(conversationId, event, data) {
    this.io.to(`conversation_${conversationId}`).emit(event, data);
  }
}

module.exports = ChatSocket;