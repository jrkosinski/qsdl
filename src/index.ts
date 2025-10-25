import { qsdl1 } from './examples';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { schema } from './schema';
import { AnthropicLLMApi, OpenAILLMApi } from './llms';

import dotenv from 'dotenv';
dotenv.config();

interface IStrategy {
    name: string;
    qsdl: any;
}

interface IStrategyParser {
    parse(text: string): Promise<IStrategy>;
}

function testSchemaValidation() {
    //compile the schema
    const ajv = new Ajv({ allErrors: true, strict: false });
    addFormats(ajv);
    const validate = ajv.compile(schema);

    //validate the example QSDL
    const valid = validate(qsdl1);
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

function main() {
    console.log('Application started successfully');

    testSchemaValidation();
    //testOpenAI();
    testAnthropic();
}

main();
