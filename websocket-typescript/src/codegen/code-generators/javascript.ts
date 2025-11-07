/**
 * Code Generators for converting AST to executable code
 */

import { CodeGenerator } from '.';
import {
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

/**
 * JavaScript Code Generator
 */
export class JavaScriptCodeGenerator extends CodeGenerator<string> {
    generate(ast: StrategyNode): string {
        this.code = [];
        this.indent = 0;

        //generate header
        this.generateHeader();

        //visit strategy node
        ast.accept(this);

        return this.code.join('\n');
    }

    private generateHeader() {
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

    private generateConstructor(node: StrategyNode) {
        this.code.push(
            this.getIndent() + 'constructor(brokerApi, variables = {}) {'
        );
        this.increaseIndent();
        this.addCodeLine('this.broker = brokerApi;');
        this.addCodeLine('this.variables = variables;');
        this.addCodeLine('this.positions = {};');
        this.addCodeLine('this.indicatorCache = {};');

        //position limits
        this.addCodeLine('this.positionLimits = {');
        this.increaseIndent();
        for (const limit of node.positionLimits) {
            const symbol =
                limit.symbol instanceof VariableNode
                    ? `[this.variables['${limit.symbol.name}']]`
                    : `'${limit.symbol}'`;
            this.addCodeLine(`${symbol}: {`);
            this.increaseIndent();
            this.code.push(
                this.getIndent() + `min: ${limit.min.accept(this)},`
            );
            this.addCodeLine(`max: ${limit.max.accept(this)}`);
            this.decreaseIndent();
            this.addCodeLine('},');
        }
        this.decreaseIndent();
        this.addCodeLine('};');
        this.addCodeLine('}');
        this.code.push('');
        this.decreaseIndent();
    }

    private generateIndicatorMethodsJS(node: StrategyNode) {
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
            this.addCodeLine('}');
            this.code.push('');
        }
    }

    private generateRuleEvaluationJS(node: StrategyNode) {
        this.addCodeLine('evaluateRules(context) {');
        this.increaseIndent();
        this.addCodeLine('const actionsToExecute = [];');
        this.code.push('');

        for (let i = 0; i < node.rules.length; i++) {
            const rule = node.rules[i];
            this.addCodeLine('//rule ' + (i + 1));
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
                this.addCodeLine('} else {');
                this.increaseIndent();
                for (const actionId of rule.elseActions) {
                    this.code.push(
                        this.getIndent() +
                            `actionsToExecute.push('${actionId}');`
                    );
                }
                this.decreaseIndent();
            }
            this.addCodeLine('}');
            this.code.push('');
        }

        this.addCodeLine('return actionsToExecute;');
        this.decreaseIndent();
        this.addCodeLine('}');
        this.code.push('');
    }

    private generateOrderMethodsJS(node: StrategyNode) {
        this.addCodeLine('async executeAction(actionId) {');
        this.increaseIndent();
        this.addCodeLine('switch(actionId) {');
        this.increaseIndent();

        for (const action of node.actions) {
            this.addCodeLine(`case '${action.id}':`);
            this.increaseIndent();
            this.code.push(
                this.getIndent() + 'return ' + action.order.accept(this) + ';'
            );
            this.decreaseIndent();
        }

        this.addCodeLine('default:');
        this.increaseIndent();
        this.addCodeLine('return null;');
        this.decreaseIndent();

        this.decreaseIndent();
        this.addCodeLine('}');
        this.decreaseIndent();
        this.addCodeLine('}');
        this.code.push('');
    }

    private generateExecuteMethodJS(node: StrategyNode) {
        this.addCodeLine('async execute(marketData) {');
        this.increaseIndent();

        //calculate indicators
        this.addCodeLine('//calculate indicators');
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
        this.addCodeLine('//build execution context');
        this.addCodeLine('const context = {');
        this.increaseIndent();
        this.code.push(
            this.getIndent() + 'indicatorValues: this.indicatorCache,'
        );
        this.addCodeLine('positions: this.positions,');
        this.addCodeLine('variables: this.variables,');
        this.addCodeLine('currentCandles: marketData');
        this.decreaseIndent();
        this.addCodeLine('};');

        this.code.push('');
        this.addCodeLine('//evaluate rules');
        this.code.push(
            this.getIndent() + 'const actions = this.evaluateRules(context);'
        );

        this.code.push('');
        this.addCodeLine('//execute actions');
        this.addCodeLine('for (const actionId of actions) {');
        this.increaseIndent();
        this.code.push(
            this.getIndent() + 'await this.executeAction(actionId);'
        );
        this.decreaseIndent();
        this.addCodeLine('}');

        this.decreaseIndent();
        this.addCodeLine('}');
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
