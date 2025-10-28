// models/Conversation.js
const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema({
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },

  title: { 
    type: String, 
  },
  
  messages: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message'
  }],
  isActive: { 
    type: Boolean, 
    default: true 
  }
}, { timestamps: true });

conversationSchema.virtual('messageCount').get(function() {
  return this.messages.length;
});

module.exports = mongoose.model('Conversation', conversationSchema);
