/**
 * Code Generators for converting AST to executable code
 */

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
} from './ast-node';

/**
 * Base code generator with common functionality
 */
export abstract class CodeGenerator<T> implements ASTVisitor<T> {
    protected indent: number = 0;
    protected indentSize: number = 4;

    protected getIndent(): string {
        return ' '.repeat(this.indent * this.indentSize);
    }

    protected increaseIndent(): void {
        this.indent++;
    }

    protected decreaseIndent(): void {
        this.indent = Math.max(0, this.indent - 1);
    }

    abstract generate(ast: StrategyNode): string;

    //abstract visitor methods
    abstract visitStrategy(node: StrategyNode): T;
    abstract visitIndicator(node: IndicatorNode): T;
    abstract visitCandle(node: CandleNode): T;
    abstract visitTimeframe(node: TimeframeNode): T;
    abstract visitAction(node: ActionNode): T;
    abstract visitMarketOrder(node: MarketOrderNode): T;
    abstract visitLimitOrder(node: LimitOrderNode): T;
    abstract visitRule(node: RuleNode): T;
    abstract visitPositionLimit(node: PositionLimitNode): T;
    abstract visitComparison(node: ComparisonNode): T;
    abstract visitLogicalOperation(node: LogicalOperationNode): T;
    abstract visitCrossover(node: CrossoverNode): T;
    abstract visitLiteralNumber(node: LiteralNumberNode): T;
    abstract visitVariable(node: VariableNode): T;
    abstract visitBinaryOperation(node: BinaryOperationNode): T;
    abstract visitIndicatorOutputRef(node: IndicatorOutputRefNode): T;
    abstract visitCandleFieldRef(node: CandleFieldRefNode): T;
}

/**
 * Python Code Generator
 */
export class PythonCodeGenerator extends CodeGenerator<string> {
    private code: string[] = [];

    generate(ast: StrategyNode): string {
        this.code = [];
        this.indent = 0;

        //generate header
        this.generateHeader();

        //visit strategy node
        ast.accept(this);

        return this.code.join('\n');
    }

    private generateHeader(): void {
        this.code.push('"""');
        this.code.push('Generated Trading Strategy');
        this.code.push('Generated at: ' + new Date().toISOString());
        this.code.push('"""');
        this.code.push('');
        this.code.push('import numpy as np');
        this.code.push('import pandas as pd');
        this.code.push('from typing import Dict, List, Optional, Tuple');
        this.code.push('from dataclasses import dataclass');
        this.code.push('from datetime import datetime');
        this.code.push('import talib');
        this.code.push('');
        this.code.push('');
    }

    visitStrategy(node: StrategyNode): string {
        this.code.push('@dataclass');
        this.code.push('class Position:');
        this.increaseIndent();
        this.code.push(this.getIndent() + 'symbol: str');
        this.code.push(this.getIndent() + 'quantity: float');
        this.code.push(this.getIndent() + 'average_price: float');
        this.code.push('');
        this.decreaseIndent();

        this.code.push('class ' + this.getStrategyClassName(node) + ':');
        this.increaseIndent();

        //generate docstring
        if (node.description) {
            this.code.push(this.getIndent() + '"""' + node.description + '"""');
            this.code.push('');
        }

        //generate __init__ method
        this.generateInitMethod(node);

        //generate indicator calculation methods
        this.generateIndicatorMethods(node);

        //generate rule evaluation method
        this.generateRuleEvaluationMethod(node);

        //generate order execution methods
        this.generateOrderMethods(node);

        //generate main execution method
        this.generateExecuteMethod(node);

        this.decreaseIndent();

        return this.code.join('\n');
    }

    private getStrategyClassName(node: StrategyNode): string {
        if (node.name) {
            return node.name.replace(/\s+/g, '') + 'Strategy';
        }
        return 'GeneratedStrategy';
    }

    private generateInitMethod(node: StrategyNode): void {
        this.code.push(
            this.getIndent() + 'def __init__(self, broker_api, **variables):'
        );
        this.increaseIndent();
        this.code.push(this.getIndent() + 'self.broker = broker_api');
        this.code.push(this.getIndent() + 'self.variables = variables');
        this.code.push(this.getIndent() + 'self.positions = {}');
        this.code.push(this.getIndent() + 'self.indicator_cache = {}');

        //initialize position limits
        this.code.push(this.getIndent() + 'self.position_limits = {');
        this.increaseIndent();
        for (const limit of node.positionLimits) {
            const symbol =
                limit.symbol instanceof VariableNode
                    ? `self.variables.get('${limit.symbol.name}')`
                    : `'${limit.symbol}'`;
            this.code.push(this.getIndent() + `${symbol}: {`);
            this.increaseIndent();
            this.code.push(
                this.getIndent() + `'min': ${limit.min.accept(this)},`
            );
            this.code.push(
                this.getIndent() + `'max': ${limit.max.accept(this)}`
            );
            this.decreaseIndent();
            this.code.push(this.getIndent() + '},');
        }
        this.decreaseIndent();
        this.code.push(this.getIndent() + '}');

        this.code.push('');
        this.decreaseIndent();
    }

    private generateIndicatorMethods(node: StrategyNode): void {
        const indicators = node.dataSources.filter(
            (ds: any) => ds instanceof IndicatorNode
        ) as IndicatorNode[];

        for (const indicator of indicators) {
            this.code.push(
                this.getIndent() + `def calculate_${indicator.id}(self, data):`
            );
            this.increaseIndent();

            //generate indicator calculation based on type
            switch (indicator.indicatorType) {
                case 'sma':
                    const period = indicator.params.get('period') || 20;
                    const source = indicator.params.get('source') || 'close';
                    this.code.push(
                        this.getIndent() +
                            `return talib.SMA(data['${source}'], timeperiod=${period})`
                    );
                    break;

                case 'ema':
                    const emaPeriod = indicator.params.get('period') || 20;
                    const emaSource = indicator.params.get('source') || 'close';
                    this.code.push(
                        this.getIndent() +
                            `return talib.EMA(data['${emaSource}'], timeperiod=${emaPeriod})`
                    );
                    break;

                case 'macd':
                    const fastPeriod =
                        indicator.params.get('fast_period') || 12;
                    const slowPeriod =
                        indicator.params.get('slow_period') || 26;
                    const signalPeriod =
                        indicator.params.get('signal_period') || 9;
                    const macdSource =
                        indicator.params.get('source') || 'close';
                    this.code.push(
                        this.getIndent() +
                            `macd, signal, histogram = talib.MACD(data['${macdSource}'], ` +
                            `fastperiod=${fastPeriod}, slowperiod=${slowPeriod}, signalperiod=${signalPeriod})`
                    );
                    this.code.push(
                        this.getIndent() +
                            'return {"macd": macd, "signal": signal, "histogram": histogram}'
                    );
                    break;

                default:
                    this.code.push(
                        this.getIndent() +
                            '# TODO: Implement ' +
                            indicator.indicatorType
                    );
                    this.code.push(
                        this.getIndent() + 'raise NotImplementedError()'
                    );
            }

            this.code.push('');
            this.decreaseIndent();
        }
    }

    private generateRuleEvaluationMethod(node: StrategyNode): void {
        this.code.push(this.getIndent() + 'def evaluate_rules(self, context):');
        this.increaseIndent();
        this.code.push(this.getIndent() + 'actions_to_execute = []');
        this.code.push('');

        for (let i = 0; i < node.rules.length; i++) {
            const rule = node.rules[i];
            this.code.push(this.getIndent() + '# Rule ' + (i + 1));
            this.code.push(
                this.getIndent() + 'if ' + rule.condition.accept(this) + ':'
            );
            this.increaseIndent();
            for (const actionId of rule.thenActions) {
                this.code.push(
                    this.getIndent() +
                        `actions_to_execute.append('${actionId}')`
                );
            }
            this.decreaseIndent();

            if (rule.elseActions && rule.elseActions.length > 0) {
                this.code.push(this.getIndent() + 'else:');
                this.increaseIndent();
                for (const actionId of rule.elseActions) {
                    this.code.push(
                        this.getIndent() +
                            `actions_to_execute.append('${actionId}')`
                    );
                }
                this.decreaseIndent();
            }
            this.code.push('');
        }

        this.code.push(this.getIndent() + 'return actions_to_execute');
        this.code.push('');
        this.decreaseIndent();
    }

    private generateOrderMethods(node: StrategyNode): void {
        this.code.push(
            this.getIndent() + 'def execute_action(self, action_id):'
        );
        this.increaseIndent();
        this.code.push(this.getIndent() + 'actions = {');
        this.increaseIndent();

        for (const action of node.actions) {
            this.code.push(
                this.getIndent() +
                    `'${action.id}': lambda: ${action.order.accept(this)},`
            );
        }

        this.decreaseIndent();
        this.code.push(this.getIndent() + '}');
        this.code.push('');
        this.code.push(this.getIndent() + 'if action_id in actions:');
        this.increaseIndent();
        this.code.push(this.getIndent() + 'return actions[action_id]()');
        this.decreaseIndent();
        this.code.push(this.getIndent() + 'return None');
        this.code.push('');
        this.decreaseIndent();
    }

    private generateExecuteMethod(node: StrategyNode): void {
        this.code.push(this.getIndent() + 'def execute(self, market_data):');
        this.increaseIndent();
        this.code.push(
            this.getIndent() + '"""Main execution method called on each tick"""'
        );
        this.code.push(this.getIndent() + '# Calculate indicators');

        const indicators = node.dataSources.filter(
            (ds: any) => ds instanceof IndicatorNode
        ) as IndicatorNode[];
        for (const indicator of indicators) {
            this.code.push(
                this.getIndent() +
                    `self.indicator_cache['${indicator.id}'] = self.calculate_${indicator.id}(market_data)`
            );
        }

        this.code.push('');
        this.code.push(this.getIndent() + '# Build execution context');
        this.code.push(this.getIndent() + 'context = {');
        this.increaseIndent();
        this.code.push(
            this.getIndent() + "'indicator_values': self.indicator_cache,"
        );
        this.code.push(this.getIndent() + "'positions': self.positions,");
        this.code.push(this.getIndent() + "'variables': self.variables,");
        this.code.push(this.getIndent() + "'current_candles': market_data");
        this.decreaseIndent();
        this.code.push(this.getIndent() + '}');

        this.code.push('');
        this.code.push(this.getIndent() + '# Evaluate rules and get actions');
        this.code.push(
            this.getIndent() + 'actions = self.evaluate_rules(context)'
        );

        this.code.push('');
        this.code.push(this.getIndent() + '# Execute actions');
        this.code.push(this.getIndent() + 'for action_id in actions:');
        this.increaseIndent();
        this.code.push(this.getIndent() + 'self.execute_action(action_id)');
        this.decreaseIndent();

        this.code.push('');
        this.decreaseIndent();
    }

    //visitor implementations for other nodes
    visitIndicator(node: IndicatorNode): string {
        return `self.indicator_cache.get('${node.id}')`;
    }

    visitCandle(node: CandleNode): string {
        return `market_data['${node.id}']`;
    }

    visitTimeframe(node: TimeframeNode): string {
        return `'${node.length}${node.period}'`;
    }

    visitAction(node: ActionNode): string {
        return `execute_${node.id}()`;
    }

    visitMarketOrder(node: MarketOrderNode): string {
        const symbol =
            node.symbol instanceof VariableNode
                ? `self.variables.get('${node.symbol.name}')`
                : `'${node.symbol}'`;

        return `self.broker.place_order({
            'type': 'market',
            'symbol': ${symbol},
            'side': '${node.side}',
            'quantity': ${node.quantity.accept(this)},
            'tif': '${node.tif}'
        })`;
    }

    visitLimitOrder(node: LimitOrderNode): string {
        const symbol =
            node.symbol instanceof VariableNode
                ? `self.variables.get('${node.symbol.name}')`
                : `'${node.symbol}'`;

        return `self.broker.place_order({
            'type': 'limit',
            'symbol': ${symbol},
            'side': '${node.side}',
            'quantity': ${node.quantity.accept(this)},
            'limit_price': ${node.limitPrice.accept(this)},
            'tif': '${node.tif}'
        })`;
    }

    visitRule(node: RuleNode): string {
        return ''; //handled in generateRuleEvaluationMethod
    }

    visitPositionLimit(node: PositionLimitNode): string {
        return ''; //handled in generateInitMethod
    }

    visitComparison(node: ComparisonNode): string {
        const left = node.left.accept(this);
        const right = node.right.accept(this);
        const op = node.operator === '==' ? '==' : node.operator;
        return `(${left} ${op} ${right})`;
    }

    visitLogicalOperation(node: LogicalOperationNode): string {
        const conditions = node.conditions.map((c) => c.accept(this));
        const op = node.operator === 'and' ? ' and ' : ' or ';
        return `(${conditions.join(op)})`;
    }

    visitCrossover(node: CrossoverNode): string {
        //for Python, we need to check previous values
        const series1 = node.series1.accept(this);
        const series2 = node.series2.accept(this);

        if (node.direction === 'above') {
            return `(${series1}[-1] > ${series2}[-1] and ${series1}[-2] <= ${series2}[-2])`;
        } else {
            return `(${series1}[-1] < ${series2}[-1] and ${series1}[-2] >= ${series2}[-2])`;
        }
    }

    visitLiteralNumber(node: LiteralNumberNode): string {
        return node.value.toString();
    }

    visitVariable(node: VariableNode): string {
        return `self.variables.get('${node.name}', 0)`;
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
                return `(${left} % ${right})`;
            case 'pct':
                return `((${left} / 100) * ${right})`;
            default:
                return '0';
        }
    }

    visitIndicatorOutputRef(node: IndicatorOutputRefNode): string {
        if (node.output !== undefined) {
            if (typeof node.output === 'string') {
                return `self.indicator_cache['${node.indicatorId}']['${node.output}']`;
            } else {
                return `self.indicator_cache['${node.indicatorId}'][${node.output}]`;
            }
        }
        return `self.indicator_cache['${node.indicatorId}']`;
    }

    visitCandleFieldRef(node: CandleFieldRefNode): string {
        return `market_data['${node.candleId}']['${node.field}']`;
    }
}

/**
 * JavaScript Code Generator
 */
export class JavaScriptCodeGenerator extends CodeGenerator<string> {
    private code: string[] = [];

    generate(ast: StrategyNode): string {
        this.code = [];
        this.indent = 0;

        //generate header
        this.generateHeader();

        //visit strategy node
        ast.accept(this);

        return this.code.join('\n');
    }

    private generateHeader(): void {
        this.code.push('/**');
        this.code.push(' * Generated Trading Strategy');
        this.code.push(' * Generated at: ' + new Date().toISOString());
        this.code.push(' */');
        this.code.push('');
        this.code.push("const talib = require('talib');");
        this.code.push('');
    }

    visitStrategy(node: StrategyNode): string {
        const className = this.getStrategyClassName(node);

        this.code.push(`class ${className} {`);
        this.increaseIndent();

        //constructor
        this.generateConstructor(node);

        //indicator calculation methods
        this.generateIndicatorMethodsJS(node);

        //rule evaluation
        this.generateRuleEvaluationJS(node);

        //order execution
        this.generateOrderMethodsJS(node);

        //Main execution method
        this.generateExecuteMethodJS(node);

        this.decreaseIndent();
        this.code.push('}');
        this.code.push('');
        this.code.push(`module.exports = ${className};`);

        return this.code.join('\n');
    }

    private getStrategyClassName(node: StrategyNode): string {
        if (node.name) {
            return node.name.replace(/\s+/g, '') + 'Strategy';
        }
        return 'GeneratedStrategy';
    }

    private generateConstructor(node: StrategyNode): void {
        this.code.push(
            this.getIndent() + 'constructor(brokerApi, variables = {}) {'
        );
        this.increaseIndent();
        this.code.push(this.getIndent() + 'this.broker = brokerApi;');
        this.code.push(this.getIndent() + 'this.variables = variables;');
        this.code.push(this.getIndent() + 'this.positions = {};');
        this.code.push(this.getIndent() + 'this.indicatorCache = {};');

        //position limits
        this.code.push(this.getIndent() + 'this.positionLimits = {');
        this.increaseIndent();
        for (const limit of node.positionLimits) {
            const symbol =
                limit.symbol instanceof VariableNode
                    ? `[this.variables['${limit.symbol.name}']]`
                    : `'${limit.symbol}'`;
            this.code.push(this.getIndent() + `${symbol}: {`);
            this.increaseIndent();
            this.code.push(
                this.getIndent() + `min: ${limit.min.accept(this)},`
            );
            this.code.push(this.getIndent() + `max: ${limit.max.accept(this)}`);
            this.decreaseIndent();
            this.code.push(this.getIndent() + '},');
        }
        this.decreaseIndent();
        this.code.push(this.getIndent() + '};');
        this.code.push(this.getIndent() + '}');
        this.code.push('');
        this.decreaseIndent();
    }

    private generateIndicatorMethodsJS(node: StrategyNode): void {
        const indicators = node.dataSources.filter(
            (ds: any) => ds instanceof IndicatorNode
        ) as IndicatorNode[];

        for (const indicator of indicators) {
            this.code.push(
                this.getIndent() + `calculate_${indicator.id}(data) {`
            );
            this.increaseIndent();

            //generate based on indicator type
            switch (indicator.indicatorType) {
                case 'sma':
                    const period = indicator.params.get('period') || 20;
                    const source = indicator.params.get('source') || 'close';
                    this.code.push(
                        this.getIndent() +
                            `return talib.SMA(data['${source}'], ${period});`
                    );
                    break;

                case 'macd':
                    const fastPeriod =
                        indicator.params.get('fast_period') || 12;
                    const slowPeriod =
                        indicator.params.get('slow_period') || 26;
                    const signalPeriod =
                        indicator.params.get('signal_period') || 9;
                    const macdSource =
                        indicator.params.get('source') || 'close';
                    this.code.push(
                        this.getIndent() +
                            `const result = talib.MACD(data['${macdSource}'], ${fastPeriod}, ${slowPeriod}, ${signalPeriod});`
                    );
                    this.code.push(
                        this.getIndent() +
                            'return { macd: result.outMACD, signal: result.outMACDSignal, histogram: result.outMACDHist };'
                    );
                    break;

                default:
                    this.code.push(
                        this.getIndent() +
                            '//tODO: Implement ' +
                            indicator.indicatorType
                    );
                    this.code.push(
                        this.getIndent() + 'throw new Error("Not implemented");'
                    );
            }

            this.decreaseIndent();
            this.code.push(this.getIndent() + '}');
            this.code.push('');
        }
    }

    private generateRuleEvaluationJS(node: StrategyNode): void {
        this.code.push(this.getIndent() + 'evaluateRules(context) {');
        this.increaseIndent();
        this.code.push(this.getIndent() + 'const actionsToExecute = [];');
        this.code.push('');

        for (let i = 0; i < node.rules.length; i++) {
            const rule = node.rules[i];
            this.code.push(this.getIndent() + '//rule ' + (i + 1));
            this.code.push(
                this.getIndent() + 'if (' + rule.condition.accept(this) + ') {'
            );
            this.increaseIndent();
            for (const actionId of rule.thenActions) {
                this.code.push(
                    this.getIndent() + `actionsToExecute.push('${actionId}');`
                );
            }
            this.decreaseIndent();

            if (rule.elseActions && rule.elseActions.length > 0) {
                this.code.push(this.getIndent() + '} else {');
                this.increaseIndent();
                for (const actionId of rule.elseActions) {
                    this.code.push(
                        this.getIndent() +
                            `actionsToExecute.push('${actionId}');`
                    );
                }
                this.decreaseIndent();
            }
            this.code.push(this.getIndent() + '}');
            this.code.push('');
        }

        this.code.push(this.getIndent() + 'return actionsToExecute;');
        this.decreaseIndent();
        this.code.push(this.getIndent() + '}');
        this.code.push('');
    }

    private generateOrderMethodsJS(node: StrategyNode): void {
        this.code.push(this.getIndent() + 'async executeAction(actionId) {');
        this.increaseIndent();
        this.code.push(this.getIndent() + 'switch(actionId) {');
        this.increaseIndent();

        for (const action of node.actions) {
            this.code.push(this.getIndent() + `case '${action.id}':`);
            this.increaseIndent();
            this.code.push(
                this.getIndent() + 'return ' + action.order.accept(this) + ';'
            );
            this.decreaseIndent();
        }

        this.code.push(this.getIndent() + 'default:');
        this.increaseIndent();
        this.code.push(this.getIndent() + 'return null;');
        this.decreaseIndent();

        this.decreaseIndent();
        this.code.push(this.getIndent() + '}');
        this.decreaseIndent();
        this.code.push(this.getIndent() + '}');
        this.code.push('');
    }

    private generateExecuteMethodJS(node: StrategyNode): void {
        this.code.push(this.getIndent() + 'async execute(marketData) {');
        this.increaseIndent();

        //calculate indicators
        this.code.push(this.getIndent() + '//calculate indicators');
        const indicators = node.dataSources.filter(
            (ds: any) => ds instanceof IndicatorNode
        ) as IndicatorNode[];
        for (const indicator of indicators) {
            this.code.push(
                this.getIndent() +
                    `this.indicatorCache['${indicator.id}'] = this.calculate_${indicator.id}(marketData);`
            );
        }

        this.code.push('');
        this.code.push(this.getIndent() + '//build execution context');
        this.code.push(this.getIndent() + 'const context = {');
        this.increaseIndent();
        this.code.push(
            this.getIndent() + 'indicatorValues: this.indicatorCache,'
        );
        this.code.push(this.getIndent() + 'positions: this.positions,');
        this.code.push(this.getIndent() + 'variables: this.variables,');
        this.code.push(this.getIndent() + 'currentCandles: marketData');
        this.decreaseIndent();
        this.code.push(this.getIndent() + '};');

        this.code.push('');
        this.code.push(this.getIndent() + '//evaluate rules');
        this.code.push(
            this.getIndent() + 'const actions = this.evaluateRules(context);'
        );

        this.code.push('');
        this.code.push(this.getIndent() + '//execute actions');
        this.code.push(this.getIndent() + 'for (const actionId of actions) {');
        this.increaseIndent();
        this.code.push(
            this.getIndent() + 'await this.executeAction(actionId);'
        );
        this.decreaseIndent();
        this.code.push(this.getIndent() + '}');

        this.decreaseIndent();
        this.code.push(this.getIndent() + '}');
    }

    //visitor implementations
    visitIndicator(node: IndicatorNode): string {
        return `this.indicatorCache['${node.id}']`;
    }

    visitCandle(node: CandleNode): string {
        return `marketData['${node.id}']`;
    }

    visitTimeframe(node: TimeframeNode): string {
        return `'${node.length}${node.period}'`;
    }

    visitAction(node: ActionNode): string {
        return `execute_${node.id}()`;
    }

    visitMarketOrder(node: MarketOrderNode): string {
        const symbol =
            node.symbol instanceof VariableNode
                ? `this.variables['${node.symbol.name}']`
                : `'${node.symbol}'`;

        return `this.broker.placeOrder({
            type: 'market',
            symbol: ${symbol},
            side: '${node.side}',
            quantity: ${node.quantity.accept(this)},
            tif: '${node.tif}'
        })`;
    }

    visitLimitOrder(node: LimitOrderNode): string {
        const symbol =
            node.symbol instanceof VariableNode
                ? `this.variables['${node.symbol.name}']`
                : `'${node.symbol}'`;

        return `this.broker.placeOrder({
            type: 'limit',
            symbol: ${symbol},
            side: '${node.side}',
            quantity: ${node.quantity.accept(this)},
            limitPrice: ${node.limitPrice.accept(this)},
            tif: '${node.tif}'
        })`;
    }

    visitRule(node: RuleNode): string {
        return ''; //handled elsewhere
    }

    visitPositionLimit(node: PositionLimitNode): string {
        return ''; //handled elsewhere
    }

    visitComparison(node: ComparisonNode): string {
        const left = node.left.accept(this);
        const right = node.right.accept(this);
        const op = node.operator === '==' ? '===' : node.operator;
        return `(${left} ${op} ${right})`;
    }

    visitLogicalOperation(node: LogicalOperationNode): string {
        const conditions = node.conditions.map((c) => c.accept(this));
        const op = node.operator === 'and' ? ' && ' : ' || ';
        return `(${conditions.join(op)})`;
    }

    visitCrossover(node: CrossoverNode): string {
        const series1 = node.series1.accept(this);
        const series2 = node.series2.accept(this);

        //simplified for JavaScript - would need historical data tracking
        if (node.direction === 'above') {
            return `(${series1} > ${series2})`;
        } else {
            return `(${series1} < ${series2})`;
        }
    }

    visitLiteralNumber(node: LiteralNumberNode): string {
        return node.value.toString();
    }

    visitVariable(node: VariableNode): string {
        return `(this.variables['${node.name}'] || 0)`;
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
                return `(${left} % ${right})`;
            case 'pct':
                return `((${left} / 100) * ${right})`;
            default:
                return '0';
        }
    }

    visitIndicatorOutputRef(node: IndicatorOutputRefNode): string {
        if (node.output !== undefined) {
            if (typeof node.output === 'string') {
                return `this.indicatorCache['${node.indicatorId}']['${node.output}']`;
            } else {
                return `this.indicatorCache['${node.indicatorId}'][${node.output}]`;
            }
        }
        return `this.indicatorCache['${node.indicatorId}']`;
    }

    visitCandleFieldRef(node: CandleFieldRefNode): string {
        return `marketData['${node.candleId}']['${node.field}']`;
    }
}
