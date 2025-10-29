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

import { qsdl1, qsdl1_response1 } from './examples';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { schema } from './schema/schema_v0.0.1';
import { AnthropicLLMApi, OpenAILLMApi } from './llms';
import chalk from 'chalk';
import prompts from 'prompts';
import fs from 'fs';

import dotenv from 'dotenv';
import { AnthropicConversation, IUserIOModule } from './llms/conversation';
import { WebsocketServer } from './server/websocket-server';
dotenv.config();

/**
 * Represents a trading strategy with its name and QSDL definition.
 */
interface IStrategy {
    name: string;
    qsdl: any;
}

//4. schema improvements

/**
 * Interface for parsing natural language text into structured strategy objects.
 */
interface IStrategyParser {
    parse(text: string): Promise<IStrategy>;
}

/**
 * Tests the QSDL schema validation using AJV.
 * Compiles the schema and validates an example QSDL response against it.
 */
function testSchemaValidation() {
    //compile the schema
    const ajv = new Ajv({ allErrors: true, strict: false });
    addFormats(ajv);
    const validate = ajv.compile(schema);

    //validate the example QSDL
    const valid = validate(qsdl1_response1);
    if (!valid) {
        console.error('QSDL validation errors:', validate.errors);
    } else {
        console.log('QSDL is valid');
    }
}

/**
 * Tests the OpenAI API integration.
 * Sends a simple query to verify API connectivity and response handling.
 */
async function testOpenAI() {
    const openai = new OpenAILLMApi(process.env.OPENAI_API_KEY || '');
    const response = await openai.query('say either yes or no, no other words');
    console.log('OpenAI response:', response);
}

/**
 * Tests the Anthropic API integration.
 * Sends a simple query to verify API connectivity and response handling.
 */
async function testAnthropic() {
    const anthropic = new AnthropicLLMApi(process.env.ANTHROPIC_API_KEY || '');
    const response = await anthropic.query(
        'say either yes or no, no other words'
    );
    console.log('Anthropic response:', response);
}

/**
 * Runs a multi-turn conversation test using Anthropic's API.
 * Creates an interactive CLI interface for users to define trading strategies
 * through a conversational flow, with colored console output for better UX.
 *
 * @returns {Promise<string>} The final QSDL JSON string generated from the conversation
 */
async function multiTurnConversationTestTest(): Promise<string> {
    const inputModule: IUserIOModule = {
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
        async onResponse(response: string): Promise<string> {
            console.log(chalk.cyan('Response:'), response);
            console.log(); // Empty line for spacing
            return response;
        },
        async onQuestion(question: string): Promise<string> {
            console.log(chalk.cyan('Question:'), question);
            console.log(); // Empty line for spacing
            return question;
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
            console.log(); // Empty line for spacing
        },
    };

    const conversation = new AnthropicConversation(inputModule);
    return await conversation.startConversation();
}

/**
 * Main application entry point.
 * Initializes and starts the multi-turn conversation for QSDL strategy definition,
 * then saves the generated output to output.json.
 */
function main() {
    console.log('Application started successfully');

    //testSchemaValidation();
    //testOpenAI();
    //testAnthropic();
    new WebsocketServer({
        port: 1077,
        jwtSecret: process.env.JWT_SECRET || 'secret',
    }).start();

    multiTurnConversationTestTest().then((r) => {
        console.log(r);
        fs.writeFileSync('output.json', JSON.stringify(r, null, 2));
    });
}

main();
