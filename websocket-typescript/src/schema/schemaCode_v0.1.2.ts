/*
This is an interface definition for strategy. strategy should be able to represent a wide array and variety of trading strategies. Its main components are: 
[1] data: these are data indicators (e.g. a moving average or more complex indicator) that can be named and have multiple or single outputs, or simple candles that give price, volume, timestamp. These data sources can be used in calculations, expressions, triggers, etc. 
[2] actions: these are (currently at least) orders only - orders to place, and how to place them, types of orders, etc. These are used in rules. 
[3] position_limits: these define how to manage a position (max and min sizes, etc.) 
[4] rules: this is the real meat of the strategy. These are logical rules that define how to use the data and actions that are defined, to execute a strategy. 

These are only for trading forex, stocks, and futures; no complex derivatives. 

The end result of a strategy is a chunk of JSON that has all of the necessary information for defining how a specific trading strategy works, with no ambiguity. 



*/

/**
 * Data sources are data indicators (e.g. a moving average or more complex indicator) that can be named and have
 * multiple or single parameters and outputs, or simple candles that give price, volume, timestamp.
 * These data sources can be used in calculations, expressions, triggers, etc.
 */
interface data_source {
    id: string;
    type: 'indicator' | 'candle';
    timeframe: timeframe;
    offset?: number;
}

/**
 * Defines an OHLCVT candle (OHLC + volume + timestamp).
 */
interface candle {
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    timestamp: number;
}

/**
 * Expresses a timeframe for candles/bars.
 */
interface timeframe {
    length: number; //default 1, can't be zero
    period: 'second' | 'minute' | 'hour' | 'day' | 'month';
}

/**
 * Expresses a specific indicator type and its input parameters.
 */
interface data_indicator extends data_source {
    indicator_type: 'sma' | 'ema' | 'rsi' | 'atr';
    params: any[];
}

/**
 * Defines how time works.
 */
interface data_time extends data_source {
    second: number;
    minute: number;
    hour: number;
}

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
    symbol: string;
    max: value_expression;
    min: value_expression;
}

/**
 * this is the real meat of the strategy. These are logical rules that define how to use the data and actions
 * that are defined, to execute a strategy.
 */
interface rule {
    if: condition;
    then: string[];
    else?: string[]; //else is not required
}

interface condition {
    //must have only one of 'expression', 'and', 'or'
    expression?: comparison;
    and?: condition[] | comparison[];
    or?: condition[] | comparison[];
}

interface value_expression {
    value: number | string | operation | indicator_output;
}

interface numeric_expression {
    value: number | operation | indicator_output;
}

interface indicator_output {
    indicator_id: string; //must be valid indicator id
    output_index?: number; //default to 0
}

interface comparison {
    operandA: value_expression | number; //must have
    operandB: value_expression | number; //must have
    comparison: '<' | '>' | '<=' | '>=' | '==' | '!='; //must have
}

interface operation {
    operand: '+' | '*' | '-' | '/' | '%';
    valueA: value_expression;
    valueB: value_expression;
}

interface strategy {
    data: data_source[]; //must have length of at least one
    rules: rule[]; //must have length of at least one
    actions: action[]; //must have length of at least one
    position_limits: position_limit[]; //must have at least one
}

const Example_of_Strategy: strategy = {
    data: [
        {
            id: 'sma50',
            type: 'indicator',
            timeframe: { period: 'day', length: 1 },
            params: [50],
        } as data_indicator,
        {
            id: 'sma200',
            type: 'indicator',
            timeframe: { period: 'day', length: 1 },
            params: [200],
        } as data_indicator,
        {
            id: 'priceASL',
            type: 'candle',
            timeframe: { period: 'day', length: 1 },
        },
        {
            id: 'priceASLprev',
            type: 'candle',
            timeframe: { period: 'day', length: 1 },
            offset: 1,
        } as data_indicator,
    ],
    actions: [
        {
            id: 'buyASL',
            order: {
                type: 'market',
                side: 'buy',
                quantity: 100,
                symbol: 'ASL',
                tif: 'gtc',
            },
        },
        {
            id: 'sellASL',
            order: {
                type: 'market',
                side: 'sell',
                quantity: 100,
                symbol: 'ASL',
                tif: 'gtc',
            },
        },
    ],
    position_limits: [
        {
            symbol: 'ASL',
            max: { value: 100 },
            min: { value: 0 },
        },
    ],
    rules: [
        {
            if: {
                expression: {
                    comparison: '<',
                    operandA: { value: { indicator_id: 'priceASL' } },
                    operandB: 250,
                },
            },
            then: ['buyASL'],
        },
    ],
};

////////////////////////////////////////////////////////////////////////////
// ORDERS

interface base_order {
    symbol: string;
    quantity: number; //TODO: change to expression
    side: 'buy' | 'sell';
    tif: 'day' | 'gtc' | 'ioc' | 'fok' | 'gtd' | 'ext';
    extended_hours?: boolean;
    accountId?: string;
    timestamp?: Date;
}

//Market
interface market_order extends base_order {
    type: 'market';
}

//Limit
interface limit_order extends base_order {
    type: 'limit';
    limit_price: number;
}

//Stop market
interface stop_lorder extends base_order {
    type: 'stop';
    stop_price: number;
}

//Stop-limit
interface stop_limit_order extends base_order {
    type: 'stop_limit';
    stop_price: value_expression;
    limit_price: value_expression;
}

//Trailing Stop
interface trailing_stop_order extends base_order {
    type: 'trailing_stop';
    trail_amount?: value_expression; // Dollar amount
    trail_percent?: value_expression; // Percentage
}

//Trailing Stop-limit
interface trailing_stop_limit_order extends base_order {
    type: 'trailing_stop_limit';
    trail_amount?: value_expression;
    trail_percent?: value_expression;
    limit_offset: value_expression; // Offset from stop price for limit
}

//OCO
interface oco_order extends base_order {
    type: 'oco';
    orders: [
        limit_order | stop_lorder | stop_limit_order,
        limit_order | stop_lorder | stop_limit_order
    ];
}

//Bracket
interface bracket_order extends base_order {
    type: 'bracket';
    entry_order: market_order | limit_order;
    profit_target: limit_order;
    stop_loss: stop_lorder | stop_limit_order;
}

//Iceberg
interface iceberg_order extends base_order {
    type: 'iceberg';
    limit_price: value_expression;
    display_quantity: value_expression; // Visible quantity
    total_quantity: value_expression; // Total order size
}

//All or none
interface aon_order extends base_order {
    type: 'all_or_none';
    limit_price: value_expression;
}

//FOK
interface fok_order extends base_order {
    type: 'fill_or_kill';
    limit_price?: value_expression;
}

//IOC
interface ioc_order extends base_order {
    type: 'immediate_or_cancel';
    limit_price?: numeric_expression;
}

//GTD
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

//Union type for all order types
type stock_order =
    | market_order
    | limit_order
    | stop_lorder
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

//Time in Force enum for better type safety
enum time_in_force {
    DAY = 'DAY', // Day order
    GTC = 'GTC', // Good till canceled
    IOC = 'IOC', // Immediate or cancel
    FOK = 'FOK', // Fill or kill
    GTD = 'GTD', // Good till date
    EXT = 'EXT', // Extended hours
}
