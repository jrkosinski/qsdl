import WebSocket from 'ws';
import { Logger } from '../util/logger';

interface WebSocketClientConfig {
    url: string;
    reconnect?: boolean;
    reconnectInterval?: number;
    maxReconnectAttempts?: number;
}

export class WebsocketClient {
    private _ws: WebSocket | null = null;
    private _config: WebSocketClientConfig;
    private _reconnectAttempts: number = 0;
    private _isConnected: boolean = false;
    private _shouldReconnect: boolean = true;
    private _messageHandlers: Array<(data: string) => void> = [];
    private _logger: Logger = new Logger('WSCLIENT');

    constructor(config: WebSocketClientConfig) {
        this._config = {
            reconnect: true,
            reconnectInterval: 3000,
            maxReconnectAttempts: 5,
            ...config,
        };
    }

    public async connect(): Promise<void> {
        return new Promise((resolve, reject) => {
            try {
                this._ws = new WebSocket(this._config.url);

                this._ws.on('open', () => {
                    this._logger.debug('Connected to WebSocket server');
                    this._isConnected = true;
                    this._reconnectAttempts = 0;
                    resolve();
                });

                this._ws.on('message', (data: Buffer) => {
                    this._handleMessage(data);
                });

                this._ws.on('close', () => {
                    this._logger.debug('Disconnected from WebSocket server');
                    this._isConnected = false;
                    this._handleDisconnect();
                });

                this._ws.on('error', (error: Error) => {
                    this._logger.error('WebSocket error:', error);
                    if (!this._isConnected) {
                        reject(error);
                    }
                });
            } catch (error) {
                reject(error);
            }
        });
    }

    public send(data: string | Buffer): void {
        if (
            this._ws &&
            this._isConnected &&
            this._ws.readyState === WebSocket.OPEN
        ) {
            this._ws.send(data);
        } else {
            this._logger.error(
                'Cannot send message: WebSocket is not connected'
            );
        }
    }

    public onMessage(handler: (data: string) => void): void {
        this._messageHandlers.push(handler);
    }

    public disconnect(): void {
        this._shouldReconnect = false;
        if (this._ws) {
            this._ws.close();
            this._ws = null;
        }
        this._isConnected = false;
    }

    public isClientConnected(): boolean {
        return this._isConnected;
    }

    public getReconnectAttempts(): number {
        return this._reconnectAttempts;
    }

    private _handleMessage(data: Buffer): void {
        let message = data.toString();
        this._logger.debug(`Client received: ${message}`);

        // Notify all registered message handlers
        this._messageHandlers.forEach((handler) => {
            try {
                handler(message);
            } catch (error) {
                this._logger.error('Error in message handler:', error);
            }
        });
    }

    private _handleDisconnect(): void {
        if (
            this._shouldReconnect &&
            this._config.reconnect &&
            this._reconnectAttempts < (this._config.maxReconnectAttempts || 5)
        ) {
            this._reconnectAttempts++;
            this._logger.warn(
                `Attempting to reconnect (${this._reconnectAttempts}/${this._config.maxReconnectAttempts})...`
            );

            setTimeout(() => {
                this.connect().catch((error) => {
                    this._logger.error('Reconnection failed:', error);
                });
            }, this._config.reconnectInterval);
        } else if (
            this._reconnectAttempts >= (this._config.maxReconnectAttempts || 5)
        ) {
            this._logger.error('Max reconnection attempts reached');
        }
    }
}
