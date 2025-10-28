// routes/chatRoutes.js
const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');
const { auth } = require('../middleware/auth');
const { chatLimiter, authLimiter } = require('../middleware/rateLimit');



router.post('/register', authLimiter, chatController.register);
router.post('/login', authLimiter, chatController.login);


 
router.use(auth);

router.post('/conversations', chatController.createConversation);
router.get('/conversations', chatController.getConversations);
router.get('/conversations/:conversationId/messages', chatController.getConversationMessages);
router.delete('/conversations/:conversationId', chatController.deleteConversation);
router.delete('/conversations/:conversationId/clear', chatController.clearConversation);
router.put('/:conversationId/title', auth, chatController.updateConversationTitle);


router.post('/chat', chatLimiter, chatController.sendMessage);


module.exports = router;
