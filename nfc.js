// nfc.js
const { NFC } = require('nfc-pcsc');

// Global variables to track NFC state
let nfc = null;
let readers = new Map();
let currentReader = null;
let currentCard = null;

function initializeNFC() {
    try {
        nfc = new NFC();
        nfc.on('reader', reader => {
            console.log(`Reader detected: ${reader.reader.name}`);
            readers.set(reader.reader.name, reader);
            currentReader = reader;
            reader.on('card', card => {
                console.log(`Card detected: ${card.uid}`);
                currentCard = card;
            });
            reader.on('card.off', card => {
                console.log(`Card removed: ${card.uid}`);
                currentCard = null;
            });
            reader.on('error', err => {
                console.error('Reader error:', err);
            });
            reader.on('end', () => {
                console.log(`Reader removed: ${reader.reader.name}`);
                readers.delete(reader.reader.name);
                if (currentReader && currentReader.reader.name === reader.reader.name) {
                    currentReader = null;
                    currentCard = null;
                }
            });
        });
        nfc.on('error', err => {
            console.error('NFC error:', err);
        });
        console.log('NFC initialized successfully');
    } catch (error) {
        console.error('Error initializing NFC:', error);
    }
}

function isReaderAvailable() {
    return currentReader !== null;
}

function isCardPresent() {
    return currentCard !== null;
}

function hexToBuffer(hex) {
    return Buffer.from(hex, 'hex');
}

function bufferToHex(buffer) {
    return buffer.toString('hex').toUpperCase();
}

async function sendApdu(apdu) {
    if (!currentReader || !currentCard) {
        throw new Error('No reader or card available');
    }
    const command = hexToBuffer(apdu);
    console.log(`Sending APDU: ${apdu}`);
    const response = await currentReader.transmit(command, 255);
    console.log(`APDU Response: ${bufferToHex(response)}`);
    return response;
}

async function loadAuthKey(key = 'FFFFFFFFFFFF') {
    const command = `FF82000006${key}`;
    const response = await sendApdu(command);
    const responseHex = bufferToHex(response);
    if (!responseHex.endsWith('9000')) {
        throw new Error(`Load key failed: ${responseHex}`);
    }
    return response;
}

async function authenticateBlock(blockNumber, keyType = 'A', keyLocation = 0) {
    const blockHex = blockNumber.toString(16).padStart(2, '0');
    const keyTypeByte = keyType.toUpperCase() === 'A' ? '60' : '61';
    const keyLocationHex = keyLocation.toString(16).padStart(2, '0');
    const command = `FF86000005010000${blockHex}${keyTypeByte}${keyLocationHex}`;
    const response = await sendApdu(command);
    const responseHex = bufferToHex(response);
    if (!responseHex.endsWith('9000')) {
        throw new Error(`Authenticate failed: ${responseHex}`);
    }
    return response;
}

async function authenticateBlockImproved(blockNumber, keyType = 'A', key = 'FFFFFFFFFFFF') {
    const keyTypeByte = keyType.toUpperCase() === 'A' ? '60' : '61';
    const commonKeys = [
        key,
        'FFFFFFFFFFFF',
        'A0A1A2A3A4A5',
        'B0B1B2B3B4B5',
        'D3F7D3F7D3F7',
        '000000000000'
    ];
    for (const tryKey of commonKeys) {
        try {
            console.log(`Trying key: ${tryKey}`);
            const loadCommand = `FF82000006${tryKey}`;
            const loadResponse = await sendApdu(loadCommand);
            const loadResponseHex = bufferToHex(loadResponse);
            if (!loadResponseHex.endsWith('9000')) {
                console.log(`Load key failed: ${loadResponseHex}`);
                continue;
            }
            const blockHex = blockNumber.toString(16).padStart(2, '0');
            const authCommand = `FF86000005010000${blockHex}${keyTypeByte}00`;
            const authResponse = await sendApdu(authCommand);
            const authResponseHex = bufferToHex(authResponse);
            if (authResponseHex.endsWith('9000')) {
                console.log(`✓ Authentication successful with key: ${tryKey}`);
                return { success: true, key: tryKey };
            } else {
                console.log(`Authentication failed with key ${tryKey}: ${authResponseHex}`);
            }
        } catch (error) {
            console.log(`Error with key ${tryKey}: ${error.message}`);
        }
    }
    throw new Error(`Authentication failed for block ${blockNumber} with all common keys`);
}

async function readBlockImproved(blockNumber, keyType = 'A', key = 'FFFFFFFFFFFF') {
    const authResult = await authenticateBlockImproved(blockNumber, keyType, key);
    if (!authResult.success) {
        throw new Error(`Authentication failed for block ${blockNumber}`);
    }
    const blockHex = blockNumber.toString(16).padStart(2, '0');
    const readCommand = `FFB00000${blockHex}10`;
    const response = await sendApdu(readCommand);
    const responseHex = bufferToHex(response);
    if (!responseHex.endsWith('9000')) {
        throw new Error(`Read failed with status: ${responseHex.slice(-4)}`);
    }
    const dataOnly = response.slice(0, -2);
    return {
        blockNumber,
        data: bufferToHex(dataOnly),
        keyUsed: authResult.key
    };
}

async function readBlockWithRetry(blockNumber, keyType, key, retry = 2) {
    for (let i = 0; i <= retry; i++) {
        try {
            await loadAuthKey(key);
            await authenticateBlock(blockNumber, keyType);
            const blockHex = parseInt(blockNumber).toString(16).padStart(2, '0');
            const readCommand = `FFB00000${blockHex}10`;
            const response = await sendApdu(readCommand);
            const responseHex = bufferToHex(response);
            if (!responseHex.endsWith('9000')) {
                throw new Error(`Read failed with status: ${responseHex.slice(-4)}`);
            }
            return response.slice(0, -2);
        } catch (err) {
            if (i === retry) throw err;
        }
    }
}

module.exports = {
    initializeNFC,
    isReaderAvailable,
    isCardPresent,
    hexToBuffer,
    bufferToHex,
    sendApdu,
    loadAuthKey,
    authenticateBlock,
    authenticateBlockImproved,
    readBlockImproved,
    readBlockWithRetry,
    getCurrentReader: () => currentReader,
    getCurrentCard: () => currentCard
}; 