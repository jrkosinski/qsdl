const qsdl1 = {
    data: [],
    rules: [],
    actions: [],
    position_limits: [],
};

const qsdl2 = {
    data: [
        {
            id: 'volume',
            type: 'volume',
            spec: {
                offset: 0,
            },
        },
        {
            id: 'price',
            type: 'price',
            spec: {
                offset: 0,
            },
        },
        {
            id: 'candle0',
            type: 'candle',
            spec: {
                offset: 0,
            },
        },
        {
            id: 'candle1',
            type: 'candle',
            spec: {
                offset: 1,
            },
        },
        {
            id: 'macd-12-26-9',
            type: 'indicator',
            spec: {
                params: [12, 26, 9],
            },
        },
    ],
    rules: [],
    actions: [],
    position_limits: [],
};

const expression1 = {
    value: 100,
    operation: {},
};

/*
primitives: 
- expression
- operation
*/

/*
const operation1 = 

const expression2 = {
    greaterThan: {
        valueA: 100,
        valueB: {
            percentage: {},
        },
    },
};

const qsdl3 = {
    data: [
        {
            id: 'volume',
            type: 'volume',
            spec: {
                offset: 0,
            },
        },
        {
            id: 'price',
            type: 'price',
            spec: {
                offset: 0,
            },
        },
        {
            id: 'candle0',
            type: 'candle',
            spec: {
                offset: 0,
            },
        },
        {
            id: 'candle1',
            type: 'candle',
            spec: {
                offset: 1,
            },
        },
        {
            id: 'macd-12-26-9',
            type: 'indicator',
            spec: {
                params: [12, 26, 9],
            },
        },
    ],
    rules: [
        {
            id: 'rule_open',
            preconditions: [
                {
                    expression: { lessThan: { operands: [] } },
                },
            ],
            triggers: [{}],
            actions: [
                {
                    id: 'buyASDL',
                },
            ],
        },
    ],
    actions: [
        {
            id: 'buyASDL',
            type: 'buy',
            symbol: 'ASDL',
            quantity: {
                value: 100,
            },
            order: {
                type: 'limit',
                price: {
                    expression: { value: 'price' },
                },
            },
        },
    ],
    position_limits: [
        {
            symbol: 'ASDL',
            max: {
                expression: { value: 100 },
            },
            min: {
                expression: { value: 0 },
            },
        },
    ],
};
*/
