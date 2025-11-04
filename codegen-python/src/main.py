from src.json_to_ast import transform_strategy
from src.ast_to_code import JavaScriptGenerator
import json


def json_to_ast(): 
    # Load the original strategy JSON
    original_strategy = {
        "symbols": ["TSLA"],
        "indicators": [
            {
                "id": "ema_50",
                "type": "ema",
                "symbol": "TSLA",
                "params": {"period": 50}
            },
            {
                "id": "ema_200",
                "type": "ema",
                "symbol": "TSLA",
                "params": {"period": 200}
            },
            {
                "id": "rsi_14",
                "type": "rsi",
                "symbol": "TSLA",
                "params": {"period": 14}
            }
        ],
        "triggers": [
            {
                "and": [
                    {
                        "type": "price_move",
                        "params": {
                            "event_type": "cross",
                            "threshold": 430,
                            "direction": "below"
                        }
                    },
                    {
                        "type": "indicator_comparison",
                        "params": {
                            "indicator1": "ema_50",
                            "indicator2": "ema_200",
                            "operator": ">"
                        }
                    },
                    {
                        "type": "indicator_event",
                        "params": {
                            "indicator": "rsi_14",
                            "event_type": "cross",
                            "threshold": 60,
                            "direction": "above"
                        }
                    }
                ],
                "actions": ["entry_long"]
            },
            {
                "and": [
                    {
                        "type": "indicator_comparison",
                        "params": {
                            "indicator1": "ema_50",
                            "indicator2": "ema_200",
                            "operator": "<"
                        }
                    }
                ],
                "actions": ["exit_long"]
            }
        ],
        "actions": [
            {
                "id": "entry_long",
                "type": "entry",
                "direction": "long",
                "max_position_size": 10,
                "order": {
                    "symbol": "TSLA",
                    "type": "market",
                    "tif": "day"
                }
            },
            {
                "id": "exit_long",
                "type": "exit",
                "direction": "long",
                "percent_of_position": 100,
                "order": {
                    "symbol": "TSLA",
                    "type": "market",
                    "tif": "day"
                }
            }
        ]
    }
    
    # Transform to AST
    ast = transform_strategy(original_strategy)
    
    # Pretty print the result
    print("Transformed AST:")
    print("=" * 60)
    print(json.dumps(ast, indent=2))
    
    # Save to file
    with open('transformed_ast.json', 'w') as f:
        json.dump(ast, f, indent=2)
    
    print("\n" + "=" * 60)
    print("AST saved to transformed_ast.json")

def ast_to_code(): 
    with open('transformed_ast.json', 'r') as f:
        ast = json.load(f)
    
    print("\n" + "=" * 60)
    print("JAVASCRIPT CODE:")
    print("=" * 60)
    codegen = JavaScriptGenerator(ast)
    print(codegen.generate())

# Example usage and test
if __name__ == "__main__":
    ast_to_code()