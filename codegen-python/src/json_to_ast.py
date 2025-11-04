import json
from typing import Dict, Any, List, Optional, Union
from dataclasses import dataclass, asdict
from enum import Enum

class NodeType(Enum):
    """AST Node Types"""
    TRADING_STRATEGY = "TradingStrategy"
    INDICATOR_DEF = "IndicatorDefinition"
    RULE = "Rule"
    LOGICAL_EXPR = "LogicalExpression"
    COMPARISON = "Comparison"
    CROSSING_EVENT = "CrossingEvent"
    PRICE_REF = "PriceReference"
    INDICATOR_REF = "IndicatorReference"
    LITERAL = "Literal"
    ORDER_ACTION = "OrderAction"
    POSITION = "Position"

class ComparisonOp(Enum):
    """Comparison operators"""
    LESS_THAN = "LESS_THAN"
    GREATER_THAN = "GREATER_THAN"
    LESS_THAN_OR_EQUAL = "LESS_THAN_OR_EQUAL"
    GREATER_THAN_OR_EQUAL = "GREATER_THAN_OR_EQUAL"
    EQUALS = "EQUALS"
    NOT_EQUALS = "NOT_EQUALS"

class LogicalOp(Enum):
    """Logical operators"""
    AND = "AND"
    OR = "OR"

class StrategyTransformer:
    """
    Transforms original strategy JSON format into AST representation
    """
    
    def __init__(self, strategy_json: Dict[str, Any]):
        self.strategy = strategy_json
        self.symbol = strategy_json['symbols'][0] if strategy_json.get('symbols') else 'UNKNOWN'
        self.indicators_map = self._build_indicators_map()
        self.actions_map = self._build_actions_map()
        
    def _build_indicators_map(self) -> Dict[str, Dict[str, Any]]:
        """Build a map of indicator IDs to their definitions"""
        return {ind['id']: ind for ind in self.strategy.get('indicators', [])}
    
    def _build_actions_map(self) -> Dict[str, Dict[str, Any]]:
        """Build a map of action IDs to their definitions"""
        return {act['id']: act for act in self.strategy.get('actions', [])}
    
    def transform(self) -> Dict[str, Any]:
        """Main transformation method"""
        ast = {
            "type": NodeType.TRADING_STRATEGY.value,
            "symbol": self.symbol,
            "indicators": self._transform_indicators(),
            "rules": self._transform_triggers()
        }
        return ast
    
    def _transform_indicators(self) -> List[Dict[str, Any]]:
        """Transform indicator definitions"""
        result = []
        for indicator in self.strategy.get('indicators', []):
            result.append({
                "type": NodeType.INDICATOR_DEF.value,
                "name": indicator['id'],
                "indicator_type": indicator['type'].upper(),
                "params": indicator.get('params', {})
            })
        return result
    
    def _transform_triggers(self) -> List[Dict[str, Any]]:
        """Transform triggers into rules"""
        result = []
        for i, trigger in enumerate(self.strategy.get('triggers', [])):
            # Get the condition tree
            condition = self._transform_trigger_conditions(trigger)
            
            # Get the associated actions
            for action_id in trigger.get('actions', []):
                action = self.actions_map.get(action_id)
                if action:
                    rule_name = f"{action_id}_rule" if action_id else f"rule_{i}"
                    result.append({
                        "type": NodeType.RULE.value,
                        "name": rule_name,
                        "condition": condition,
                        "action": self._transform_action(action)
                    })
        return result
    
    def _transform_trigger_conditions(self, trigger: Dict[str, Any]) -> Dict[str, Any]:
        """Transform trigger conditions into logical expression tree"""
        
        # Handle AND conditions
        if 'and' in trigger:
            operands = [self._transform_condition(cond) for cond in trigger['and']]
            # If only one operand, return it directly
            if len(operands) == 1:
                return operands[0]
            return {
                "type": NodeType.LOGICAL_EXPR.value,
                "operator": LogicalOp.AND.value,
                "operands": operands
            }
        
        # Handle OR conditions
        elif 'or' in trigger:
            operands = [self._transform_condition(cond) for cond in trigger['or']]
            # If only one operand, return it directly
            if len(operands) == 1:
                return operands[0]
            return {
                "type": NodeType.LOGICAL_EXPR.value,
                "operator": LogicalOp.OR.value,
                "operands": operands
            }
        
        # Single condition
        else:
            # Try to find a condition field
            for key in trigger:
                if key not in ['actions', 'id', 'name']:
                    return self._transform_condition(trigger)
        
        # Default to always true
        return {
            "type": NodeType.COMPARISON.value,
            "left": {"type": NodeType.LITERAL.value, "value": 1, "dataType": "number"},
            "operator": ComparisonOp.EQUALS.value,
            "right": {"type": NodeType.LITERAL.value, "value": 1, "dataType": "number"}
        }
    
    def _transform_condition(self, condition: Dict[str, Any]) -> Dict[str, Any]:
        """Transform individual condition based on its type"""
        
        cond_type = condition.get('type', '')
        params = condition.get('params', {})
        
        if cond_type == 'price_move':
            return self._transform_price_condition(params)
        
        elif cond_type == 'indicator_comparison':
            return self._transform_indicator_comparison(params)
        
        elif cond_type == 'indicator_event':
            return self._transform_indicator_event(params)
        
        elif cond_type == 'price_comparison':
            return self._transform_price_comparison(params)
        
        # Handle nested logical conditions
        elif 'and' in condition:
            return self._transform_trigger_conditions(condition)
        
        elif 'or' in condition:
            return self._transform_trigger_conditions(condition)
        
        # Default/unknown condition
        return {
            "type": NodeType.COMPARISON.value,
            "left": {"type": NodeType.LITERAL.value, "value": 1, "dataType": "number"},
            "operator": ComparisonOp.EQUALS.value,
            "right": {"type": NodeType.LITERAL.value, "value": 1, "dataType": "number"}
        }
    
    def _transform_price_condition(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """Transform price movement condition"""
        
        event_type = params.get('event_type', '')
        threshold = params.get('threshold', 0)
        direction = params.get('direction', '')
        
        # Determine the comparison operator
        if event_type == 'cross':
            # For crossing events, we typically check the current state after cross
            # "cross below" means price is now below threshold
            # "cross above" means price is now above threshold
            if direction == 'below':
                op = ComparisonOp.LESS_THAN
            elif direction == 'above':
                op = ComparisonOp.GREATER_THAN
            else:
                op = ComparisonOp.EQUALS
            
            # Note: In a real implementation, you might want to create a special
            # CrossingEvent node type that tracks previous values
            return {
                "type": NodeType.COMPARISON.value,
                "left": {
                    "type": NodeType.PRICE_REF.value,
                    "symbol": self.symbol
                },
                "operator": op.value,
                "right": {
                    "type": NodeType.LITERAL.value,
                    "value": threshold,
                    "dataType": "number"
                }
            }
        
        # For non-crossing events, use simple comparison
        elif event_type == 'above':
            op = ComparisonOp.GREATER_THAN
        elif event_type == 'below':
            op = ComparisonOp.LESS_THAN
        else:
            op = ComparisonOp.EQUALS
        
        return {
            "type": NodeType.COMPARISON.value,
            "left": {
                "type": NodeType.PRICE_REF.value,
                "symbol": self.symbol
            },
            "operator": op.value,
            "right": {
                "type": NodeType.LITERAL.value,
                "value": threshold,
                "dataType": "number"
            }
        }
    
    def _transform_price_comparison(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """Transform direct price comparison"""
        operator = params.get('operator', '>')
        value = params.get('value', 0)
        
        op_map = {
            '<': ComparisonOp.LESS_THAN,
            '>': ComparisonOp.GREATER_THAN,
            '<=': ComparisonOp.LESS_THAN_OR_EQUAL,
            '>=': ComparisonOp.GREATER_THAN_OR_EQUAL,
            '==': ComparisonOp.EQUALS,
            '!=': ComparisonOp.NOT_EQUALS
        }
        
        return {
            "type": NodeType.COMPARISON.value,
            "left": {
                "type": NodeType.PRICE_REF.value,
                "symbol": self.symbol
            },
            "operator": op_map.get(operator, ComparisonOp.GREATER_THAN).value,
            "right": {
                "type": NodeType.LITERAL.value,
                "value": value,
                "dataType": "number"
            }
        }
    
    def _transform_indicator_comparison(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """Transform indicator to indicator comparison"""
        
        indicator1 = params.get('indicator1', '')
        indicator2 = params.get('indicator2', '')
        operator = params.get('operator', '>')
        value = params.get('value')  # Optional: comparing to a fixed value
        
        op_map = {
            '<': ComparisonOp.LESS_THAN,
            '>': ComparisonOp.GREATER_THAN,
            '<=': ComparisonOp.LESS_THAN_OR_EQUAL,
            '>=': ComparisonOp.GREATER_THAN_OR_EQUAL,
            '==': ComparisonOp.EQUALS,
            '!=': ComparisonOp.NOT_EQUALS
        }
        
        left = {
            "type": NodeType.INDICATOR_REF.value,
            "name": indicator1
        }
        
        # Right side can be another indicator or a literal value
        if indicator2:
            right = {
                "type": NodeType.INDICATOR_REF.value,
                "name": indicator2
            }
        elif value is not None:
            right = {
                "type": NodeType.LITERAL.value,
                "value": value,
                "dataType": "number"
            }
        else:
            # Default to comparing with 0
            right = {
                "type": NodeType.LITERAL.value,
                "value": 0,
                "dataType": "number"
            }
        
        return {
            "type": NodeType.COMPARISON.value,
            "left": left,
            "operator": op_map.get(operator, ComparisonOp.GREATER_THAN).value,
            "right": right
        }
    
    def _transform_indicator_event(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """Transform indicator event (like RSI crossing threshold)"""
        
        indicator = params.get('indicator', '')
        event_type = params.get('event_type', '')
        threshold = params.get('threshold', 0)
        direction = params.get('direction', '')
        operator = params.get('operator')  # Alternative to event_type
        
        # Determine comparison operator
        if event_type == 'cross':
            if direction == 'above':
                op = ComparisonOp.GREATER_THAN
            elif direction == 'below':
                op = ComparisonOp.LESS_THAN
            else:
                op = ComparisonOp.EQUALS
        elif event_type == 'above' or direction == 'above':
            op = ComparisonOp.GREATER_THAN
        elif event_type == 'below' or direction == 'below':
            op = ComparisonOp.LESS_THAN
        elif operator:
            op_map = {
                '<': ComparisonOp.LESS_THAN,
                '>': ComparisonOp.GREATER_THAN,
                '<=': ComparisonOp.LESS_THAN_OR_EQUAL,
                '>=': ComparisonOp.GREATER_THAN_OR_EQUAL,
                '==': ComparisonOp.EQUALS,
                '!=': ComparisonOp.NOT_EQUALS
            }
            op = op_map.get(operator, ComparisonOp.GREATER_THAN)
        else:
            op = ComparisonOp.GREATER_THAN
        
        return {
            "type": NodeType.COMPARISON.value,
            "left": {
                "type": NodeType.INDICATOR_REF.value,
                "name": indicator
            },
            "operator": op.value,
            "right": {
                "type": NodeType.LITERAL.value,
                "value": threshold,
                "dataType": "number"
            }
        }
    
    def _transform_action(self, action: Dict[str, Any]) -> Dict[str, Any]:
        """Transform action definition"""
        
        action_type = action.get('type', '')
        direction = action.get('direction', '')
        
        # Determine action type
        if action_type == 'entry':
            act_type = 'OPEN_POSITION'
        elif action_type == 'exit':
            act_type = 'CLOSE_POSITION'
        else:
            act_type = action_type.upper()
        
        # Build position info
        position = {
            "type": NodeType.POSITION.value,
            "direction": direction.upper() if direction else 'LONG',
            "symbol": action.get('order', {}).get('symbol', self.symbol),
            "order_type": action.get('order', {}).get('type', 'market').upper()
        }
        
        # Add position-specific fields
        if action_type == 'entry':
            position['max_size'] = action.get('max_position_size', 1)
        elif action_type == 'exit':
            position['percent'] = action.get('percent_of_position', 100)
        
        return {
            "type": NodeType.ORDER_ACTION.value,
            "action_type": act_type,
            "position": position
        }


def transform_strategy(original_json: Dict[str, Any]) -> Dict[str, Any]:
    """
    Convenience function to transform strategy JSON to AST
    """
    transformer = StrategyTransformer(original_json)
    return transformer.transform()

