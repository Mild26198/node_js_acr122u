// server.js
const app = require('./app');
const { initializeNFC } = require('./nfc');

const PORT = process.env.PORT || 3007;
app.listen(PORT, () => {
    console.log(`ACR122U Web Server running on port ${PORT}`);
    console.log(`Visit http://localhost:${PORT} to access the web interface`);
    initializeNFC();
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\nShutting down server...');
    process.exit(0);
});