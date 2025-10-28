import WebSocket from 'ws';

interface WebSocketClientConfig {
    url: string;
    reconnect?: boolean;
    reconnectInterval?: number;
    maxReconnectAttempts?: number;
}

export class WebsocketClient {
    private ws: WebSocket | null = null;
    private config: WebSocketClientConfig;
    private reconnectAttempts: number = 0;
    private isConnected: boolean = false;
    private shouldReconnect: boolean = true;
    private messageHandlers: Array<(data: string) => void> = [];

    constructor(config: WebSocketClientConfig) {
        this.config = {
            reconnect: true,
            reconnectInterval: 3000,
            maxReconnectAttempts: 5,
            ...config,
        };
    }

    async connect(): Promise<void> {
        return new Promise((resolve, reject) => {
            try {
                this.ws = new WebSocket(this.config.url);

                this.ws.on('open', () => {
                    console.log('Connected to WebSocket server');
                    this.isConnected = true;
                    this.reconnectAttempts = 0;
                    resolve();
                });

                this.ws.on('message', (data: Buffer) => {
                    this.handleMessage(data);
                });

                this.ws.on('close', () => {
                    console.log('Disconnected from WebSocket server');
                    this.isConnected = false;
                    this.handleDisconnect();
                });

                this.ws.on('error', (error: Error) => {
                    console.error('WebSocket error:', error);
                    if (!this.isConnected) {
                        reject(error);
                    }
                });
            } catch (error) {
                reject(error);
            }
        });
    }

    private handleMessage(data: Buffer): void {
        const message = data.toString();
        console.log('Received:', message);

        // Notify all registered message handlers
        this.messageHandlers.forEach((handler) => {
            try {
                handler(message);
            } catch (error) {
                console.error('Error in message handler:', error);
            }
        });
    }

    private handleDisconnect(): void {
        if (
            this.shouldReconnect &&
            this.config.reconnect &&
            this.reconnectAttempts < (this.config.maxReconnectAttempts || 5)
        ) {
            this.reconnectAttempts++;
            console.log(
                `Attempting to reconnect (${this.reconnectAttempts}/${this.config.maxReconnectAttempts})...`
            );

            setTimeout(() => {
                this.connect().catch((error) => {
                    console.error('Reconnection failed:', error);
                });
            }, this.config.reconnectInterval);
        } else if (this.reconnectAttempts >= (this.config.maxReconnectAttempts || 5)) {
            console.error('Max reconnection attempts reached');
        }
    }

    send(data: string | Buffer): void {
        if (this.ws && this.isConnected && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(data);
        } else {
            console.error('Cannot send message: WebSocket is not connected');
        }
    }

    onMessage(handler: (data: string) => void): void {
        this.messageHandlers.push(handler);
    }

    disconnect(): void {
        this.shouldReconnect = false;
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        this.isConnected = false;
    }

    isClientConnected(): boolean {
        return this.isConnected;
    }

    getReconnectAttempts(): number {
        return this.reconnectAttempts;
    }
}
