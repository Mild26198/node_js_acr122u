// routes/sector.js
const express = require('express');
const router = express.Router();
const {
    isReaderAvailable,
    isCardPresent,
    loadAuthKey,
    authenticateBlock,
    authenticateBlockImproved,
    sendApdu,
    bufferToHex
} = require('../nfc');

// อ่าน sector แบบ 3 blocks (ไม่รวม trailer)
router.post('/read-sector', async (req, res) => {
    const { sectorNumber = 1, keyType = 'A', key = 'FFFFFFFFFFFF' } = req.body;
    
    try {
        // ตรวจสอบเบื้องต้น
        if (!isReaderAvailable()) {
            return res.status(500).json({ 
                success: false, 
                error: 'No NFC reader detected' 
            });
        }
        
        if (!isCardPresent()) {
            return res.status(400).json({ 
                success: false, 
                error: 'No card present' 
            });
        }

        // คำนวณ block addresses
        const startBlock = sectorNumber * 4;
        const keyNumber = 0; // Key location in reader volatile memory
        const results = [];
        let authenticated = false;
        let currentAuthenticatedSector = -1;

        // Load authentication key ลง reader
        try {
            await loadAuthKey(key, keyNumber);
        } catch (error) {
            return res.status(500).json({ 
                success: false, 
                error: `Failed to load authentication key: ${error.message}` 
            });
        }

        // Authenticate ครั้งเดียวสำหรับทั้ง sector
        const blockSector = Math.floor(startBlock / 4);
        const keyTypeHex = keyType === 'A' ? '60' : '61';
        const trailerBlock = blockSector * 4 + 3;
        
        console.log(`Authenticating sector ${blockSector} using trailer block ${trailerBlock}`);
        
        // สร้าง APDU สำหรับ authentication
        // Format: FF 86 00 00 05 01 00 [Trailer Block] [KeyType] [KeyNumber]
        const authApdu = `FF860000050100${trailerBlock.toString(16).padStart(2, '0')}${keyTypeHex}${keyNumber.toString(16).padStart(2, '0')}`;
        
        console.log(`Auth APDU: ${authApdu}`);
        
        const authResponse = await sendApdu(authApdu);
        const authResponseHex = bufferToHex(authResponse);
        
        console.log(`Auth Response: ${authResponseHex}`);
        
        if (!authResponseHex.endsWith('9000')) {
            // ลอง Key Type อื่น
            const alternateKeyTypeHex = keyType === 'A' ? '61' : '60';
            const alternateKeyType = keyType === 'A' ? 'B' : 'A';
            
            console.log(`Retrying with Key Type ${alternateKeyType}`);
            
            const altAuthApdu = `FF860000050100${trailerBlock.toString(16).padStart(2, '0')}${alternateKeyTypeHex}${keyNumber.toString(16).padStart(2, '0')}`;
            const altAuthResponse = await sendApdu(altAuthApdu);
            const altAuthResponseHex = bufferToHex(altAuthResponse);
            
            console.log(`Alt Auth Response: ${altAuthResponseHex}`);
            
            if (!altAuthResponseHex.endsWith('9000')) {
                throw new Error(`Authentication failed for sector ${blockSector} (trailer block ${trailerBlock.toString(16).padStart(2, '0').toUpperCase()}) with both Key A and Key B. Status: ${authResponseHex.slice(-4)}`);
            }
            
            console.log(`Authentication successful with Key Type ${alternateKeyType}`);
        }

        // อ่านแต่ละ block ใน sector (3 blocks)
        for (let i = 0; i < 3; i++) {
            const blockNumber = startBlock + i;
            
            try {

                console.log(`Reading block ${blockNumber} (0x${blockNumber.toString(16).padStart(2, '0').toUpperCase()})`);
                
                // อ่าน block data - แก้ไข APDU format
                // Format: FF B0 00 [Block Number] [Le]
                const blockHex = blockNumber.toString(16).padStart(2, '0');
                const readCommand = `FFB000${blockHex}10`; // แก้ไขตรงนี้
                
                console.log(`Read APDU: ${readCommand}`);
                console.log(`Expected: FF B0 00 ${blockHex.toUpperCase()} 10`);
                
                const response = await sendApdu(readCommand);
                const responseHex = bufferToHex(response);
                
                console.log(`Read Response: ${responseHex}`);
                
                if (!responseHex.endsWith('9000')) {
                    // ลองใช้ alternative authentication method
                    console.log(`Read failed, trying alternative method for block ${blockNumber}`);
                    
                    // ลอง authenticate ใหม่ด้วย block number แทน trailer block
                    const directAuthApdu = `FF860000050100${blockHex}${keyTypeHex}${keyNumber.toString(16).padStart(2, '0')}`;
                    console.log(`Direct Auth APDU: ${directAuthApdu}`);
                    
                    const directAuthResponse = await sendApdu(directAuthApdu);
                    const directAuthResponseHex = bufferToHex(directAuthResponse);
                    
                    console.log(`Direct Auth Response: ${directAuthResponseHex}`);
                    
                    if (directAuthResponseHex.endsWith('9000')) {
                        // ลองอ่านอีกครั้ง
                        const retryResponse = await sendApdu(readCommand);
                        const retryResponseHex = bufferToHex(retryResponse);
                        
                        console.log(`Retry Read Response: ${retryResponseHex}`);
                        
                        if (!retryResponseHex.endsWith('9000')) {
                            throw new Error(`Read failed for block ${blockHex.toUpperCase()} after direct auth. Status: ${retryResponseHex.slice(-4)}`);
                        }
                        
                        // สำเร็จ
                        const dataOnly = retryResponse.slice(0, -2);
                        const dataHex = bufferToHex(dataOnly);
                        
                        results.push({ 
                            blockNumber: blockNumber, 
                            blockHex: blockHex.toUpperCase(),
                            data: dataHex.toUpperCase(), 
                            success: true,
                            method: 'direct-auth'
                        });
                    } else {
                        throw new Error(`Read failed for block ${blockHex.toUpperCase()} with status: ${responseHex.slice(-4)}`);
                    }
                } else {
                    // อ่านสำเร็จ
                    const dataOnly = response.slice(0, -2);
                    const dataHex = bufferToHex(dataOnly);
                    
                    // แปลงเป็น ASCII เพื่อดูข้อมูล
                    const asciiData = dataHex.match(/.{2}/g)
                        .map(byte => {
                            const charCode = parseInt(byte, 16);
                            return (charCode >= 32 && charCode <= 126) ? String.fromCharCode(charCode) : '.';
                        })
                        .join('');
                    
                    console.log(`Block ${blockNumber}: ${dataHex.toUpperCase()} | ${asciiData}`);
                    
                    // ตรวจสอบว่าเป็นข้อมูลว่างหรือไม่
                    const isEmpty = dataHex.match(/^0+$/);
                    const dataType = isEmpty ? 'Empty' : 'Data';
                    
                    results.push({ 
                        blockNumber: blockNumber, 
                        blockHex: blockHex.toUpperCase(),
                        data: dataHex.toUpperCase(),
                        ascii: asciiData,
                        dataType: dataType,
                        success: true,
                        method: 'trailer-auth'
                    });
                }
                
            } catch (error) {
                console.log(`Error reading block ${blockNumber}: ${error.message}`);
                
                results.push({ 
                    blockNumber: blockNumber,
                    blockHex: blockNumber.toString(16).padStart(2, '0').toUpperCase(),
                    error: error.message, 
                    success: false 
                });
            }
        }

        // ส่งผลลัพธ์
        res.json({ 
            success: true, 
            sectorNumber: sectorNumber,
            keyType: keyType,
            totalBlocks: results.length,
            successfulReads: results.filter(r => r.success).length,
            results: results 
        });

    } catch (error) {
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// เขียน sector (3 blocks)
router.post('/write-sector', async (req, res) => {
    const { sectorNumber = 1, keyType = 'A', key = 'FFFFFFFFFFFF', dataBlocks } = req.body;
    
    // ตรวจสอบ input validation
    if (!Array.isArray(dataBlocks) || dataBlocks.length !== 3) {
        return res.status(400).json({ 
            success: false, 
            error: 'dataBlocks ต้องเป็น array ขนาด 3 (แต่ละ block 16 bytes = 32 hex chars)' 
        });
    }

    // ตรวจสอบ data format
    for (let i = 0; i < dataBlocks.length; i++) {
        const data = dataBlocks[i];
        if (typeof data !== 'string' || data.length !== 32) {
            return res.status(400).json({ 
                success: false, 
                error: `Block ${i} ต้องเป็น string 32 hex chars (16 bytes), received: ${data?.length || 'undefined'} chars` 
            });
        }
        
        // ตรวจสอบว่าเป็น hex string
        if (!/^[0-9A-Fa-f]+$/.test(data)) {
            return res.status(400).json({ 
                success: false, 
                error: `Block ${i} ต้องเป็น hexadecimal string เท่านั้น` 
            });
        }
    }

    try {
        // ตรวจสอบเบื้องต้น
        if (!isReaderAvailable()) {
            return res.status(500).json({ 
                success: false, 
                error: 'No NFC reader detected' 
            });
        }
        
        if (!isCardPresent()) {
            return res.status(400).json({ 
                success: false, 
                error: 'No card present' 
            });
        }

        // คำนวณ block addresses
        const startBlock = sectorNumber * 4;
        const keyNumber = 0; // Key location in reader volatile memory
        const results = [];
        let authenticated = false;
        let currentAuthenticatedSector = -1;

        // Load authentication key ลง reader
        try {
            await loadAuthKey(key, keyNumber);
        } catch (error) {
            return res.status(500).json({ 
                success: false, 
                error: `Failed to load authentication key: ${error.message}` 
            });
        }

        // เขียนแต่ละ block ใน sector (3 blocks)
        for (let i = 0; i < 3; i++) {
            const blockNumber = startBlock + i;
            const blockSector = Math.floor(blockNumber / 4);
            const blockData = dataBlocks[i].toUpperCase();
            
            try {
                // Authenticate ถ้าจำเป็น (เมื่อเปลี่ยน sector หรือยังไม่ได้ authenticate)
                if (!authenticated || currentAuthenticatedSector !== blockSector) {
                    const keyTypeHex = keyType === 'A' ? '60' : '61';
                    
                    // ใช้ trailer block สำหรับ authentication (sector * 4 + 3)
                    const trailerBlock = blockSector * 4 + 3;
                    
                    console.log(`Authenticating sector ${blockSector} (block ${blockNumber}) using trailer block ${trailerBlock}`);
                    
                    // สร้าง APDU สำหรับ authentication
                    // Format: FF 86 00 00 05 01 00 [Trailer Block] [KeyType] [KeyNumber]
                    const authApdu = `FF860000050100${trailerBlock.toString(16).padStart(2, '0')}${keyTypeHex}${keyNumber.toString(16).padStart(2, '0')}`;
                    
                    console.log(`Auth APDU: ${authApdu}`);
                    
                    const authResponse = await sendApdu(authApdu);
                    const authResponseHex = bufferToHex(authResponse);
                    
                    console.log(`Auth Response: ${authResponseHex}`);
                    
                    if (!authResponseHex.endsWith('9000')) {
                        // ลอง Key Type อื่น
                        const alternateKeyTypeHex = keyType === 'A' ? '61' : '60';
                        const alternateKeyType = keyType === 'A' ? 'B' : 'A';
                        
                        console.log(`Retrying with Key Type ${alternateKeyType}`);
                        
                        const altAuthApdu = `FF860000050100${trailerBlock.toString(16).padStart(2, '0')}${alternateKeyTypeHex}${keyNumber.toString(16).padStart(2, '0')}`;
                        const altAuthResponse = await sendApdu(altAuthApdu);
                        const altAuthResponseHex = bufferToHex(altAuthResponse);
                        
                        console.log(`Alt Auth Response: ${altAuthResponseHex}`);
                        
                        if (!altAuthResponseHex.endsWith('9000')) {
                            throw new Error(`Authentication failed for sector ${blockSector} (trailer block ${trailerBlock.toString(16).padStart(2, '0').toUpperCase()}) with both Key A and Key B. Status: ${authResponseHex.slice(-4)}`);
                        }
                        
                        console.log(`Authentication successful with Key Type ${alternateKeyType}`);
                    }
                    
                    authenticated = true;
                    currentAuthenticatedSector = blockSector;
                }

                // เขียน block data
                // Format: FF D6 00 [Block Number] 10 [16 bytes data]
                const blockHex = blockNumber.toString(16).padStart(2, '0');
                const writeCommand = `FFD600${blockHex}10${blockData}`;
                
                const response = await sendApdu(writeCommand);
                const responseHex = bufferToHex(response);
                
                if (!responseHex.endsWith('9000')) {
                    throw new Error(`Write failed for block ${blockHex.toUpperCase()} with status: ${responseHex.slice(-4)}`);
                }
                
                results.push({ 
                    blockNumber: blockNumber,
                    blockHex: blockHex.toUpperCase(),
                    data: blockData, 
                    success: true 
                });
                
            } catch (error) {
                results.push({ 
                    blockNumber: blockNumber,
                    blockHex: blockNumber.toString(16).padStart(2, '0').toUpperCase(),
                    error: error.message, 
                    success: false 
                });
                
                // Reset authentication state เมื่อเกิด error
                authenticated = false;
                currentAuthenticatedSector = -1;
            }
        }

        // ส่งผลลัพธ์
        res.json({ 
            success: true, 
            sectorNumber: sectorNumber,
            keyType: keyType,
            totalBlocks: results.length,
            successfulWrites: results.filter(r => r.success).length,
            results: results 
        });

    } catch (error) {
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// อ่าน single block
router.post('/read-block', async (req, res) => {
    const { blockNumber, keyType = 'A', key = 'FFFFFFFFFFFF' } = req.body;
    
    if (blockNumber === undefined || blockNumber === null) {
        return res.status(400).json({ 
            success: false, 
            error: 'blockNumber is required' 
        });
    }

    try {
        // ตรวจสอบเบื้องต้น
        if (!isReaderAvailable()) {
            return res.status(500).json({ 
                success: false, 
                error: 'No NFC reader detected' 
            });
        }
        
        if (!isCardPresent()) {
            return res.status(400).json({ 
                success: false, 
                error: 'No card present' 
            });
        }

        const keyNumber = 0;
        
        // Load authentication key
        await loadAuthKey(key, keyNumber);
        
        // Authenticate
        const keyTypeHex = keyType === 'A' ? '60' : '61';
        const authApdu = `FF860000050100${blockNumber.toString(16).padStart(2, '0')}${keyTypeHex}${keyNumber.toString(16).padStart(2, '0')}`;
        
        const authResponse = await sendApdu(authApdu);
        const authResponseHex = bufferToHex(authResponse);
        
        if (!authResponseHex.endsWith('9000')) {
            throw new Error(`Authentication failed with status: ${authResponseHex.slice(-4)}`);
        }
        
        // Read block
        const blockHex = blockNumber.toString(16).padStart(2, '0');
        const readCommand = `FFB00000${blockHex}10`;
        
        const response = await sendApdu(readCommand);
        const responseHex = bufferToHex(response);
        
        if (!responseHex.endsWith('9000')) {
            throw new Error(`Read failed with status: ${responseHex.slice(-4)}`);
        }
        
        const dataOnly = response.slice(0, -2);
        const dataHex = bufferToHex(dataOnly);
        
        res.json({ 
            success: true, 
            blockNumber: blockNumber,
            blockHex: blockHex.toUpperCase(),
            data: dataHex.toUpperCase()
        });

    } catch (error) {
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// เขียน single block
router.post('/write-block', async (req, res) => {
    const { blockNumber, keyType = 'A', key = 'FFFFFFFFFFFF', data } = req.body;
    
    if (blockNumber === undefined || blockNumber === null) {
        return res.status(400).json({ 
            success: false, 
            error: 'blockNumber is required' 
        });
    }
    
    if (!data || typeof data !== 'string' || data.length !== 32) {
        return res.status(400).json({ 
            success: false, 
            error: 'data ต้องเป็น string 32 hex chars (16 bytes)' 
        });
    }
    
    if (!/^[0-9A-Fa-f]+$/.test(data)) {
        return res.status(400).json({ 
            success: false, 
            error: 'data ต้องเป็น hexadecimal string เท่านั้น' 
        });
    }

    try {
        // ตรวจสอบเบื้องต้น
        if (!isReaderAvailable()) {
            return res.status(500).json({ 
                success: false, 
                error: 'No NFC reader detected' 
            });
        }
        
        if (!isCardPresent()) {
            return res.status(400).json({ 
                success: false, 
                error: 'No card present' 
            });
        }

        const keyNumber = 0;
        
        // Load authentication key
        await loadAuthKey(key, keyNumber);
        
        // Authenticate
        const keyTypeHex = keyType === 'A' ? '60' : '61';
        const authApdu = `FF860000050100${blockNumber.toString(16).padStart(2, '0')}${keyTypeHex}${keyNumber.toString(16).padStart(2, '0')}`;
        
        const authResponse = await sendApdu(authApdu);
        const authResponseHex = bufferToHex(authResponse);
        
        if (!authResponseHex.endsWith('9000')) {
            throw new Error(`Authentication failed with status: ${authResponseHex.slice(-4)}`);
        }
        
        // Write block
        const blockHex = blockNumber.toString(16).padStart(2, '0');
        const writeCommand = `FFD600${blockHex}10${data.toUpperCase()}`;
        
        const response = await sendApdu(writeCommand);
        const responseHex = bufferToHex(response);
        
        if (!responseHex.endsWith('9000')) {
            throw new Error(`Write failed with status: ${responseHex.slice(-4)}`);
        }
        
        res.json({ 
            success: true, 
            blockNumber: blockNumber,
            blockHex: blockHex.toUpperCase(),
            data: data.toUpperCase()
        });

    } catch (error) {
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// ทดสอบอ่าน sector 0 (ที่มักจะอ่านได้) พร้อมทดสอบ Access Control
router.post('/test-read-sector0', async (req, res) => {
    try {
        if (!isReaderAvailable()) {
            return res.status(500).json({ success: false, error: 'No NFC reader detected' });
        }
        
        if (!isCardPresent()) {
            return res.status(400).json({ success: false, error: 'No card present' });
        }

        const key = 'FFFFFFFFFFFF';
        const keyNumber = 0;
        const results = [];
        
        // Load key
        await loadAuthKey(key, keyNumber);
        
        // อ่าน sector 0 (blocks 0, 1, 2) และ trailer block 3
        for (let blockNumber = 0; blockNumber < 4; blockNumber++) {
            try {
                console.log(`Testing block ${blockNumber}`);
                
                // Method 1: ใช้ old style authentication (PC/SC V2.01)
                const authApdu1 = `FF88000${blockNumber.toString(16)}600`;
                console.log(`Method 1 (Old Style) Auth APDU: ${authApdu1}`);
                
                try {
                    const authResponse1 = await sendApdu(authApdu1);
                    const authResponseHex1 = bufferToHex(authResponse1);
                    console.log(`Method 1 Auth Response: ${authResponseHex1}`);
                    
                    if (authResponseHex1.endsWith('9000')) {
                        // ลองอ่าน
                        const readApdu = `FFB00000${blockNumber.toString(16).padStart(2, '0')}10`;
                        console.log(`Read APDU: ${readApdu}`);
                        
                        const readResponse = await sendApdu(readApdu);
                        const readResponseHex = bufferToHex(readResponse);
                        console.log(`Read Response: ${readResponseHex}`);
                        
                        if (readResponseHex.endsWith('9000')) {
                            const dataOnly = readResponse.slice(0, -2);
                            const dataHex = bufferToHex(dataOnly);
                            
                            results.push({
                                blockNumber: blockNumber,
                                method: 'old-style-auth',
                                data: dataHex.toUpperCase(),
                                success: true
                            });
                            continue;
                        }
                    }
                } catch (e) {
                    console.log(`Method 1 failed: ${e.message}`);
                }
                
                // Method 2: New style authentication with trailer block
                const authApdu2 = `FF860000050100036000`;
                console.log(`Method 2 (New Style) Auth APDU: ${authApdu2}`);
                
                const authResponse2 = await sendApdu(authApdu2);
                const authResponseHex2 = bufferToHex(authResponse2);
                console.log(`Method 2 Auth Response: ${authResponseHex2}`);
                
                if (authResponseHex2.endsWith('9000')) {
                    // ลองอ่าน
                    const readApdu = `FFB00000${blockNumber.toString(16).padStart(2, '0')}10`;
                    console.log(`Read APDU: ${readApdu}`);
                    
                    const readResponse = await sendApdu(readApdu);
                    const readResponseHex = bufferToHex(readResponse);
                    console.log(`Read Response: ${readResponseHex}`);
                    
                    if (readResponseHex.endsWith('9000')) {
                        const dataOnly = readResponse.slice(0, -2);
                        const dataHex = bufferToHex(dataOnly);
                        
                        results.push({
                            blockNumber: blockNumber,
                            method: 'new-style-auth',
                            data: dataHex.toUpperCase(),
                            success: true
                        });
                        continue;
                    }
                }
                
                // Method 3: ลอง Key B
                const authApdu3 = `FF860000050100036100`;
                console.log(`Method 3 (Key B) Auth APDU: ${authApdu3}`);
                
                const authResponse3 = await sendApdu(authApdu3);
                const authResponseHex3 = bufferToHex(authResponse3);
                console.log(`Method 3 Auth Response: ${authResponseHex3}`);
                
                if (authResponseHex3.endsWith('9000')) {
                    // ลองอ่าน
                    const readApdu = `FFB00000${blockNumber.toString(16).padStart(2, '0')}10`;
                    console.log(`Read APDU: ${readApdu}`);
                    
                    const readResponse = await sendApdu(readApdu);
                    const readResponseHex = bufferToHex(readResponse);
                    console.log(`Read Response: ${readResponseHex}`);
                    
                    if (readResponseHex.endsWith('9000')) {
                        const dataOnly = readResponse.slice(0, -2);
                        const dataHex = bufferToHex(dataOnly);
                        
                        results.push({
                            blockNumber: blockNumber,
                            method: 'key-b-auth',
                            data: dataHex.toUpperCase(),
                            success: true
                        });
                        continue;
                    }
                }
                
                results.push({
                    blockNumber: blockNumber,
                    method: 'none',
                    error: 'All authentication methods failed',
                    success: false
                });
                
            } catch (error) {
                results.push({
                    blockNumber: blockNumber,
                    error: error.message,
                    success: false
                });
            }
        }
        
        res.json({ success: true, results: results });
        
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ทดสอบอ่าน sector อื่นๆ ด้วยวิธีที่ใช้ได้จาก sector 0
router.post('/test-read-any-sector', async (req, res) => {
    const { sectorNumber = 1, method = 'old-style' } = req.body;
    
    try {
        if (!isReaderAvailable()) {
            return res.status(500).json({ success: false, error: 'No NFC reader detected' });
        }
        
        if (!isCardPresent()) {
            return res.status(400).json({ success: false, error: 'No card present' });
        }

        const key = 'FFFFFFFFFFFF';
        const keyNumber = 0;
        const results = [];
        const startBlock = sectorNumber * 4;
        
        // Load key
        await loadAuthKey(key, keyNumber);
        
        // อ่าน 3 data blocks ของ sector
        for (let i = 0; i < 3; i++) {
            const blockNumber = startBlock + i;
            
            try {
                console.log(`Testing block ${blockNumber} with method: ${method}`);
                
                let authSuccess = false;
                
                if (method === 'old-style') {
                    // Method 1: Old style authentication
                    const authApdu = `FF88000${blockNumber.toString(16)}600`;
                    console.log(`Old Style Auth APDU: ${authApdu}`);
                    
                    const authResponse = await sendApdu(authApdu);
                    const authResponseHex = bufferToHex(authResponse);
                    console.log(`Auth Response: ${authResponseHex}`);
                    
                    authSuccess = authResponseHex.endsWith('9000');
                } else if (method === 'new-style') {
                    // Method 2: New style authentication with trailer block
                    const trailerBlock = sectorNumber * 4 + 3;
                    const authApdu = `FF860000050100${trailerBlock.toString(16).padStart(2, '0')}6000`;
                    console.log(`New Style Auth APDU: ${authApdu}`);
                    
                    const authResponse = await sendApdu(authApdu);
                    const authResponseHex = bufferToHex(authResponse);
                    console.log(`Auth Response: ${authResponseHex}`);
                    
                    authSuccess = authResponseHex.endsWith('9000');
                } else if (method === 'key-b') {
                    // Method 3: Key B authentication
                    const trailerBlock = sectorNumber * 4 + 3;
                    const authApdu = `FF860000050100${trailerBlock.toString(16).padStart(2, '0')}6100`;
                    console.log(`Key B Auth APDU: ${authApdu}`);
                    
                    const authResponse = await sendApdu(authApdu);
                    const authResponseHex = bufferToHex(authResponse);
                    console.log(`Auth Response: ${authResponseHex}`);
                    
                    authSuccess = authResponseHex.endsWith('9000');
                }
                
                if (authSuccess) {
                    // ลองอ่าน
                    const readApdu = `FFB00000${blockNumber.toString(16).padStart(2, '0')}10`;
                    console.log(`Read APDU: ${readApdu}`);
                    
                    const readResponse = await sendApdu(readApdu);
                    const readResponseHex = bufferToHex(readResponse);
                    console.log(`Read Response: ${readResponseHex}`);
                    
                    if (readResponseHex.endsWith('9000')) {
                        const dataOnly = readResponse.slice(0, -2);
                        const dataHex = bufferToHex(dataOnly);
                        
                        results.push({
                            blockNumber: blockNumber,
                            method: method,
                            data: dataHex.toUpperCase(),
                            success: true
                        });
                    } else {
                        results.push({
                            blockNumber: blockNumber,
                            method: method,
                            error: `Read failed with status: ${readResponseHex.slice(-4)}`,
                            success: false
                        });
                    }
                } else {
                    results.push({
                        blockNumber: blockNumber,
                        method: method,
                        error: 'Authentication failed',
                        success: false
                    });
                }
                
            } catch (error) {
                results.push({
                    blockNumber: blockNumber,
                    method: method,
                    error: error.message,
                    success: false
                });
            }
        }
        
        res.json({ 
            success: true, 
            sectorNumber: sectorNumber,
            method: method,
            results: results 
        });
        
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ทดลองอ่าน sector พร้อมแก้ปัญหา 6300
router.post('/read-sector-fixed', async (req, res) => {
    const { sectorNumber = 1, keyType = 'A', key = 'FFFFFFFFFFFF' } = req.body;
    
    try {
        // ตรวจสอบเบื้องต้น
        if (!isReaderAvailable()) {
            return res.status(500).json({ success: false, error: 'No NFC reader detected' });
        }
        
        if (!isCardPresent()) {
            return res.status(400).json({ success: false, error: 'No card present' });
        }

        const keyNumber = 0;
        const results = [];
        const startBlock = sectorNumber * 4;
        
        // Load key
        await loadAuthKey(key, keyNumber);
        console.log(`Key loaded: ${key}`);
        
        // วิธีที่ 1: ใช้ Old Style Authentication (PC/SC V2.01)
        console.log(`\n=== Method 1: Old Style Authentication ===`);
        let methodWorked = false;
        
        for (let i = 0; i < 3; i++) {
            const blockNumber = startBlock + i;
            
            try {
                console.log(`\nTesting block ${blockNumber} with old style auth...`);
                
                // Old style auth: FF 88 00 [Block] [KeyType] [KeyNumber]
                const keyTypeHex = keyType === 'A' ? '60' : '61';
                const authApdu = `FF88000${blockNumber.toString(16)}${keyTypeHex}0`;
                console.log(`Auth APDU: ${authApdu}`);
                
                const authResponse = await sendApdu(authApdu);
                const authResponseHex = bufferToHex(authResponse);
                console.log(`Auth Response: ${authResponseHex}`);
                
                if (authResponseHex.endsWith('9000')) {
                    // ลองอ่าน
                    const readApdu = `FFB00000${blockNumber.toString(16).padStart(2, '0')}10`;
                    console.log(`Read APDU: ${readApdu}`);
                    
                    const readResponse = await sendApdu(readApdu);
                    const readResponseHex = bufferToHex(readResponse);
                    console.log(`Read Response: ${readResponseHex}`);
                    
                    if (readResponseHex.endsWith('9000')) {
                        const dataOnly = readResponse.slice(0, -2);
                        const dataHex = bufferToHex(dataOnly);
                        
                        results.push({
                            blockNumber: blockNumber,
                            method: 'old-style',
                            data: dataHex.toUpperCase(),
                            success: true
                        });
                        methodWorked = true;
                        continue;
                    }
                }
                
                // ถ้า old style ไม่ได้ ลอง key B
                if (keyType === 'A') {
                    console.log(`Trying Key B for block ${blockNumber}...`);
                    const authApduB = `FF88000${blockNumber.toString(16)}610`;
                    console.log(`Auth APDU (Key B): ${authApduB}`);
                    
                    const authResponseB = await sendApdu(authApduB);
                    const authResponseHexB = bufferToHex(authResponseB);
                    console.log(`Auth Response (Key B): ${authResponseHexB}`);
                    
                    if (authResponseHexB.endsWith('9000')) {
                        const readApdu = `FFB00000${blockNumber.toString(16).padStart(2, '0')}10`;
                        const readResponse = await sendApdu(readApdu);
                        const readResponseHex = bufferToHex(readResponse);
                        console.log(`Read Response (Key B): ${readResponseHex}`);
                        
                        if (readResponseHex.endsWith('9000')) {
                            const dataOnly = readResponse.slice(0, -2);
                            const dataHex = bufferToHex(dataOnly);
                            
                            results.push({
                                blockNumber: blockNumber,
                                method: 'old-style-key-b',
                                data: dataHex.toUpperCase(),
                                success: true
                            });
                            methodWorked = true;
                            continue;
                        }
                    }
                }
                
                results.push({
                    blockNumber: blockNumber,
                    method: 'old-style',
                    error: 'Authentication or read failed',
                    success: false
                });
                
            } catch (error) {
                results.push({
                    blockNumber: blockNumber,
                    method: 'old-style',
                    error: error.message,
                    success: false
                });
            }
        }
        
        // ถ้าวิธีแรกไม่ได้ลอง T=CL Emulation
        if (!methodWorked) {
            console.log(`\n=== Method 2: T=CL Emulation ===`);
            
            // อ่าน trailer block เพื่อดู access control bits
            const trailerBlock = sectorNumber * 4 + 3;
            
            try {
                console.log(`Reading trailer block ${trailerBlock} to check access control...`);
                
                // Authenticate trailer block
                const authApdu = `FF88000${trailerBlock.toString(16)}600`;
                console.log(`Trailer Auth APDU: ${authApdu}`);
                
                const authResponse = await sendApdu(authApdu);
                const authResponseHex = bufferToHex(authResponse);
                console.log(`Trailer Auth Response: ${authResponseHex}`);
                
                if (authResponseHex.endsWith('9000')) {
                    const readApdu = `FFB00000${trailerBlock.toString(16).padStart(2, '0')}10`;
                    const readResponse = await sendApdu(readApdu);
                    const readResponseHex = bufferToHex(readResponse);
                    console.log(`Trailer Read Response: ${readResponseHex}`);
                    
                    if (readResponseHex.endsWith('9000')) {
                        const dataOnly = readResponse.slice(0, -2);
                        const dataHex = bufferToHex(dataOnly);
                        console.log(`Trailer Data: ${dataHex}`);
                        
                        // วิเคราะห์ access control bits
                        const accessBits = dataHex.substring(12, 20); // bytes 6-9
                        console.log(`Access Control Bits: ${accessBits}`);
                        
                        // บอกว่าทำไมอ่านไม่ได้
                        results.push({
                            blockNumber: trailerBlock,
                            method: 'trailer-analysis',
                            data: dataHex.toUpperCase(),
                            accessBits: accessBits,
                            analysis: 'Check access control bits - blocks may be write-only or protected',
                            success: true
                        });
                    }
                }
                
            } catch (error) {
                console.log(`Trailer analysis failed: ${error.message}`);
            }
        }
        
        res.json({ 
            success: true, 
            sectorNumber: sectorNumber,
            keyType: keyType,
            methodWorked: methodWorked,
            totalBlocks: results.length,
            successfulReads: results.filter(r => r.success).length,
            results: results 
        });
        
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Quick test - ทดสอบแค่ block เดียว
router.post('/quick-test-block', async (req, res) => {
    const { blockNumber = 0, keyType = 'A', key = 'FFFFFFFFFFFF' } = req.body;
    
    try {
        if (!isReaderAvailable()) {
            return res.status(500).json({ success: false, error: 'No NFC reader detected' });
        }
        
        if (!isCardPresent()) {
            return res.status(400).json({ success: false, error: 'No card present' });
        }

        const keyNumber = 0;
        const results = [];
        
        // Load key
        await loadAuthKey(key, keyNumber);
        console.log(`Testing block ${blockNumber} with key: ${key}`);
        
        // วิธีที่ 1: Old Style (PC/SC V2.01)
        try {
            console.log(`Method 1: Old Style Authentication`);
            const keyTypeHex = keyType === 'A' ? '60' : '61';
            const authApdu = `FF88000${blockNumber.toString(16)}${keyTypeHex}0`;
            console.log(`Auth APDU: ${authApdu}`);
            
            const authResponse = await sendApdu(authApdu);
            const authResponseHex = bufferToHex(authResponse);
            console.log(`Auth Response: ${authResponseHex}`);
            
            if (authResponseHex.endsWith('9000')) {
                const readApdu = `FFB00000${blockNumber.toString(16).padStart(2, '0')}10`;
                console.log(`Read APDU: ${readApdu}`);
                
                const readResponse = await sendApdu(readApdu);
                const readResponseHex = bufferToHex(readResponse);
                console.log(`Read Response: ${readResponseHex}`);
                
                if (readResponseHex.endsWith('9000')) {
                    const dataOnly = readResponse.slice(0, -2);
                    const dataHex = bufferToHex(dataOnly);
                    
                    return res.json({
                        success: true,
                        blockNumber: blockNumber,
                        method: 'old-style-auth',
                        data: dataHex.toUpperCase(),
                        message: 'Successfully read with old style authentication'
                    });
                } else {
                    console.log(`Read failed with status: ${readResponseHex.slice(-4)}`);
                }
            } else {
                console.log(`Auth failed with status: ${authResponseHex.slice(-4)}`);
            }
        } catch (error) {
            console.log(`Method 1 error: ${error.message}`);
        }
        
        // วิธีที่ 2: ลอง Key B ถ้าใช้ Key A
        if (keyType === 'A') {
            try {
                console.log(`Method 2: Old Style with Key B`);
                const authApdu = `FF88000${blockNumber.toString(16)}610`;
                console.log(`Auth APDU (Key B): ${authApdu}`);
                
                const authResponse = await sendApdu(authApdu);
                const authResponseHex = bufferToHex(authResponse);
                console.log(`Auth Response (Key B): ${authResponseHex}`);
                
                if (authResponseHex.endsWith('9000')) {
                    const readApdu = `FFB00000${blockNumber.toString(16).padStart(2, '0')}10`;
                    const readResponse = await sendApdu(readApdu);
                    const readResponseHex = bufferToHex(readResponse);
                    console.log(`Read Response (Key B): ${readResponseHex}`);
                    
                    if (readResponseHex.endsWith('9000')) {
                        const dataOnly = readResponse.slice(0, -2);
                        const dataHex = bufferToHex(dataOnly);
                        
                        return res.json({
                            success: true,
                            blockNumber: blockNumber,
                            method: 'old-style-key-b',
                            data: dataHex.toUpperCase(),
                            message: 'Successfully read with old style Key B authentication'
                        });
                    }
                }
            } catch (error) {
                console.log(`Method 2 error: ${error.message}`);
            }
        }
        
        // วิธีที่ 3: New Style (PC/SC V2.07)
        try {
            console.log(`Method 3: New Style Authentication`);
            const sector = Math.floor(blockNumber / 4);
            const trailerBlock = sector * 4 + 3;
            const keyTypeHex = keyType === 'A' ? '60' : '61';
            
            const authApdu = `FF860000050100${trailerBlock.toString(16).padStart(2, '0')}${keyTypeHex}00`;
            console.log(`Auth APDU (New Style): ${authApdu}`);
            
            const authResponse = await sendApdu(authApdu);
            const authResponseHex = bufferToHex(authResponse);
            console.log(`Auth Response (New Style): ${authResponseHex}`);
            
            if (authResponseHex.endsWith('9000')) {
                const readApdu = `FFB00000${blockNumber.toString(16).padStart(2, '0')}10`;
                const readResponse = await sendApdu(readApdu);
                const readResponseHex = bufferToHex(readResponse);
                console.log(`Read Response (New Style): ${readResponseHex}`);
                
                if (readResponseHex.endsWith('9000')) {
                    const dataOnly = readResponse.slice(0, -2);
                    const dataHex = bufferToHex(dataOnly);
                    
                    return res.json({
                        success: true,
                        blockNumber: blockNumber,
                        method: 'new-style-auth',
                        data: dataHex.toUpperCase(),
                        message: 'Successfully read with new style authentication'
                    });
                }
            }
        } catch (error) {
            console.log(`Method 3 error: ${error.message}`);
        }
        
        res.json({
            success: false,
            blockNumber: blockNumber,
            error: 'All authentication methods failed',
            message: 'Block may be protected or access control bits prevent reading'
        });
        
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Debug function สำหรับตรวจสอบ card และ sector
router.post('/debug-card', async (req, res) => {
    try {
        if (!isReaderAvailable()) {
            return res.status(500).json({ success: false, error: 'No NFC reader detected' });
        }
        
        if (!isCardPresent()) {
            return res.status(400).json({ success: false, error: 'No card present' });
        }

        const debugInfo = {
            cardPresent: true,
            sectors: []
        };

        // ทดสอบ authentication กับ sector 0-15 ด้วย default key
        const defaultKey = 'FFFFFFFFFFFF';
        const keyNumber = 0;
        
        await loadAuthKey(defaultKey, keyNumber);
        
        for (let sector = 0; sector < 16; sector++) {
            const trailerBlock = sector * 4 + 3;
            const sectorInfo = {
                sector: sector,
                trailerBlock: trailerBlock,
                keyA: false,
                keyB: false,
                readable: []
            };
            
            // ทดสอบ Key A
            try {
                const authApduA = `FF860000050100${trailerBlock.toString(16).padStart(2, '0')}60${keyNumber.toString(16).padStart(2, '0')}`;
                const authResponseA = await sendApdu(authApduA);
                const authResponseHexA = bufferToHex(authResponseA);
                
                if (authResponseHexA.endsWith('9000')) {
                    sectorInfo.keyA = true;
                    
                    // ทดสอบอ่าน data blocks
                    for (let i = 0; i < 3; i++) {
                        const blockNumber = sector * 4 + i;
                        try {
                            const readApdu = `FFB00000${blockNumber.toString(16).padStart(2, '0')}10`;
                            const readResponse = await sendApdu(readApdu);
                            const readResponseHex = bufferToHex(readResponse);
                            
                            if (readResponseHex.endsWith('9000')) {
                                sectorInfo.readable.push(blockNumber);
                            }
                        } catch (e) {
                            // ignore read errors
                        }
                    }
                }
            } catch (e) {
                // ignore auth errors
            }
            
            // ทดสอบ Key B
            try {
                const authApduB = `FF860000050100${trailerBlock.toString(16).padStart(2, '0')}61${keyNumber.toString(16).padStart(2, '0')}`;
                const authResponseB = await sendApdu(authApduB);
                const authResponseHexB = bufferToHex(authResponseB);
                
                if (authResponseHexB.endsWith('9000')) {
                    sectorInfo.keyB = true;
                }
            } catch (e) {
                // ignore auth errors
            }
            
            debugInfo.sectors.push(sectorInfo);
        }
        
        res.json({ success: true, debug: debugInfo });
        
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;