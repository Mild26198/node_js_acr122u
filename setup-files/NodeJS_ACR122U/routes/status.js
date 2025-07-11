// routes/status.js
const express = require('express');
const router = express.Router();
const { isReaderAvailable, isCardPresent, getCurrentReader, getCurrentCard, bufferToHex } = require('../nfc');

// Reader status
router.get('/reader-status', (req, res) => {
    const currentReader = getCurrentReader();
    const currentCard = getCurrentCard();
    res.json({
        success: true,
        readerDetected: isReaderAvailable(),
        cardPresent: isCardPresent(),
        readerName: currentReader ? currentReader.reader.name : null,
        cardUID: currentCard ? currentCard.uid : null
    });
});

// Card info
router.get('/card-info', (req, res) => {
    const currentCard = getCurrentCard();
    if (!isCardPresent()) {
        return res.status(400).json({ success: false, error: 'No card present' });
    }
    res.json({
        success: true,
        cardPresent: true,
        uid: currentCard.uid,
        atr: currentCard.atr ? bufferToHex(currentCard.atr) : null,
        type: currentCard.type
    });
});

// Server status
router.get('/status', (req, res) => {
    res.json({
        status: 'running',
        message: 'ACR122U Web Server is running',
        readerDetected: isReaderAvailable(),
        cardPresent: isCardPresent(),
        timestamp: new Date().toISOString()
    });
});

// Read UID
router.get('/read-uid', (req, res) => {
    const currentCard = getCurrentCard();
    if (!isCardPresent()) {
        return res.status(400).json({ success: false, error: 'No card present' });
    }
    res.json({ success: true, uid: currentCard.uid });
});

// Read UID little endian
router.get('/read-uid-le', (req, res) => {
    const currentCard = getCurrentCard();
    if (!isCardPresent()) {
        return res.status(400).json({ success: false, error: 'No card present' });
    }
    const uid = currentCard.uid;
    const leUid = uid.match(/.{1,2}/g).reverse().join('');
    const decimal = parseInt(leUid, 16);
    res.json({ success: true, uid_le: leUid, decimal });
});

module.exports = router; 