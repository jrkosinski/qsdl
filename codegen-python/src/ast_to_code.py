import json
from typing import Dict, Any, List
from abc import ABC, abstractmethod


class JavaScriptGenerator(ABC):
    """Generate JavaScript code from AST"""
    
    def __init__(self, ast: Dict[str, Any]):
        self.ast = ast
        self.indent_level = 0
        self.indent_str = "  "
        
    def indent(self) -> str:
        return self.indent_str * self.indent_level
    
    def generate_comparison_operator(self, op: str) -> str:
        return {
            'LESS_THAN': '<',
            'GREATER_THAN': '>',
            'LESS_THAN_OR_EQUAL': '<=',
            'GREATER_THAN_OR_EQUAL': '>=',
            'EQUALS': '===',
            'NOT_EQUALS': '!=='
        }[op]
    
    def generate(self) -> str:
        code = []
        code.append("// Generated JavaScript Trading Strategy")
        code.append(f"class {self.ast['symbol']}Strategy {{")
        self.indent_level += 1
        
        # Generate entry condition
        for rule in self.ast['rules']:
            if rule['name'] == 'entry_long_rule':
                code.append(f"{self.indent()}checkEntry(price, rsi14, ema50, ema200) {{")
                self.indent_level += 1
                conditions = self.generate_condition_js(rule['condition'])
                code.append(f"{self.indent()}return {conditions};")
                self.indent_level -= 1
                code.append(f"{self.indent()}}}")
                code.append("")
                
            elif rule['name'] == 'exit_long_rule':
                code.append(f"{self.indent()}checkExit(ema50, ema200) {{")
                self.indent_level += 1
                conditions = self.generate_condition_js(rule['condition'])
                code.append(f"{self.indent()}return {conditions};")
                self.indent_level -= 1
                code.append(f"{self.indent()}}}")
        
        self.indent_level -= 1
        code.append("}")
        return "\n".join(code)
    
    def generate_condition_js(self, condition: Dict[str, Any]) -> str:
        if condition['type'] == 'LogicalExpression':
            op = ' && ' if condition['operator'] == 'AND' else ' || '
            parts = [f"({self.generate_condition_js(c)})" for c in condition['operands']]
            return op.join(parts)
        elif condition['type'] == 'Comparison':
            left = self.get_value_js(condition['left'])
            right = self.get_value_js(condition['right'])
            op = self.generate_comparison_operator(condition['operator'])
            return f"{left} {op} {right}"
        return "true"
    
    def get_value_js(self, val: Dict[str, Any]) -> str:
        if val['type'] == 'Literal':
            return str(val['value'])
        elif val['type'] == 'PriceReference':
            return 'price'
        elif val['type'] == 'IndicatorReference':
            # Convert snake_case to camelCase
            name = val['name'].replace('_', '')
            return name
        return "null"


    