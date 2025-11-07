import { WebSocketServer, WebSocket } from 'ws';
import jwt from 'jsonwebtoken';
import { IncomingMessage } from 'http';
import { AnthropicConversation, IUserIO } from '../llms/conversation';
import { randomBytes } from 'crypto';
import { Logger } from '../util/logger';

const ENABLE_JWT_SECURITY = false;

interface WebSocketServerConfig {
    port: number;
    host?: string;
    jwtSecret: string;
}

function generateUniqueClientId(): string {
    return randomBytes(16).toString('hex');
}

enum MessageType {
    prompt = 'prompt',
    error = 'error',
    stats = 'stats',
    message = 'message',
    question = 'question',
}

class WebsocketUserIO implements IUserIO {
    private _ws: WebSocket;
    private _server: WebsocketConversationServer;
    private _id: string;
    private _pendingResponse: ((value: string) => void) | null = null;
    private _logger: Logger;

    public get id(): string {
        return this._id;
    }

    constructor(server: WebsocketConversationServer, ws: WebSocket) {
        this._id = generateUniqueClientId();
        this._ws = ws;
        this._server = server;
        this._logger = new Logger('WSIO-' + this.id);

        this._ws.on('message', (data: Buffer) => {
            this._handleMessage(ws, data);
        });

        this._ws.on('close', () => {
            this._logger.debug('Client disconnected');
            this._server.onUserExit(this.id);
        });

        this._ws.on('error', (error: Error) => {
            this._logger.error('WebSocket error:', error);
            this._server.onUserExit(this.id);
        });
    }

    /** Gets user response to a prompt */
    public async getUserResponse(prompt: string): Promise<string> {
        if (this._pendingResponse)
            throw new Error('Already waiting for previous response');

        return new Promise<string>((resolve, reject) => {
            const timeout = setTimeout(() => {
                this._pendingResponse = null;
                reject(new Error('Timeout waiting for user response'));
            }, 300000); // 5 minute timeout

            this._pendingResponse = (response: string) => {
                this._logger.debug('clearing timeout');
                clearTimeout(timeout);
                this._logger.debug(
                    'setting pending response to null, prompt is ' + prompt
                );
                this._pendingResponse = null;
                this._logger.debug('resolving ' + response);

                resolve(response);
            };

            //send prompt to client
            this._sendMessageToClient(MessageType.prompt, prompt);
        });
    }

    /** Called when user exits the conversation */
    public async onUserExit(): Promise<void> {
        this.onMessage('User exited');
        this._server.onUserExit(this.id);
    }

    /** Called to display statistics (e.g., cache usage) */
    public async onStats(stats: string): Promise<void> {
        //send response to client
        this._sendMessageToClient(MessageType.stats, stats);
    }

    /** Called when an error occurs */
    public async onError(error: any): Promise<void> {
        this._sendMessageToClient(MessageType.error, error.toString());
    }

    /** Called when AI asks a question */
    public async onQuestion(query: string): Promise<void> {
        //send question to client, wait for response
        //return await this.getUserResponse(query);
        this._sendMessageToClient(MessageType.question, query);
    }

    /** Called to display a message to the user */
    public async onMessage(message: string): Promise<void> {
        this._logger.info('onMessage:' + message);
        //send message to client
        this._sendMessageToClient(MessageType.message, message);
    }

    private _handleMessage(ws: WebSocket, data: Buffer) {
        const message = data.toString();
        this._logger.info('Server received:' + message);

        //if we're waiting for a response, resolve the pending promise
        if (this._pendingResponse) {
            this._logger.debug('there is a pending response, handling it...');
            this._pendingResponse(message);
        }
    }

    private _sendMessageToClient(type: string, text: string) {
        this._sendToClient({ type, text });
    }

    private _sendToClient(data: any) {
        if (this._ws.readyState === WebSocket.OPEN) {
            this._logger.debug('Sending: ' + JSON.stringify(data));
            this._ws.send(JSON.stringify(data));
        }
    }
}

interface IWCSClient {
    ws: WebSocket;
    io: WebsocketUserIO;
}

export class WebsocketConversationServer {
    private _wss: WebSocketServer | null = null;
    private _clients: Set<IWCSClient> = new Set();
    private _config: WebSocketServerConfig;
    private _logger: Logger = new Logger('WSSERV');

    constructor(config: WebSocketServerConfig) {
        this._config = config;
    }

    public async start(): Promise<void> {
        this._wss = new WebSocketServer({
            port: this._config.port,
            host: this._config.host || 'localhost',
        });

        this._wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
            if (ENABLE_JWT_SECURITY) {
                //verify JWT token from query parameter or header
                const token = this._extractToken(req);

                if (!this._verifyToken(token)) {
                    this._logger.warn('Unauthorized connection attempt');
                    ws.close(1008, 'Unauthorized: Invalid or missing token');
                    return;
                }
            }

            this._logger.info('New client connected');
            const userIO = new WebsocketUserIO(this, ws);
            this._clients.add({ ws, io: userIO });

            new AnthropicConversation(userIO)
                .startConversation()
                .then((output) => {
                    if (output) {
                        this._sendToClient(ws, JSON.stringify(output));
                    }
                });
        });

        this._logger.info(
            `WebSocket server listening on ${
                this._config.host || 'localhost'
            }:${this._config.port}`
        );
    }

    public getClientCount(): number {
        return this._clients.size;
    }

    public onUserExit(clientId: string) {
        this._clients.forEach((client) => {
            if (client.io.id === clientId) {
                this._endClient(client);
                return;
            }
        });
    }

    private _endClient(client: IWCSClient) {
        client.ws.close();
        this._clients.delete(client);
    }

    private _extractToken(req: IncomingMessage): string | null {
        //try to get token from query parameter
        const url = new URL(req.url || '', `http://${req.headers.host}`);
        const tokenFromQuery = url.searchParams.get('token');

        if (tokenFromQuery) {
            return tokenFromQuery;
        }

        //try to get token from Authorization header
        const authHeader = req.headers.authorization;
        if (authHeader?.startsWith('Bearer ')) {
            return authHeader.substring(7);
        }

        return null;
    }

    private _verifyToken(token: string | null): boolean {
        if (!ENABLE_JWT_SECURITY) return true;

        if (!token) {
            return false;
        }

        try {
            jwt.verify(token, this._config.jwtSecret);
            return true;
        } catch (error) {
            console.error('JWT verification failed:', error);
            return false;
        }
    }

    private _broadcast(data: string | Buffer) {
        this._clients.forEach((client) => {
            if (client.ws.readyState === WebSocket.OPEN) {
                client.ws.send(data);
            }
        });
    }

    private _sendToClient(ws: WebSocket, data: string | Buffer) {
        if (ws.readyState === WebSocket.OPEN) {
            this._logger.debug(`Sending data to client: ${data}`);
            ws.send(data);
        }
    }

    private _stop() {
        if (this._wss) {
            this._clients.forEach((client) => {
                client.ws.close();
            });
            this._wss.close(() => {
                this._logger.info('WebSocket server stopped');
            });
            this._clients.clear();
        }
    }
}
