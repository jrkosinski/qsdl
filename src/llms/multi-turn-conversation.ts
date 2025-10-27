import { schema } from '../schema/schema_v0.0.1';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import Anthropic from '@anthropic-ai/sdk';

export interface IUserInputModule {
    getUserResponse(prompt: string): Promise<string>;
    onUserExit(): Promise<void>;
    onResponse(response: string): Promise<string>;
    onStats(stats: string): Promise<void>;
    onError(error: any): Promise<void>;
    onQuestion(query: string): Promise<string>;
    onMessage(message: string): Promise<void>;
}

const SCHEMA_FAIL_MAX_RETRIES = 3;
const MAX_QUESTION_LOOP_COUNT = 10;
const INITIAL_SYSTEM_PROMPT = `I'm going to give you a schema for a json document. And a text description of a trading strategy. I would like you to convert the text description into a chunk of json that satisfies the schema. If there are any questions or things that need clarification (information missing), then ask before generating the json. But preface all of your responses that are questions with a 'Q:'. Ask one question at a time, or maximum two if they are related. Your job is to finally generate the json, so don't ask questions if the answers aren't necessary for generating the json (e.g. no need to ask questions about things that aren't directly reflected in the schema). When you send me json, send me nothing but json (no text explanation accompanying it).`;
const ANTHROPIC_LLM_MODEL = 'claude-sonnet-4-5-20250929';
const DEFAULT_MAX_TOKENS = 4096;
const CONSOLE_LOGGING_ENABLED = true;

interface Message {
    role: 'user' | 'assistant';
    content: string;
}

export class AnthropicMultiTurnConversation {
    private api: Anthropic;
    private schemaFailureMaxRetries: number = SCHEMA_FAIL_MAX_RETRIES;
    private maxQuestionCount: number = MAX_QUESTION_LOOP_COUNT;
    private initialSystemPrompt: string = INITIAL_SYSTEM_PROMPT;
    private anthropicModel: string = ANTHROPIC_LLM_MODEL;
    private defaultMaxTokens: number = DEFAULT_MAX_TOKENS;
    private conversationHistory: Message[] = [];
    private questionCount: number = 0;

    constructor() {
        this.api = new Anthropic({
            apiKey: process.env.ANTHROPIC_API_KEY,
        });
    }

    public async startConversation(
        inputModule: IUserInputModule
    ): Promise<any> {
        let output: any = null;
        let haveValidOutput: boolean = false;
        let isFirstTime: boolean = true;

        //start message
        await this.initialStartMessage(inputModule);

        //go into conversation loop
        while (true) {
            //read user input
            const userMessage = await this.readUserInput(
                inputModule,
                isFirstTime
            );
            isFirstTime = false;

            //check for voluntary exit
            if (await this.checkForExit(inputModule, userMessage)) break;

            // Add user message to history
            this.addConversationHistory(userMessage, 'user');

            try {
                let assistantMessage = await this.sendMessage(inputModule);

                //display assistant response
                if (assistantMessage.startsWith('Q:')) {
                    const maxQuestionsReached = await this.handleQuestion(
                        inputModule,
                        assistantMessage
                    );

                    if (maxQuestionsReached) {
                        inputModule.onMessage(
                            'Maximum number of questions reached. We are having trouble completing this task; it might be too complex for us now. Exiting conversation. '
                        );
                        break;
                    }

                    //will loop around now to collect answer to the question
                } else {
                    const tempOutput = await this.handleJsonOutput(
                        inputModule,
                        assistantMessage
                    );

                    if (tempOutput) {
                        const confirmed = await this.finalConfirmation(
                            inputModule,
                            tempOutput
                        );
                        if (confirmed) {
                            output = tempOutput;
                            break;
                        } else {
                            await inputModule.onQuestion(
                                'Please provide the correct information or clarifications needed:'
                            );
                            //will loop around now to collect corrected info
                        }
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

    private async initialStartMessage(
        inputModule: IUserInputModule
    ): Promise<void> {
        await inputModule.onMessage(
            'Starting multi-turn conversation with Anthropic API...'
        );
    }

    private async readUserInput(
        inputModule: IUserInputModule,
        isFirstTime: boolean
    ): Promise<string> {
        const userMessage = isFirstTime
            ? (
                  await inputModule.getUserResponse(
                      'Explain the trading strategy:'
                  )
              ).trim()
            : (await inputModule.getUserResponse('Answer here:')).trim();
        return userMessage;
    }

    private addConversationHistory(
        message: string,
        role: 'user' | 'assistant'
    ) {
        if (CONSOLE_LOGGING_ENABLED) console.log(role, 'says: ', message);
        this.conversationHistory.push({ role, content: message });
    }

    private async showCacheUsageStats(
        apiResponse: any,
        inputModule: IUserInputModule
    ) {
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
    }

    private async checkForExit(
        inputModule: IUserInputModule,
        userMessage: string
    ): Promise<boolean> {
        if (
            !userMessage ||
            userMessage.toLowerCase() === 'exit' ||
            userMessage.toLowerCase() === 'quit'
        ) {
            inputModule.onMessage('Exiting....');
            await inputModule.onUserExit();
            return true;
        }

        return false;
    }

    private async sendMessage(inputModule: IUserInputModule): Promise<any> {
        //static initial system prompt
        const systemPrompt: any = [
            {
                type: 'text',
                text: this.initialSystemPrompt,
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

        //call Anthropic API with conversation history and initial system prompt
        await inputModule.onMessage('Sending message to Anthropic API...');
        const apiResponse = await this.api.messages.create({
            model: this.anthropicModel,
            max_tokens: this.defaultMaxTokens,
            system: systemPrompt,
            messages: this.conversationHistory.map((msg) => ({
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
        this.addConversationHistory(assistantMessage, 'assistant');

        //show cache usage stats if available
        await this.showCacheUsageStats(apiResponse, inputModule);

        return assistantMessage;
    }

    private async handleJsonOutput(
        inputModule: IUserInputModule,
        assistantMessage: string
    ): Promise<any> {
        await inputModule.onMessage('Received json from assistant.');
        let json = this.parseJsonSafe(assistantMessage.trim());
        let output: any = null;

        //here test against the schema
        await inputModule.onMessage(
            'Validating generated json against schema...'
        );

        for (let n = 0; n < this.schemaFailureMaxRetries; n++) {
            try {
                if (this.validateJson(json)) {
                    await inputModule.onMessage(
                        '✅ Generated JSON is valid against the schema.'
                    );
                    output = json;
                    break;
                } else {
                    //TODO: retry schema validation failures
                    await inputModule.onMessage(
                        `❌ Generated JSON is NOT valid against the schema. Attempting retry ${
                            n + 1
                        } of ${this.schemaFailureMaxRetries}...`
                    );

                    //ask Claude to fix it
                    this.addConversationHistory(
                        'The JSON you provided does not validate against the schema. Please fix it and provide valid JSON.',
                        'user'
                    );

                    // Call API again to get corrected JSON
                    const response = await this.sendMessage(inputModule);

                    // Update assistantMessage for next iteration
                    json = this.parseJsonSafe(response.trim());
                }
            } catch (err) {
                //let claude know it needs to retry
                await inputModule.onMessage(
                    `❌ Response is not valid JSON. Attempting retry ${
                        n + 1
                    } of ${this.schemaFailureMaxRetries}...`
                );
            }
        }

        return output;
    }

    private async finalConfirmation(
        inputModule: IUserInputModule,
        output: any
    ): Promise<boolean> {
        this.addConversationHistory(
            'Explain your understand of this trading strategy back to me in words, so that I can confirm if you understood it. Do not prefix your response with Q:',
            'user'
        );

        const response = await this.sendMessage(inputModule);

        await inputModule.onMessage(response);
        const userResponse = await inputModule.getUserResponse(
            'Is this explanation correct and satisfactory? Type Y or N:'
        );

        return userResponse.toLowerCase() === 'y';
    }

    private parseJsonSafe(jsonString: string): any | null {
        try {
            const startBracketIndex = jsonString.indexOf('{');
            const endBracketIndex = jsonString.lastIndexOf('}');

            if (startBracketIndex < 0 || endBracketIndex < 0) {
                throw new Error('No JSON object found in the response');
            }

            //remove everything that isn't json
            jsonString = jsonString.substring(
                startBracketIndex,
                endBracketIndex + 1
            );

            return JSON.parse(jsonString);
        } catch (error) {
            throw error;
        }
    }

    private async handleQuestion(
        inputModule: IUserInputModule,
        assistantMessage: string
    ): Promise<boolean> {
        this.questionCount++;
        if (this.questionCount > this.maxQuestionCount) {
            await inputModule.onError(
                'Maximum question limit reached. Exiting conversation.'
            );
            return true;
        }

        //ask the question to the user
        await inputModule.onQuestion(assistantMessage.substring(2).trim());
        return false;
    }
}
