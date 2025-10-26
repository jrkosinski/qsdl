import { qsdl1, qsdl1_response1 } from './examples';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { schema } from './schema/schema_v0.0.1';
import { AnthropicLLMApi, OpenAILLMApi } from './llms';
import chalk from 'chalk';
import prompts from 'prompts';
import fs from 'fs';

import dotenv from 'dotenv';
import {
    AnthropicMultiTurnConversation,
    IUserInputModule,
} from './llms/multi-turn-conversation';
dotenv.config();

interface IStrategy {
    name: string;
    qsdl: any;
}

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

async function multiTurnConversationTestTest(): Promise<string> {
    const conversation = new AnthropicMultiTurnConversation();

    const inputModule: IUserInputModule = {
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

    return await conversation.startConversation(inputModule);
}

function main() {
    console.log('Application started successfully');

    //testSchemaValidation();
    //testOpenAI();
    //testAnthropic();
    multiTurnConversationTestTest().then((r) => {
        console.log(r);
        fs.writeFileSync('output.json', JSON.stringify(r, null, 2));
    });
}

main();
