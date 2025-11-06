/**
 * Simple web server to serve the QSDL WebSocket client HTML interface.
 *
 * This server provides a static file server for the WebSocket client UI,
 * allowing users to connect to the QSDL WebSocket server and interact
 * with trading strategy generation through a browser interface.
 *
 */
//TODO:
/*
    2. what happens on successful download 
    3. what happens on failure to produce qsdl 
    4. what happens on failure to validate schema 
    5. deploy 
    6. security

    UX: 
    1. add start & reset conv. button s
    2. start conv. automatically 
    3. end conv on success or failure 
    4. download the qsdl as file
 */

import express from 'express';
import path from 'path';

const app = express();
const PORT = process.env.PORT || 3000;
const SERVER_DOMAIN = process.env.SERVER_DOMAIN || 'localhost';

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, '../public')));

// Serve index.html for root path
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start the server
app.listen(PORT, () => {
    console.log(`QSDL Web Client Server running at http://localhost:${PORT}`);
    console.log(
        `Open your browser to http://localhost:${PORT} to access the WebSocket client`
    );
    console.log(
        `Make sure the WebSocket server is running on ws://${SERVER_DOMAIN}:1077`
    );
});
