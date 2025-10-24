/*
Trade in the direction of the medium-term trend (50-period SMA vs. 200-period SMA).
Use RSI to time pullbacks for entry, and ATR for adaptive stop-loss and take-profit.

Indicators: 50 SMA, 200 SMA, RSI14

Trigger: 
SMA50 > SMA200 (uptrend)
RSI has JUST CROSSED above 40

Text: 
*/
export const qsdl1 = {
    symbols: ['REMX'],
    indicators: [
        {
            id: 'sma50',
            type: 'sma',
            symbol: 'REMX',
            params: {
                window: 50,
            },
        },
        {
            id: 'sma200',
            type: 'sma',
            symbol: 'REMX',
            params: {
                window: 200,
            },
        },
        {
            id: 'rsi14',
            type: 'rsi',
            symbol: 'REMX',
            params: {
                period: 14,
            },
        },
    ],
    preconditions: [],
    triggers: [
        {
            and: [
                {
                    type: 'indicator_event',
                    params: {
                        event_type: 'cross',
                        threshold: 40,
                        direction: 'above',
                    },
                },
                {
                    type: 'indicator_comparison',
                    params: {
                        indicator1: 'sma50',
                        indicator2: 'sma200',
                        operator: '>',
                    },
                },
            ],
            actions: ['enter_long'],
        },
        {
            or: [
                {
                    type: 'indicator_event',
                    params: {
                        event_type: 'cross',
                        threshold: 40,
                        direction: 'below',
                    },
                },
                {
                    type: 'indicator_comparison',
                    params: {
                        indicator1: 'sma50',
                        indicator2: 'sma200',
                        operator: '<',
                    },
                },
            ],
            actions: ['exit'],
        },
    ],
    actions: [
        {
            id: 'enter_long',
            type: 'entry',
            direction: 'long',
            max_position_size: 100,
            percent_of_position: 100,
            order: {
                symbol: 'REMX',
                type: 'market',
                tif: 'day',
            },
            stop_loss: {},
        },
        {
            type: 'exit',
            direction: 'long',
            max_position_size: 100,
            percent_of_position: 100,
            order: {
                symbol: 'REMX',
                type: 'market',
                tif: 'day',
            },
            stop_loss: {},
        },
    ],
};
