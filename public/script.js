let statusCheckInterval;
        
// Auto-refresh status every 2 seconds
function startStatusCheck() {
    statusCheckInterval = setInterval(checkStatus, 2000);
}

function stopStatusCheck() {
    if (statusCheckInterval) {
        clearInterval(statusCheckInterval);
    }
}

// Check reader and card status
async function checkStatus() {
    try {
        const response = await fetch('/reader-status');
        const data = await response.json();
        
        const readerStatus = document.getElementById('readerStatus');
        const cardStatus = document.getElementById('cardStatus');
        
        // Update reader status
        if (data.readerDetected) {
            readerStatus.className = 'status-card success';
            document.getElementById('readerInfo').innerHTML = `
                <strong>Reader:</strong> ${data.readerName || 'Unknown'}<br>
                <strong>Status:</strong> Connected
            `;
        } else {
            readerStatus.className = 'status-card error';
            document.getElementById('readerInfo').innerHTML = `
                <strong>Status:</strong> No reader detected
            `;
        }
        
        // Update card status
        if (data.cardPresent) {
            cardStatus.className = 'status-card success';
            document.getElementById('cardInfo').innerHTML = `
                <strong>Card:</strong> Present<br>
                <strong>UID:</strong> ${data.cardUID || 'Unknown'}
            `;
        } else {
            cardStatus.className = 'status-card error';
            document.getElementById('cardInfo').innerHTML = `
                <strong>Status:</strong> No card detected
            `;
        }
    } catch (error) {
        console.error('Error checking status:', error);
    }
}

// Get detailed card information
async function getCardInfo() {
    try {
        const response = await fetch('/card-info');
        const data = await response.json();
        
        if (data.success) {
            document.getElementById('cardInfo').innerHTML = `
                <strong>Card:</strong> Present<br>
                <strong>ATR:</strong> ${data.atr}<br>
                <strong>UID:</strong> ${data.uid}<br>
                <strong>Type:</strong> ${data.type || 'Unknown'}
            `;
        } else {
            showResult('cardInfo', data.error, false);
        }
    } catch (error) {
        showResult('cardInfo', 'Error getting card info: ' + error.message, false);
    }
}




// Utility functions
function validateKey(key) {
    return /^[0-9A-Fa-f]{12}$/.test(key);
}

function validateData(data) {
    return /^[0-9A-Fa-f]{32}$/.test(data);
}

function showResult(elementId, message, success) {
    const element = document.getElementById(elementId);
    element.innerHTML = message;
    element.className = success ? 'result success' : 'result error';
    element.style.display = 'block';
}

function showTab(tabName) {
    // Hide all tab contents
    const contents = document.querySelectorAll('.tab-content');
    contents.forEach(content => content.classList.remove('active'));
    
    // Remove active class from all tabs
    const tabs = document.querySelectorAll('.tab');
    tabs.forEach(tab => tab.classList.remove('active'));
    
    // Show selected tab content
    document.getElementById(tabName).classList.add('active');
    
    // Add active class to clicked tab
    event.target.classList.add('active');
}

function generateTestData() {
    const chars = '0123456789ABCDEF';
    let result = '';
    for (let i = 0; i < 32; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    document.getElementById('writeData').value = result;
}

async function readUID() {
    const resultDiv = document.getElementById('uidResult');
    resultDiv.style.display = 'block';
    resultDiv.className = 'result'; // reset class
    resultDiv.textContent = 'Reading UID...';
    try {
        const response = await fetch('/read-uid');
        const data = await response.json();
        if (data.success) {
            resultDiv.className = 'result success';
            resultDiv.textContent = 'UID: ' + data.uid;
        } else {
            resultDiv.className = 'result error';
            resultDiv.textContent = 'Error: ' + data.error;
        }
    } catch (err) {
        resultDiv.className = 'result error';
        resultDiv.textContent = 'Error: ' + err.message;
    }
}

async function readUIDLE() {
    const resultDiv = document.getElementById('uidLEResult');
    resultDiv.style.display = 'block';
    resultDiv.className = 'result'; // reset class
    resultDiv.textContent = 'Reading UID+Card number...';
    try {
        const response = await fetch('/read-uid-le');
        const data = await response.json();
        if (data.success) {
            resultDiv.className = 'result success';
            // แก้ไขตรงนี้ให้แสดงทั้ง hex และ decimal
            resultDiv.textContent = 'UID: ' + data.uid + ' \nCard number: ' + data.decimal ;
        } else {
            resultDiv.className = 'result error';
            resultDiv.textContent = 'Error: ' + data.error;
        }
    } catch (err) {
        resultDiv.className = 'result error';
        resultDiv.textContent = 'Error: ' + err.message;
    }
}

// Read sector (original)
async function readSector() {
    const sectorNumber = document.getElementById('sectorNumber').value;
    const keyType = document.getElementById('sectorKeyType').value;
    const key = document.getElementById('sectorKey').value;
    const resultDiv = document.getElementById('sectorResult');
    resultDiv.className = 'result';
    resultDiv.textContent = 'Reading sector...';
    try {
        const response = await fetch('/read-sector', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sectorNumber, keyType, key })
        });
        const data = await response.json();
        if (data.success) {
            let html = `<b>Sector ${data.sectorNumber}:</b><br>`;
            data.results.forEach((block, i) => {
                if (block.success) {
                    html += `Block ${block.blockNumber}: ${block.data}<br>`;
                    if (i < 3) {
                        document.getElementById('sectorData'+i).value = block.data;
                    }
                } else {
                    html += `Block ${block.blockNumber}: Error: ${block.error}<br>`;
                }
            });
            resultDiv.className = 'result success';
            resultDiv.innerHTML = html;
        } else {
            resultDiv.className = 'result error';
            resultDiv.textContent = data.error;
        }
    } catch (err) {
        resultDiv.className = 'result error';
        resultDiv.textContent = 'Error: ' + err.message;
    }
}


async function writeSector() {
    const sectorNumber = document.getElementById('sectorNumber').value;
    const keyType = document.getElementById('sectorKeyType').value;
    const key = document.getElementById('sectorKey').value;
    const dataBlocks = [
        document.getElementById('sectorData0').value,
        document.getElementById('sectorData1').value,
        document.getElementById('sectorData2').value
    ];
    const resultDiv = document.getElementById('sectorResult');
    resultDiv.className = 'result';
    resultDiv.textContent = 'Writing sector...';
    if (!dataBlocks.every(d => /^[0-9A-Fa-f]{32}$/.test(d))) {
        resultDiv.className = 'result error';
        resultDiv.textContent = 'แต่ละ block ต้องเป็น 32 ตัวอักษร hex';
        return;
    }
    try {
        const response = await fetch('/write-sector', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sectorNumber, keyType, key, dataBlocks })
        });
        const data = await response.json();
        if (data.success) {
            let html = `<b>Write Sector ${data.sectorNumber}:</b><br>`;
            data.results.forEach((block, i) => {
                if (block.success) {
                    html += `Block ${block.blockNumber}: OK<br>`;
                } else {
                    html += `Block ${block.blockNumber}: Error: ${block.error}<br>`;
                }
            });
            resultDiv.className = 'result success';
            resultDiv.innerHTML = html;
        } else {
            resultDiv.className = 'result error';
            resultDiv.textContent = data.error;
        }
    } catch (err) {
        resultDiv.className = 'result error';
        resultDiv.textContent = 'Error: ' + err.message;
    }
}

// Initialize on page load
window.onload = function() {
    checkStatus();
    startStatusCheck();
};

// Clean up on page unload
window.onbeforeunload = function() {
    stopStatusCheck();
};