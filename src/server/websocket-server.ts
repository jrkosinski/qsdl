import { WebSocketServer, WebSocket } from 'ws';

interface WebSocketServerConfig {
    port: number;
    host?: string;
}

export class WSServer {
    private wss: WebSocketServer | null = null;
    private clients: Set<WebSocket> = new Set();
    private config: WebSocketServerConfig;

    constructor(config: WebSocketServerConfig) {
        this.config = config;
    }

    start(): void {
        this.wss = new WebSocketServer({
            port: this.config.port,
            host: this.config.host || 'localhost',
        });

        this.wss.on('connection', (ws: WebSocket) => {
            console.log('New client connected');
            this.clients.add(ws);

            ws.on('message', (data: Buffer) => {
                this.handleMessage(ws, data);
            });

            ws.on('close', () => {
                console.log('Client disconnected');
                this.clients.delete(ws);
            });

            ws.on('error', (error: Error) => {
                console.error('WebSocket error:', error);
                this.clients.delete(ws);
            });
        });

        console.log(`WebSocket server listening on ${this.config.host || 'localhost'}:${this.config.port}`);
    }

    private handleMessage(ws: WebSocket, data: Buffer): void {
        // TODO: Implement message handling logic
        const message = data.toString();
        console.log('Received:', message);

        // Example: Echo back to client
        // ws.send(message);
    }

    broadcast(data: string | Buffer): void {
        this.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(data);
            }
        });
    }

    sendToClient(ws: WebSocket, data: string | Buffer): void {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(data);
        }
    }

    stop(): void {
        if (this.wss) {
            this.clients.forEach((client) => {
                client.close();
            });
            this.wss.close(() => {
                console.log('WebSocket server stopped');
            });
            this.clients.clear();
        }
    }

    getClientCount(): number {
        return this.clients.size;
    }
}
