import { qsdl1 } from './examples';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { schema } from './schema';
import OpenAI from 'openai';

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
    const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY!,
    });

    const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
            { role: 'system', content: 'You are a helpful assistant.' },
            {
                role: 'user',
                content: 'Explain quantum computing in simple terms.',
            },
        ],
    });

    console.log(completion.choices[0].message);
}

function main() {
    console.log('Application started successfully');

    testSchemaValidation();
    testOpenAI();
}

main();
