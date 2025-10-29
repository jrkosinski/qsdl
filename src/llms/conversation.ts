/**
 * Multi-turn conversation handler for interactive trading strategy definition.
 *
 * This module implements an interactive conversation flow with Anthropic's Claude AI
 * to convert natural language trading strategy descriptions into QSDL-compliant JSON.
 * It manages the complete lifecycle of the conversation including:
 *
 * - Multi-turn dialogue with context preservation
 * - Question-based clarification when information is missing
 * - Automatic schema validation with retry logic
 * - Final confirmation to ensure accurate understanding
 * - Prompt caching for efficient API usage
 *
 * The conversation flow:
 * 1. User provides initial strategy description
 * 2. AI asks clarifying questions (prefixed with 'Q:')
 * 3. User answers questions
 * 4. AI generates JSON output
 * 5. System validates JSON against QSDL schema
 * 6. AI explains understanding back to user
 * 7. User confirms or provides corrections
 *
 * Features:
 * - Configurable retry limits for schema validation failures
 * - Maximum question count to prevent infinite loops
 * - Conversation history tracking
 * - Cache optimization for system prompts and schema
 * - Extensible input/output module interface for custom UI implementations
 */

import { schema } from '../schema/schema_v0.0.2';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import Anthropic from '@anthropic-ai/sdk';

/**
 * Interface for handling user input/output during the conversation.
 * Provides hooks for various events in the conversation lifecycle,
 * allowing custom implementations for different UI frameworks (CLI, web, etc.).
 */
export interface IUserIO {
    /** Gets user response to a prompt */
    getUserResponse(prompt: string): Promise<string>;

    /** Called when user exits the conversation */
    onUserExit(): Promise<void>;

    /** Called to display statistics (e.g., cache usage) */
    onStats(stats: string): Promise<void>;

    /** Called when an error occurs */
    onError(error: any): Promise<void>;

    /** Called when AI asks a question */
    onQuestion(query: string): Promise<string>;

    /** Called to display a message to the user */
    onMessage(message: string): Promise<void>;
}

const SCHEMA_FAIL_MAX_RETRIES = 3;
const MAX_QUESTION_LOOP_COUNT = 10;
const INITIAL_SYSTEM_PROMPT = `I'm going to give you a schema for a json document. And a text description of a trading strategy. I would like you to convert the text description into a chunk of json that satisfies the schema. If there are any questions or things that need clarification (information missing), then ask before generating the json. But preface all of your responses that are questions with a 'Q:'. Ask one question at a time, or maximum two if they are related. Your job is to finally generate the json, so don't ask questions if the answers aren't necessary for generating the json (e.g. no need to ask questions about things that aren't directly reflected in the json schema). Do not discuss or answer things that are not directly about the trading strategy to be generated. When you send me json, send me nothing but json (no text explanation accompanying it). If not sending JSON, then always preface your response with 'Q:'`;
const ANTHROPIC_LLM_MODEL = 'claude-sonnet-4-5-20250929';
const DEFAULT_MAX_TOKENS = 4096;
const CONSOLE_LOGGING_ENABLED = false;

/**
 * Represents a single message in the conversation history.
 */
interface Message {
    role: 'user' | 'assistant';
    content: string;
}

/**
 * Manages multi-turn conversations with Anthropic's Claude API for QSDL generation.
 * Handles the complete conversation lifecycle including questions, validation, and confirmation.
 */
export class AnthropicConversation {
    private _api: Anthropic;
    private _schemaFailureMaxRetries: number = SCHEMA_FAIL_MAX_RETRIES;
    private _maxQuestionCount: number = MAX_QUESTION_LOOP_COUNT;
    private _initialSystemPrompt: string = INITIAL_SYSTEM_PROMPT;
    private _anthropicModel: string = ANTHROPIC_LLM_MODEL;
    private _defaultMaxTokens: number = DEFAULT_MAX_TOKENS;
    private _conversationHistory: Message[] = [];
    private _questionCount: number = 0;
    private _inputModule: IUserIO;

    /**
     * Creates a new AnthropicConversation instance.
     * @param {IUserIO} inputModule - The input/output handler for user interactions
     * @throws {Error} If inputModule is not provided
     */
    constructor(inputModule: IUserIO) {
        this._inputModule = inputModule;
        if (!inputModule) throw new Error('input module is required');
        this._api = new Anthropic({
            apiKey: process.env.ANTHROPIC_API_KEY,
        });
    }

    /**
     * Starts the multi-turn conversation flow.
     * Orchestrates the entire process of gathering strategy information,
     * asking clarifying questions, generating JSON, validating it, and confirming with the user.
     * @returns {Promise<any>} The validated QSDL JSON object, or null if conversation was exited
     */
    public async startConversation(): Promise<any> {
        let output: any = null;
        let haveValidOutput: boolean = false;
        let isFirstTime: boolean = true;

        //start message
        await this._initialStartMessage();

        //go into conversation loop
        while (true) {
            //read user input
            const userMessage = await this._readUserInput(isFirstTime);
            isFirstTime = false;

            //check for voluntary exit
            if (await this._checkForExit(userMessage)) break;

            try {
                //send user message
                let assistantMessage = await this._sendMessage(
                    userMessage,
                    'user'
                );

                //display assistant response
                if (assistantMessage.startsWith('Q:')) {
                    const maxQuestionsReached = await this._handleQuestion(
                        assistantMessage
                    );

                    if (maxQuestionsReached) {
                        this._inputModule.onMessage(
                            'Maximum number of questions reached. We are having trouble completing this task; it might be too complex for us now. Exiting conversation. '
                        );
                        break;
                    }

                    //will loop around now to collect answer to the question
                } else {
                    const tempOutput = await this._handleJsonOutput(
                        assistantMessage
                    );

                    if (tempOutput) {
                        const confirmed = await this._finalConfirmation(
                            tempOutput
                        );
                        if (confirmed) {
                            output = tempOutput;
                            break;
                        } else {
                            await this._inputModule.onQuestion(
                                'Please provide the correct information or clarifications needed:'
                            );
                            //will loop around now to collect corrected info
                        }
                    }
                }
            } catch (error) {
                await this._inputModule.onError(error);
            }
        }

        return output;
    }

    /**
     * Validates a JSON object against the QSDL schema using AJV.
     * @param {any} json - The JSON object to validate
     * @returns {boolean} True if valid, false otherwise
     * @todo Move this out to a separate module
     */
    private _validateJson(json: any): boolean {
        //compile the schema
        const ajv = new Ajv({ allErrors: true, strict: false });
        addFormats(ajv);
        const validate = ajv.compile(schema);

        //validate the example QSDL
        return validate(json);
    }

    /**
     * Displays the initial welcome message when the conversation starts.
     */
    private async _initialStartMessage(): Promise<void> {
        await this._inputModule.onMessage(
            'Starting multi-turn conversation with Anthropic API...'
        );
    }

    /**
     * Reads user input with appropriate prompts.
     * @param {boolean} isFirstTime - True if this is the first user input, false otherwise
     * @returns {Promise<string>} The trimmed user input
     */
    private async _readUserInput(isFirstTime: boolean): Promise<string> {
        const userMessage = isFirstTime
            ? (
                  await this._inputModule.getUserResponse(
                      'Explain the trading strategy:'
                  )
              ).trim()
            : (await this._inputModule.getUserResponse('Your reply:')).trim();
        return userMessage;
    }

    /**
     * Adds a message to the conversation history.
     * @param {string} message - The message content
     * @param {'user' | 'assistant'} role - The role of the message sender
     */
    private _addConversationHistory(
        message: string,
        role: 'user' | 'assistant'
    ) {
        if (CONSOLE_LOGGING_ENABLED) console.log(role, 'says: ', message);
        this._conversationHistory.push({ role, content: message });
    }

    /**
     * Displays cache usage statistics from the API response.
     * Shows cache creation and cache hit metrics if available.
     * @param {any} apiResponse - The API response containing usage information
     */
    private async _showCacheUsageStats(apiResponse: any) {
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
                await this._inputModule.onStats(cacheStats);
            }
        }
    }

    /**
     * Checks if the user wants to exit the conversation.
     * Exits if message is empty or contains 'exit' or 'quit'.
     * @param {string} userMessage - The user's message to check
     * @returns {Promise<boolean>} True if the user wants to exit, false otherwise
     */
    private async _checkForExit(userMessage: string): Promise<boolean> {
        if (
            !userMessage ||
            userMessage.toLowerCase() === 'exit' ||
            userMessage.toLowerCase() === 'quit'
        ) {
            this._inputModule.onMessage('Exiting....');
            await this._inputModule.onUserExit();
            return true;
        }

        return false;
    }

    /**
     * Adds a message to the conversation history, and then sends it.
     * Same as calling addConversationHistory(message, role) and then updateConversation()
     * @param {string} message - The message content
     * @param {'user' | 'assistant'} role - The role of the message sender
     */
    private async _sendMessage(
        message: string,
        role: 'user' | 'assistant'
    ): Promise<any> {
        this._addConversationHistory(message, role);
        return await this._updateConversation();
    }

    /**
     * Sends the current conversation to Anthropic's API and returns the response.
     * Uses prompt caching for the system prompt and schema to reduce API costs.
     * @returns {Promise<any>} The assistant's response message
     */
    private async _updateConversation(): Promise<any> {
        //static initial system prompt
        const systemPrompt: any = [
            {
                type: 'text',
                text: this._initialSystemPrompt,
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
        await this._inputModule.onMessage('Processing...');
        const apiResponse = await this._api.messages.create({
            model: this._anthropicModel,
            max_tokens: this._defaultMaxTokens,
            system: systemPrompt,
            messages: this._conversationHistory.map((msg) => ({
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
        this._addConversationHistory(assistantMessage, 'assistant');

        //show cache usage stats if available
        await this._showCacheUsageStats(apiResponse);

        return assistantMessage;
    }

    /**
     * Handles JSON output from the assistant.
     * Parses the JSON, validates it against the schema, and retries if validation fails.
     * @param {string} assistantMessage - The assistant's response containing JSON
     * @returns {Promise<any>} The validated JSON object, or null if validation failed after all retries
     */
    private async _handleJsonOutput(assistantMessage: string): Promise<any> {
        await this._inputModule.onMessage('Processing received json...');
        let json = this._parseJsonSafe(assistantMessage.trim());
        let output: any = null;

        //here test against the schema
        await this._inputModule.onMessage(
            'Validating generated json against schema...'
        );

        for (let n = 0; n < this._schemaFailureMaxRetries; n++) {
            try {
                if (this._validateJson(json)) {
                    await this._inputModule.onMessage(
                        '✅ Generated JSON is valid against the schema.'
                    );
                    output = json;
                    break;
                } else {
                    //TODO: retry schema validation failures
                    await this._inputModule.onMessage(
                        `❌ Generated JSON is NOT valid against the schema. Attempting retry ${
                            n + 1
                        } of ${this._schemaFailureMaxRetries}...`
                    );

                    //ask Claude to fix it
                    const response = await this._sendMessage(
                        'The JSON you provided does not validate against the schema. Please fix it and provide valid JSON.',
                        'user'
                    );

                    // Update assistantMessage for next iteration
                    json = this._parseJsonSafe(response.trim());
                }
            } catch (err) {
                //let claude know it needs to retry
                await this._inputModule.onMessage(
                    `❌ Response is not valid JSON. Attempting retry ${
                        n + 1
                    } of ${this._schemaFailureMaxRetries}...`
                );
            }
        }

        return output;
    }

    /**
     * Asks the assistant to explain its understanding and gets user confirmation.
     * This ensures the AI correctly understood the strategy before finalizing.
     * @param {any} output - The generated JSON output to confirm
     * @returns {Promise<boolean>} True if user confirms, false otherwise
     */
    private async _finalConfirmation(output: any): Promise<boolean> {
        const response = await this._sendMessage(
            'Explain your understand of this trading strategy back to me in words, so that I can confirm if you understood it. Do not prefix your response with Q:',
            'user'
        );

        await this._inputModule.onMessage(response);
        const userResponse = await this._inputModule.getUserResponse(
            'Is this explanation correct and satisfactory? Type Y or N:'
        );

        return userResponse.toLowerCase() === 'y';
    }

    /**
     * Safely parses a JSON string, extracting only the JSON object portion.
     * Removes any text before or after the JSON object.
     * @param {string} jsonString - The string containing JSON (possibly with extra text)
     * @returns {any | null} The parsed JSON object
     * @throws {Error} If no valid JSON object is found or parsing fails
     */
    private _parseJsonSafe(jsonString: string): any | null {
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

    /**
     * Handles a question from the assistant.
     * Tracks question count and prevents infinite question loops.
     * @param {string} assistantMessage - The assistant's question (prefixed with 'Q:')
     * @returns {Promise<boolean>} True if max questions reached, false otherwise
     */
    private async _handleQuestion(assistantMessage: string): Promise<boolean> {
        this._questionCount++;
        if (this._questionCount > this._maxQuestionCount) {
            await this._inputModule.onError(
                'Maximum question limit reached. Exiting conversation.'
            );
            return true;
        }

        //ask the question to the user
        await this._inputModule.onQuestion(
            assistantMessage.substring(2).trim()
        );
        return false;
    }
}
