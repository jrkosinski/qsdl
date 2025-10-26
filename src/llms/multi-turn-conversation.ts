import { schema } from '../schema';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import Anthropic from '@anthropic-ai/sdk';

export interface IUserInputModule {
    getUserResponse(): Promise<string>;
    onUserExit(): Promise<void>;
    onResponse(response: string): Promise<string>;
    onStats(stats: string): Promise<void>;
    onError(error: any): Promise<void>;
    onQuestion(query: string): Promise<string>;
    onMessage(message: string): Promise<void>;
}

const SCHEMA_FAIL_MAX_RETRIES = 3;
const MAX_QUESTION_LOOP = 10; //TODO: use this

export class AnthropicMultiTurnConversation {
    private api: Anthropic;

    constructor() {
        this.api = new Anthropic({
            apiKey: process.env.ANTHROPIC_API_KEY,
        });
    }

    public async startConversation(
        inputModule: IUserInputModule
    ): Promise<any> {
        interface Message {
            role: 'user' | 'assistant';
            content: string;
        }

        return new Promise<string>(async (resolve, reject) => {
            const conversationHistory: Message[] = [];
            let output = '';

            inputModule.onMessage(
                'Starting multi-turn conversation with Anthropic API...'
            );

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
                    inputModule.onMessage('Starting conversation...');

                    //call Anthropic API with conversation history
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

                    //extract assistant's response
                    const assistantMessage =
                        apiResponse.content[0].type === 'text'
                            ? apiResponse.content[0].text
                            : '';

                    //add assistant message to history
                    conversationHistory.push({
                        role: 'assistant',
                        content: assistantMessage,
                    });

                    //display assistant response
                    if (assistantMessage.startsWith('Q:')) {
                        await inputModule.onQuestion(
                            assistantMessage.substring(2).trim()
                        );
                    } else {
                        output = JSON.parse(assistantMessage.trim());

                        //here test against the schema
                        inputModule.onMessage(
                            'Validating generated json against schema...'
                        );

                        for (let n = 0; n < SCHEMA_FAIL_MAX_RETRIES; n++) {
                            try {
                                if (this.validateJson(output)) {
                                    await inputModule.onMessage(
                                        '✅ Generated JSON is valid against the schema.'
                                    );
                                    break;
                                }
                            } catch (err) {
                                //let claude know it needs to retry
                                inputModule.onMessage(
                                    `Response is not valid JSON. Attempting retry ${
                                        n + 1
                                    } of ${SCHEMA_FAIL_MAX_RETRIES}...`
                                );
                            }
                        }
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

    private validateJson(json: any): boolean {
        //compile the schema
        const ajv = new Ajv({ allErrors: true, strict: false });
        addFormats(ajv);
        const validate = ajv.compile(schema);

        //validate the example QSDL
        return validate(json);
    }
}
