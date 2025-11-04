interface IData {
    id: string;
    type: 'indicator' | 'candle' | 'volume' | 'time';
    timeframe: ITimeframe;
    offset?: number;
}

interface ITimeframe {
    length: number; //default 1, can't be zero
    period: 'second' | 'minute' | 'hour' | 'day' | 'month';
}

interface IDataIndicator extends IData {
    indicator_type: 'sma' | 'ema' | 'rsi' | 'atr';
    params: any[];
}

interface IDataTime extends IData {
    second: number;
    minute: number;
    hour: number;
}

interface IAction {
    id: string;
    order: StockOrder;
}

interface IPositionLimit {
    symbol: string;
    max: number;
    min: number;
}

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

interface IOperation {}

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
            max: 100,
            min: 0,
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

// Union type for all order types
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

// Time in Force enum for better type safety
enum TimeInForce {
    DAY = 'DAY', // Day order
    GTC = 'GTC', // Good till canceled
    IOC = 'IOC', // Immediate or cancel
    FOK = 'FOK', // Fill or kill
    GTD = 'GTD', // Good till date
    EXT = 'EXT', // Extended hours
}
