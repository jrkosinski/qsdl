export const schema = {
    $schema: 'http://json-schema.org/draft-07/schema#',
    type: 'object',
    title: 'IStrategy',
    required: ['data', 'rules', 'actions', 'position_limits'],
    properties: {
        version: '0.0.1',
        data: {
            type: 'array',
            minItems: 1,
            items: {
                oneOf: [
                    {
                        $ref: '#/definitions/IDataIndicator',
                    },
                    {
                        $ref: '#/definitions/IDataCandle',
                    },
                    {
                        $ref: '#/definitions/IDataVolume',
                    },
                    {
                        $ref: '#/definitions/IDataTime',
                    },
                ],
            },
        },
        rules: {
            type: 'array',
            minItems: 1,
            items: {
                $ref: '#/definitions/IRule',
            },
        },
        actions: {
            type: 'array',
            minItems: 1,
            items: {
                $ref: '#/definitions/IAction',
            },
        },
        position_limits: {
            type: 'array',
            minItems: 1,
            items: {
                $ref: '#/definitions/IPositionLimit',
            },
        },
    },
    definitions: {
        ITimeframe: {
            type: 'object',
            required: ['length', 'period'],
            properties: {
                length: {
                    type: 'number',
                    minimum: 1,
                    default: 1,
                },
                period: {
                    type: 'string',
                    enum: ['second', 'minute', 'hour', 'day', 'month'],
                },
            },
        },
        IDataBase: {
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
                    $ref: '#/definitions/ITimeframe',
                },
                offset: {
                    type: 'number',
                },
            },
        },
        IDataIndicator: {
            allOf: [
                {
                    $ref: '#/definitions/IDataBase',
                },
                {
                    type: 'object',
                    required: ['indicator_type', 'params'],
                    properties: {
                        type: {
                            const: 'indicator',
                        },
                        indicator_type: {
                            type: 'string',
                            enum: ['sma', 'ema', 'rsi', 'atr'],
                        },
                        params: {
                            type: 'array',
                        },
                    },
                },
            ],
        },
        IDataCandle: {
            allOf: [
                {
                    $ref: '#/definitions/IDataBase',
                },
                {
                    type: 'object',
                    properties: {
                        type: {
                            const: 'candle',
                        },
                    },
                },
            ],
        },
        IDataVolume: {
            allOf: [
                {
                    $ref: '#/definitions/IDataBase',
                },
                {
                    type: 'object',
                    properties: {
                        type: {
                            const: 'volume',
                        },
                    },
                },
            ],
        },
        IDataTime: {
            allOf: [
                {
                    $ref: '#/definitions/IDataBase',
                },
                {
                    type: 'object',
                    required: ['second', 'minute', 'hour'],
                    properties: {
                        type: {
                            const: 'time',
                        },
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
            ],
        },
        IAction: {
            type: 'object',
            required: ['id', 'order'],
            properties: {
                id: {
                    type: 'string',
                },
                order: {
                    $ref: '#/definitions/StockOrder',
                },
            },
        },
        IPositionLimit: {
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
        IRule: {
            type: 'object',
            required: ['if', 'then'],
            properties: {
                if: {
                    $ref: '#/definitions/ICondition',
                },
                then: {
                    type: 'array',
                    items: {
                        type: 'string',
                    },
                },
                else: {
                    type: 'array',
                    items: {
                        type: 'string',
                    },
                },
            },
        },
        ICondition: {
            type: 'object',
            oneOf: [
                {
                    required: ['expression'],
                    properties: {
                        expression: {
                            $ref: '#/definitions/IComparison',
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
                                        $ref: '#/definitions/ICondition',
                                    },
                                    {
                                        $ref: '#/definitions/IComparison',
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
                                        $ref: '#/definitions/ICondition',
                                    },
                                    {
                                        $ref: '#/definitions/IComparison',
                                    },
                                ],
                            },
                        },
                    },
                    additionalProperties: false,
                },
            ],
        },
        IComparison: {
            type: 'object',
            required: ['operandA', 'operandB', 'comparison'],
            properties: {
                operandA: {
                    oneOf: [
                        {
                            type: 'number',
                        },
                        {
                            $ref: '#/definitions/IValueExpression',
                        },
                    ],
                },
                operandB: {
                    oneOf: [
                        {
                            type: 'number',
                        },
                        {
                            $ref: '#/definitions/IValueExpression',
                        },
                    ],
                },
                comparison: {
                    type: 'string',
                    enum: ['<', '>', '<=', '>=', '==', '!='],
                },
            },
        },
        IValueExpression: {
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
                            $ref: '#/definitions/IOperation',
                        },
                        {
                            $ref: '#/definitions/IIndicatorOutput',
                        },
                    ],
                },
            },
        },
        IIndicatorOutput: {
            type: 'object',
            required: ['indicator_id'],
            properties: {
                indicator_id: {
                    type: 'string',
                },
                output_index: {
                    type: 'number',
                    default: 0,
                },
            },
        },
        IOperation: {
            type: 'object',
        },
        StockOrder: {
            oneOf: [
                {
                    $ref: '#/definitions/IMarketOrder',
                },
                {
                    $ref: '#/definitions/ILimitOrder',
                },
                {
                    $ref: '#/definitions/IStopOrder',
                },
                {
                    $ref: '#/definitions/IStopLimitOrder',
                },
                {
                    $ref: '#/definitions/ITrailingStopOrder',
                },
                {
                    $ref: '#/definitions/ITrailingStopLimitOrder',
                },
                {
                    $ref: '#/definitions/IOCOOrder',
                },
                {
                    $ref: '#/definitions/IBracketOrder',
                },
                {
                    $ref: '#/definitions/IIcebergOrder',
                },
                {
                    $ref: '#/definitions/IAllOrNoneOrder',
                },
                {
                    $ref: '#/definitions/IFillOrKillOrder',
                },
                {
                    $ref: '#/definitions/IImmediateOrCancelOrder',
                },
                {
                    $ref: '#/definitions/IGoodTillDateOrder',
                },
                {
                    $ref: '#/definitions/IPeggedOrder',
                },
            ],
        },
        IBaseOrder: {
            type: 'object',
            required: ['symbol', 'quantity', 'side', 'tif'],
            properties: {
                symbol: {
                    type: 'string',
                },
                quantity: {
                    type: 'number',
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
                accountId: {
                    type: 'string',
                },
                timestamp: {
                    type: 'string',
                    format: 'date-time',
                },
            },
        },
        IMarketOrder: {
            allOf: [
                {
                    $ref: '#/definitions/IBaseOrder',
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
        ILimitOrder: {
            allOf: [
                {
                    $ref: '#/definitions/IBaseOrder',
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
        IStopOrder: {
            allOf: [
                {
                    $ref: '#/definitions/IBaseOrder',
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
        IStopLimitOrder: {
            allOf: [
                {
                    $ref: '#/definitions/IBaseOrder',
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
        ITrailingStopOrder: {
            allOf: [
                {
                    $ref: '#/definitions/IBaseOrder',
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
                        },
                        trail_percent: {
                            type: 'number',
                        },
                    },
                },
            ],
        },
        ITrailingStopLimitOrder: {
            allOf: [
                {
                    $ref: '#/definitions/IBaseOrder',
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
                        },
                    },
                },
            ],
        },
        IOCOOrder: {
            allOf: [
                {
                    $ref: '#/definitions/IBaseOrder',
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
                                        $ref: '#/definitions/ILimitOrder',
                                    },
                                    {
                                        $ref: '#/definitions/IStopOrder',
                                    },
                                    {
                                        $ref: '#/definitions/IStopLimitOrder',
                                    },
                                ],
                            },
                        },
                    },
                },
            ],
        },
        IBracketOrder: {
            allOf: [
                {
                    $ref: '#/definitions/IBaseOrder',
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
                                    $ref: '#/definitions/IMarketOrder',
                                },
                                {
                                    $ref: '#/definitions/ILimitOrder',
                                },
                            ],
                        },
                        profit_target: {
                            $ref: '#/definitions/ILimitOrder',
                        },
                        stop_loss: {
                            oneOf: [
                                {
                                    $ref: '#/definitions/IStopOrder',
                                },
                                {
                                    $ref: '#/definitions/IStopLimitOrder',
                                },
                            ],
                        },
                    },
                },
            ],
        },
        IIcebergOrder: {
            allOf: [
                {
                    $ref: '#/definitions/IBaseOrder',
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
                        },
                        total_quantity: {
                            type: 'number',
                        },
                    },
                },
            ],
        },
        IAllOrNoneOrder: {
            allOf: [
                {
                    $ref: '#/definitions/IBaseOrder',
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
        IFillOrKillOrder: {
            allOf: [
                {
                    $ref: '#/definitions/IBaseOrder',
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
        IImmediateOrCancelOrder: {
            allOf: [
                {
                    $ref: '#/definitions/IBaseOrder',
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
        IGoodTillDateOrder: {
            allOf: [
                {
                    $ref: '#/definitions/IBaseOrder',
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
        IPeggedOrder: {
            allOf: [
                {
                    $ref: '#/definitions/IBaseOrder',
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
    },
};
