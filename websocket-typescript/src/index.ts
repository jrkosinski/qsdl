/**
 * Main entry point for the QSDL (Quantitative Strategy Definition Language) application.
 *
 * This module provides the primary interface for converting natural language trading
 * strategy descriptions into structured JSON that conforms to the QSDL schema. It includes
 * test functions for schema validation and LLM integrations, as well as the main
 * multi-turn conversation flow for interactive strategy definition.
 *
 * Key functionality:
 * - Schema validation testing
 * - OpenAI and Anthropic API integration testing
 * - Interactive multi-turn conversation for strategy definition
 * - JSON output generation and persistence
 */

import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { schema } from './schema/schema_v0.0.1'; //'../../../../schema/schema_v0.0.1';
import { AnthropicLLMApi, OpenAILLMApi } from './llms';
import chalk from 'chalk';
import prompts from 'prompts';
import fs from 'fs';

import dotenv from 'dotenv';
import { AnthropicConversation, IUserIO } from './llms/conversation';
import { WebsocketConversationServer } from './server/websocket-server';
import { WebsocketClient } from './client/websocket-client';
import { runCodeGenExample, runCodeGenTests } from './codegen/example';
dotenv.config();

const inputModule: IUserIO = {
    async getUserResponse(prompt: string): Promise<string> {
        const response = await prompts({
            type: 'text',
            name: 'message',
            message: chalk.green(prompt ?? 'Answer:'),
        });
        return response.message?.trim();
    },
    async onUserExit(): Promise<void> {
        console.log(chalk.yellow('\n👋 Goodbye!\n'));
    },
    async onQuestion(question: string): Promise<void> {
        console.log(chalk.cyan('Question:'), question);
        console.log(); //empty line for spacing
    },
    async onStats(stats: string): Promise<void> {
        console.log(chalk.gray(`ℹ️  ${stats}\n`));
    },
    async onError(error: any): Promise<void> {
        console.error(chalk.red('\n❌ Error:'), error);
        console.log();
    },
    async onMessage(message: string): Promise<void> {
        console.log(chalk.blue('💬 Message:'), message);
        console.log(); //empty line for spacing
    },
};

/**
 * Main application entry point.
 * Initializes and starts the multi-turn conversation for QSDL strategy definition,
 * then saves the generated output to output.json.
 */
async function main() {
    console.log('Application started successfully');

    const TEST_WSS_SERVER = true;
    const TEST_WSS_CLIENT = false;
    const TEST_CODE_GEN = false;

    if (TEST_WSS_SERVER) {
        //testSchemaValidation();
        //testOpenAI();
        //testAnthropic();
        new WebsocketConversationServer({
            port: process.env.PORT ? parseInt(process.env.PORT) : 9000,
            jwtSecret: process.env.JWT_SECRET || 'secret',
        }).start();
    }

    if (TEST_WSS_CLIENT) {
        const client = new WebsocketClient({
            url: 'http://localhost:9000',
        });

        client.onMessage(async (data) => {
            if (data.startsWith('{') && data.endsWith('}')) {
                const message: any = JSON.parse(data);
                if (message.type == 'message') {
                    inputModule.onMessage(message.text);
                }
                if (message.type == 'prompt') {
                    const response = await inputModule.getUserResponse(
                        message.text
                    );
                    client.send(response);
                }
                if (message.type == 'stats') {
                    inputModule.onStats(message.text);
                }
                if (message.type == 'error') {
                    inputModule.onError(message.text);
                }
                if (message.type == 'question') {
                    inputModule.onQuestion(message.text);
                }
            } else {
                inputModule.onMessage(data);
            }
        });

        await client.connect();
    }

    if (TEST_CODE_GEN) {
        runCodeGenExample();
        runCodeGenTests();
    }

    await new Promise(() => {}); //never resolves
}

main();
