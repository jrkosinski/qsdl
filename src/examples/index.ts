/*
Trade in the direction of the medium-term trend when the 50-period SMA is higher than the 200-period SMA.
Use RSI to time pullbacks for entry, buying 100 of REMX with a market order when the RSI has just crossed in the previous bar above 40.
If there is already a 100 long position, don't buy more. 100 is the max. If there is long position in REMX, then 
exit it fully with a market order when either the RSI crosses back below 40, or when the 50 SMA crosses below the 200 SMA.



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

export const qsdl1_response1 = {
    symbols: ['REMX'],
    indicators: [
        {
            id: 'sma_50',
            type: 'sma',
            symbol: 'REMX',
            params: {
                period: 50,
            },
        },
        {
            id: 'sma_200',
            type: 'sma',
            symbol: 'REMX',
            params: {
                period: 200,
            },
        },
        {
            id: 'rsi_14',
            type: 'rsi',
            symbol: 'REMX',
            params: {
                period: 14,
            },
        },
    ],
    triggers: [
        {
            and: [
                {
                    type: 'indicator_comparison',
                    params: {
                        indicator1: 'sma_50',
                        indicator2: 'sma_200',
                        operator: '>',
                    },
                },
                {
                    type: 'indicator_event',
                    params: {
                        event_type: 'cross_up',
                        threshold: 40,
                        direction: 'above',
                    },
                },
            ],
            actions: ['entry_long'],
        },
        {
            or: [
                {
                    type: 'indicator_event',
                    params: {
                        event_type: 'cross_down',
                        threshold: 40,
                        direction: 'below',
                    },
                },
                {
                    type: 'indicator_comparison',
                    params: {
                        indicator1: 'sma_50',
                        indicator2: 'sma_200',
                        operator: '<',
                    },
                },
            ],
            actions: ['exit_long'],
        },
    ],
    actions: [
        {
            id: 'entry_long',
            type: 'entry',
            direction: 'long',
            max_position_size: 100,
            order: {
                symbol: 'REMX',
                type: 'market',
                tif: 'day',
                price: null,
            },
        },
        {
            id: 'exit_long',
            type: 'exit',
            direction: 'long',
            percent_of_position: 100,
            order: {
                symbol: 'REMX',
                type: 'market',
                tif: 'day',
                price: null,
            },
        },
    ],
};
