/**
 * Complete Example: JSON Strategy to AST to Executable Code
 */

import { createStrategyParser } from './parser';
import { JavaScriptCodeGenerator } from './code-generators';
import {
    strategy,
    data_indicator,
    data_candle,
} from '../schema/schemaCode_v0.1.3';
import * as fs from 'fs';
import { MT5CodeGenerator } from './code-generators/mt5';

// ============================================================================
// Example Strategy JSON
// ============================================================================

export const exampleCodeGenStrategy: strategy = {
    name: 'MACD SMA Crossover',
    description:
        'Buy when MACD crosses bullish and 50 SMA is above 100 SMA, with volume confirmation',
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
            id: 'macd_hourly_prev',
            type: 'indicator',
            indicator_type: 'macd',
            symbol: { var: '$SYM' },
            timeframe: { period: 'hour', length: 1 },
            offset: 1, //previous bar
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
                period: 100,
                shift: 0,
                source: 'close',
            },
        } as data_indicator,
        {
            id: 'current_candle',
            type: 'candle',
            symbol: { var: '$SYM' },
            timeframe: { period: 'hour', length: 1 },
        } as data_candle,
    ],
    actions: [
        {
            id: 'buy',
            order: {
                type: 'limit',
                symbol: { var: '$SYM' },
                quantity: { var: '$POSMAX' },
                side: 'buy',
                limit_price: {
                    operator: '*',
                    operandA: { candle_id: 'current_candle', field: 'close' },
                    operandB: 1.005, // 0.5% above current price
                },
                tif: 'gtc',
            },
        },
        {
            id: 'sell',
            order: {
                type: 'market',
                symbol: { var: '$SYM' },
                quantity: { var: '$POSMAX' },
                side: 'sell',
                tif: 'gtc',
            },
        },
    ],
    rules: [
        {
            //buy Rule: MACD crosses bullish AND 50 SMA > 100 SMA AND volume > 50% of average
            if: {
                and: [
                    {
                        // 50 SMA > 100 SMA (precondition)
                        expression: {
                            operator: '>',
                            operandA: { indicator_id: 'sma_50' },
                            operandB: { indicator_id: 'sma_100' },
                        },
                    },
                    {
                        //MACD histogram crosses above zero (current > 0)
                        expression: {
                            operator: '>',
                            operandA: {
                                indicator_id: 'macd_hourly',
                                output: 'histogram',
                            },
                            operandB: 0,
                        },
                    },
                    {
                        //MACD histogram was below zero (previous <= 0)
                        expression: {
                            operator: '<=',
                            operandA: {
                                indicator_id: 'macd_hourly_prev',
                                output: 'histogram',
                            },
                            operandB: 0,
                        },
                    },
                    {
                        //volume confirmation: current volume > 50% of average
                        expression: {
                            operator: '>',
                            operandA: {
                                candle_id: 'current_candle',
                                field: 'volume',
                            },
                            operandB: {
                                operator: '*',
                                operandA: { indicator_id: 'sma_volume' },
                                operandB: 0.5,
                            },
                        },
                    },
                ],
            },
            then: ['buy'],
        },
        {
            //sell Rule: 50 SMA crosses below 100 SMA (exit when precondition goes negative)
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

// ============================================================================
// Main Example: Parse, Validate, and Generate Code
// ============================================================================

export function runCodeGenExample() {
    console.log('='.repeat(80));
    console.log('STRATEGY JSON TO AST TO CODE - COMPLETE EXAMPLE');
    console.log('='.repeat(80));
    console.log();

    //step 1: Create parser with indicator registry
    console.log('Step 1: Creating parser with indicator registry...');
    const parser = createStrategyParser();
    console.log('✓ Parser created');
    console.log();

    //step 2: Parse JSON to AST
    console.log('Step 2: Parsing strategy JSON to AST...');
    const { ast, validation } = parser.parseAndValidate(exampleCodeGenStrategy);

    if (validation.valid) {
        console.log('✓ Strategy parsed successfully');
        console.log(`  - Name: ${ast.name || 'Unnamed'}`);
        console.log(`  - Data sources: ${ast.dataSources.length}`);
        console.log(`  - Actions: ${ast.actions.length}`);
        console.log(`  - Rules: ${ast.rules.length}`);
        console.log(`  - Position limits: ${ast.positionLimits.length}`);
    } else {
        console.error('✗ Validation errors:');
        validation.errors.forEach((error: any) => {
            console.error(`  - ${error.message}`);
        });
        return;
    }

    if (validation.warnings.length > 0) {
        console.warn('⚠ Warnings:');
        validation.warnings.forEach((warning) => {
            console.warn(`  - ${warning.message}`);
        });
    }
    console.log();

    //step 3: Display AST structure
    console.log('Step 3: AST Structure:');
    console.log('```');
    displayASTStructure(ast);
    console.log('```');
    console.log();

    //step 4: Generate Python code
    console.log('Step 4: Generating MT5 code...');
    const mt5Generator = new MT5CodeGenerator();
    const mt5Code = mt5Generator.generate(ast);
    console.log('✓ MT5 code generated');
    console.log();

    console.log('MT5 Code Preview:');
    console.log('='.repeat(40));
    const pythonLines = mt5Code.split('\n');
    console.log(pythonLines.slice(0, 50).join('\n'));
    if (pythonLines.length > 50) {
        console.log('... (truncated) ...');
    }
    console.log('='.repeat(40));
    console.log();

    //step 5: Generate JavaScript code
    console.log('Step 5: Generating JavaScript code...');
    const jsGenerator = new JavaScriptCodeGenerator();
    const jsCode = jsGenerator.generate(ast);
    console.log('✓ JavaScript code generated');
    console.log();

    console.log('JavaScript Code Preview:');
    console.log('='.repeat(40));
    const jsLines = jsCode.split('\n');
    console.log(jsLines.slice(0, 50).join('\n'));
    if (jsLines.length > 50) {
        console.log('... (truncated) ...');
    }
    console.log('='.repeat(40));
    console.log();

    //step 6: Save generated code to files
    console.log('Step 6: Saving generated code...');
    saveGeneratedCode(mt5Code, jsCode, ast.name || 'strategy');
    console.log();

    console.log('='.repeat(80));
    console.log('EXAMPLE COMPLETE');
    console.log('='.repeat(80));
}

// ============================================================================
// Helper Functions
// ============================================================================

function displayASTStructure(ast: any, indent: number = 0) {
    const indentStr = '  '.repeat(indent);

    if (ast === null || ast === undefined) {
        console.log(indentStr + 'null');
        return;
    }

    if (typeof ast === 'object') {
        if (Array.isArray(ast)) {
            console.log(indentStr + '[');
            ast.forEach((item, index) => {
                if (typeof item === 'object' && item.type) {
                    console.log(indentStr + '  ' + `${index}: ${item.type}`);
                } else {
                    displayASTStructure(item, indent + 1);
                }
            });
            console.log(indentStr + ']');
        } else if (ast.type) {
            console.log(indentStr + `${ast.type} {`);
            for (const [key, value] of Object.entries(ast)) {
                if (key === 'type' || key === 'sourceLocation') continue;

                if (typeof value === 'object' && value !== null) {
                    if (Array.isArray(value)) {
                        console.log(
                            indentStr + `  ${key}: [${value.length} items]`
                        );
                    } else if ('type' in value) {
                        console.log(
                            indentStr + `  ${key}: ${(value as any).type}`
                        );
                    } else {
                        console.log(indentStr + `  ${key}:`);
                        displayASTStructure(value, indent + 2);
                    }
                } else {
                    console.log(indentStr + `  ${key}: ${value}`);
                }
            }
            console.log(indentStr + '}');
        } else {
            for (const [key, value] of Object.entries(ast)) {
                console.log(indentStr + `${key}:`);
                displayASTStructure(value, indent + 1);
            }
        }
    } else {
        console.log(indentStr + ast);
    }
}

function saveGeneratedCode(
    pythonCode: string,
    jsCode: string,
    strategyName: string
) {
    strategyName = strategyName.replace(' ', '_');

    console.log(`save MT5 code to: ${strategyName}_strategy.mt5`);
    console.log(`save JavaScript code to: ${strategyName}_strategy.js`);

    fs.writeFileSync(`${strategyName}_strategy.mt5`, pythonCode, 'utf-8');
    fs.writeFileSync(`${strategyName}_strategy.js`, jsCode, 'utf-8');
}

// ============================================================================
// Advanced Example: Strategy with Complex Conditions
// ============================================================================

export const advancedStrategyExample: strategy = {
    name: 'Bollinger Band Mean Reversion',
    description: 'Trade bounces off Bollinger Bands with RSI confirmation',
    data: [
        {
            id: 'bb',
            type: 'indicator',
            indicator_type: 'bb',
            symbol: 'SPY',
            timeframe: { period: 'hour', length: 1 },
            params: {
                period: 20,
                std_dev: 2,
                source: 'close',
            },
        } as data_indicator,
        {
            id: 'rsi',
            type: 'indicator',
            indicator_type: 'rsi',
            symbol: 'SPY',
            timeframe: { period: 'hour', length: 1 },
            params: {
                period: 14,
                source: 'close',
            },
        } as data_indicator,
        {
            id: 'current',
            type: 'candle',
            symbol: 'SPY',
            timeframe: { period: 'hour', length: 1 },
        } as data_candle,
    ],
    actions: [
        {
            id: 'buy_oversold',
            order: {
                type: 'limit',
                symbol: 'SPY',
                quantity: {
                    operator: 'pct',
                    operandA: 10, // 10% of portfolio
                    operandB: { var: '$PORTFOLIO_VALUE' },
                },
                side: 'buy',
                limit_price: {
                    operator: '*',
                    operandA: { candle_id: 'current', field: 'close' },
                    operandB: 0.998, //slightly below current price
                },
                tif: 'day',
            },
        },
        {
            id: 'sell_overbought',
            order: {
                type: 'limit',
                symbol: 'SPY',
                quantity: {
                    operator: 'pct',
                    operandA: 10,
                    operandB: { var: '$PORTFOLIO_VALUE' },
                },
                side: 'sell',
                limit_price: {
                    operator: '*',
                    operandA: { candle_id: 'current', field: 'close' },
                    operandB: 1.002, //slightly above current price
                },
                tif: 'day',
            },
        },
    ],
    rules: [
        {
            //buy when price touches lower band and RSI < 30
            if: {
                and: [
                    {
                        expression: {
                            operator: '<=',
                            operandA: { candle_id: 'current', field: 'low' },
                            operandB: { indicator_id: 'bb', output: 'lower' },
                        },
                    },
                    {
                        expression: {
                            operator: '<',
                            operandA: { indicator_id: 'rsi' },
                            operandB: 30,
                        },
                    },
                ],
            },
            then: ['buy_oversold'],
        },
        {
            //sell when price touches upper band and RSI > 70
            if: {
                and: [
                    {
                        expression: {
                            operator: '>=',
                            operandA: { candle_id: 'current', field: 'high' },
                            operandB: { indicator_id: 'bb', output: 'upper' },
                        },
                    },
                    {
                        expression: {
                            operator: '>',
                            operandA: { indicator_id: 'rsi' },
                            operandB: 70,
                        },
                    },
                ],
            },
            then: ['sell_overbought'],
        },
    ],
    position_limits: [
        {
            symbol: 'SPY',
            max: {
                operator: 'pct',
                operandA: 30, //Max 30% of portfolio
                operandB: { var: '$PORTFOLIO_VALUE' },
            },
            min: 0,
        },
    ],
};

// ============================================================================
// Test Suite
// ============================================================================

export function runCodeGenTests() {
    console.log('\n' + '='.repeat(80));
    console.log('RUNNING TESTS');
    console.log('='.repeat(80) + '\n');

    const parser = createStrategyParser();

    //test 1: Basic strategy parsing
    console.log('Test 1: Basic strategy parsing');
    try {
        const result = parser.parseAndValidate(exampleCodeGenStrategy);
        console.log(`  ✓ Parsed successfully: ${result.validation.valid}`);
    } catch (error) {
        console.log(`  ✗ Failed: ${error}`);
    }

    //test 2: Advanced strategy parsing
    console.log('Test 2: Advanced strategy parsing');
    try {
        const result = parser.parseAndValidate(advancedStrategyExample);
        console.log(`  ✓ Parsed successfully: ${result.validation.valid}`);
    } catch (error) {
        console.log(`  ✗ Failed: ${error}`);
    }

    //test 3: Code generation
    console.log('Test 3: Code generation');
    try {
        const { ast } = parser.parseAndValidate(exampleCodeGenStrategy);
        const mt5Gen = new MT5CodeGenerator();
        const jsGen = new JavaScriptCodeGenerator();

        const pythonCode = mt5Gen.generate(ast);
        const jsCode = jsGen.generate(ast);

        console.log(`  ✓ MT5 code generated: ${pythonCode.length} characters`);
        console.log(
            `  ✓ JavaScript code generated: ${jsCode.length} characters`
        );
    } catch (error) {
        console.log(`  ✗ Failed: ${error}`);
    }

    console.log('\nAll tests completed!');
}
