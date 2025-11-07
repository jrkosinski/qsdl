/**
 * MT5/MQL5 Code Generator for MetaTrader 5 Expert Advisors
 */
import { CodeGenerator } from '.';
import {
    ASTVisitor,
    StrategyNode,
    IndicatorNode,
    CandleNode,
    TimeframeNode,
    ActionNode,
    MarketOrderNode,
    LimitOrderNode,
    RuleNode,
    PositionLimitNode,
    ComparisonNode,
    LogicalOperationNode,
    CrossoverNode,
    LiteralNumberNode,
    VariableNode,
    BinaryOperationNode,
    IndicatorOutputRefNode,
    CandleFieldRefNode,
} from '../ast-node';
import Handlebars from 'handlebars';

/**
 * MT5/MQL5 Code Generator
 * Generates Expert Advisor scripts for MetaTrader 5
 */
export class MT5CodeGenerator2 extends CodeGenerator<string> {
    private code: string[] = [];
    private indicatorHandles: Map<string, string> = new Map();
    private indicatorBuffers: Map<string, string> = new Map();
    private variables: Set<string> = new Set();

    generate(ast: StrategyNode): string {
        this.code = [];
        this.indent = 0;
        this.indicatorHandles.clear();
        this.indicatorBuffers.clear();
        this.variables.clear();

        //generate EA structure
        this.generateInputParameters(ast);
        this.generateGlobalVariables(ast);
        this.generateOnInit(ast);
        this.generateOnDeinit();
        this.generateOnTick(ast);
        this.generateHelperFunctions(ast);

        return this.code.join('\n');
    }

    //ACTIONS - 1 function to rule them

    //DATASOURCES - 1 function per

    //POSITION LIMITS - what to do

    //RULES - LOGIC

    private generateInputParameters(ast: StrategyNode): void {
        this.code.push('//--- Input parameters');

        //extract all variables from the strategy
        this.extractVariables(ast);

        //generate input parameters for each variable
        for (const variable of this.variables) {
            const cleanName = variable.replace('$', '');

            //determine appropriate type and default based on variable name
            if (cleanName === 'SYM' || cleanName === 'SYMBOL') {
                this.code.push(
                    `input string ${cleanName} = "EURUSD";  //trading symbol`
                );
            } else if (
                cleanName.includes('POS') ||
                cleanName.includes('QUANTITY')
            ) {
                this.code.push(
                    `input double ${cleanName} = 0.1;  //position size`
                );
            } else if (cleanName.includes('PORTFOLIO')) {
                this.code.push(
                    `input double ${cleanName} = 10000.0;  //portfolio value`
                );
            } else {
                this.code.push(
                    `input double ${cleanName} = 1.0;  // ${cleanName}`
                );
            }
        }

        //add standard EA parameters
        this.code.push(
            'input int MagicNumber = 123456;  //magic number for this EA'
        );
        this.code.push(
            'input double Slippage = 10;      //maximum slippage in points'
        );
        this.code.push(
            'input bool EnableTrading = true;  //enable/disable trading'
        );
        this.code.push('');
    }

    private generateGlobalVariables(ast: StrategyNode): void {
        this.code.push('//--- Global variables');
        this.code.push('CTrade trade;');
        this.code.push('CPositionInfo positionInfo;');
        this.code.push('COrderInfo orderInfo;');
        this.code.push('');

        //generate indicator handles
        const indicators = ast.dataSources.filter(
            (ds) => ds instanceof IndicatorNode
        ) as IndicatorNode[];
        for (const indicator of indicators) {
            const handleName = `h_${indicator.id}`;
            this.code.push(
                `int ${handleName} = INVALID_HANDLE;  //handle for ${indicator.indicatorType}`
            );
            this.indicatorHandles.set(indicator.id, handleName);
        }
        this.code.push('');

        //generate indicator buffers
        for (const indicator of indicators) {
            const bufferName = `buffer_${indicator.id}`;
            this.code.push(
                `double ${bufferName}[];  //buffer for ${indicator.id}`
            );
            this.indicatorBuffers.set(indicator.id, bufferName);

            //for MACD, we need multiple buffers
            if (indicator.indicatorType === 'macd') {
                this.code.push(
                    `double ${bufferName}_signal[];  //signal buffer for ${indicator.id}`
                );
                this.code.push(
                    `double ${bufferName}_histogram[];  //histogram buffer for ${indicator.id}`
                );
            } else if (indicator.indicatorType === 'bb') {
                this.code.push(
                    `double ${bufferName}_upper[];  //upper band for ${indicator.id}`
                );
                this.code.push(
                    `double ${bufferName}_middle[];  //middle band for ${indicator.id}`
                );
                this.code.push(
                    `double ${bufferName}_lower[];  //lower band for ${indicator.id}`
                );
            }
        }

        this.code.push('');
        this.code.push('//previous values for crossover detection');
        for (const indicator of indicators) {
            if (indicator.offset && indicator.offset > 0) {
                this.code.push(`double prev_${indicator.id}_value = 0;`);
            }
        }
        this.code.push('');
    }

    private generateOnInit(ast: StrategyNode): void {
        this.code.push(
            '//+------------------------------------------------------------------+'
        );
        this.code.push(
            '//| Expert initialization function                                   |'
        );
        this.code.push(
            '//+------------------------------------------------------------------+'
        );
        this.code.push('int OnInit()');
        this.code.push('{');
        this.increaseIndent();

        //set magic number
        this.code.push(
            this.getIndent() + '//set magic number for trade object'
        );
        this.code.push(
            this.getIndent() + 'trade.SetExpertMagicNumber(MagicNumber);'
        );
        this.code.push(
            this.getIndent() + 'trade.SetDeviationInPoints(Slippage);'
        );
        this.code.push(
            this.getIndent() + 'trade.SetTypeFilling(ORDER_FILLING_IOC);'
        );
        this.code.push('');

        //initialize indicators
        const indicators = ast.dataSources.filter(
            (ds) => ds instanceof IndicatorNode
        ) as IndicatorNode[];
        for (const indicator of indicators) {
            this.code.push(this.getIndent() + `//initialize ${indicator.id}`);
            const handleName = this.indicatorHandles.get(indicator.id);
            const symbol = this.getSymbolString(indicator.symbol);
            const timeframe = this.getTimeframeString(indicator.timeframe);

            switch (indicator.indicatorType) {
                case 'sma':
                    const smaPeriod = indicator.params.get('period') || 20;
                    const smaShift = indicator.params.get('shift') || 0;
                    const smaMethod = 'MODE_SMA';
                    const smaPrice = this.getPriceConstant(
                        (indicator.params.get('source') as string) || 'close'
                    );
                    this.code.push(
                        this.getIndent() +
                            `${handleName} = iMA(${symbol}, ${timeframe}, ${smaPeriod}, ${smaShift}, ${smaMethod}, ${smaPrice});`
                    );
                    break;

                case 'ema':
                    const emaPeriod = indicator.params.get('period') || 20;
                    const emaShift = indicator.params.get('shift') || 0;
                    const emaMethod = 'MODE_EMA';
                    const emaPrice = this.getPriceConstant(
                        (indicator.params.get('source') as string) || 'close'
                    );
                    this.code.push(
                        this.getIndent() +
                            `${handleName} = iMA(${symbol}, ${timeframe}, ${emaPeriod}, ${emaShift}, ${emaMethod}, ${emaPrice});`
                    );
                    break;

                case 'macd':
                    const fastPeriod =
                        indicator.params.get('fast_period') || 12;
                    const slowPeriod =
                        indicator.params.get('slow_period') || 26;
                    const signalPeriod =
                        indicator.params.get('signal_period') || 9;
                    const macdPrice = this.getPriceConstant(
                        (indicator.params.get('source') as string) || 'close'
                    );
                    this.code.push(
                        this.getIndent() +
                            `${handleName} = iMACD(${symbol}, ${timeframe}, ${fastPeriod}, ${slowPeriod}, ${signalPeriod}, ${macdPrice});`
                    );
                    break;

                case 'bb':
                    const bbPeriod = indicator.params.get('period') || 20;
                    const bbShift = indicator.params.get('shift') || 0;
                    const bbStdDev = indicator.params.get('std_dev') || 2;
                    const bbPrice = this.getPriceConstant(
                        (indicator.params.get('source') as string) || 'close'
                    );
                    this.code.push(
                        this.getIndent() +
                            `${handleName} = iBands(${symbol}, ${timeframe}, ${bbPeriod}, ${bbShift}, ${bbStdDev}, ${bbPrice});`
                    );
                    break;

                case 'rsi':
                    const rsiPeriod = indicator.params.get('period') || 14;
                    const rsiPrice = this.getPriceConstant(
                        (indicator.params.get('source') as string) || 'close'
                    );
                    this.code.push(
                        this.getIndent() +
                            `${handleName} = iRSI(${symbol}, ${timeframe}, ${rsiPeriod}, ${rsiPrice});`
                    );
                    break;

                default:
                    this.code.push(
                        this.getIndent() +
                            `//tODO: Initialize ${indicator.indicatorType}`
                    );
            }

            this.code.push(
                this.getIndent() + `if(${handleName} == INVALID_HANDLE)`
            );
            this.code.push(this.getIndent() + '{');
            this.increaseIndent();
            this.code.push(
                this.getIndent() +
                    `Print("Failed to create ${indicator.id} indicator");`
            );
            this.code.push(this.getIndent() + 'return(INIT_FAILED);');
            this.decreaseIndent();
            this.code.push(this.getIndent() + '}');
            this.code.push('');
        }

        //set indicator buffers as series
        for (const indicator of indicators) {
            const bufferName = this.indicatorBuffers.get(indicator.id);
            this.code.push(
                this.getIndent() + `ArraySetAsSeries(${bufferName}, true);`
            );

            if (indicator.indicatorType === 'macd') {
                this.code.push(
                    this.getIndent() +
                        `ArraySetAsSeries(${bufferName}_signal, true);`
                );
                this.code.push(
                    this.getIndent() +
                        `ArraySetAsSeries(${bufferName}_histogram, true);`
                );
            } else if (indicator.indicatorType === 'bb') {
                this.code.push(
                    this.getIndent() +
                        `ArraySetAsSeries(${bufferName}_upper, true);`
                );
                this.code.push(
                    this.getIndent() +
                        `ArraySetAsSeries(${bufferName}_middle, true);`
                );
                this.code.push(
                    this.getIndent() +
                        `ArraySetAsSeries(${bufferName}_lower, true);`
                );
            }
        }

        this.code.push('');
        this.code.push(this.getIndent() + 'return(INIT_SUCCEEDED);');
        this.decreaseIndent();
        this.code.push('}');
        this.code.push('');
    }

    private generateOnDeinit(): void {
        this.code.push(
            '//+------------------------------------------------------------------+'
        );
        this.code.push(
            '//| Expert deinitialization function                                 |'
        );
        this.code.push(
            '//+------------------------------------------------------------------+'
        );
        this.code.push('void OnDeinit(const int reason)');
        this.code.push('{');
        this.increaseIndent();

        //release indicator handles
        for (const [id, handle] of this.indicatorHandles) {
            this.code.push(
                this.getIndent() + `if(${handle} != INVALID_HANDLE)`
            );
            this.increaseIndent();
            this.code.push(this.getIndent() + `IndicatorRelease(${handle});`);
            this.decreaseIndent();
        }

        this.decreaseIndent();
        this.code.push('}');
        this.code.push('');
    }

    private generateOnTick(ast: StrategyNode): void {
        this.code.push(
            '//+------------------------------------------------------------------+'
        );
        this.code.push(
            '//| Expert tick function                                             |'
        );
        this.code.push(
            '//+------------------------------------------------------------------+'
        );
        this.code.push('void OnTick()');
        this.code.push('{');
        this.increaseIndent();

        //check if trading is enabled
        this.code.push(this.getIndent() + 'if(!EnableTrading) return;');
        this.code.push('');

        //update indicator values
        this.code.push(this.getIndent() + '//update indicator values');
        const indicators = ast.dataSources.filter(
            (ds) => ds instanceof IndicatorNode
        ) as IndicatorNode[];

        for (const indicator of indicators) {
            const handleName = this.indicatorHandles.get(indicator.id);
            const bufferName = this.indicatorBuffers.get(indicator.id);
            const offset = indicator.offset || 0;

            if (indicator.indicatorType === 'macd') {
                this.code.push(
                    this.getIndent() +
                        `if(CopyBuffer(${handleName}, 0, ${offset}, 3, ${bufferName}) <= 0) return;`
                );
                this.code.push(
                    this.getIndent() +
                        `if(CopyBuffer(${handleName}, 1, ${offset}, 3, ${bufferName}_signal) <= 0) return;`
                );
                this.code.push(
                    this.getIndent() +
                        `if(CopyBuffer(${handleName}, 2, ${offset}, 3, ${bufferName}_histogram) <= 0) return;`
                );
            } else if (indicator.indicatorType === 'bb') {
                this.code.push(
                    this.getIndent() +
                        `if(CopyBuffer(${handleName}, 0, ${offset}, 3, ${bufferName}_upper) <= 0) return;`
                );
                this.code.push(
                    this.getIndent() +
                        `if(CopyBuffer(${handleName}, 1, ${offset}, 3, ${bufferName}_middle) <= 0) return;`
                );
                this.code.push(
                    this.getIndent() +
                        `if(CopyBuffer(${handleName}, 2, ${offset}, 3, ${bufferName}_lower) <= 0) return;`
                );
            } else {
                this.code.push(
                    this.getIndent() +
                        `if(CopyBuffer(${handleName}, 0, ${offset}, 3, ${bufferName}) <= 0) return;`
                );
            }
        }
        this.code.push('');

        //get current market prices
        this.code.push(this.getIndent() + '//get current market data');
        this.code.push(
            this.getIndent() +
                'double ask = SymbolInfoDouble(_Symbol, SYMBOL_ASK);'
        );
        this.code.push(
            this.getIndent() +
                'double bid = SymbolInfoDouble(_Symbol, SYMBOL_BID);'
        );
        this.code.push(
            this.getIndent() +
                'double point = SymbolInfoDouble(_Symbol, SYMBOL_POINT);'
        );
        this.code.push('');

        //check position limits
        this.code.push(this.getIndent() + '//check current position');
        this.code.push(
            this.getIndent() +
                'double currentPosition = GetCurrentPosition(_Symbol);'
        );
        this.code.push('');

        //evaluate rules
        this.code.push(this.getIndent() + '//evaluate trading rules');
        for (let i = 0; i < ast.rules.length; i++) {
            const rule = ast.rules[i];
            this.code.push(this.getIndent() + `//rule ${i + 1}`);
            this.code.push(
                this.getIndent() + 'if(' + rule.condition.accept(this) + ')'
            );
            this.code.push(this.getIndent() + '{');
            this.increaseIndent();

            //execute then actions
            for (const actionId of rule.thenActions) {
                const action = ast.actions.find((a) => a.id === actionId);
                if (action) {
                    this.generateActionExecution(action);
                }
            }

            this.decreaseIndent();
            this.code.push(this.getIndent() + '}');

            //handle else actions if present
            if (rule.elseActions && rule.elseActions.length > 0) {
                this.code.push(this.getIndent() + 'else');
                this.code.push(this.getIndent() + '{');
                this.increaseIndent();

                for (const actionId of rule.elseActions) {
                    const action = ast.actions.find((a) => a.id === actionId);
                    if (action) {
                        this.generateActionExecution(action);
                    }
                }

                this.decreaseIndent();
                this.code.push(this.getIndent() + '}');
            }
            this.code.push('');
        }

        this.decreaseIndent();
        this.code.push('}');
        this.code.push('');
    }

    private generateActionExecution(action: ActionNode): void {
        this.code.push(this.getIndent() + `//execute action: ${action.id}`);

        if (action.order instanceof MarketOrderNode) {
            const order = action.order;
            const symbol = this.getSymbolString(order.symbol);
            const quantity = order.quantity.accept(this);

            if (order.side === 'buy') {
                this.code.push(
                    this.getIndent() +
                        `if(!trade.Buy(${quantity}, ${symbol})) Print("Buy order failed: ", trade.ResultRetcode());`
                );
            } else {
                this.code.push(
                    this.getIndent() +
                        `if(!trade.Sell(${quantity}, ${symbol})) Print("Sell order failed: ", trade.ResultRetcode());`
                );
            }
        } else if (action.order instanceof LimitOrderNode) {
            const order = action.order;
            const symbol = this.getSymbolString(order.symbol);
            const quantity = order.quantity.accept(this);
            const price = order.limitPrice.accept(this);

            if (order.side === 'buy') {
                this.code.push(
                    this.getIndent() +
                        `if(!trade.BuyLimit(${quantity}, ${price}, ${symbol})) Print("Buy limit order failed: ", trade.ResultRetcode());`
                );
            } else {
                this.code.push(
                    this.getIndent() +
                        `if(!trade.SellLimit(${quantity}, ${price}, ${symbol})) Print("Sell limit order failed: ", trade.ResultRetcode());`
                );
            }
        }
    }

    private generateHelperFunctions(ast: StrategyNode): void {
        //generate position checking function
        this.code.push(
            '//+------------------------------------------------------------------+'
        );
        this.code.push(
            '//| Get current position size for a symbol                          |'
        );
        this.code.push(
            '//+------------------------------------------------------------------+'
        );
        this.code.push('double GetCurrentPosition(string symbol)');
        this.code.push('{');
        this.increaseIndent();
        this.code.push(this.getIndent() + 'double totalVolume = 0;');
        this.code.push(
            this.getIndent() + 'int totalPositions = PositionsTotal();'
        );
        this.code.push('');
        this.code.push(
            this.getIndent() + 'for(int i = 0; i < totalPositions; i++)'
        );
        this.code.push(this.getIndent() + '{');
        this.increaseIndent();
        this.code.push(this.getIndent() + 'if(positionInfo.SelectByIndex(i))');
        this.code.push(this.getIndent() + '{');
        this.increaseIndent();
        this.code.push(
            this.getIndent() +
                'if(positionInfo.Symbol() == symbol && positionInfo.Magic() == MagicNumber)'
        );
        this.code.push(this.getIndent() + '{');
        this.increaseIndent();
        this.code.push(
            this.getIndent() +
                'if(positionInfo.PositionType() == POSITION_TYPE_BUY)'
        );
        this.increaseIndent();
        this.code.push(
            this.getIndent() + 'totalVolume += positionInfo.Volume();'
        );
        this.decreaseIndent();
        this.code.push(this.getIndent() + 'else');
        this.increaseIndent();
        this.code.push(
            this.getIndent() + 'totalVolume -= positionInfo.Volume();'
        );
        this.decreaseIndent();
        this.decreaseIndent();
        this.code.push(this.getIndent() + '}');
        this.decreaseIndent();
        this.code.push(this.getIndent() + '}');
        this.decreaseIndent();
        this.code.push(this.getIndent() + '}');
        this.code.push('');
        this.code.push(this.getIndent() + 'return totalVolume;');
        this.decreaseIndent();
        this.code.push('}');
        this.code.push('');

        //generate position limit checking function
        this.code.push(
            '//+------------------------------------------------------------------+'
        );
        this.code.push(
            '//| Check if position is within limits                               |'
        );
        this.code.push(
            '//+------------------------------------------------------------------+'
        );
        this.code.push(
            'bool IsWithinPositionLimits(string symbol, double newVolume, bool isBuy)'
        );
        this.code.push('{');
        this.increaseIndent();
        this.code.push(
            this.getIndent() + 'double currentPos = GetCurrentPosition(symbol);'
        );
        this.code.push(
            this.getIndent() +
                'double projectedPos = currentPos + (isBuy ? newVolume : -newVolume);'
        );
        this.code.push('');

        //add position limit checks based on strategy
        for (const limit of ast.positionLimits) {
            const symbol = this.getSymbolString(limit.symbol);
            const max = limit.max.accept(this);
            const min = limit.min.accept(this);

            this.code.push(this.getIndent() + `if(symbol == ${symbol})`);
            this.code.push(this.getIndent() + '{');
            this.increaseIndent();
            this.code.push(
                this.getIndent() +
                    `if(projectedPos > ${max} || projectedPos < ${min})`
            );
            this.increaseIndent();
            this.code.push(this.getIndent() + 'return false;');
            this.decreaseIndent();
            this.decreaseIndent();
            this.code.push(this.getIndent() + '}');
        }

        this.code.push('');
        this.code.push(this.getIndent() + 'return true;');
        this.decreaseIndent();
        this.code.push('}');
    }

    //helper methods for MQL5 specific conversions
    private getSymbolString(symbol: string | VariableNode): string {
        if (typeof symbol === 'string') {
            return `"${symbol}"`;
        } else {
            const varName = symbol.name.replace('$', '');
            return varName;
        }
    }

    private getTimeframeString(timeframe: TimeframeNode): string {
        const periodMap: { [key: string]: string } = {
            minute: 'M',
            hour: 'H',
            day: 'D',
            month: 'MN',
        };

        const prefix = 'PERIOD_';
        const period = periodMap[timeframe.period] || 'H';
        const length = timeframe.length || 1;

        //special cases for common timeframes
        if (period === 'M' && length === 1) return 'PERIOD_M1';
        if (period === 'M' && length === 5) return 'PERIOD_M5';
        if (period === 'M' && length === 15) return 'PERIOD_M15';
        if (period === 'M' && length === 30) return 'PERIOD_M30';
        if (period === 'H' && length === 1) return 'PERIOD_H1';
        if (period === 'H' && length === 4) return 'PERIOD_H4';
        if (period === 'D' && length === 1) return 'PERIOD_D1';
        if (period === 'MN' && length === 1) return 'PERIOD_MN1';

        //default
        return `PERIOD_${period}${length}`;
    }

    private getPriceConstant(source: string): string {
        const priceMap: { [key: string]: string } = {
            open: 'PRICE_OPEN',
            high: 'PRICE_HIGH',
            low: 'PRICE_LOW',
            close: 'PRICE_CLOSE',
            hl2: 'PRICE_MEDIAN',
            hlc3: 'PRICE_TYPICAL',
            ohlc4: 'PRICE_WEIGHTED',
            volume: 'PRICE_CLOSE', //volume uses close price
        };

        return priceMap[source] || 'PRICE_CLOSE';
    }

    private extractVariables(ast: StrategyNode): void {
        //extract from data sources
        for (const dataSource of ast.dataSources) {
            if (dataSource.symbol instanceof VariableNode) {
                this.variables.add(dataSource.symbol.name.replace('$', ''));
            }
        }

        //extract from actions
        for (const action of ast.actions) {
            if (action.order.symbol instanceof VariableNode) {
                this.variables.add(action.order.symbol.name.replace('$', ''));
            }
            this.extractVariablesFromExpression(action.order.quantity);
            if ('limit_price' in action.order) {
                this.extractVariablesFromExpression(
                    (action.order as any).limit_price
                );
            }
        }

        //extract from position limits
        for (const limit of ast.positionLimits) {
            if (limit.symbol instanceof VariableNode) {
                this.variables.add(limit.symbol.name.replace('$', ''));
            }
            this.extractVariablesFromExpression(limit.max);
            this.extractVariablesFromExpression(limit.min);
        }
    }

    private extractVariablesFromExpression(expr: any): void {
        if (!expr) return;

        if (expr instanceof VariableNode) {
            this.variables.add(expr.name.replace('$', ''));
        } else if (expr instanceof BinaryOperationNode) {
            this.extractVariablesFromExpression(expr.left);
            this.extractVariablesFromExpression(expr.right);
        }
    }

    //visitor implementations
    visitStrategy(node: StrategyNode): string {
        return this.generate(node);
    }

    visitIndicator(node: IndicatorNode): string {
        const bufferName = this.indicatorBuffers.get(node.id);
        return `${bufferName}[0]`;
    }

    visitCandle(node: CandleNode): string {
        //in MT5, we access current candle data directly
        return `iClose(_Symbol, 0, 0)`; //default to close price
    }

    visitTimeframe(node: TimeframeNode): string {
        return this.getTimeframeString(node);
    }

    visitAction(node: ActionNode): string {
        return ''; //handled in generateActionExecution
    }

    visitMarketOrder(node: MarketOrderNode): string {
        return ''; //handled in generateActionExecution
    }

    visitLimitOrder(node: LimitOrderNode): string {
        return ''; //handled in generateActionExecution
    }

    visitRule(node: RuleNode): string {
        return ''; //handled in generateOnTick
    }

    visitPositionLimit(node: PositionLimitNode): string {
        return ''; //handled in helper functions
    }

    visitComparison(node: ComparisonNode): string {
        const left = node.left.accept(this);
        const right = node.right.accept(this);
        return `${left} ${node.operator} ${right}`;
    }

    visitLogicalOperation(node: LogicalOperationNode): string {
        const conditions = node.conditions.map((c) => `(${c.accept(this)})`);
        const op = node.operator === 'and' ? ' && ' : ' || ';
        return conditions.join(op);
    }

    visitCrossover(node: CrossoverNode): string {
        //for crossovers, we need to check current vs previous values
        const series1Current = node.series1.accept(this);
        const series2Current = node.series2.accept(this);

        //we'll need to store previous values - simplified version
        if (node.direction === 'above') {
            return `(${series1Current} > ${series2Current})`; //simplified
        } else {
            return `(${series1Current} < ${series2Current})`; //simplified
        }
    }

    visitLiteralNumber(node: LiteralNumberNode): string {
        return node.value.toString();
    }

    visitVariable(node: VariableNode): string {
        const varName = node.name.replace('$', '');
        return varName;
    }

    visitBinaryOperation(node: BinaryOperationNode): string {
        const left = node.left.accept(this);
        const right = node.right.accept(this);

        switch (node.operator) {
            case '+':
                return `(${left} + ${right})`;
            case '-':
                return `(${left} - ${right})`;
            case '*':
                return `(${left} * ${right})`;
            case '/':
                return `(${left} / ${right})`;
            case 'mod':
                return `MathMod(${left}, ${right})`;
            case 'pct':
                return `((${left} / 100.0) * ${right})`;
            default:
                return '0';
        }
    }

    visitIndicatorOutputRef(node: IndicatorOutputRefNode): string {
        const bufferName = this.indicatorBuffers.get(node.indicatorId);

        if (!bufferName) return '0';

        //handle different outputs for multi-output indicators
        if (node.output !== undefined) {
            const indicatorType = this.getIndicatorType(node.indicatorId);

            if (indicatorType === 'macd') {
                if (node.output === 'macd' || node.output === 0) {
                    return `${bufferName}[0]`;
                } else if (node.output === 'signal' || node.output === 1) {
                    return `${bufferName}_signal[0]`;
                } else if (node.output === 'histogram' || node.output === 2) {
                    return `${bufferName}_histogram[0]`;
                }
            } else if (indicatorType === 'bb') {
                if (node.output === 'upper' || node.output === 0) {
                    return `${bufferName}_upper[0]`;
                } else if (node.output === 'middle' || node.output === 1) {
                    return `${bufferName}_middle[0]`;
                } else if (node.output === 'lower' || node.output === 2) {
                    return `${bufferName}_lower[0]`;
                }
            }
        }

        return `${bufferName}[0]`;
    }

    visitCandleFieldRef(node: CandleFieldRefNode): string {
        //access current candle data
        switch (node.field) {
            case 'open':
                return 'iOpen(_Symbol, 0, 0)';
            case 'high':
                return 'iHigh(_Symbol, 0, 0)';
            case 'low':
                return 'iLow(_Symbol, 0, 0)';
            case 'close':
                return 'iClose(_Symbol, 0, 0)';
            case 'volume':
                return 'iVolume(_Symbol, 0, 0)';
            default:
                return 'iClose(_Symbol, 0, 0)';
        }
    }

    private getIndicatorType(indicatorId: string): string {
        //this would need to be tracked during parsing
        //for now, we'll check the buffer name patterns
        if (indicatorId.includes('macd')) return 'macd';
        if (indicatorId.includes('bb')) return 'bb';
        return 'default';
    }
}
