/*
This is an export interface definition for strategy. strategy should be able to represent a wide array and variety of trading strategies. Its main components are: 
[1] data: these are data indicators (e.g. a moving average or more complex indicator) that can be named and have multiple or single outputs, or simple candles that give price, volume, timestamp. These data sources can be used in calculations, expressions, triggers, etc. 
[2] actions: these are (currently at least) orders only - orders to place, and how to place them, types of orders, etc. These are used in rules. 
[3] position_limits: these define how to manage a position (max and min sizes, etc.) 
[4] rules: this is the real meat of the strategy. These are logical rules that define how to use the data and actions that are defined, to execute a strategy. 

These are only for trading forex, stocks, and futures; no complex derivatives. 

The end result of a strategy is a chunk of JSON that has all of the necessary information for defining how a specific trading strategy works, with no ambiguity. 
*/

//DOING: (MED) parameterize symbols, indicator parameters, etc.
//TODO: (EASY) order amounts should be formulae
//TODO: (MED) indicators library
//TODO: (HARD) state management
//TODO: (HARD) error handling?
//TODO: (MED) time constraints
//TODO: (MED) way to specify candle relationships
//TODO: (HARD) selective indicator library
//TODO: (EASY) handling of multiple symbols (just verify)
//TODO: (EASY) dynamic position size expressions (notably: a way to indicate "current size of position")
//TODO: (?) is another validation pass needed, to make sure that indicator_id s and outputs/inputs names are valid?
//TODO: (?) are known good examples of indicators needed to feed to the LLM?
//TODO: (HARD) management of trailing stops

//TODO:
//Position sizing:
//1. a constant passed in as variable
//2. a percentage of portfolio
//3. a risk% based on trailing stop-loss order

//PROMPT TO CONVERT TO SCHEMA:
/*
This is an interface definition for IStrategy. IStrategy should be able to represent a wide array and variety of trading strategies. Its main components are: 
[1] data: these are data indicators (e.g. a moving average or more complex indicator) that can be named and have multiple or single outputs, or simple candles that give price, volume, timestamp. These data sources can be used in calculations, expressions, triggers, etc. 
[2] actions: these are (currently at least) orders only - orders to place, and how to place them, types of orders, etc. These are used in rules. 
[3] position_limits: these define how to manage a position (max and min sizes, etc.) 
[4] rules: this is the real meat of the strategy. These are logical rules that define how to use the data and actions that are defined, to execute a strategy. 
These are only for trading forex, stocks, and futures; no complex derivatives. 
The end result of a strategy is a chunk of JSON that has all of the necessary information for defining how a specific trading strategy works, with no ambiguity.  Can you convert this into a json schema that essentially does the same things? It should keep integrity of ids as well - like if a portion of the json refers to an "action id", then it should be verified that it points to a valid action id
*/

//INITIAL PROMPT TO ANTHROPIC TO PARSE NL:
/*
I'm going to give you a schema for a json document. 
And an equivalent definition of IStrategy in typescript.
And a text description of a trading strategy. 
I would like you to convert the text description into a chunk of json that satisfies the schema. 
If there are any questions or things that need clarification (information missing), then ask before generating the json. 
But preface all of your responses that are questions with a 'Q:'. Ask one question at a time, or maximum two if they are related. 
Your job is to finally generate the json, so don't ask questions if the answers aren't necessary for generating the json 
(e.g. no need to ask questions about things that aren't directly reflected in the json schema). 
Do not discuss or answer things that are not directly about the trading strategy to be generated. 
When you send me json, send me nothing but json (no text explanation accompanying it). 
If not sending JSON, then always preface your response with 'Q:'
The customer might want certain values to be a variable instead of a hard-coded value. For example, the symbol to trade. 
The given schema allows for that, in the format { var: '$VARNAME' }. Please make variable names all capitals and preface 
them with $. No need to ask customers what variable names to use; choose ones that make sense to you. 
When you generate the final json document, give it a title and a description that make sense to you.
*/

// ============================================================================
// INDICATOR REGISTRY - Defines all available indicators and their signatures
// ============================================================================

/**
 * Describes an input parameter for an indicator
 */
export interface indicator_input {
    name: string;
    type: 'number' | 'string' | 'source'; //source is for specifying OHLC field
    required: boolean;
    default_value?: number | string;
    description?: string;
    min?: number; //for number types
    max?: number; //for number types
    allowed_values?: string[]; //for string enums like 'close', 'open', 'hl2', etc.
}

/**
 * Describes an output from an indicator
 */
export interface indicator_output_definition {
    name: string;
    index: number;
    is_default?: boolean;
    description?: string;
}

/**
 * Registry entry for a single indicator type
 * Indicator has: a type & a name
 * Indicator is: a list of inputs & outputs
 */
export interface indicator_definition {
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
export interface indicator_registry {
    indicators: { [key: string]: indicator_definition };
}

//Example registry entries
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
                    max: 1000,
                    description: 'Number of periods to average',
                },
                {
                    name: 'shift',
                    type: 'number',
                    required: false,
                    min: 1,
                    max: 1000,
                    description: 'Shift or offset from most recent bar',
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
                    is_default: true,
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
                    is_default: true,
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
export interface data_source {
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
export interface data_candle extends data_source {
    type: 'candle';
}

/**
 * Expresses a timeframe for candles/bars.
 */
export interface timeframe {
    length: number; //default 1, can't be zero
    period: 'second' | 'minute' | 'hour' | 'day' | 'month';
}

/**
 * Expresses a specific indicator instance with named parameters.
 * The params must match the indicator definition in the registry.
 */
export interface data_indicator extends data_source {
    type: 'indicator';
    indicator_type: string; //Must match a key in the indicator registry
    params: { [key: string]: number | string }; //named parameters matching the registry definition
}

// ============================================================================
// VALUE REFERENCES - How to reference indicator outputs and candle values
// ============================================================================

export type string_value = string | string_variable;
export type numeric_value = number | numeric_variable;

export interface string_variable {
    var: string;
}

export interface numeric_variable {
    var: string;
}

export interface string_ternary_expression {
    if: condition;
    then: string_value;
    else: string_value;
}

export interface numeric_ternary_expression {
    if: condition;
    then: numeric_expression | numeric_ternary_expression;
    else: numeric_expression | numeric_ternary_expression;
}

/**
 * Reference to a specific output from an indicator
 */
export interface indicator_output_ref {
    indicator_id: string; //Must be valid indicator id from data sources
    output?: string | number; //can use name ('macd', 'signal') or index (0, 1)
    //if omitted, defaults to first output (index 0)
}

/**
 * Reference to a specific field from a candle
 */
export interface candle_field_ref {
    candle_id: string; //Must be valid candle id from data sources
    field: 'open' | 'high' | 'low' | 'close' | 'volume' | 'timestamp';
}

/**
 * Numeric-only expression (for things like prices that must be numbers)
 */
export type numeric_expression =
    | numeric_value
    | operation
    | indicator_output_ref
    | candle_field_ref;

// ============================================================================
// OPERATIONS AND CONDITIONS
// ============================================================================

export interface comparison {
    operandA: numeric_expression;
    operandB: numeric_expression;
    operator: '<' | '>' | '<=' | '>=' | '==' | '!=';
}

export interface operation {
    operator: '+' | '*' | '-' | '/' | 'mod' | 'modulo' | 'pct' | 'percent';
    operandA: numeric_expression;
    operandB: numeric_expression;
}

export interface condition {
    //Must have only one of 'expression', 'and', 'or'
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
export interface action {
    id: string;
    order: stock_order;
}

/**
 * Defines max and minimum position sizes.
 */
export interface position_limit {
    symbol: string_value;
    max: numeric_expression;
    min: numeric_expression;
}

/**
 * This is the real meat of the strategy. These are logical rules that define how to use the data and actions
 * that are defined, to execute a strategy.
 */
export interface rule {
    if: condition;
    then: string[]; //action IDs to execute
    else?: string[]; //optional else actions
}

// ============================================================================
// MAIN STRATEGY
// ============================================================================

export interface strategy {
    name?: string;
    description?: string;
    default_symbol?: string; //optional default symbol for data sources
    data: data_source[]; //Must have length of at least one
    rules: rule[]; //Must have length of at least one
    actions: action[]; //Must have length of at least one
    position_limits: position_limit[]; //Must have at least one
}

// ============================================================================
// ORDERS
// ============================================================================

export interface base_order {
    symbol: string_value;
    quantity: numeric_expression; //changed from number to allow expressions
    side: 'buy' | 'sell';
    tif: 'day' | 'gtc' | 'ioc' | 'fok' | 'gtd' | 'ext';
    extended_hours?: boolean;
    account_id?: string;
    timestamp?: Date;
}

//Market
export interface market_order extends base_order {
    type: 'market';
}

//limit
export interface limit_order extends base_order {
    type: 'limit';
    limit_price: numeric_expression;
}

//stop market
export interface stop_order extends base_order {
    type: 'stop';
    stop_price: numeric_expression;
}

//stop-limit
export interface stop_limit_order extends base_order {
    type: 'stop_limit';
    stop_price: numeric_expression;
    limit_price: numeric_expression;
}

//trailing Stop
export interface trailing_stop_order extends base_order {
    type: 'trailing_stop';
    trail_amount?: numeric_expression; //dollar amount
    trail_percent?: numeric_expression; //percentage
}

//trailing Stop-limit
export interface trailing_stop_limit_order extends base_order {
    type: 'trailing_stop_limit';
    trail_amount?: numeric_expression;
    trail_percent?: numeric_expression;
    limit_offset: numeric_expression; //offset from stop price for limit
}

//oCO
export interface oco_order extends base_order {
    type: 'oco';
    orders: [
        limit_order | stop_order | stop_limit_order,
        limit_order | stop_order | stop_limit_order
    ];
}

//bracket
export interface bracket_order extends base_order {
    type: 'bracket';
    entry_order: market_order | limit_order;
    profit_target: limit_order;
    stop_loss: stop_order | stop_limit_order;
}

//iceberg
export interface iceberg_order extends base_order {
    type: 'iceberg';
    limit_price: numeric_expression;
    display_quantity: numeric_expression; //visible quantity
    total_quantity: numeric_expression; //total order size
}

//all or none
export interface aon_order extends base_order {
    type: 'all_or_none';
    limit_price: numeric_expression;
}

//fOK
export interface fok_order extends base_order {
    type: 'fill_or_kill';
    limit_price?: numeric_expression;
}

//iOC
export interface ioc_order extends base_order {
    type: 'immediate_or_cancel';
    limit_price?: numeric_expression;
}

//gTD
export interface gtd_order extends base_order {
    type: 'good_till_date';
    limit_price?: numeric_expression;
    expiration_date: Date;
}

export interface pegged_order extends base_order {
    type: 'pegged';
    peg_type: 'midpoint' | 'primary' | 'market' | 'benchmark';
    limit_price?: numeric_expression;
    offset?: numeric_expression;
}

//union type for all order types
export type stock_order =
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
