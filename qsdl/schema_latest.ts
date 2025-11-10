export const schema = {
    version: '0.1.3',
    schema: {
        $schema: 'http://json-schema.org/draft-07/schema#',
        $id: 'https://example.com/trading-strategy.schema.json',
        title: 'Trading Strategy Schema',
        description:
            'Schema for defining trading strategies including data sources, indicators, rules, and actions',
        type: 'object',
        required: ['data', 'rules', 'actions', 'position_limits'],
        properties: {
            name: {
                type: 'string',
                description: 'Optional name for the strategy',
            },
            description: {
                type: 'string',
                description: 'Optional description of the strategy',
            },
            default_symbol: {
                type: 'string',
                description: 'Optional default symbol for data sources',
            },
            data: {
                type: 'array',
                description: 'Data sources including indicators and candles',
                minItems: 1,
                items: {
                    $ref: '#/definitions/data_source',
                },
            },
            rules: {
                type: 'array',
                description: 'Logical rules that define strategy execution',
                minItems: 1,
                items: {
                    $ref: '#/definitions/rule',
                },
            },
            actions: {
                type: 'array',
                description: 'Actions (orders) that can be executed',
                minItems: 1,
                items: {
                    $ref: '#/definitions/action',
                },
            },
            position_limits: {
                type: 'array',
                description: 'Position size limits per symbol',
                minItems: 1,
                items: {
                    $ref: '#/definitions/position_limit',
                },
            },
        },
        definitions: {
            string_value: {
                oneOf: [
                    {
                        type: 'string',
                    },
                    {
                        $ref: '#/definitions/string_variable',
                    },
                ],
            },
            numeric_value: {
                oneOf: [
                    {
                        type: 'number',
                    },
                    {
                        $ref: '#/definitions/numeric_variable',
                    },
                ],
            },
            string_variable: {
                type: 'object',
                required: ['var'],
                properties: {
                    var: {
                        type: 'string',
                    },
                },
                additionalProperties: false,
            },
            numeric_variable: {
                type: 'object',
                required: ['var'],
                properties: {
                    var: {
                        type: 'string',
                    },
                },
                additionalProperties: false,
            },
            string_ternary_expression: {
                type: 'object',
                required: ['if', 'then', 'else'],
                properties: {
                    if: {
                        $ref: '#/definitions/condition',
                    },
                    then: {
                        oneOf: [
                            { $ref: '#/definitions/string_expression' },
                            {
                                $ref: '#/definitions/string_ternary_expression',
                            },
                        ],
                    },
                    else: {
                        oneOf: [
                            { $ref: '#/definitions/string_expression' },
                            {
                                $ref: '#/definitions/string_ternary_expression',
                            },
                        ],
                    },
                },
                additionalProperties: false,
            },
            numeric_ternary_expression: {
                type: 'object',
                required: ['if', 'then', 'else'],
                properties: {
                    if: {
                        $ref: '#/definitions/condition',
                    },
                    then: {
                        oneOf: [
                            { $ref: '#/definitions/numeric_expression' },
                            {
                                $ref: '#/definitions/numeric_ternary_expression',
                            },
                        ],
                    },
                    else: {
                        oneOf: [
                            { $ref: '#/definitions/numeric_expression' },
                            {
                                $ref: '#/definitions/numeric_ternary_expression',
                            },
                        ],
                    },
                },
                additionalProperties: false,
            },
            timeframe: {
                type: 'object',
                required: ['length', 'period'],
                properties: {
                    length: {
                        type: 'integer',
                        minimum: 1,
                        description: 'Number of periods',
                    },
                    period: {
                        type: 'string',
                        enum: ['second', 'minute', 'hour', 'day', 'month'],
                        description: 'Time period unit',
                    },
                },
                additionalProperties: false,
            },
            data_source: {
                oneOf: [
                    {
                        $ref: '#/definitions/data_candle',
                    },
                    {
                        $ref: '#/definitions/data_indicator',
                    },
                ],
            },
            data_candle: {
                type: 'object',
                required: ['id', 'type', 'symbol', 'timeframe'],
                properties: {
                    id: {
                        type: 'string',
                        description: 'Unique identifier for this data source',
                    },
                    type: {
                        type: 'string',
                        const: 'candle',
                    },
                    symbol: {
                        $ref: '#/definitions/string_value',
                    },
                    timeframe: {
                        $ref: '#/definitions/timeframe',
                    },
                    offset: {
                        type: 'integer',
                        description: 'Offset from the current bar',
                    },
                },
                additionalProperties: false,
            },
            data_indicator: {
                type: 'object',
                required: [
                    'id',
                    'type',
                    'symbol',
                    'timeframe',
                    'indicator_type',
                    'params',
                ],
                properties: {
                    id: {
                        type: 'string',
                        description: 'Unique identifier for this data source',
                    },
                    type: {
                        type: 'string',
                        const: 'indicator',
                    },
                    symbol: {
                        $ref: '#/definitions/string_value',
                    },
                    timeframe: {
                        $ref: '#/definitions/timeframe',
                    },
                    offset: {
                        type: 'integer',
                        description: 'Offset from the current bar',
                    },
                    indicator_type: {
                        type: 'string',
                        description:
                            "Type of indicator (e.g., 'sma', 'ema', 'macd', 'bb')",
                    },
                    params: {
                        type: 'object',
                        description: 'Named parameters for the indicator',
                        additionalProperties: {
                            oneOf: [{ type: 'number' }, { type: 'string' }],
                        },
                    },
                },
                additionalProperties: false,
            },
            indicator_output_ref: {
                type: 'object',
                required: ['indicator_id'],
                properties: {
                    indicator_id: {
                        type: 'string',
                        description:
                            'Reference to an indicator ID from data sources',
                    },
                    output: {
                        oneOf: [{ type: 'string' }, { type: 'integer' }],
                        description:
                            'Output name or index (defaults to first output if omitted)',
                    },
                },
                additionalProperties: false,
            },
            candle_field_ref: {
                type: 'object',
                required: ['candle_id', 'field'],
                properties: {
                    candle_id: {
                        type: 'string',
                        description:
                            'Reference to a candle ID from data sources',
                    },
                    field: {
                        type: 'string',
                        enum: [
                            'open',
                            'high',
                            'low',
                            'close',
                            'volume',
                            'timestamp',
                        ],
                    },
                },
                additionalProperties: false,
            },
            numeric_expression: {
                oneOf: [
                    { $ref: '#/definitions/numeric_value' },
                    { $ref: '#/definitions/operation' },
                    { $ref: '#/definitions/indicator_output_ref' },
                    { $ref: '#/definitions/candle_field_ref' },
                ],
            },
            operation: {
                type: 'object',
                required: ['operator', 'operandA', 'operandB'],
                properties: {
                    operator: {
                        type: 'string',
                        enum: [
                            '+',
                            '*',
                            '-',
                            '/',
                            'mod',
                            'modulo',
                            'pct',
                            'percent',
                        ],
                    },
                    operandA: {
                        $ref: '#/definitions/numeric_expression',
                    },
                    operandB: {
                        $ref: '#/definitions/numeric_expression',
                    },
                },
                additionalProperties: false,
            },
            comparison: {
                type: 'object',
                required: ['operandA', 'operandB', 'operator'],
                properties: {
                    operandA: {
                        $ref: '#/definitions/numeric_expression',
                    },
                    operandB: {
                        $ref: '#/definitions/numeric_expression',
                    },
                    operator: {
                        type: 'string',
                        enum: ['<', '>', '<=', '>=', '==', '!='],
                    },
                },
                additionalProperties: false,
            },
            condition: {
                type: 'object',
                oneOf: [
                    {
                        required: ['expression'],
                        properties: {
                            expression: {
                                $ref: '#/definitions/comparison',
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
                                        { $ref: '#/definitions/condition' },
                                        { $ref: '#/definitions/comparison' },
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
                                        { $ref: '#/definitions/condition' },
                                        { $ref: '#/definitions/comparison' },
                                    ],
                                },
                            },
                        },
                        additionalProperties: false,
                    },
                ],
            },
            action: {
                type: 'object',
                required: ['id', 'order'],
                properties: {
                    id: {
                        type: 'string',
                        description: 'Unique identifier for this action',
                    },
                    order: {
                        $ref: '#/definitions/stock_order',
                    },
                },
                additionalProperties: false,
            },
            position_limit: {
                type: 'object',
                required: ['symbol', 'max', 'min'],
                properties: {
                    symbol: {
                        $ref: '#/definitions/string_value',
                    },
                    max: {
                        $ref: '#/definitions/numeric_expression',
                    },
                    min: {
                        $ref: '#/definitions/numeric_expression',
                    },
                },
                additionalProperties: false,
            },
            rule: {
                type: 'object',
                required: ['if', 'then'],
                properties: {
                    if: {
                        $ref: '#/definitions/condition',
                    },
                    then: {
                        oneOf: [
                            {
                                type: 'array',
                                items: {
                                    type: 'string',
                                },
                                description: 'Action IDs to execute',
                            },
                            {
                                $ref: '#/definitions/rule',
                                description: 'Nested rule',
                            },
                        ],
                    },
                    else: {
                        oneOf: [
                            {
                                type: 'array',
                                items: {
                                    type: 'string',
                                },
                                description: 'Optional else actions',
                            },
                            {
                                $ref: '#/definitions/rule',
                                description: 'Nested else rule',
                            },
                        ],
                    },
                },
                additionalProperties: false,
            },
            base_order: {
                type: 'object',
                required: ['symbol', 'quantity', 'side', 'tif'],
                properties: {
                    symbol: {
                        $ref: '#/definitions/string_value',
                    },
                    quantity: {
                        $ref: '#/definitions/numeric_expression',
                    },
                    side: {
                        type: 'string',
                        enum: ['buy', 'sell'],
                    },
                    tif: {
                        type: 'string',
                        enum: ['day', 'gtc', 'ioc', 'fok', 'gtd', 'ext'],
                        description: 'Time in force',
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
            market_order: {
                allOf: [
                    { $ref: '#/definitions/base_order' },
                    {
                        type: 'object',
                        required: ['type'],
                        properties: {
                            type: {
                                type: 'string',
                                const: 'market',
                            },
                        },
                    },
                ],
            },
            limit_order: {
                allOf: [
                    { $ref: '#/definitions/base_order' },
                    {
                        type: 'object',
                        required: ['type', 'limit_price'],
                        properties: {
                            type: {
                                type: 'string',
                                const: 'limit',
                            },
                            limit_price: {
                                $ref: '#/definitions/numeric_expression',
                            },
                        },
                    },
                ],
            },
            stop_order: {
                allOf: [
                    { $ref: '#/definitions/base_order' },
                    {
                        type: 'object',
                        required: ['type', 'stop_price'],
                        properties: {
                            type: {
                                type: 'string',
                                const: 'stop',
                            },
                            stop_price: {
                                $ref: '#/definitions/numeric_expression',
                            },
                        },
                    },
                ],
            },
            stop_limit_order: {
                allOf: [
                    { $ref: '#/definitions/base_order' },
                    {
                        type: 'object',
                        required: ['type', 'stop_price', 'limit_price'],
                        properties: {
                            type: {
                                type: 'string',
                                const: 'stop_limit',
                            },
                            stop_price: {
                                $ref: '#/definitions/numeric_expression',
                            },
                            limit_price: {
                                $ref: '#/definitions/numeric_expression',
                            },
                        },
                    },
                ],
            },
            trailing_stop_order: {
                allOf: [
                    { $ref: '#/definitions/base_order' },
                    {
                        type: 'object',
                        required: ['type'],
                        properties: {
                            type: {
                                type: 'string',
                                const: 'trailing_stop',
                            },
                            trail_amount: {
                                $ref: '#/definitions/numeric_expression',
                                description: 'Dollar amount for trailing stop',
                            },
                            trail_percent: {
                                $ref: '#/definitions/numeric_expression',
                                description: 'Percentage for trailing stop',
                            },
                        },
                        oneOf: [
                            { required: ['trail_amount'] },
                            { required: ['trail_percent'] },
                        ],
                    },
                ],
            },
            trailing_stop_limit_order: {
                allOf: [
                    { $ref: '#/definitions/base_order' },
                    {
                        type: 'object',
                        required: ['type', 'limit_offset'],
                        properties: {
                            type: {
                                type: 'string',
                                const: 'trailing_stop_limit',
                            },
                            trail_amount: {
                                $ref: '#/definitions/numeric_expression',
                            },
                            trail_percent: {
                                $ref: '#/definitions/numeric_expression',
                            },
                            limit_offset: {
                                $ref: '#/definitions/numeric_expression',
                                description: 'Offset from stop price for limit',
                            },
                        },
                        oneOf: [
                            { required: ['trail_amount'] },
                            { required: ['trail_percent'] },
                        ],
                    },
                ],
            },
            oco_order: {
                allOf: [
                    { $ref: '#/definitions/base_order' },
                    {
                        type: 'object',
                        required: ['type', 'orders'],
                        properties: {
                            type: {
                                type: 'string',
                                const: 'oco',
                            },
                            orders: {
                                type: 'array',
                                minItems: 2,
                                maxItems: 2,
                                items: {
                                    oneOf: [
                                        { $ref: '#/definitions/limit_order' },
                                        { $ref: '#/definitions/stop_order' },
                                        {
                                            $ref: '#/definitions/stop_limit_order',
                                        },
                                    ],
                                },
                            },
                        },
                    },
                ],
            },
            bracket_order: {
                allOf: [
                    { $ref: '#/definitions/base_order' },
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
                                type: 'string',
                                const: 'bracket',
                            },
                            entry_order: {
                                oneOf: [
                                    { $ref: '#/definitions/market_order' },
                                    { $ref: '#/definitions/limit_order' },
                                ],
                            },
                            profit_target: {
                                $ref: '#/definitions/limit_order',
                            },
                            stop_loss: {
                                oneOf: [
                                    { $ref: '#/definitions/stop_order' },
                                    { $ref: '#/definitions/stop_limit_order' },
                                ],
                            },
                        },
                    },
                ],
            },
            iceberg_order: {
                allOf: [
                    { $ref: '#/definitions/base_order' },
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
                                type: 'string',
                                const: 'iceberg',
                            },
                            limit_price: {
                                $ref: '#/definitions/numeric_expression',
                            },
                            display_quantity: {
                                $ref: '#/definitions/numeric_expression',
                                description: 'Visible quantity',
                            },
                            total_quantity: {
                                $ref: '#/definitions/numeric_expression',
                                description: 'Total order size',
                            },
                        },
                    },
                ],
            },
            aon_order: {
                allOf: [
                    { $ref: '#/definitions/base_order' },
                    {
                        type: 'object',
                        required: ['type', 'limit_price'],
                        properties: {
                            type: {
                                type: 'string',
                                const: 'all_or_none',
                            },
                            limit_price: {
                                $ref: '#/definitions/numeric_expression',
                            },
                        },
                    },
                ],
            },
            fok_order: {
                allOf: [
                    { $ref: '#/definitions/base_order' },
                    {
                        type: 'object',
                        required: ['type'],
                        properties: {
                            type: {
                                type: 'string',
                                const: 'fill_or_kill',
                            },
                            limit_price: {
                                $ref: '#/definitions/numeric_expression',
                            },
                        },
                    },
                ],
            },
            ioc_order: {
                allOf: [
                    { $ref: '#/definitions/base_order' },
                    {
                        type: 'object',
                        required: ['type'],
                        properties: {
                            type: {
                                type: 'string',
                                const: 'immediate_or_cancel',
                            },
                            limit_price: {
                                $ref: '#/definitions/numeric_expression',
                            },
                        },
                    },
                ],
            },
            gtd_order: {
                allOf: [
                    { $ref: '#/definitions/base_order' },
                    {
                        type: 'object',
                        required: ['type', 'expiration_date'],
                        properties: {
                            type: {
                                type: 'string',
                                const: 'good_till_date',
                            },
                            limit_price: {
                                $ref: '#/definitions/numeric_expression',
                            },
                            expiration_date: {
                                type: 'string',
                                format: 'date-time',
                            },
                        },
                    },
                ],
            },
            pegged_order: {
                allOf: [
                    { $ref: '#/definitions/base_order' },
                    {
                        type: 'object',
                        required: ['type', 'peg_type'],
                        properties: {
                            type: {
                                type: 'string',
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
                                $ref: '#/definitions/numeric_expression',
                            },
                            offset: {
                                $ref: '#/definitions/numeric_expression',
                            },
                        },
                    },
                ],
            },
            stock_order: {
                oneOf: [
                    { $ref: '#/definitions/market_order' },
                    { $ref: '#/definitions/limit_order' },
                    { $ref: '#/definitions/stop_order' },
                    { $ref: '#/definitions/stop_limit_order' },
                    { $ref: '#/definitions/trailing_stop_order' },
                    { $ref: '#/definitions/trailing_stop_limit_order' },
                    { $ref: '#/definitions/oco_order' },
                    { $ref: '#/definitions/bracket_order' },
                    { $ref: '#/definitions/iceberg_order' },
                    { $ref: '#/definitions/aon_order' },
                    { $ref: '#/definitions/fok_order' },
                    { $ref: '#/definitions/ioc_order' },
                    { $ref: '#/definitions/gtd_order' },
                    { $ref: '#/definitions/pegged_order' },
                ],
            },
        },
    },
};
