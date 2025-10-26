import { schema } from '../schema/schema_v0.0.1';
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
const INITIAL_SYSTEM_PROMPT = `I'm going to give you a schema for a json document. And a text description of a trading strategy. I would like you to convert the text description into a chunk of json that satisfies the schema. If there are any questions or things that need clarification (information missing), then ask before generating the json. But preface all of your questions with a Q: and when you send me json, send me nothing but json (no text explanation accompanying it).`;

interface Message {
    role: 'user' | 'assistant';
    content: string;
}

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
        const conversationHistory: Message[] = [];
        let output = '';

        inputModule.onMessage(
            'Starting multi-turn conversation with Anthropic API...'
        );

        let questionCount: number = 0;

        //static initial system prompt
        const SYSTEM_PROMPT: any = [
            {
                type: 'text',
                text: INITIAL_SYSTEM_PROMPT,
                cache_control: { type: 'ephemeral' }, // Cache the schema
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
        ];

        while (true) {
            //read user input
            const userMessage = await inputModule.getUserResponse();

            //check for exit
            if (
                !userMessage ||
                userMessage.toLowerCase() === 'exit' ||
                userMessage.toLowerCase() === 'quit'
            ) {
                console.log('exiting...', userMessage);
                await inputModule.onUserExit();
                break;
            }

            // Add user message to history
            conversationHistory.push({
                role: 'user',
                content: userMessage,
            });

            try {
                //call Anthropic API with conversation history
                inputModule.onMessage('Sending message to Anthropic API...');
                const apiResponse = await this.api.messages.create({
                    model: 'claude-sonnet-4-5-20250929',
                    max_tokens: 4096,
                    system: SYSTEM_PROMPT,
                    messages: conversationHistory.map((msg) => ({
                        role: msg.role,
                        content: msg.content,
                    })),
                });

                //extract assistant's response
                let assistantMessage =
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
                    questionCount++;
                    await inputModule.onQuestion(
                        assistantMessage.substring(2).trim()
                    );
                } else {
                    await inputModule.onMessage(
                        'Received json from assistant.'
                    );
                    output = this.parseJsonSafe(assistantMessage.trim());

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
                            } else {
                                //TODO: retry schema validation failures
                                inputModule.onMessage(
                                    `❌ Generated JSON is NOT valid against the schema. Attempting retry ${
                                        n + 1
                                    } of ${SCHEMA_FAIL_MAX_RETRIES}...`
                                );

                                // Ask Claude to fix it
                                conversationHistory.push({
                                    role: 'user',
                                    content:
                                        'The JSON you provided does not validate against the schema. Please fix it and provide valid JSON.',
                                });

                                // Call API again to get corrected JSON
                                const retryResponse =
                                    await this.api.messages.create({
                                        model: 'claude-sonnet-4-5-20250929',
                                        max_tokens: 4096,
                                        system: SYSTEM_PROMPT,
                                        messages: conversationHistory.map(
                                            (msg) => ({
                                                role: msg.role,
                                                content: msg.content,
                                            })
                                        ),
                                    });

                                const retryMessage =
                                    retryResponse.content[0].type === 'text'
                                        ? retryResponse.content[0].text
                                        : '';

                                conversationHistory.push({
                                    role: 'assistant',
                                    content: retryMessage,
                                });

                                // Update assistantMessage for next iteration
                                output = this.parseJsonSafe(
                                    retryMessage.trim()
                                );
                            }
                        } catch (err) {
                            //let claude know it needs to retry
                            inputModule.onMessage(
                                `❌ Response is not valid JSON. Attempting retry ${
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
    }

    //TODO: move this out to a separate module
    private validateJson(json: any): boolean {
        //compile the schema
        const ajv = new Ajv({ allErrors: true, strict: false });
        addFormats(ajv);
        const validate = ajv.compile(schema);

        //validate the example QSDL
        return validate(json);
    }

    private parseJsonSafe(jsonString: string): any | null {
        try {
            const startBracketIndex = jsonString.indexOf('{');
            const endBracketIndex = jsonString.lastIndexOf('}');
            if (startBracketIndex < 0 || endBracketIndex < 0) {
                return null;
            }
            jsonString = jsonString.substring(
                startBracketIndex,
                endBracketIndex + 1
            );
            return JSON.parse(jsonString);
        } catch (error) {
            return null;
        }
    }
}
