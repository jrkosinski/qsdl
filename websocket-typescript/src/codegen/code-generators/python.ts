import { CodeGenerator } from '.';
import {
    ActionNode,
    BinaryOperationNode,
    CandleFieldRefNode,
    CandleNode,
    ComparisonNode,
    CrossoverNode,
    IndicatorNode,
    IndicatorOutputRefNode,
    LimitOrderNode,
    LiteralNumberNode,
    LogicalOperationNode,
    MarketOrderNode,
    PositionLimitNode,
    RuleNode,
    StrategyNode,
    TimeframeNode,
    VariableNode,
} from '../ast-node';

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
