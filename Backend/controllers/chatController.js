const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const User = require('../models/User');
const geminiService = require('../utils/gemini');
const { generateToken } = require('../middleware/auth');

class ChatController {
  async register(req, res) {
    try {
      const { username, email, password } = req.body;

      const existingUser = await User.findOne({
        $or: [{ email }, { username }]
      });

      if (existingUser) {
        return res.status(400).json({
          success: false,
          error: 'User already exists with this email or username'
        });
      }

      const user = new User({
        username,
        email,
        password
      });

      await user.save();

      const token = generateToken(user._id);

      res.status(201).json({
        success: true,
        message: 'User registered successfully',
        data: {
          user: {
            id: user._id,
            username: user.username,
            email: user.email
          },
          token
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  async login(req, res) {
    try {
      const { email, password } = req.body;

      const user = await User.findOne({ email });
      if (!user) {
        return res.status(400).json({
          success: false,
          error: 'Invalid credentials'
        });
      }

      const isMatch = await user.comparePassword(password);
      if (!isMatch) {
        return res.status(400).json({
          success: false,
          error: 'Invalid credentials'
        });
      }

      const token = generateToken(user._id);

      res.status(200).json({
        success: true,
        token,
        user: { id: user._id, email: user.email, username: user.username },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  async createConversation(req, res) {
    try {
      const { initialMessage } = req.body;
      const title = initialMessage?.trim()?.slice(0, 50) || "New Conversation";

      console.log("🆕 Creating conversation with title:", title);

      const conversation = new Conversation({
        userId: req.user._id,
        title
      });

      await conversation.save();

      let messages = [];
      if (initialMessage) {
        const message = await Message.create({
          conversationId: conversation._id,
          role: "user",
          content: initialMessage,
          createdAt: new Date()
        });

        conversation.messages.push(message._id);
        await conversation.save();

        messages.push(message);
      }

      await User.findByIdAndUpdate(req.user._id, {
        $push: { chatHistory: conversation._id }
      });

      res.status(201).json({
        success: true,
        data: {
          conversation: {
            _id: conversation._id,
            title: conversation.title, // ✅ Title return karo
            createdAt: conversation.createdAt,
            messages
          }
        }
      });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async getConversations(req, res) {
    try {
      const conversations = await Conversation.find({
        userId: req.user._id,
        isActive: true
      })
      .select('title messages createdAt updatedAt') // ✅ Title explicitly select karo
      .populate({
        path: 'messages',
        select: 'content',
        options: { sort: { createdAt: 1 }, limit: 1 }
      })
      .sort({ updatedAt: -1 });

      const formatted = conversations.map(conv => ({
        _id: conv._id,
        // ✅ CRITICAL: Always use saved title from database
        title: conv.title || "New Conversation",
        messageCount: conv.messages?.length || 0,
        createdAt: conv.createdAt,
        updatedAt: conv.updatedAt,
      }));

      console.log("📊 Sending conversations to frontend:", formatted);

      res.json({
        success: true,
        data: { conversations: formatted }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }



async sendMessage(req, res) {
  try {
    const { conversationId, message } = req.body;

    // 🛑 Validation
    if (!message || message.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Message cannot be empty'
      });
    }

    // 🧩 Find the conversation
    const conversation = await Conversation.findOne({
      _id: conversationId,
      userId: req.user._id
    });

    if (!conversation) {
      return res.status(404).json({
        success: false,
        error: 'Conversation not found'
      });
    }

    // 🧠 Auto-update title if it's default
    if (conversation.title === "New Conversation" || !conversation.title) {
      const newTitle = message.trim().slice(0, 50);
      conversation.title = newTitle;
      await conversation.save();
      console.log("🔄 Auto-updated conversation title:", newTitle);
    }

    // 🕓 Get previous messages (for context)
    const previousMessages = await Message.find({
      conversationId: conversation._id
    }).sort({ createdAt: 1 }).limit(20);

    // 💬 Save user's message
    const userMessage = new Message({
      conversationId: conversation._id,
      content: message,
      role: 'user'
    });
    await userMessage.save();

    conversation.messages.push(userMessage._id);
    await conversation.save();

    // 🧠 Prepare chat history for Gemini
    const history = previousMessages.map(msg => ({
      role: msg.role,
      content: msg.content
    }));

    // 🚀 Send message to Gemini Service
    console.log("📨 Sending message to Gemini:", message);
    const geminiResponse = await geminiService.sendMessage(conversationId, message, history);
    console.log("🧠 Gemini response:", geminiResponse);

    // ❗Handle failed Gemini response
    if (!geminiResponse || geminiResponse.success === false) {
      return res.status(500).json({
        success: false,
        error: geminiResponse?.error || "Gemini service failed"
      });
    }

    // ✅ Always have a reply fallback
    const replyContent =
      geminiResponse.message ||
      geminiResponse.text ||
      "I couldn't generate a response at the moment.";

    // 💬 Save assistant reply
    const assistantMessage = new Message({
      conversationId: conversation._id,
      content: replyContent,
      role: 'assistant',
      tokens: geminiResponse.tokens || 0
    });
    await assistantMessage.save();

    conversation.messages.push(assistantMessage._id);
    await conversation.save();

    // ✅ Send back structured response (frontend expects this format)
    return res.json({
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
          timestamp: assistantMessage.createdAt,
          tokens: assistantMessage.tokens
        },
        conversationId: conversation._id
      }
    });
  } catch (error) {
    console.error("❌ Backend sendMessage error:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Internal Server Error"
    });
  }
}


  async getConversationMessages(req, res) {
    try {
      const { conversationId } = req.params;

      const conversation = await Conversation.findOne({
        _id: conversationId,
        userId: req.user._id
      });

      if (!conversation) {
        return res.status(404).json({
          success: false,
          error: 'Conversation not found'
        });
      }

      const messages = await Message.find({
        conversationId: conversation._id
      })
      .select('content role createdAt')
      .sort({ createdAt: 1 });

      res.json({
        success: true,
        data: {
          conversation: {
            id: conversation._id,
            title: conversation.title // ✅ Title return karo
          },
          messages
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // ✅ NEW: Update conversation title
  async updateConversationTitle(req, res) {
    try {
      const { conversationId } = req.params;
      const { title } = req.body;

      if (!title || title.trim().length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Title cannot be empty'
        });
      }

      const conversation = await Conversation.findOneAndUpdate(
        {
          _id: conversationId,
          userId: req.user._id
        },
        { 
          title: title.trim().slice(0, 50) // Limit title length
        },
        { new: true }
      );

      if (!conversation) {
        return res.status(404).json({
          success: false,
          error: 'Conversation not found'
        });
      }

      console.log("✅ Title updated in MongoDB:", conversation.title);

      res.json({
        success: true,
        data: {
          conversation: {
            _id: conversation._id,
            title: conversation.title,
            updatedAt: conversation.updatedAt
          }
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  async deleteConversation(req, res) {
    try {
      const { conversationId } = req.params;

      const conversation = await Conversation.findOneAndUpdate(
        {
          _id: conversationId,
          userId: req.user._id
        },
        { isActive: false },
        { new: true }
      );

      if (!conversation) {
        return res.status(404).json({
          success: false,
          error: 'Conversation not found'
        });
      }

      geminiService.clearSession(conversationId);

      res.json({
        success: true,
        message: 'Conversation deleted successfully'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  async clearConversation(req, res) {
    try {
      const { conversationId } = req.params;

      const conversation = await Conversation.findOne({
        _id: conversationId,
        userId: req.user._id
      });

      if (!conversation) {
        return res.status(404).json({
          success: false,
          error: 'Conversation not found'
        });
      }

      await Message.deleteMany({ conversationId: conversation._id });

      conversation.messages = [];
      await conversation.save();

      geminiService.clearSession(conversationId);

      res.json({
        success: true,
        message: 'Conversation cleared successfully'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
}

module.exports = new ChatController();