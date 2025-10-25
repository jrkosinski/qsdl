import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';

export interface ILLMApi {
    query(prompt: string): Promise<string>;
}

export class OpenAILLMApi implements ILLMApi {
    private api: OpenAI;

    constructor(apiKey: string) {
        this.api = new OpenAI({ apiKey });
    }

    async query(prompt: string): Promise<string> {
        const completion = await this.api.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                { role: 'system', content: 'You are a helpful assistant.' },
                {
                    role: 'user',
                    content: 'Explain quantum computing in simple terms.',
                },
            ],
        });

        console.log(completion.choices[0]);
        return completion.choices[0].message?.content || '';
    }
}

export class AnthropicLLMApi implements ILLMApi {
    private api: Anthropic;

    constructor(apiKey: string) {
        this.api = new Anthropic({
            apiKey: process.env.ANTHROPIC_API_KEY,
        });
    }

    async query(prompt: string): Promise<string> {
        const response = await this.api.messages.create({
            model: 'claude-sonnet-4-5-20250929', // pick the model you’re allowed to use
            max_tokens: 1024,
            messages: [{ role: 'user', content: prompt }],
        });

        console.log('Anthropic says:', response.content);
        return (response.content[0] as any).text;
    }
}
