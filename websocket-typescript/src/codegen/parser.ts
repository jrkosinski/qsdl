/**
 * Parser for converting JSON Strategy to AST
 */

import {
    //aST Nodes
    StrategyNode,
    DataSourceNode,
    IndicatorNode,
    CandleNode,
    TimeframeNode,
    ActionNode,
    OrderNode,
    MarketOrderNode,
    LimitOrderNode,
    RuleNode,
    PositionLimitNode,

    //expression Nodes
    ExpressionNode,
    LiteralNumberNode,
    VariableNode,
    BinaryOperationNode,
    IndicatorOutputRefNode,
    CandleFieldRefNode,

    //condition Nodes
    ConditionNode,
    ComparisonNode,
    LogicalOperationNode,
    CrossoverNode,

    //context
    ValidationContext,
    ValidationResult,
    ValidationError,
    ValidationWarning,
} from './ast-node';

//import the original interface definitions
import type {
    strategy,
    data_source,
    data_indicator,
    data_candle,
    timeframe,
    action,
    rule,
    position_limit,
    condition,
    comparison,
    operation,
    numeric_expression,
    indicator_output_ref,
    candle_field_ref,
    numeric_value,
    string_value,
    numeric_variable,
    string_variable,
    stock_order,
    market_order,
    limit_order,
    //add other order types as needed
} from '../schema/schemaCode_v0.1.3';

export class StrategyParser {
    private indicatorRegistry: Map<string, any>;
    private validationContext: ValidationContext;

    constructor(indicatorRegistry: Map<string, any> = new Map()) {
        this.indicatorRegistry = indicatorRegistry;
        this.validationContext = {
            indicatorRegistry: this.indicatorRegistry,
            definedDataSources: new Map(),
            definedActions: new Map(),
            errors: [],
            warnings: [],
        };
    }

    /**
     * Parse a JSON strategy object into an AST
     */
    public parseStrategy(json: strategy): StrategyNode {
        //reset validation context for new strategy
        this.validationContext = {
            indicatorRegistry: this.indicatorRegistry,
            definedDataSources: new Map(),
            definedActions: new Map(),
            errors: [],
            warnings: [],
        };

        //parse data sources
        const dataSources = this.parseDataSources(json.data);

        //parse actions
        const actions = this.parseActions(json.actions);

        //parse rules
        const rules = this.parseRules(json.rules);

        //parse position limits
        const positionLimits = this.parsePositionLimits(json.position_limits);

        //create strategy node
        const strategyNode = new StrategyNode(
            json.name,
            json.description,
            dataSources,
            actions,
            rules,
            positionLimits
        );

        return strategyNode;
    }

    /**
     * Parse data sources (indicators and candles)
     */
    private parseDataSources(sources: data_source[]): DataSourceNode[] {
        const nodes: DataSourceNode[] = [];

        for (const source of sources) {
            const node = this.parseDataSource(source);
            nodes.push(node);

            //register for validation
            this.validationContext.definedDataSources.set(source.id, node);
        }

        return nodes;
    }

    private parseDataSource(source: data_source): DataSourceNode {
        const symbol = this.parseStringValue(source.symbol);
        const timeframe = this.parseTimeframe(source.timeframe);

        if (source.type === 'indicator') {
            const indicator = source as data_indicator;
            const params = new Map<string, any>();

            //convert params object to Map
            for (const [key, value] of Object.entries(indicator.params)) {
                params.set(key, value);
            }

            return new IndicatorNode(
                source.id,
                symbol,
                timeframe,
                indicator.indicator_type,
                params,
                source.offset
            );
        } else if (source.type === 'candle') {
            return new CandleNode(source.id, symbol, timeframe, source.offset);
        } else {
            throw new Error(
                `Unknown data source type: ${(source as any).type}`
            );
        }
    }

    private parseTimeframe(tf: timeframe): TimeframeNode {
        return new TimeframeNode(tf.period, tf.length || 1);
    }

    /**
     * Parse actions
     */
    private parseActions(actions: action[]): ActionNode[] {
        const nodes: ActionNode[] = [];

        for (const action of actions) {
            const orderNode = this.parseOrder(action.order);
            const actionNode = new ActionNode(action.id, orderNode);
            nodes.push(actionNode);

            //register for validation
            this.validationContext.definedActions.set(action.id, actionNode);
        }

        return nodes;
    }

    private parseOrder(order: stock_order): OrderNode {
        const symbol = this.parseStringValue(order.symbol);
        const quantity = this.parseNumericExpression(order.quantity);

        switch (order.type) {
            case 'market':
                return new MarketOrderNode(
                    symbol,
                    order.side,
                    quantity,
                    order.tif
                );

            case 'limit':
                const limitOrder = order as limit_order;
                return new LimitOrderNode(
                    symbol,
                    order.side,
                    quantity,
                    order.tif,
                    this.parseNumericExpression(limitOrder.limit_price)
                );

            //add other order types as needed
            default:
                throw new Error(`Unsupported order type: ${order.type}`);
        }
    }

    /**
     * Parse rules
     */
    private parseRules(rules: rule[]): RuleNode[] {
        return rules.map((rule) => this.parseRule(rule));
    }

    private parseRule(rule: rule): RuleNode {
        const condition = this.parseCondition(rule.if);
        return new RuleNode(condition, rule.then, rule.else);
    }

    /**
     * Parse conditions (boolean logic)
     */
    private parseCondition(cond: condition): ConditionNode {
        //check for expression (comparison)
        if ('expression' in cond && cond.expression) {
            return this.parseComparison(cond.expression);
        }

        //check for AND operation
        if ('and' in cond && cond.and) {
            const conditions = cond.and.map((c) => {
                //check if it's a direct comparison or nested condition
                if ('operandA' in c && 'operandB' in c && 'operator' in c) {
                    return this.parseComparison(c as comparison);
                } else {
                    return this.parseCondition(c as condition);
                }
            });
            return new LogicalOperationNode('and', conditions);
        }

        //check for OR operation
        if ('or' in cond && cond.or) {
            const conditions = cond.or.map((c) => {
                //check if it's a direct comparison or nested condition
                if ('operandA' in c && 'operandB' in c && 'operator' in c) {
                    return this.parseComparison(c as comparison);
                } else {
                    return this.parseCondition(c as condition);
                }
            });
            return new LogicalOperationNode('or', conditions);
        }

        throw new Error('Invalid condition: must have expression, and, or or');
    }

    private parseComparison(comp: comparison): ComparisonNode {
        const left = this.parseNumericExpression(comp.operandA);
        const right = this.parseNumericExpression(comp.operandB);

        return new ComparisonNode(comp.operator, left, right);
    }

    /**
     * Parse numeric expressions
     */
    public parseNumericExpression(expr: numeric_expression): ExpressionNode {
        //check if it's a simple value
        if (typeof expr === 'number') {
            return new LiteralNumberNode(expr);
        }

        //check if it's a variable
        if (this.isVariable(expr)) {
            const varExpr = expr as numeric_variable;
            return new VariableNode(varExpr.var);
        }

        //check if it's an operation
        if (this.isOperation(expr)) {
            const op = expr as operation;
            return new BinaryOperationNode(
                op.operator as any,
                this.parseNumericExpression(op.operandA),
                this.parseNumericExpression(op.operandB)
            );
        }

        //check if it's an indicator output reference
        if (this.isIndicatorOutputRef(expr)) {
            const ref = expr as indicator_output_ref;
            return new IndicatorOutputRefNode(ref.indicator_id, ref.output);
        }

        //check if it's a candle field reference
        if (this.isCandleFieldRef(expr)) {
            const ref = expr as candle_field_ref;
            return new CandleFieldRefNode(ref.candle_id, ref.field);
        }

        throw new Error(
            `Unknown numeric expression type: ${JSON.stringify(expr)}`
        );
    }

    /**
     * Parse position limits
     */
    private parsePositionLimits(limits: position_limit[]): PositionLimitNode[] {
        return limits.map((limit) => this.parsePositionLimit(limit));
    }

    private parsePositionLimit(limit: position_limit): PositionLimitNode {
        const symbol = this.parseStringValue(limit.symbol);
        const max = this.parseNumericExpression(limit.max);
        const min = this.parseNumericExpression(limit.min);

        return new PositionLimitNode(symbol, max, min);
    }

    /**
     * Helper methods for type checking
     */
    private parseStringValue(value: string_value): string | VariableNode {
        if (typeof value === 'string') {
            return value;
        }

        if (this.isStringVariable(value)) {
            return new VariableNode((value as string_variable).var);
        }

        throw new Error(`Invalid string value: ${JSON.stringify(value)}`);
    }

    private isVariable(expr: any): boolean {
        return typeof expr === 'object' && 'var' in expr;
    }

    private isStringVariable(value: any): boolean {
        return typeof value === 'object' && 'var' in value;
    }

    private isOperation(expr: any): boolean {
        return (
            typeof expr === 'object' &&
            'operator' in expr &&
            'operandA' in expr &&
            'operandB' in expr
        );
    }

    private isIndicatorOutputRef(expr: any): boolean {
        return typeof expr === 'object' && 'indicator_id' in expr;
    }

    private isCandleFieldRef(expr: any): boolean {
        return (
            typeof expr === 'object' && 'candle_id' in expr && 'field' in expr
        );
    }

    /**
     * Validate the parsed AST
     */
    public validate(ast: StrategyNode): ValidationResult {
        return ast.validate(this.validationContext);
    }

    /**
     * Parse and validate in one step
     */
    public parseAndValidate(json: strategy): {
        ast: StrategyNode;
        validation: ValidationResult;
    } {
        const ast = this.parseStrategy(json);
        const validation = this.validate(ast);

        return { ast, validation };
    }
}

/**
 * Helper class for detecting and parsing crossovers
 */
export class CrossoverDetector {
    /**
     * Detect if a condition represents a crossover and convert it
     */
    static detectCrossover(
        current: comparison,
        previous: comparison
    ): CrossoverNode | null {
        //check if we're comparing the same indicators/values
        if (
            !this.isSameExpression(current.operandA, previous.operandA) ||
            !this.isSameExpression(current.operandB, previous.operandB)
        ) {
            return null;
        }

        //detect bullish crossover (current > and previous <=)
        if (
            current.operator === '>' &&
            (previous.operator === '<=' || previous.operator === '<')
        ) {
            const parser = new StrategyParser();
            return new CrossoverNode(
                parser.parseNumericExpression(current.operandA),
                parser.parseNumericExpression(current.operandB),
                'above'
            );
        }

        //detect bearish crossover (current < and previous >=)
        if (
            current.operator === '<' &&
            (previous.operator === '>=' || previous.operator === '>')
        ) {
            const parser = new StrategyParser();
            return new CrossoverNode(
                parser.parseNumericExpression(current.operandA),
                parser.parseNumericExpression(current.operandB),
                'below'
            );
        }

        return null;
    }

    private static isSameExpression(
        a: numeric_expression,
        b: numeric_expression
    ): boolean {
        //simplified comparison - would need more sophisticated logic in production
        return JSON.stringify(a) === JSON.stringify(b);
    }
}

/**
 * Factory function for creating parser with default indicator registry
 */
export function createStrategyParser(
    indicatorRegistry?: Map<string, any>
): StrategyParser {
    const registry = indicatorRegistry || createDefaultIndicatorRegistry();
    return new StrategyParser(registry);
}

/**
 * Create a default indicator registry with common indicators
 */
//TODO: create this from the indicator registry that we have at home
function createDefaultIndicatorRegistry(): Map<string, any> {
    const registry = new Map<string, any>();

    //add common indicators
    registry.set('sma', {
        type: 'sma',
        display_name: 'Simple Moving Average',
        inputs: [
            { name: 'period', type: 'number', required: true },
            { name: 'shift', type: 'number', required: false },
            { name: 'source', type: 'source', required: false },
        ],
        outputs: [{ name: 'value', index: 0, is_default: true }],
    });

    registry.set('ema', {
        type: 'ema',
        display_name: 'Exponential Moving Average',
        inputs: [
            { name: 'period', type: 'number', required: true },
            { name: 'source', type: 'source', required: false },
        ],
        outputs: [{ name: 'value', index: 0, is_default: true }],
    });

    registry.set('macd', {
        type: 'macd',
        display_name: 'MACD',
        inputs: [
            { name: 'fast_period', type: 'number', required: false },
            { name: 'slow_period', type: 'number', required: false },
            { name: 'signal_period', type: 'number', required: false },
            { name: 'source', type: 'source', required: false },
        ],
        outputs: [
            { name: 'macd', index: 0 },
            { name: 'signal', index: 1 },
            { name: 'histogram', index: 2, is_default: true },
        ],
    });

    registry.set('bb', {
        type: 'bb',
        display_name: 'Bollinger Bands',
        inputs: [
            { name: 'period', type: 'number', required: false },
            { name: 'std_dev', type: 'number', required: false },
            { name: 'source', type: 'source', required: false },
        ],
        outputs: [
            { name: 'upper', index: 0 },
            { name: 'middle', index: 1 },
            { name: 'lower', index: 2 },
        ],
    });

    registry.set('rsi', {
        type: 'rsi',
        display_name: 'Relative Strength Index',
        inputs: [
            { name: 'period', type: 'number', required: false },
            { name: 'source', type: 'source', required: false },
        ],
        outputs: [{ name: 'value', index: 0, is_default: true }],
    });

    return registry;
}
