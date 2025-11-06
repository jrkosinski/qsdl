/**
 * Strategy Interface Definitions
 * These are the JSON schema definitions for trading strategies
 */

// ============================================================================
// VALUE TYPES
// ============================================================================

export type string_value = string | string_variable;
export type numeric_value = number | numeric_variable;

export interface string_variable {
    var: string;
}

export interface numeric_variable {
    var: string;
}

export interface string_ternary_expression {
    if: condition;
    then: string_value;
    else: string_value;
}

export interface numeric_ternary_expression {
    if: condition;
    then: numeric_expression | numeric_ternary_expression;
    else: numeric_expression | numeric_ternary_expression;
}

// ============================================================================
// DATA SOURCE DEFINITIONS
// ============================================================================

export interface data_source {
    id: string;
    type: 'indicator' | 'candle';
    symbol: string_value;
    timeframe: timeframe;
    offset?: number;
}

export interface data_candle extends data_source {
    type: 'candle';
}

export interface timeframe {
    length: number; // default 1, can't be zero
    period: 'second' | 'minute' | 'hour' | 'day' | 'month';
}

export interface data_indicator extends data_source {
    type: 'indicator';
    indicator_type: string; // Must match a key in the indicator registry
    params: { [key: string]: number | string }; // Named parameters matching the registry definition
}

// ============================================================================
// VALUE REFERENCES
// ============================================================================

export interface indicator_output_ref {
    indicator_id: string;
    output?: string | number;
}

export interface candle_field_ref {
    candle_id: string;
    field: 'open' | 'high' | 'low' | 'close' | 'volume' | 'timestamp';
}

export type numeric_expression =
    | numeric_value
    | operation
    | indicator_output_ref
    | candle_field_ref;

// ============================================================================
// OPERATIONS AND CONDITIONS
// ============================================================================

export interface comparison {
    operandA: numeric_expression;
    operandB: numeric_expression;
    operator: '<' | '>' | '<=' | '>=' | '==' | '!=';
}

export interface operation {
    operator: '+' | '*' | '-' | '/' | 'mod' | 'modulo' | 'pct' | 'percent';
    operandA: numeric_expression;
    operandB: numeric_expression;
}

export interface condition {
    // Must have only one of 'expression', 'and', 'or'
    expression?: comparison;
    and?: condition[] | comparison[];
    or?: condition[] | comparison[];
}

// ============================================================================
// ACTIONS AND RULES
// ============================================================================

export interface action {
    id: string;
    order: stock_order;
}

export interface position_limit {
    symbol: string_value;
    max: numeric_expression;
    min: numeric_expression;
}

export interface rule {
    if: condition;
    then: string[]; // Action IDs to execute
    else?: string[]; // Optional else actions
}

// ============================================================================
// MAIN STRATEGY INTERFACE
// ============================================================================

export interface strategy {
    name?: string;
    description?: string;
    default_symbol?: string;
    data: data_source[];
    rules: rule[];
    actions: action[];
    position_limits: position_limit[];
}

// ============================================================================
// ORDERS
// ============================================================================

export interface base_order {
    symbol: string_value;
    quantity: numeric_expression;
    side: 'buy' | 'sell';
    tif: 'day' | 'gtc' | 'ioc' | 'fok' | 'gtd' | 'ext';
    extended_hours?: boolean;
    account_id?: string;
    timestamp?: Date;
}

export interface market_order extends base_order {
    type: 'market';
}

export interface limit_order extends base_order {
    type: 'limit';
    limit_price: numeric_expression;
}

export interface stop_order extends base_order {
    type: 'stop';
    stop_price: numeric_expression;
}

export interface stop_limit_order extends base_order {
    type: 'stop_limit';
    stop_price: numeric_expression;
    limit_price: numeric_expression;
}

export interface trailing_stop_order extends base_order {
    type: 'trailing_stop';
    trail_amount?: numeric_expression;
    trail_percent?: numeric_expression;
}

export interface trailing_stop_limit_order extends base_order {
    type: 'trailing_stop_limit';
    trail_amount?: numeric_expression;
    trail_percent?: numeric_expression;
    limit_offset: numeric_expression;
}

export interface oco_order extends base_order {
    type: 'oco';
    orders: [
        limit_order | stop_order | stop_limit_order,
        limit_order | stop_order | stop_limit_order
    ];
}

export interface bracket_order extends base_order {
    type: 'bracket';
    entry_order: market_order | limit_order;
    profit_target: limit_order;
    stop_loss: stop_order | stop_limit_order;
}

export interface iceberg_order extends base_order {
    type: 'iceberg';
    limit_price: numeric_expression;
    display_quantity: numeric_expression;
    total_quantity: numeric_expression;
}

export interface aon_order extends base_order {
    type: 'all_or_none';
    limit_price: numeric_expression;
}

export interface fok_order extends base_order {
    type: 'fill_or_kill';
    limit_price?: numeric_expression;
}

export interface ioc_order extends base_order {
    type: 'immediate_or_cancel';
    limit_price?: numeric_expression;
}

export interface gtd_order extends base_order {
    type: 'good_till_date';
    limit_price?: numeric_expression;
    expiration_date: Date;
}

export interface pegged_order extends base_order {
    type: 'pegged';
    peg_type: 'midpoint' | 'primary' | 'market' | 'benchmark';
    limit_price?: numeric_expression;
    offset?: numeric_expression;
}

export type stock_order =
    | market_order
    | limit_order
    | stop_order
    | stop_limit_order
    | trailing_stop_order
    | trailing_stop_limit_order
    | oco_order
    | bracket_order
    | iceberg_order
    | aon_order
    | fok_order
    | ioc_order
    | gtd_order
    | pegged_order;

// ============================================================================
// INDICATOR REGISTRY
// ============================================================================

export interface indicator_input {
    name: string;
    type: 'number' | 'string' | 'source';
    required: boolean;
    default_value?: number | string;
    description?: string;
    min?: number;
    max?: number;
    allowed_values?: string[];
}

export interface indicator_output_definition {
    name: string;
    index: number;
    is_default?: boolean;
    description?: string;
}

export interface indicator_definition {
    type: string;
    display_name: string;
    description: string;
    inputs: indicator_input[];
    outputs: indicator_output_definition[];
}

export interface indicator_registry {
    indicators: { [key: string]: indicator_definition };
}
