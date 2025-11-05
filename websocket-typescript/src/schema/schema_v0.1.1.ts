export const schema = {
    version: '0.1.1',
    schema: {
        $schema: 'http://json-schema.org/draft-07/schema#',
        title: 'trading_strategy_schema',
        description:
            'Schema for defining trading strategies for forex, stocks, and futures',
        type: 'object',
        $ref: '#/definitions/i_strategy',
        definitions: {
            i_strategy: {
                type: 'object',
                required: ['data', 'rules', 'actions', 'position_limits'],
                properties: {
                    data: {
                        type: 'array',
                        description: 'must have length of at least one',
                        minItems: 1,
                        items: {
                            $ref: '#/definitions/i_data',
                        },
                    },
                    rules: {
                        type: 'array',
                        description: 'must have length of at least one',
                        minItems: 1,
                        items: {
                            $ref: '#/definitions/i_rule',
                        },
                    },
                    actions: {
                        type: 'array',
                        description: 'must have length of at least one',
                        minItems: 1,
                        items: {
                            $ref: '#/definitions/i_action',
                        },
                    },
                    position_limits: {
                        type: 'array',
                        description: 'must have at least one',
                        minItems: 1,
                        items: {
                            $ref: '#/definitions/i_position_limit',
                        },
                    },
                },
            },
            i_data: {
                type: 'object',
                required: ['id', 'type', 'timeframe'],
                properties: {
                    id: {
                        type: 'string',
                    },
                    type: {
                        type: 'string',
                        enum: ['indicator', 'candle', 'volume', 'time'],
                    },
                    timeframe: {
                        $ref: '#/definitions/i_timeframe',
                    },
                    offset: {
                        type: 'number',
                    },
                },
                allOf: [
                    {
                        if: {
                            properties: {
                                type: {
                                    const: 'indicator',
                                },
                            },
                        },
                        then: {
                            $ref: '#/definitions/i_data_indicator',
                        },
                    },
                    {
                        if: {
                            properties: {
                                type: {
                                    const: 'time',
                                },
                            },
                        },
                        then: {
                            $ref: '#/definitions/i_data_time',
                        },
                    },
                ],
            },
            i_timeframe: {
                type: 'object',
                required: ['length', 'period'],
                properties: {
                    length: {
                        type: 'number',
                        description: "default 1, can't be zero",
                        minimum: 1,
                        default: 1,
                    },
                    period: {
                        type: 'string',
                        enum: ['second', 'minute', 'hour', 'day', 'month'],
                    },
                },
            },
            i_data_indicator: {
                type: 'object',
                required: ['indicator_type', 'params'],
                properties: {
                    indicator_type: {
                        type: 'string',
                        enum: ['sma', 'ema', 'rsi', 'atr'],
                    },
                    params: {
                        type: 'array',
                    },
                },
            },
            i_data_time: {
                type: 'object',
                required: ['second', 'minute', 'hour'],
                properties: {
                    second: {
                        type: 'number',
                    },
                    minute: {
                        type: 'number',
                    },
                    hour: {
                        type: 'number',
                    },
                },
            },
            i_action: {
                type: 'object',
                required: ['id', 'order'],
                properties: {
                    id: {
                        type: 'string',
                    },
                    order: {
                        $ref: '#/definitions/stock_order',
                    },
                },
            },
            i_position_limit: {
                type: 'object',
                required: ['symbol', 'max', 'min'],
                properties: {
                    symbol: {
                        type: 'string',
                    },
                    max: {
                        type: 'number',
                    },
                    min: {
                        type: 'number',
                    },
                },
            },
            i_rule: {
                type: 'object',
                required: ['if', 'then'],
                properties: {
                    if: {
                        $ref: '#/definitions/i_condition',
                    },
                    then: {
                        type: 'array',
                        items: {
                            type: 'string',
                        },
                    },
                    else: {
                        type: 'array',
                        description: 'else is not required',
                        items: {
                            type: 'string',
                        },
                    },
                },
            },
            i_condition: {
                type: 'object',
                description: "must have only one of 'expression', 'and', 'or'",
                oneOf: [
                    {
                        required: ['expression'],
                        properties: {
                            expression: {
                                $ref: '#/definitions/i_comparison',
                            },
                        },
                        additionalProperties: false,
                    },
                    {
                        required: ['and'],
                        properties: {
                            and: {
                                type: 'array',
                                items: {
                                    oneOf: [
                                        {
                                            $ref: '#/definitions/i_condition',
                                        },
                                        {
                                            $ref: '#/definitions/i_comparison',
                                        },
                                    ],
                                },
                            },
                        },
                        additionalProperties: false,
                    },
                    {
                        required: ['or'],
                        properties: {
                            or: {
                                type: 'array',
                                items: {
                                    oneOf: [
                                        {
                                            $ref: '#/definitions/i_condition',
                                        },
                                        {
                                            $ref: '#/definitions/i_comparison',
                                        },
                                    ],
                                },
                            },
                        },
                        additionalProperties: false,
                    },
                ],
            },
            i_value_expression: {
                type: 'object',
                required: ['value'],
                properties: {
                    value: {
                        oneOf: [
                            {
                                type: 'number',
                            },
                            {
                                type: 'string',
                            },
                            {
                                $ref: '#/definitions/i_operation',
                            },
                            {
                                $ref: '#/definitions/i_indicator_output',
                            },
                        ],
                    },
                },
            },
            i_indicator_output: {
                type: 'object',
                required: ['indicator_id'],
                properties: {
                    indicator_id: {
                        type: 'string',
                        description: 'must be valid indicator id',
                    },
                    output_index: {
                        type: 'number',
                        description: 'default to 0',
                        default: 0,
                    },
                },
            },
            i_comparison: {
                type: 'object',
                required: ['operand_a', 'operand_b', 'comparison'],
                description: 'must have operand_a, operand_b, and comparison',
                properties: {
                    operand_a: {
                        oneOf: [
                            {
                                $ref: '#/definitions/i_value_expression',
                            },
                            {
                                type: 'number',
                            },
                        ],
                    },
                    operand_b: {
                        oneOf: [
                            {
                                $ref: '#/definitions/i_value_expression',
                            },
                            {
                                type: 'number',
                            },
                        ],
                    },
                    comparison: {
                        type: 'string',
                        enum: ['<', '>', '<=', '>=', '==', '!='],
                    },
                },
            },
            i_operation: {
                type: 'object',
                required: ['operand', 'value_a', 'value_b'],
                properties: {
                    operand: {
                        type: 'string',
                        enum: ['+', '*', '-', '/', '%'],
                    },
                    value_a: {
                        $ref: '#/definitions/i_value_expression',
                    },
                    value_b: {
                        $ref: '#/definitions/i_value_expression',
                    },
                },
            },
            i_base_order: {
                type: 'object',
                required: ['symbol', 'quantity', 'side', 'tif'],
                properties: {
                    symbol: {
                        type: 'string',
                    },
                    quantity: {
                        type: 'number',
                        description: 'TODO: change to expression',
                    },
                    side: {
                        type: 'string',
                        enum: ['buy', 'sell'],
                    },
                    tif: {
                        type: 'string',
                        enum: ['day', 'gtc', 'ioc', 'fok', 'gtd', 'ext'],
                    },
                    extended_hours: {
                        type: 'boolean',
                    },
                    account_id: {
                        type: 'string',
                    },
                    timestamp: {
                        type: 'string',
                        format: 'date-time',
                    },
                },
            },
            i_market_order: {
                allOf: [
                    {
                        $ref: '#/definitions/i_base_order',
                    },
                    {
                        type: 'object',
                        required: ['type'],
                        properties: {
                            type: {
                                const: 'market',
                            },
                        },
                    },
                ],
            },
            i_limit_order: {
                allOf: [
                    {
                        $ref: '#/definitions/i_base_order',
                    },
                    {
                        type: 'object',
                        required: ['type', 'limit_price'],
                        properties: {
                            type: {
                                const: 'limit',
                            },
                            limit_price: {
                                type: 'number',
                            },
                        },
                    },
                ],
            },
            i_stop_order: {
                description: 'Stop market',
                allOf: [
                    {
                        $ref: '#/definitions/i_base_order',
                    },
                    {
                        type: 'object',
                        required: ['type', 'stop_price'],
                        properties: {
                            type: {
                                const: 'stop',
                            },
                            stop_price: {
                                type: 'number',
                            },
                        },
                    },
                ],
            },
            i_stop_limit_order: {
                description: 'Stop-limit',
                allOf: [
                    {
                        $ref: '#/definitions/i_base_order',
                    },
                    {
                        type: 'object',
                        required: ['type', 'stop_price', 'limit_price'],
                        properties: {
                            type: {
                                const: 'stop_limit',
                            },
                            stop_price: {
                                type: 'number',
                            },
                            limit_price: {
                                type: 'number',
                            },
                        },
                    },
                ],
            },
            i_trailing_stop_order: {
                description: 'Trailing Stop',
                allOf: [
                    {
                        $ref: '#/definitions/i_base_order',
                    },
                    {
                        type: 'object',
                        required: ['type'],
                        properties: {
                            type: {
                                const: 'trailing_stop',
                            },
                            trail_amount: {
                                type: 'number',
                                description: 'Dollar amount',
                            },
                            trail_percent: {
                                type: 'number',
                                description: 'Percentage',
                            },
                        },
                    },
                ],
            },
            i_trailing_stop_limit_order: {
                description: 'Trailing Stop-limit',
                allOf: [
                    {
                        $ref: '#/definitions/i_base_order',
                    },
                    {
                        type: 'object',
                        required: ['type', 'limit_offset'],
                        properties: {
                            type: {
                                const: 'trailing_stop_limit',
                            },
                            trail_amount: {
                                type: 'number',
                            },
                            trail_percent: {
                                type: 'number',
                            },
                            limit_offset: {
                                type: 'number',
                                description: 'Offset from stop price for limit',
                            },
                        },
                    },
                ],
            },
            i_oco_order: {
                description: 'OCO',
                allOf: [
                    {
                        $ref: '#/definitions/i_base_order',
                    },
                    {
                        type: 'object',
                        required: ['type', 'orders'],
                        properties: {
                            type: {
                                const: 'oco',
                            },
                            orders: {
                                type: 'array',
                                minItems: 2,
                                maxItems: 2,
                                items: {
                                    oneOf: [
                                        {
                                            $ref: '#/definitions/i_limit_order',
                                        },
                                        {
                                            $ref: '#/definitions/i_stop_order',
                                        },
                                        {
                                            $ref: '#/definitions/i_stop_limit_order',
                                        },
                                    ],
                                },
                            },
                        },
                    },
                ],
            },
            i_bracket_order: {
                description: 'Bracket',
                allOf: [
                    {
                        $ref: '#/definitions/i_base_order',
                    },
                    {
                        type: 'object',
                        required: [
                            'type',
                            'entry_order',
                            'profit_target',
                            'stop_loss',
                        ],
                        properties: {
                            type: {
                                const: 'bracket',
                            },
                            entry_order: {
                                oneOf: [
                                    {
                                        $ref: '#/definitions/i_market_order',
                                    },
                                    {
                                        $ref: '#/definitions/i_limit_order',
                                    },
                                ],
                            },
                            profit_target: {
                                $ref: '#/definitions/i_limit_order',
                            },
                            stop_loss: {
                                oneOf: [
                                    {
                                        $ref: '#/definitions/i_stop_order',
                                    },
                                    {
                                        $ref: '#/definitions/i_stop_limit_order',
                                    },
                                ],
                            },
                        },
                    },
                ],
            },
            i_iceberg_order: {
                description: 'Iceberg',
                allOf: [
                    {
                        $ref: '#/definitions/i_base_order',
                    },
                    {
                        type: 'object',
                        required: [
                            'type',
                            'limit_price',
                            'display_quantity',
                            'total_quantity',
                        ],
                        properties: {
                            type: {
                                const: 'iceberg',
                            },
                            limit_price: {
                                type: 'number',
                            },
                            display_quantity: {
                                type: 'number',
                                description: 'Visible quantity',
                            },
                            total_quantity: {
                                type: 'number',
                                description: 'Total order size',
                            },
                        },
                    },
                ],
            },
            i_all_or_none_order: {
                description: 'All or none',
                allOf: [
                    {
                        $ref: '#/definitions/i_base_order',
                    },
                    {
                        type: 'object',
                        required: ['type', 'limit_price'],
                        properties: {
                            type: {
                                const: 'all_or_none',
                            },
                            limit_price: {
                                type: 'number',
                            },
                        },
                    },
                ],
            },
            i_fill_or_kill_order: {
                description: 'FOK',
                allOf: [
                    {
                        $ref: '#/definitions/i_base_order',
                    },
                    {
                        type: 'object',
                        required: ['type'],
                        properties: {
                            type: {
                                const: 'fill_or_kill',
                            },
                            limit_price: {
                                type: 'number',
                            },
                        },
                    },
                ],
            },
            i_immediate_or_cancel_order: {
                description: 'IOC',
                allOf: [
                    {
                        $ref: '#/definitions/i_base_order',
                    },
                    {
                        type: 'object',
                        required: ['type'],
                        properties: {
                            type: {
                                const: 'immediate_or_cancel',
                            },
                            limit_price: {
                                type: 'number',
                            },
                        },
                    },
                ],
            },
            i_good_till_date_order: {
                description: 'GTD',
                allOf: [
                    {
                        $ref: '#/definitions/i_base_order',
                    },
                    {
                        type: 'object',
                        required: ['type', 'expiration_date'],
                        properties: {
                            type: {
                                const: 'good_till_date',
                            },
                            limit_price: {
                                type: 'number',
                            },
                            expiration_date: {
                                type: 'string',
                                format: 'date-time',
                            },
                        },
                    },
                ],
            },
            i_pegged_order: {
                allOf: [
                    {
                        $ref: '#/definitions/i_base_order',
                    },
                    {
                        type: 'object',
                        required: ['type', 'peg_type'],
                        properties: {
                            type: {
                                const: 'pegged',
                            },
                            peg_type: {
                                type: 'string',
                                enum: [
                                    'midpoint',
                                    'primary',
                                    'market',
                                    'benchmark',
                                ],
                            },
                            limit_price: {
                                type: 'number',
                            },
                            offset: {
                                type: 'number',
                            },
                        },
                    },
                ],
            },
            stock_order: {
                description: 'Union type for all order types',
                oneOf: [
                    {
                        $ref: '#/definitions/i_market_order',
                    },
                    {
                        $ref: '#/definitions/i_limit_order',
                    },
                    {
                        $ref: '#/definitions/i_stop_order',
                    },
                    {
                        $ref: '#/definitions/i_stop_limit_order',
                    },
                    {
                        $ref: '#/definitions/i_trailing_stop_order',
                    },
                    {
                        $ref: '#/definitions/i_trailing_stop_limit_order',
                    },
                    {
                        $ref: '#/definitions/i_oco_order',
                    },
                    {
                        $ref: '#/definitions/i_bracket_order',
                    },
                    {
                        $ref: '#/definitions/i_iceberg_order',
                    },
                    {
                        $ref: '#/definitions/i_all_or_none_order',
                    },
                    {
                        $ref: '#/definitions/i_fill_or_kill_order',
                    },
                    {
                        $ref: '#/definitions/i_immediate_or_cancel_order',
                    },
                    {
                        $ref: '#/definitions/i_good_till_date_order',
                    },
                    {
                        $ref: '#/definitions/i_pegged_order',
                    },
                ],
            },
            time_in_force: {
                description: 'Time in Force enum for better type safety',
                type: 'string',
                enum: ['DAY', 'GTC', 'IOC', 'FOK', 'GTD', 'EXT'],
            },
        },
    },
};
