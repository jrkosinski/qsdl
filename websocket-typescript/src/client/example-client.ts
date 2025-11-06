import { WebsocketClient } from './websocket-client';
import prompts from 'prompts';
import chalk from 'chalk';

/**
 * Example WebSocket client implementation that connects to the QSDL WebSocket server
 * and provides an interactive CLI for sending and receiving messages.
 */
async function main() {
    const client = new WebsocketClient({
        url: 'ws://localhost:1077',
        reconnect: true,
        reconnectInterval: 3000,
        maxReconnectAttempts: 5,
    });

    //register a message handler
    client.onMessage((message) => {
        console.log(chalk.green('📨 Server message:'), message);
    });

    try {
        //connect to the server
        await client.connect();

        //interactive message loop
        let running = true;
        while (running) {
            const response = await prompts({
                type: 'text',
                name: 'message',
                message: chalk.blue('Enter message (or "exit" to quit):'),
            });

            if (
                !response.message ||
                response.message.trim().toLowerCase() === 'exit'
            ) {
                running = false;
                break;
            }

            client.send(response.message);
        }

        //disconnect when done
        client.disconnect();
        console.log(chalk.yellow('👋 Disconnected from server'));
    } catch (error) {
        console.error(chalk.red('❌ Connection error:'), error);
        process.exit(1);
    }
}

//run the client if this file is executed directly
if (require.main === module) {
    main();
}
