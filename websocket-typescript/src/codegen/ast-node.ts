/**
 * Abstract Syntax Tree Node Definitions for Trading Strategy
 */

import { Rule } from 'ajv/dist/compile/rules';
import { isStringArray } from '../util';

// ============================================================================
// Execution Context
// ============================================================================

export interface ExecutionContext {
    //Market data
    currentCandles: Map<string, CandleData>;
    historicalCandles: Map<string, CandleData[]>;

    //calculated values
    indicatorValues: Map<string, number | number[]>;

    //portfolio state
    positions: Map<string, Position>;
    portfolioValue: number;

    //variable bindings
    variables: Map<string, any>;

    //time context
    currentTime: Date;
    timeframe: string;
}

export interface CandleData {
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    timestamp: Date;
}

export interface Position {
    symbol: string;
    quantity: number;
    averagePrice: number;
    currentPrice: number;
    pnl: number;
}

// ============================================================================
// Base AST Node
// ============================================================================

export abstract class ASTNode {
    public readonly type: string;
    public readonly sourceLocation?: SourceLocation;

    constructor(type: string, location?: SourceLocation) {
        this.type = type;
        this.sourceLocation = location;
    }

    abstract validate(context: ValidationContext): ValidationResult;
    abstract accept<T>(visitor: ASTVisitor<T>): T;

    //helper for debugging
    abstract toString(): string;
}

export interface SourceLocation {
    line?: number;
    column?: number;
    path?: string;
}

export interface ValidationContext {
    indicatorRegistry: Map<string, any>;
    definedDataSources: Map<string, DataSourceNode>;
    definedActions: Map<string, ActionNode>;
    errors: ValidationError[];
    warnings: ValidationWarning[];
}

export interface ValidationResult {
    valid: boolean;
    errors: ValidationError[];
    warnings: ValidationWarning[];
}

export interface ValidationError {
    message: string;
    location?: SourceLocation;
    severity: 'error';
}

export interface ValidationWarning {
    message: string;
    location?: SourceLocation;
    severity: 'warning';
}

// ============================================================================
// Expression Nodes (for numeric expressions)
// ============================================================================

export abstract class ExpressionNode extends ASTNode {
    constructor(type: string, location?: SourceLocation) {
        super(`Expression.${type}`, location);
    }

    abstract evaluate(context: ExecutionContext): number;
}

export class LiteralNumberNode extends ExpressionNode {
    constructor(public readonly value: number) {
        super('LiteralNumber');
    }

    evaluate(context: ExecutionContext): number {
        return this.value;
    }

    validate(context: ValidationContext): ValidationResult {
        return { valid: true, errors: [], warnings: [] };
    }

    accept<T>(visitor: ASTVisitor<T>): T {
        return visitor.visitLiteralNumber(this);
    }

    toString(): string {
        return this.value.toString();
    }
}

export class VariableNode extends ExpressionNode {
    constructor(public readonly name: string) {
        super('Variable');
    }

    evaluate(context: ExecutionContext): number {
        const value = context.variables.get(this.name);
        if (value === undefined) {
            throw new Error(`Undefined variable: ${this.name}`);
        }
        return Number(value);
    }

    validate(context: ValidationContext): ValidationResult {
        //variables are validated at runtime
        return { valid: true, errors: [], warnings: [] };
    }

    accept<T>(visitor: ASTVisitor<T>): T {
        return visitor.visitVariable(this);
    }

    toString(): string {
        return this.name;
    }
}

export class BinaryOperationNode extends ExpressionNode {
    constructor(
        public readonly operator: '+' | '-' | '*' | '/' | 'mod' | 'pct',
        public readonly left: ExpressionNode,
        public readonly right: ExpressionNode
    ) {
        super('BinaryOperation');
    }

    evaluate(context: ExecutionContext): number {
        const leftValue = this.left.evaluate(context);
        const rightValue = this.right.evaluate(context);

        switch (this.operator) {
            case '+':
                return leftValue + rightValue;
            case '-':
                return leftValue - rightValue;
            case '*':
                return leftValue * rightValue;
            case '/':
                if (rightValue === 0) throw new Error('Division by zero');
                return leftValue / rightValue;
            case 'mod':
                return leftValue % rightValue;
            case 'pct':
                return (leftValue / 100) * rightValue;
            default:
                throw new Error(`Unknown operator: ${this.operator}`);
        }
    }

    validate(context: ValidationContext): ValidationResult {
        const leftResult = this.left.validate(context);
        const rightResult = this.right.validate(context);

        return {
            valid: leftResult.valid && rightResult.valid,
            errors: [...leftResult.errors, ...rightResult.errors],
            warnings: [...leftResult.warnings, ...rightResult.warnings],
        };
    }

    accept<T>(visitor: ASTVisitor<T>): T {
        return visitor.visitBinaryOperation(this);
    }

    toString(): string {
        return `(${this.left.toString()} ${
            this.operator
        } ${this.right.toString()})`;
    }
}

export class IndicatorOutputRefNode extends ExpressionNode {
    constructor(
        public readonly indicatorId: string,
        public readonly output?: string | number
    ) {
        super('IndicatorOutputRef');
    }

    evaluate(context: ExecutionContext): number {
        const key =
            this.output !== undefined
                ? `${this.indicatorId}.${this.output}`
                : this.indicatorId;

        const value = context.indicatorValues.get(key);
        if (value === undefined) {
            throw new Error(`Indicator value not found: ${key}`);
        }

        return Array.isArray(value) ? value[0] : value;
    }

    validate(context: ValidationContext): ValidationResult {
        const dataSource = context.definedDataSources.get(this.indicatorId);
        if (!dataSource) {
            return {
                valid: false,
                errors: [
                    {
                        message: `Undefined indicator: ${this.indicatorId}`,
                        severity: 'error',
                    },
                ],
                warnings: [],
            };
        }
        return { valid: true, errors: [], warnings: [] };
    }

    accept<T>(visitor: ASTVisitor<T>): T {
        return visitor.visitIndicatorOutputRef(this);
    }

    toString(): string {
        return this.output !== undefined
            ? `${this.indicatorId}.${this.output}`
            : this.indicatorId;
    }
}

export class CandleFieldRefNode extends ExpressionNode {
    constructor(
        public readonly candleId: string,
        public readonly field:
            | 'open'
            | 'high'
            | 'low'
            | 'close'
            | 'volume'
            | 'timestamp'
    ) {
        super('CandleFieldRef');
    }

    evaluate(context: ExecutionContext): number {
        const candle = context.currentCandles.get(this.candleId);
        if (!candle) {
            throw new Error(`Candle not found: ${this.candleId}`);
        }
        return candle[this.field] as number;
    }

    validate(context: ValidationContext): ValidationResult {
        const dataSource = context.definedDataSources.get(this.candleId);
        if (!dataSource) {
            return {
                valid: false,
                errors: [
                    {
                        message: `Undefined candle: ${this.candleId}`,
                        severity: 'error',
                    },
                ],
                warnings: [],
            };
        }
        return { valid: true, errors: [], warnings: [] };
    }

    accept<T>(visitor: ASTVisitor<T>): T {
        return visitor.visitCandleFieldRef(this);
    }

    toString(): string {
        return `${this.candleId}.${this.field}`;
    }
}

// ============================================================================
// Condition Nodes (for boolean logic)
// ============================================================================

export abstract class ConditionNode extends ASTNode {
    constructor(type: string, location?: SourceLocation) {
        super(`Condition.${type}`, location);
    }

    abstract evaluate(context: ExecutionContext): boolean;
}

export class ComparisonNode extends ConditionNode {
    constructor(
        public readonly operator: '<' | '>' | '<=' | '>=' | '==' | '!=',
        public readonly left: ExpressionNode,
        public readonly right: ExpressionNode
    ) {
        super('Comparison');
    }

    evaluate(context: ExecutionContext): boolean {
        const leftValue = this.left.evaluate(context);
        const rightValue = this.right.evaluate(context);

        switch (this.operator) {
            case '<':
                return leftValue < rightValue;
            case '>':
                return leftValue > rightValue;
            case '<=':
                return leftValue <= rightValue;
            case '>=':
                return leftValue >= rightValue;
            case '==':
                return Math.abs(leftValue - rightValue) < 1e-10; //floating point equality
            case '!=':
                return Math.abs(leftValue - rightValue) >= 1e-10;
            default:
                throw new Error(
                    `Unknown comparison operator: ${this.operator}`
                );
        }
    }

    validate(context: ValidationContext): ValidationResult {
        const leftResult = this.left.validate(context);
        const rightResult = this.right.validate(context);

        return {
            valid: leftResult.valid && rightResult.valid,
            errors: [...leftResult.errors, ...rightResult.errors],
            warnings: [...leftResult.warnings, ...rightResult.warnings],
        };
    }

    accept<T>(visitor: ASTVisitor<T>): T {
        return visitor.visitComparison(this);
    }

    toString(): string {
        return `(${this.left.toString()} ${
            this.operator
        } ${this.right.toString()})`;
    }
}

export class LogicalOperationNode extends ConditionNode {
    constructor(
        public readonly operator: 'and' | 'or',
        public readonly conditions: ConditionNode[]
    ) {
        super('LogicalOperation');
    }

    evaluate(context: ExecutionContext): boolean {
        if (this.operator === 'and') {
            return this.conditions.every((cond) => cond.evaluate(context));
        } else {
            return this.conditions.some((cond) => cond.evaluate(context));
        }
    }

    validate(context: ValidationContext): ValidationResult {
        const results = this.conditions.map((cond) => cond.validate(context));

        return {
            valid: results.every((r) => r.valid),
            errors: results.flatMap((r) => r.errors),
            warnings: results.flatMap((r) => r.warnings),
        };
    }

    accept<T>(visitor: ASTVisitor<T>): T {
        return visitor.visitLogicalOperation(this);
    }

    toString(): string {
        const condStrs = this.conditions.map((c) => c.toString());
        return `(${condStrs.join(` ${this.operator.toUpperCase()} `)})`;
    }
}

export class CrossoverNode extends ConditionNode {
    constructor(
        public readonly series1: ExpressionNode,
        public readonly series2: ExpressionNode,
        public readonly direction: 'above' | 'below'
    ) {
        super('Crossover');
    }

    evaluate(context: ExecutionContext): boolean {
        //this requires historical data to detect crossover
        //for now, simplified implementation
        const current1 = this.series1.evaluate(context);
        const current2 = this.series2.evaluate(context);

        //TODO: Implement proper crossover detection with historical values
        if (this.direction === 'above') {
            return current1 > current2;
        } else {
            return current1 < current2;
        }
    }

    validate(context: ValidationContext): ValidationResult {
        const result1 = this.series1.validate(context);
        const result2 = this.series2.validate(context);

        return {
            valid: result1.valid && result2.valid,
            errors: [...result1.errors, ...result2.errors],
            warnings: [...result1.warnings, ...result2.warnings],
        };
    }

    accept<T>(visitor: ASTVisitor<T>): T {
        return visitor.visitCrossover(this);
    }

    toString(): string {
        return `${this.series1.toString()} crosses ${
            this.direction
        } ${this.series2.toString()}`;
    }
}

// ============================================================================
// Data Source Nodes
// ============================================================================

export abstract class DataSourceNode extends ASTNode {
    constructor(
        type: string,
        public readonly id: string,
        public readonly symbol: string | VariableNode,
        public readonly timeframe: TimeframeNode,
        public readonly offset?: number
    ) {
        super(`DataSource.${type}`);
    }
}

export class IndicatorNode extends DataSourceNode {
    constructor(
        id: string,
        symbol: string | VariableNode,
        timeframe: TimeframeNode,
        public readonly indicatorType: string,
        public readonly params: Map<string, any>,
        offset?: number
    ) {
        super('Indicator', id, symbol, timeframe, offset);
    }

    validate(context: ValidationContext): ValidationResult {
        //check if indicator type exists in registry
        if (!context.indicatorRegistry.has(this.indicatorType)) {
            return {
                valid: false,
                errors: [
                    {
                        message: `Unknown indicator type: ${this.indicatorType}`,
                        severity: 'error',
                    },
                ],
                warnings: [],
            };
        }

        //TODO: Validate parameters against indicator definition

        return { valid: true, errors: [], warnings: [] };
    }

    accept<T>(visitor: ASTVisitor<T>): T {
        return visitor.visitIndicator(this);
    }

    toString(): string {
        const paramStr = Array.from(this.params.entries())
            .map(([k, v]) => `${k}=${v}`)
            .join(', ');
        return `${this.indicatorType}(${paramStr})`;
    }
}

export class CandleNode extends DataSourceNode {
    constructor(
        id: string,
        symbol: string | VariableNode,
        timeframe: TimeframeNode,
        offset?: number
    ) {
        super('Candle', id, symbol, timeframe, offset);
    }

    validate(context: ValidationContext): ValidationResult {
        return { valid: true, errors: [], warnings: [] };
    }

    accept<T>(visitor: ASTVisitor<T>): T {
        return visitor.visitCandle(this);
    }

    toString(): string {
        return `Candle[${this.id}]`;
    }
}

export class TimeframeNode extends ASTNode {
    constructor(
        public readonly period: 'second' | 'minute' | 'hour' | 'day' | 'month',
        public readonly length: number = 1
    ) {
        super('Timeframe');
    }

    validate(context: ValidationContext): ValidationResult {
        if (this.length <= 0) {
            return {
                valid: false,
                errors: [
                    {
                        message: 'Timeframe length must be positive',
                        severity: 'error',
                    },
                ],
                warnings: [],
            };
        }
        return { valid: true, errors: [], warnings: [] };
    }

    accept<T>(visitor: ASTVisitor<T>): T {
        return visitor.visitTimeframe(this);
    }

    toString(): string {
        return `${this.length}${this.period}`;
    }
}

// ============================================================================
// Action Nodes
// ============================================================================

export class ActionNode extends ASTNode {
    constructor(public readonly id: string, public readonly order: OrderNode) {
        super('Action');
    }

    validate(context: ValidationContext): ValidationResult {
        return this.order.validate(context);
    }

    accept<T>(visitor: ASTVisitor<T>): T {
        return visitor.visitAction(this);
    }

    toString(): string {
        return `Action[${this.id}]: ${this.order.toString()}`;
    }
}

export abstract class OrderNode extends ASTNode {
    constructor(
        type: string,
        public readonly symbol: string | VariableNode,
        public readonly side: 'buy' | 'sell',
        public readonly quantity: ExpressionNode,
        public readonly tif: 'day' | 'gtc' | 'ioc' | 'fok' | 'gtd' | 'ext'
    ) {
        super(`Order.${type}`);
    }
}

export class MarketOrderNode extends OrderNode {
    constructor(
        symbol: string | VariableNode,
        side: 'buy' | 'sell',
        quantity: ExpressionNode,
        tif: 'day' | 'gtc' | 'ioc' | 'fok' | 'gtd' | 'ext'
    ) {
        super('Market', symbol, side, quantity, tif);
    }

    validate(context: ValidationContext): ValidationResult {
        return this.quantity.validate(context);
    }

    accept<T>(visitor: ASTVisitor<T>): T {
        return visitor.visitMarketOrder(this);
    }

    toString(): string {
        return `Market ${this.side} ${this.quantity.toString()}`;
    }
}

export class LimitOrderNode extends OrderNode {
    constructor(
        symbol: string | VariableNode,
        side: 'buy' | 'sell',
        quantity: ExpressionNode,
        tif: 'day' | 'gtc' | 'ioc' | 'fok' | 'gtd' | 'ext',
        public readonly limitPrice: ExpressionNode
    ) {
        super('Limit', symbol, side, quantity, tif);
    }

    validate(context: ValidationContext): ValidationResult {
        const quantityResult = this.quantity.validate(context);
        const priceResult = this.limitPrice.validate(context);

        return {
            valid: quantityResult.valid && priceResult.valid,
            errors: [...quantityResult.errors, ...priceResult.errors],
            warnings: [...quantityResult.warnings, ...priceResult.warnings],
        };
    }

    accept<T>(visitor: ASTVisitor<T>): T {
        return visitor.visitLimitOrder(this);
    }

    toString(): string {
        return `Limit ${
            this.side
        } ${this.quantity.toString()} @ ${this.limitPrice.toString()}`;
    }
}

// ============================================================================
// Rule Nodes
// ============================================================================

export class RuleNode extends ASTNode {
    constructor(
        public readonly condition: ConditionNode,
        public readonly thenActions: string[] | RuleNode[],
        public readonly elseActions?: string[] | RuleNode[]
    ) {
        super('Rule');
    }

    validate(context: ValidationContext): ValidationResult {
        const conditionResult = this.condition.validate(context);

        //validate action references
        const errors: ValidationError[] = [...conditionResult.errors];

        if (isStringArray(this.thenActions)) {
            for (const actionId of this.thenActions) {
                if (!context.definedActions.has(actionId)) {
                    errors.push({
                        message: `Undefined action: ${actionId}`,
                        severity: 'error',
                    });
                }
            }
        } else {
            //TODO: define this
        }

        if (isStringArray(this.elseActions)) {
            if (this.elseActions) {
                for (const actionId of this.elseActions) {
                    if (!context.definedActions.has(actionId)) {
                        errors.push({
                            message: `Undefined action: ${actionId}`,
                            severity: 'error',
                        });
                    }
                }
            }
        } else {
            //TODO: define this
        }

        return {
            valid: errors.length === 0 && conditionResult.valid,
            errors,
            warnings: conditionResult.warnings,
        };
    }

    accept<T>(visitor: ASTVisitor<T>): T {
        return visitor.visitRule(this);
    }

    toString(): string {
        //TODO: support nested rules

        let str = `IF ${this.condition.toString()} THEN [${
            isStringArray(this.thenActions) ? this.thenActions.join(', ') : []
        }]`;
        if (this.elseActions) {
            str += ` ELSE [${
                isStringArray(this.elseActions)
                    ? this.elseActions.join(', ')
                    : []
            }]`;
        }
        return str;
    }
}

// ============================================================================
// Position Management Nodes
// ============================================================================

export class PositionLimitNode extends ASTNode {
    constructor(
        public readonly symbol: string | VariableNode,
        public readonly max: ExpressionNode,
        public readonly min: ExpressionNode
    ) {
        super('PositionLimit');
    }

    validate(context: ValidationContext): ValidationResult {
        const maxResult = this.max.validate(context);
        const minResult = this.min.validate(context);

        return {
            valid: maxResult.valid && minResult.valid,
            errors: [...maxResult.errors, ...minResult.errors],
            warnings: [...maxResult.warnings, ...minResult.warnings],
        };
    }

    accept<T>(visitor: ASTVisitor<T>): T {
        return visitor.visitPositionLimit(this);
    }

    toString(): string {
        const sym =
            this.symbol instanceof VariableNode
                ? this.symbol.name
                : this.symbol;
        return `PositionLimit[${sym}]: ${this.min.toString()} to ${this.max.toString()}`;
    }
}

// ============================================================================
// Root Strategy Node
// ============================================================================

export class StrategyNode extends ASTNode {
    constructor(
        public readonly name: string | undefined,
        public readonly description: string | undefined,
        public readonly dataSources: DataSourceNode[],
        public readonly actions: ActionNode[],
        public readonly rules: RuleNode[],
        public readonly positionLimits: PositionLimitNode[]
    ) {
        super('Strategy');
    }

    validate(context: ValidationContext): ValidationResult {
        const errors: ValidationError[] = [];
        const warnings: ValidationWarning[] = [];

        //validate all data sources
        for (const dataSource of this.dataSources) {
            const result = dataSource.validate(context);
            errors.push(...result.errors);
            warnings.push(...result.warnings);
        }

        //validate all actions
        for (const action of this.actions) {
            const result = action.validate(context);
            errors.push(...result.errors);
            warnings.push(...result.warnings);
        }

        //validate all rules
        for (const rule of this.rules) {
            const result = rule.validate(context);
            errors.push(...result.errors);
            warnings.push(...result.warnings);
        }

        //validate position limits
        for (const limit of this.positionLimits) {
            const result = limit.validate(context);
            errors.push(...result.errors);
            warnings.push(...result.warnings);
        }

        //check for required components
        if (this.dataSources.length === 0) {
            errors.push({
                message: 'Strategy must have at least one data source',
                severity: 'error',
            });
        }

        if (this.rules.length === 0) {
            errors.push({
                message: 'Strategy must have at least one rule',
                severity: 'error',
            });
        }

        if (this.actions.length === 0) {
            errors.push({
                message: 'Strategy must have at least one action',
                severity: 'error',
            });
        }

        if (this.positionLimits.length === 0) {
            errors.push({
                message: 'Strategy must have at least one position limit',
                severity: 'error',
            });
        }

        return {
            valid: errors.length === 0,
            errors,
            warnings,
        };
    }

    accept<T>(visitor: ASTVisitor<T>): T {
        return visitor.visitStrategy(this);
    }

    toString(): string {
        return `Strategy[${this.name || 'unnamed'}]`;
    }
}

// ============================================================================
// Visitor Pattern for AST Traversal
// ============================================================================

export interface ASTVisitor<T> {
    visitStrategy(node: StrategyNode): T;
    visitIndicator(node: IndicatorNode): T;
    visitCandle(node: CandleNode): T;
    visitTimeframe(node: TimeframeNode): T;
    visitAction(node: ActionNode): T;
    visitMarketOrder(node: MarketOrderNode): T;
    visitLimitOrder(node: LimitOrderNode): T;
    visitRule(node: RuleNode): T;
    visitPositionLimit(node: PositionLimitNode): T;
    visitComparison(node: ComparisonNode): T;
    visitLogicalOperation(node: LogicalOperationNode): T;
    visitCrossover(node: CrossoverNode): T;
    visitLiteralNumber(node: LiteralNumberNode): T;
    visitVariable(node: VariableNode): T;
    visitBinaryOperation(node: BinaryOperationNode): T;
    visitIndicatorOutputRef(node: IndicatorOutputRefNode): T;
    visitCandleFieldRef(node: CandleFieldRefNode): T;
}
