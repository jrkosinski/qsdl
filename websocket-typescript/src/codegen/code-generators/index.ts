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
} from '../ast-node';

/**
 * Base code generator with common functionality
 */
export abstract class CodeGenerator<T> implements ASTVisitor<T> {
    protected indent: number = 0;
    protected indentSize: number = 4;
    protected code: string[] = [];

    protected getIndent(): string {
        return ' '.repeat(this.indent * this.indentSize);
    }

    protected increaseIndent() {
        this.indent++;
    }

    protected decreaseIndent() {
        this.indent = Math.max(0, this.indent - 1);
    }

    protected addCodeLine(code?: string) {
        if (code) this.code.push(this.getIndent() + code);
        else this.code.push('');
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

export { MT5CodeGenerator } from './mt5';
