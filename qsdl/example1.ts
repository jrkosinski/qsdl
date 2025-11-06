/*
precondition: the 50 sma is above the 100 sma on a daily chart
buy signal: MACD crosses bullish (hourly) and volume is above 50% of the daily average for the last 20 days
to do: buy to maintain n% of portfolio in chosen symbol
exit when: the precondition goes negative
when entering: use a limit order with the price 0.5% above the current price
when exiting: use a market order and exit all at once 
*/

const example1: strategy = {
    data: [
        {
            id: 'macd_hourly',
            type: 'indicator',
            indicator_type: 'macd',
            symbol: { var: '$SYM' },
            timeframe: { period: 'hour', length: 1 },
            params: {
                fast_period: 12,
                slow_period: 26,
                signal_period: 9,
                source: 'close',
            },
        } as data_indicator,
        {
            id: 'sma_volume',
            type: 'indicator',
            indicator_type: 'sma',
            symbol: { var: '$SYM' },
            timeframe: { period: 'day', length: 1 },
            params: {
                period: 20,
                shift: 0,
                source: 'volume',
            },
        } as data_indicator,
        {
            id: 'sma_50',
            type: 'indicator',
            indicator_type: 'sma',
            symbol: { var: '$SYM' },
            timeframe: { period: 'day', length: 1 },
            params: {
                period: 50,
                shift: 0,
                source: 'close',
            },
        } as data_indicator,
        {
            id: 'sma_100',
            type: 'indicator',
            indicator_type: 'sma',
            symbol: { var: '$SYM' },
            timeframe: { period: 'day', length: 1 },
            params: {
                period: 50,
                shift: 0,
                source: 'close',
            },
        } as data_indicator,
    ],
    actions: [
        {
            id: 'buy',
            order: {
                type: 'market',
                symbol: { var: '$SYM' },
                quantity: { var: '$POSMAX' }, //TODO: HERE WE NEED A VARIABLE TO INDICATE POSITION SIZE
                side: 'buy',
                tif: 'gtc',
            },
        },
        {
            id: 'sell',
            order: {
                type: 'market',
                symbol: { var: '$SYM' },
                quantity: { var: '$POSMAX' }, //TODO: HERE WE NEED A VARIABLE TO INDICATE POSITION SIZE
                side: 'sell',
                tif: 'gtc',
            },
        },
    ],
    rules: [
        {
            if: {
                //TODO: need to indicate a crosssing "JUST" happened
                and: [
                    {
                        expression: {
                            operator: '>',
                            operandA: { indicator_id: 'sma_50' },
                            operandB: { indicator_id: 'sma_100' },
                        },
                    },
                    {
                        expression: {
                            operator: '>',
                            operandA: {
                                indicator_id: 'macd_hourly',
                                output: 'histogram',
                            },
                            operandB: 0,
                        },
                    },
                ],
            },
            then: ['buy'],
        },
        {
            if: {
                expression: {
                    operator: '<',
                    operandA: { indicator_id: 'sma_50' },
                    operandB: { indicator_id: 'sma_100' },
                },
            },
            then: ['sell'],
        },
    ],
    position_limits: [
        {
            symbol: { var: '$SYM' },
            max: { var: '$POSMAX' },
            min: { var: '$POSMIN' },
        },
    ],
};
