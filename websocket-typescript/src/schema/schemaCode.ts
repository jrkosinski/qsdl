/*
This is an interface definition for IStrategy. IStrategy should be able to represent a wide array and variety of trading strategies. Its main components are: 
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
interface IData {
    id: string;
    type: 'indicator' | 'candle';
    timeframe: ITimeframe;
    offset?: number;
}

/**
 * Defines an OHLCVT candle (OHLC + volume + timestamp).
 */
interface ICandleBar {
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
interface ITimeframe {
    length: number; //default 1, can't be zero
    period: 'second' | 'minute' | 'hour' | 'day' | 'month';
}

/**
 * Expresses a specific indicator type and its input parameters.
 */
interface IDataIndicator extends IData {
    indicator_type: 'sma' | 'ema' | 'rsi' | 'atr';
    params: any[];
}

/**
 * Defines how time works.
 */
interface IDataTime extends IData {
    second: number;
    minute: number;
    hour: number;
}

/**
 * These are (currently at least) orders only - orders to place, and how to place them, types of orders, etc.
 * These are used in rules. In the future there might be a 'signal' action - one that gives a signal but doesn't
 * specify the placing of a specific order.
 */
interface IAction {
    id: string;
    order: StockOrder;
}

/**
 * Defines max and minimum position sizes.
 */
interface IPositionLimit {
    symbol: string;
    max: IValueExpression;
    min: IValueExpression;
}

/**
 * this is the real meat of the strategy. These are logical rules that define how to use the data and actions
 * that are defined, to execute a strategy.
 */
interface IRule {
    if: ICondition;
    then: string[];
    else?: string[]; //else is not required
}

interface ICondition {
    //must have only one of 'expression', 'and', 'or'
    expression?: IComparison;
    and?: ICondition[] | IComparison[];
    or?: ICondition[] | IComparison[];
}

interface IValueExpression {
    value: number | string | IOperation | IIndicatorOutput;
}

interface IIndicatorOutput {
    indicator_id: string; //must be valid indicator id
    output_index?: number; //default to 0
}

interface IComparison {
    operandA: IValueExpression | number; //must have
    operandB: IValueExpression | number; //must have
    comparison: '<' | '>' | '<=' | '>=' | '==' | '!='; //must have
}

interface IOperation {
    operand: '+' | '*' | '-' | '/' | '%';
    valueA: IValueExpression;
    valueB: IValueExpression;
}

interface IStrategy {
    data: IData[]; //must have length of at least one
    rules: IRule[]; //must have length of at least one
    actions: IAction[]; //must have length of at least one
    position_limits: IPositionLimit[]; //must have at least one
}

const EXAMPLE_OF_ISTRATEGY: IStrategy = {
    data: [
        {
            id: 'sma50',
            type: 'indicator',
            timeframe: { period: 'day', length: 1 },
            params: [50],
        } as IDataIndicator,
        {
            id: 'sma200',
            type: 'indicator',
            timeframe: { period: 'day', length: 1 },
            params: [200],
        } as IDataIndicator,
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
        } as IDataIndicator,
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

interface IBaseOrder {
    symbol: string;
    quantity: number; //TODO: change to expression
    side: 'buy' | 'sell';
    tif: 'day' | 'gtc' | 'ioc' | 'fok' | 'gtd' | 'ext';
    extended_hours?: boolean;
    accountId?: string;
    timestamp?: Date;
}

//Market
interface IMarketOrder extends IBaseOrder {
    type: 'market';
}

//Limit
interface ILimitOrder extends IBaseOrder {
    type: 'limit';
    limit_price: number;
}

//Stop market
interface IStopOrder extends IBaseOrder {
    type: 'stop';
    stop_price: number;
}

//Stop-limit
interface IStopLimitOrder extends IBaseOrder {
    type: 'stop_limit';
    stop_price: number;
    limit_price: number;
}

//Trailing Stop
interface ITrailingStopOrder extends IBaseOrder {
    type: 'trailing_stop';
    trail_amount?: number; // Dollar amount
    trail_percent?: number; // Percentage
}

//Trailing Stop-limit
interface ITrailingStopLimitOrder extends IBaseOrder {
    type: 'trailing_stop_limit';
    trail_amount?: number;
    trail_percent?: number;
    limit_offset: number; // Offset from stop price for limit
}

//OCO
interface IOCOOrder extends IBaseOrder {
    type: 'oco';
    orders: [
        ILimitOrder | IStopOrder | IStopLimitOrder,
        ILimitOrder | IStopOrder | IStopLimitOrder
    ];
}

//Bracket
interface IBracketOrder extends IBaseOrder {
    type: 'bracket';
    entry_order: IMarketOrder | ILimitOrder;
    profit_target: ILimitOrder;
    stop_loss: IStopOrder | IStopLimitOrder;
}

//Iceberg
interface IIcebergOrder extends IBaseOrder {
    type: 'iceberg';
    limit_price: number;
    display_quantity: number; // Visible quantity
    total_quantity: number; // Total order size
}

//All or none
interface IAllOrNoneOrder extends IBaseOrder {
    type: 'all_or_none';
    limit_price: number;
}

//FOK
interface IFillOrKillOrder extends IBaseOrder {
    type: 'fill_or_kill';
    limit_price?: number;
}

//IOC
interface IImmediateOrCancelOrder extends IBaseOrder {
    type: 'immediate_or_cancel';
    limit_price?: number;
}

//GTD
interface IGoodTillDateOrder extends IBaseOrder {
    type: 'good_till_date';
    limit_price?: number;
    expiration_date: Date;
}

interface IPeggedOrder extends IBaseOrder {
    type: 'pegged';
    peg_type: 'midpoint' | 'primary' | 'market' | 'benchmark';
    limit_price?: number;
    offset?: number;
}

//Union type for all order types
type StockOrder =
    | IMarketOrder
    | ILimitOrder
    | IStopOrder
    | IStopLimitOrder
    | ITrailingStopOrder
    | ITrailingStopLimitOrder
    | IOCOOrder
    | IBracketOrder
    | IIcebergOrder
    | IAllOrNoneOrder
    | IFillOrKillOrder
    | IImmediateOrCancelOrder
    | IGoodTillDateOrder
    | IPeggedOrder;

//Time in Force enum for better type safety
enum TimeInForce {
    DAY = 'DAY', // Day order
    GTC = 'GTC', // Good till canceled
    IOC = 'IOC', // Immediate or cancel
    FOK = 'FOK', // Fill or kill
    GTD = 'GTD', // Good till date
    EXT = 'EXT', // Extended hours
}
