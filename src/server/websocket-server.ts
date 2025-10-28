import { WebSocketServer, WebSocket } from 'ws';
import jwt from 'jsonwebtoken';
import { IncomingMessage } from 'http';

interface WebSocketServerConfig {
    port: number;
    host?: string;
    jwtSecret: string;
}

export class WebsocketServer {
    private wss: WebSocketServer | null = null;
    private clients: Set<WebSocket> = new Set();
    private config: WebSocketServerConfig;

    constructor(config: WebSocketServerConfig) {
        this.config = config;
    }

    async start(): Promise<void> {
        this.wss = new WebSocketServer({
            port: this.config.port,
            host: this.config.host || 'localhost',
        });

        this.wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
            // Verify JWT token from query parameter or header
            const token = this.extractToken(req);

            if (!this.verifyToken(token)) {
                console.log('Unauthorized connection attempt');
                ws.close(1008, 'Unauthorized: Invalid or missing token');
                return;
            }

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

        console.log(
            `WebSocket server listening on ${this.config.host || 'localhost'}:${
                this.config.port
            }`
        );
    }

    private extractToken(req: IncomingMessage): string | null {
        // Try to get token from query parameter
        const url = new URL(req.url || '', `http://${req.headers.host}`);
        const tokenFromQuery = url.searchParams.get('token');

        if (tokenFromQuery) {
            return tokenFromQuery;
        }

        // Try to get token from Authorization header
        const authHeader = req.headers.authorization;
        if (authHeader?.startsWith('Bearer ')) {
            return authHeader.substring(7);
        }

        return null;
    }

    private verifyToken(token: string | null): boolean {
        if (!token) {
            return false;
        }

        try {
            jwt.verify(token, this.config.jwtSecret);
            return true;
        } catch (error) {
            console.error('JWT verification failed:', error);
            return false;
        }
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
