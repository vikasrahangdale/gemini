const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

class GeminiService {
  constructor() {
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

    this.model = this.genAI.getGenerativeModel({
      model: "gemini-2.5-flash", 
      generationConfig: {
        maxOutputTokens: 2048,
        temperature: 0.7,
      }
    });

    this.chatSessions = new Map();
  }

  startChat(conversationId, history = []) {
    const chatHistory = history.map(msg => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }]
    }));

    const chat = this.model.startChat({
      history: chatHistory,
      generationConfig: {
        maxOutputTokens: 2048,
        temperature: 0.7,
      },
    });

    this.chatSessions.set(conversationId, chat);
    return chat;
  }

  async sendMessage(conversationId, message, history = []) {
    try {
      let chat = this.chatSessions.get(conversationId) || this.startChat(conversationId, history);

      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Request timeout')), 30000);
      });

      const chatPromise = chat.sendMessage(message);
      const result = await Promise.race([chatPromise, timeoutPromise]);

      const response = await result.response;
      const text = response.text();

      return { success: true, message: text, tokens: this.estimateTokens(text) };

    } catch (error) {
      console.error('Gemini API Error:', error);
      this.clearSession(conversationId);

      if (error.message.includes('SAFETY')) {
        return { success: false, error: 'Message blocked for safety reasons.' };
      } else if (error.message.includes('QUOTA')) {
        return { success: false, error: 'API quota exceeded. Try again later.' };
      } else if (error.message.includes('timeout')) {
        return { success: false, error: 'Request timeout. Please try again.' };
      } else {
        return { success: false, error: 'Sorry, I encountered an error. Please try again.' };
      }
    }
  }

  estimateTokens(text) {
    return Math.ceil(text.length / 4);
  }

  clearSession(conversationId) {
    this.chatSessions.delete(conversationId);
  }
}

module.exports = new GeminiService();
