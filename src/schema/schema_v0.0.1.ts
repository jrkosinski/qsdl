export const schema = {
    $schema: 'http://json-schema.org/draft-07/schema#',
    title: 'TradingStrategy',
    version: '1.0.0',
    type: 'object',
    required: ['symbols', 'indicators', 'triggers', 'actions'],
    properties: {
        symbols: {
            type: 'array',
            items: { type: 'string' },
            minItems: 1,
            description: "List of traded symbols (e.g., ['REMX']).",
        },

        indicators: {
            type: 'array',
            minItems: 1,
            items: {
                type: 'object',
                required: ['id', 'type', 'symbol', 'params'],
                properties: {
                    id: { type: 'string' },
                    type: {
                        type: 'string',
                        enum: ['sma', 'ema', 'rsi', 'macd', 'atr', 'custom'],
                    },
                    symbol: { type: 'string' },
                    params: {
                        type: 'object',
                        additionalProperties: true,
                    },
                },
                additionalProperties: false,
            },
        },

        preconditions: {
            type: 'array',
            items: { type: 'object' },
            description:
                'Optional global preconditions before triggers can activate.',
        },

        triggers: {
            type: 'array',
            minItems: 1,
            items: {
                type: 'object',
                oneOf: [
                    { required: ['and', 'actions'] },
                    { required: ['or', 'actions'] },
                ],
                properties: {
                    and: {
                        type: 'array',
                        items: { $ref: '#/definitions/condition' },
                        description: 'All conditions must be true.',
                    },
                    or: {
                        type: 'array',
                        items: { $ref: '#/definitions/condition' },
                        description: 'Any condition can be true.',
                    },
                    actions: {
                        type: 'array',
                        items: { type: 'string' },
                        description:
                            'IDs of actions to execute if conditions are met.',
                    },
                },
                additionalProperties: false,
            },
        },

        actions: {
            type: 'array',
            minItems: 1,
            items: {
                type: 'object',
                required: ['type', 'order'],
                properties: {
                    id: { type: 'string' },
                    type: {
                        type: 'string',
                        enum: ['entry', 'exit'],
                    },
                    direction: {
                        type: 'string',
                        enum: ['long', 'short'],
                    },
                    max_position_size: { type: 'number', minimum: 0 },
                    percent_of_position: {
                        type: 'number',
                        minimum: 0,
                        maximum: 100,
                    },
                    order: {
                        type: 'object',
                        required: ['symbol', 'type', 'tif'],
                        properties: {
                            symbol: { type: 'string' },
                            type: {
                                type: 'string',
                                enum: ['market', 'limit', 'stop'],
                            },
                            tif: {
                                type: 'string',
                                enum: ['day', 'gtc', 'ioc', 'fok'],
                            },
                            price: { type: ['number', 'null'] },
                        },
                        additionalProperties: false,
                    },
                    stop_loss: {
                        type: 'object',
                        additionalProperties: true,
                    },
                },
                additionalProperties: false,
            },
        },
    },

    definitions: {
        condition: {
            type: 'object',
            oneOf: [
                {
                    required: ['type', 'params'],
                    properties: {
                        type: {
                            type: 'string',
                            enum: ['indicator_event'],
                        },
                        params: {
                            type: 'object',
                            required: ['event_type', 'threshold', 'direction'],
                            properties: {
                                event_type: {
                                    type: 'string',
                                    enum: ['cross', 'cross_up', 'cross_down'],
                                },
                                threshold: { type: 'number' },
                                direction: {
                                    type: 'string',
                                    enum: ['above', 'below'],
                                },
                            },
                            additionalProperties: false,
                        },
                    },
                },
                {
                    required: ['type', 'params'],
                    properties: {
                        type: {
                            type: 'string',
                            enum: ['indicator_comparison'],
                        },
                        params: {
                            type: 'object',
                            required: ['indicator1', 'indicator2', 'operator'],
                            properties: {
                                indicator1: { type: 'string' },
                                indicator2: { type: 'string' },
                                operator: {
                                    type: 'string',
                                    enum: ['>', '<', '>=', '<=', '==', '!='],
                                },
                            },
                            additionalProperties: false,
                        },
                    },
                },
            ],
        },
    },

    additionalProperties: false,
};
