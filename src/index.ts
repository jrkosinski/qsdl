import { qsdl1, qsdl1_response1 } from './examples';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { schema } from './schema';
import { AnthropicLLMApi, OpenAILLMApi } from './llms';
import chalk from 'chalk';
import prompts from 'prompts';
import Anthropic from '@anthropic-ai/sdk';

import dotenv from 'dotenv';
dotenv.config();

interface IStrategy {
    name: string;
    qsdl: any;
}

//1. multi-turn conversation
//2. cached prompt with schema and full instructions
//3. final confirmation step
//4. schema improvements

interface IStrategyParser {
    parse(text: string): Promise<IStrategy>;
}

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

async function testOpenAI() {
    const openai = new OpenAILLMApi(process.env.OPENAI_API_KEY || '');
    const response = await openai.query('say either yes or no, no other words');
    console.log('OpenAI response:', response);
}

async function testAnthropic() {
    const anthropic = new AnthropicLLMApi(process.env.ANTHROPIC_API_KEY || '');
    const response = await anthropic.query(
        'say either yes or no, no other words'
    );
    console.log('Anthropic response:', response);
}

async function multiTurnConversationTest(): Promise<string> {
    const anthropic: Anthropic = new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY,
    });

    interface Message {
        role: 'user' | 'assistant';
        content: string;
    }

    return new Promise<string>(async (resolve, reject) => {
        const conversationHistory: Message[] = [];
        let output = '';

        console.log(chalk.blue.bold('\nTrading Strategy Converter\n'));
        while (true) {
            console.log(
                chalk.gray("Type 'exit' or 'quit' to end the conversation.\n")
            );

            //read user input
            const response = await prompts({
                type: 'text',
                name: 'message',
                message: chalk.green('You:'),
            });
            const userMessage = response.message?.trim();

            //check for exit
            if (
                !userMessage ||
                userMessage.toLowerCase() === 'exit' ||
                userMessage.toLowerCase() === 'quit'
            ) {
                output = 'user exited the conversation';
                console.log(chalk.yellow('\n👋 Goodbye!\n'));
                break;
            }

            // Add user message to history
            conversationHistory.push({
                role: 'user',
                content: userMessage,
            });

            try {
                // Call Anthropic API with conversation history
                const apiResponse = await anthropic.messages.create({
                    model: 'claude-sonnet-4-5-20250929',
                    max_tokens: 4096,
                    system: [
                        {
                            type: 'text',
                            text: userMessage,
                        },
                        /*{
                            type: 'text',
                            text: `Here's the JSON schema:\n${JSON.stringify(
                                schema,
                                null,
                                2
                            )}`,
                            cache_control: { type: 'ephemeral' }, // Cache the schema
                        },*/
                    ],
                    messages: conversationHistory.map((msg) => ({
                        role: msg.role,
                        content: msg.content,
                    })),
                });

                // Extract assistant's response
                const assistantMessage =
                    apiResponse.content[0].type === 'text'
                        ? apiResponse.content[0].text
                        : '';

                // Add assistant message to history
                conversationHistory.push({
                    role: 'assistant',
                    content: assistantMessage,
                });

                // Display assistant response
                console.log(chalk.cyan('\nClaude:'), assistantMessage);
                console.log(); // Empty line for spacing

                // Show cache usage stats if available
                if (apiResponse.usage) {
                    const cacheStats = [
                        apiResponse.usage.cache_creation_input_tokens
                            ? `Cache created: ${apiResponse.usage.cache_creation_input_tokens} tokens`
                            : null,
                        apiResponse.usage.cache_read_input_tokens
                            ? `Cache hit: ${apiResponse.usage.cache_read_input_tokens} tokens`
                            : null,
                    ]
                        .filter(Boolean)
                        .join(' | ');

                    if (cacheStats) {
                        console.log(chalk.gray(`ℹ️  ${cacheStats}\n`));
                    }
                }
            } catch (error) {
                console.error(chalk.red('\n❌ Error:'), error);
                console.log();
            }
        }

        return output;
    });
}

function main() {
    console.log('Application started successfully');

    //testSchemaValidation();
    //testOpenAI();
    //testAnthropic();
    multiTurnConversationTest().then((r) => {
        console.log(r);
    });
}

main();
