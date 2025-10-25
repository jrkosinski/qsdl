import { schema } from '../schema';
import prompts from 'prompts';
import Anthropic from '@anthropic-ai/sdk';

export interface IUserInputModule {
    getUserResponse(): Promise<string>;
    onUserExit(): Promise<void>;
    onResponse(response: string): Promise<string>;
    onStats(stats: string): Promise<void>;
    onError(error: any): Promise<void>;
    onQuestion(query: string): Promise<string>;
}

export class AnthropicMultiTurnConversation {
    private api: Anthropic;

    constructor() {
        this.api = new Anthropic({
            apiKey: process.env.ANTHROPIC_API_KEY,
        });
    }

    async startConversation(inputModule: IUserInputModule): Promise<any> {
        interface Message {
            role: 'user' | 'assistant';
            content: string;
        }

        return new Promise<string>(async (resolve, reject) => {
            const conversationHistory: Message[] = [];
            let output = '';

            while (true) {
                //read user input
                const userMessage = await inputModule.getUserResponse();

                //check for exit
                if (
                    !userMessage ||
                    userMessage.toLowerCase() === 'exit' ||
                    userMessage.toLowerCase() === 'quit'
                ) {
                    await inputModule.onUserExit();
                    break;
                }

                // Add user message to history
                conversationHistory.push({
                    role: 'user',
                    content: userMessage,
                });

                try {
                    // Call Anthropic API with conversation history
                    const apiResponse = await this.api.messages.create({
                        model: 'claude-sonnet-4-5-20250929',
                        max_tokens: 4096,
                        system: [
                            {
                                type: 'text',
                                text: userMessage,
                            },
                            {
                                type: 'text',
                                text: `Here's the JSON schema:\n${JSON.stringify(
                                    schema,
                                    null,
                                    2
                                )}`,
                                cache_control: { type: 'ephemeral' }, // Cache the schema
                            },
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
                    if (assistantMessage.startsWith('Q:')) {
                        await inputModule.onQuestion(
                            assistantMessage.substring(2).trim()
                        );
                    } else {
                        output = JSON.parse(assistantMessage.trim());
                        break;
                    }

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
                            await inputModule.onStats(cacheStats);
                        }
                    }
                } catch (error) {
                    await inputModule.onError(error);
                }
            }

            return output;
        });
    }
}
