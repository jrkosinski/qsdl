/*
This is an interface definition for strategy. strategy should be able to represent a wide array and variety of trading strategies. Its main components are: 
[1] data: these are data indicators (e.g. a moving average or more complex indicator) that can be named and have multiple or single outputs, or simple candles that give price, volume, timestamp. These data sources can be used in calculations, expressions, triggers, etc. 
[2] actions: these are (currently at least) orders only - orders to place, and how to place them, types of orders, etc. These are used in rules. 
[3] position_limits: these define how to manage a position (max and min sizes, etc.) 
[4] rules: this is the real meat of the strategy. These are logical rules that define how to use the data and actions that are defined, to execute a strategy. 

These are only for trading forex, stocks, and futures; no complex derivatives. 

The end result of a strategy is a chunk of JSON that has all of the necessary information for defining how a specific trading strategy works, with no ambiguity. 

//TODO: parameterize symbols, indicator parameters, etc. 
//TODO: order amounts should be formulae
*/

// ============================================================================
// INDICATOR REGISTRY - Defines all available indicators and their signatures
// ============================================================================

type string_value = string | string_variable;
type numeric_value = number | numeric_variable;

interface string_variable {
    var: string;
}

interface numeric_variable {
    var: string;
}

/**
 * Describes an input parameter for an indicator
 */
interface indicator_input {
    name: string;
    type: 'number' | 'string' | 'source'; // source is for specifying OHLC field
    required: boolean;
    default_value?: number | string;
    description?: string;
    min?: number; // for number types
    max?: number; // for number types
    allowed_values?: string[]; // for string enums like 'close', 'open', 'hl2', etc.
}

/**
 * Describes an output from an indicator
 */
interface indicator_output_definition {
    name: string;
    index: number;
    description?: string;
}

/**
 * Registry entry for a single indicator type
 */
interface indicator_definition {
    type: string; // 'sma', 'ema', 'macd', etc.
    display_name: string;
    description: string;
    inputs: indicator_input[];
    outputs: indicator_output_definition[];
}

/**
 * The complete registry of all available indicators
 * This would be provided as configuration/context to the system
 */
interface indicator_registry {
    indicators: { [key: string]: indicator_definition };
}

// Example registry entries (partial - you'd have more)
const INDICATOR_REGISTRY: indicator_registry = {
    indicators: {
        sma: {
            type: 'sma',
            display_name: 'Simple Moving Average',
            description:
                'Calculates the simple moving average over a specified period',
            inputs: [
                {
                    name: 'period',
                    type: 'number',
                    required: true,
                    min: 1,
                    max: 500,
                    description: 'Number of periods to average',
                },
                {
                    name: 'source',
                    type: 'source',
                    required: false,
                    default_value: 'close',
                    allowed_values: [
                        'open',
                        'high',
                        'low',
                        'close',
                        'hl2',
                        'hlc3',
                        'ohlc4',
                    ],
                    description: 'Price source for calculation',
                },
            ],
            outputs: [
                {
                    name: 'value',
                    index: 0,
                    description: 'The SMA value',
                },
            ],
        },
        macd: {
            type: 'macd',
            display_name: 'MACD',
            description: 'Moving Average Convergence Divergence',
            inputs: [
                {
                    name: 'fast_period',
                    type: 'number',
                    required: false,
                    default_value: 12,
                    min: 1,
                    max: 100,
                    description: 'Fast EMA period',
                },
                {
                    name: 'slow_period',
                    type: 'number',
                    required: false,
                    default_value: 26,
                    min: 1,
                    max: 100,
                    description: 'Slow EMA period',
                },
                {
                    name: 'signal_period',
                    type: 'number',
                    required: false,
                    default_value: 9,
                    min: 1,
                    max: 100,
                    description: 'Signal line EMA period',
                },
                {
                    name: 'source',
                    type: 'source',
                    required: false,
                    default_value: 'close',
                    allowed_values: ['open', 'high', 'low', 'close'],
                    description: 'Price source for calculation',
                },
            ],
            outputs: [
                {
                    name: 'macd',
                    index: 0,
                    description: 'MACD line',
                },
                {
                    name: 'signal',
                    index: 1,
                    description: 'Signal line',
                },
                {
                    name: 'histogram',
                    index: 2,
                    description: 'MACD histogram (MACD - Signal)',
                },
            ],
        },
        bb: {
            type: 'bb',
            display_name: 'Bollinger Bands',
            description: 'Bollinger Bands with upper, middle, and lower bands',
            inputs: [
                {
                    name: 'period',
                    type: 'number',
                    required: false,
                    default_value: 20,
                    min: 1,
                    max: 200,
                    description: 'SMA period for middle band',
                },
                {
                    name: 'std_dev',
                    type: 'number',
                    required: false,
                    default_value: 2,
                    min: 0.1,
                    max: 5,
                    description: 'Standard deviation multiplier',
                },
                {
                    name: 'source',
                    type: 'source',
                    required: false,
                    default_value: 'close',
                    allowed_values: [
                        'open',
                        'high',
                        'low',
                        'close',
                        'hl2',
                        'hlc3',
                        'ohlc4',
                    ],
                    description: 'Price source for calculation',
                },
            ],
            outputs: [
                {
                    name: 'upper',
                    index: 0,
                    description: 'Upper band',
                },
                {
                    name: 'middle',
                    index: 1,
                    description: 'Middle band (SMA)',
                },
                {
                    name: 'lower',
                    index: 2,
                    description: 'Lower band',
                },
            ],
        },
    },
};

// ============================================================================
// DATA SOURCE DEFINITIONS
// ============================================================================

/**
 * Data sources are data indicators (e.g. a moving average or more complex indicator) that can be named and have
 * multiple or single parameters and outputs, or simple candles that give price, volume, timestamp.
 * These data sources can be used in calculations, expressions, triggers, etc.
 */
interface data_source {
    id: string;
    type: 'indicator' | 'candle';
    symbol: string_value;
    timeframe: timeframe;
    offset?: number;
}

/**
 * Defines an OHLCVT candle (OHLC + volume + timestamp).
 * When referenced in expressions, can use: .open, .high, .low, .close, .volume
 */
interface data_candle extends data_source {
    type: 'candle';
}

/**
 * Expresses a timeframe for candles/bars.
 */
interface timeframe {
    length: number; //default 1, can't be zero
    period: 'second' | 'minute' | 'hour' | 'day' | 'month';
}

/**
 * Expresses a specific indicator instance with named parameters.
 * The params must match the indicator definition in the registry.
 */
interface data_indicator extends data_source {
    type: 'indicator';
    indicator_type: string; // Must match a key in the indicator registry
    params: { [key: string]: number | string }; // Named parameters matching the registry definition
}

// ============================================================================
// VALUE REFERENCES - How to reference indicator outputs and candle values
// ============================================================================

/**
 * Reference to a specific output from an indicator
 */
interface indicator_output_ref {
    indicator_id: string; // Must be valid indicator id from data sources
    output?: string | number; // Can use name ('macd', 'signal') or index (0, 1)
    // If omitted, defaults to first output (index 0)
}

/**
 * Reference to a specific field from a candle
 */
interface candle_field_ref {
    candle_id: string; // Must be valid candle id from data sources
    field: 'open' | 'high' | 'low' | 'close' | 'volume';
}

/**
 * A value that can be used in expressions and comparisons
 */
interface value_expression {
    value:
        | number
        | string
        | operation
        | indicator_output_ref
        | candle_field_ref;
}

/**
 * Numeric-only expression (for things like prices that must be numbers)
 */
interface numeric_expression {
    value: number | operation | indicator_output_ref | candle_field_ref;
}

// ============================================================================
// OPERATIONS AND CONDITIONS
// ============================================================================

interface comparison {
    operandA: value_expression | number;
    operandB: value_expression | number;
    comparison: '<' | '>' | '<=' | '>=' | '==' | '!=';
}

interface operation {
    operand: '+' | '*' | '-' | '/' | '%';
    valueA: value_expression;
    valueB: value_expression;
}

interface condition {
    // Must have only one of 'expression', 'and', 'or'
    expression?: comparison;
    and?: condition[] | comparison[];
    or?: condition[] | comparison[];
}

// ============================================================================
// ACTIONS AND RULES
// ============================================================================

/**
 * These are (currently at least) orders only - orders to place, and how to place them, types of orders, etc.
 * These are used in rules. In the future there might be a 'signal' action - one that gives a signal but doesn't
 * specify the placing of a specific order.
 */
interface action {
    id: string;
    order: stock_order;
}

/**
 * Defines max and minimum position sizes.
 */
interface position_limit {
    symbol: string_value;
    max: value_expression;
    min: value_expression;
}

/**
 * This is the real meat of the strategy. These are logical rules that define how to use the data and actions
 * that are defined, to execute a strategy.
 */
interface rule {
    if: condition;
    then: string[]; // Action IDs to execute
    else?: string[]; // Optional else actions
}

// ============================================================================
// MAIN STRATEGY INTERFACE
// ============================================================================

interface strategy {
    name?: string;
    description?: string;
    default_symbol?: string; // Optional default symbol for data sources
    data: data_source[]; // Must have length of at least one
    rules: rule[]; // Must have length of at least one
    actions: action[]; // Must have length of at least one
    position_limits: position_limit[]; // Must have at least one
}

// ============================================================================
// EXAMPLE STRATEGIES
// ============================================================================

const Example_SMA_Crossover: strategy = {
    name: 'SMA Crossover',
    description: 'Buy when fast SMA crosses above slow SMA',
    default_symbol: 'ASL',
    data: [
        {
            symbol: { var: '$sym1' },
            id: 'fast_ma',
            type: 'indicator',
            indicator_type: 'sma',
            timeframe: { period: 'day', length: 1 },
            params: {
                period: 50,
                source: 'close',
            },
        } as data_indicator,
        {
            symbol: { var: '$sym1' },
            id: 'slow_ma',
            type: 'indicator',
            indicator_type: 'sma',
            timeframe: { period: 'day', length: 1 },
            params: {
                period: 200,
                source: 'close',
            },
        } as data_indicator,
        {
            id: 'current_price',
            type: 'candle',
            timeframe: { period: 'day', length: 1 },
        } as data_candle,
        {
            id: 'prev_price',
            type: 'candle',
            timeframe: { period: 'day', length: 1 },
            offset: 1,
        } as data_candle,
    ],
    actions: [
        {
            id: 'buy_asl',
            order: {
                type: 'market',
                side: 'buy',
                quantity: { value: 100 },
                symbol: { var: '$sym1' },
                tif: 'gtc',
            },
        },
        {
            id: 'sell_asl',
            order: {
                type: 'market',
                side: 'sell',
                quantity: { value: 100 },
                symbol: { var: '$sym1' },
                tif: 'gtc',
            },
        },
    ],
    position_limits: [
        {
            symbol: { var: '$sym1' },
            max: { value: 100 },
            min: { value: 0 },
        },
    ],
    rules: [
        {
            if: {
                and: [
                    {
                        // Fast MA > Slow MA
                        comparison: '>',
                        operandA: {
                            value: {
                                indicator_id: 'fast_ma',
                                output: 'value', // Can use name
                            },
                        },
                        operandB: {
                            value: {
                                indicator_id: 'slow_ma',
                                output: 0, // Or can use index
                            },
                        },
                    } as comparison,
                    {
                        // Price above fast MA
                        comparison: '>',
                        operandA: {
                            value: {
                                candle_id: 'current_price',
                                field: 'close',
                            },
                        },
                        operandB: {
                            value: {
                                indicator_id: 'fast_ma',
                                output: 'value',
                            },
                        },
                    } as comparison,
                ],
            },
            then: ['buy_asl'],
        },
    ],
};

const Example_MACD_Strategy: strategy = {
    name: 'MACD Histogram Cross',
    description: 'Trade when MACD histogram crosses zero',
    data: [
        {
            id: 'macd_indicator',
            type: 'indicator',
            indicator_type: 'macd',
            symbol: 'SPY',
            timeframe: { period: 'hour', length: 1 },
            params: {
                fast_period: 12,
                slow_period: 26,
                signal_period: 9,
                source: 'close',
            },
        } as data_indicator,
        {
            id: 'macd_prev',
            type: 'indicator',
            indicator_type: 'macd',
            symbol: 'SPY',
            timeframe: { period: 'hour', length: 1 },
            params: {
                fast_period: 12,
                slow_period: 26,
                signal_period: 9,
                source: 'close',
            },
            offset: 1,
        } as data_indicator,
    ],
    actions: [
        {
            id: 'sell_spy',
            order: {
                type: 'market',
                side: 'sell',
                quantity: { value: 10 },
                symbol: 'SPY',
                tif: 'day',
            },
        },
    ],
    position_limits: [
        {
            symbol: 'SPY',
            max: { value: 10 },
            min: { value: 0 },
        },
    ],
    rules: [
        {
            // Buy when histogram crosses above zero
            if: {
                and: [
                    {
                        // Current histogram > 0
                        comparison: '>',
                        operandA: {
                            value: {
                                indicator_id: 'macd_indicator',
                                output: 'histogram', // Using named output
                            },
                        },
                        operandB: 0,
                    } as comparison,
                    {
                        // Previous histogram <= 0
                        comparison: '<=',
                        operandA: {
                            value: {
                                indicator_id: 'macd_prev',
                                output: 2, // Using index for histogram
                            },
                        },
                        operandB: 0,
                    } as comparison,
                ],
            },
            then: ['buy_spy'],
        },
        {
            // Sell when histogram crosses below zero
            if: {
                and: [
                    {
                        comparison: '<',
                        operandA: {
                            value: {
                                indicator_id: 'macd_indicator',
                                output: 'histogram',
                            },
                        },
                        operandB: 0,
                    } as comparison,
                    {
                        comparison: '>=',
                        operandA: {
                            value: {
                                indicator_id: 'macd_prev',
                                output: 'histogram',
                            },
                        },
                        operandB: 0,
                    } as comparison,
                ],
            },
            then: ['sell_spy'],
        },
    ],
};

// ============================================================================
// ORDERS (keeping your existing order definitions)
// ============================================================================

interface base_order {
    symbol: string_value;
    quantity: numeric_expression; // Changed from number to allow expressions
    side: 'buy' | 'sell';
    tif: 'day' | 'gtc' | 'ioc' | 'fok' | 'gtd' | 'ext';
    extended_hours?: boolean;
    account_id?: string;
    timestamp?: Date;
}

// Market
interface market_order extends base_order {
    type: 'market';
}

// Limit
interface limit_order extends base_order {
    type: 'limit';
    limit_price: numeric_expression;
}

// Stop market
interface stop_order extends base_order {
    type: 'stop';
    stop_price: numeric_expression;
}

// Stop-limit
interface stop_limit_order extends base_order {
    type: 'stop_limit';
    stop_price: numeric_expression;
    limit_price: numeric_expression;
}

// Trailing Stop
interface trailing_stop_order extends base_order {
    type: 'trailing_stop';
    trail_amount?: numeric_expression; // Dollar amount
    trail_percent?: numeric_expression; // Percentage
}

// Trailing Stop-limit
interface trailing_stop_limit_order extends base_order {
    type: 'trailing_stop_limit';
    trail_amount?: numeric_expression;
    trail_percent?: numeric_expression;
    limit_offset: numeric_expression; // Offset from stop price for limit
}

// OCO
interface oco_order extends base_order {
    type: 'oco';
    orders: [
        limit_order | stop_order | stop_limit_order,
        limit_order | stop_order | stop_limit_order
    ];
}

// Bracket
interface bracket_order extends base_order {
    type: 'bracket';
    entry_order: market_order | limit_order;
    profit_target: limit_order;
    stop_loss: stop_order | stop_limit_order;
}

// Iceberg
interface iceberg_order extends base_order {
    type: 'iceberg';
    limit_price: numeric_expression;
    display_quantity: numeric_expression; // Visible quantity
    total_quantity: numeric_expression; // Total order size
}

// All or none
interface aon_order extends base_order {
    type: 'all_or_none';
    limit_price: numeric_expression;
}

// FOK
interface fok_order extends base_order {
    type: 'fill_or_kill';
    limit_price?: numeric_expression;
}

// IOC
interface ioc_order extends base_order {
    type: 'immediate_or_cancel';
    limit_price?: numeric_expression;
}

// GTD
interface gtd_order extends base_order {
    type: 'good_till_date';
    limit_price?: numeric_expression;
    expiration_date: Date;
}

interface pegged_order extends base_order {
    type: 'pegged';
    peg_type: 'midpoint' | 'primary' | 'market' | 'benchmark';
    limit_price?: numeric_expression;
    offset?: numeric_expression;
}

// Union type for all order types
type stock_order =
    | market_order
    | limit_order
    | stop_order
    | stop_limit_order
    | trailing_stop_order
    | trailing_stop_limit_order
    | oco_order
    | bracket_order
    | iceberg_order
    | aon_order
    | fok_order
    | ioc_order
    | gtd_order
    | pegged_order;
