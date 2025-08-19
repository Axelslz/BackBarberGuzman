const express = require('express');
const chatBotController = require('../controllers/chatBotController');

const router = express.Router();

router.post('/whatsapp', chatBotController.handleIncomingMessage);

module.exports = router;