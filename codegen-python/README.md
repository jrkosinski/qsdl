# QSDL Code Generation (Python)

**Status: Experimental / Early Stage**

Python-based code generation tool that transforms QSDL JSON strategies into executable code. This project converts trading strategy definitions into Abstract Syntax Trees (AST) and then generates programming language-specific implementations.

## Overview

This tool is designed to take QSDL JSON strategies and generate executable code that can be integrated into trading platforms. The current implementation focuses on JavaScript code generation, but the architecture is designed to support multiple target languages.

## Architecture

The code generation process follows two main stages:

1. **JSON → AST**: Transform QSDL JSON into an intermediate Abstract Syntax Tree representation
2. **AST → Code**: Generate target language code from the AST

```
QSDL JSON → AST → JavaScript/Python/Other
```

This two-stage approach provides flexibility to:
- Add support for multiple target languages
- Optimize and validate strategies at the AST level
- Perform transformations and optimizations before code generation

## Project Structure

```
codegen-python/
├── src/
│   ├── main.py           # Main entry point and orchestration
│   ├── json_to_ast.py    # QSDL JSON to AST transformer
│   └── ast_to_code.py    # AST to JavaScript code generator
├── transformed_ast.json  # Output: Generated AST (intermediate)
├── pyvenv.cfg           # Python virtual environment config
├── venv.sh              # Script to create virtual environment
├── create-env.sh        # Environment setup script
└── run.sh               # Quick run script
```

## Prerequisites

- Python 3.8 or higher
- Virtual environment support (venv)

## Installation

### 1. Create Virtual Environment

```bash
# Create the virtual environment
./venv.sh

# Or manually:
python3 -m venv .
```

### 2. Activate Virtual Environment

```bash
# On Linux/Mac
source bin/activate

# On Windows
.\Scripts\activate
```

### 3. Install Dependencies

```bash
pip install -r requirements.txt
# Currently no external dependencies beyond Python stdlib
```

## Usage

### Quick Start

```bash
# Activate environment and run
source bin/activate
./run.sh

# Or run directly
python src/main.py
```

### Running Individual Components

```python
# In Python REPL or script

from src.json_to_ast import transform_strategy
from src.ast_to_code import JavaScriptGenerator
import json

# 1. Transform QSDL JSON to AST
strategy_json = {...}  # Your QSDL JSON
ast = transform_strategy(strategy_json)

# Save AST (optional)
with open('transformed_ast.json', 'w') as f:
    json.dump(ast, f, indent=2)

# 2. Generate code from AST
codegen = JavaScriptGenerator(ast)
javascript_code = codegen.generate()
print(javascript_code)
```

## Components

### 1. JSON to AST Transformer (`json_to_ast.py`)

Converts QSDL JSON into a language-agnostic Abstract Syntax Tree.

**Key Features:**
- Transforms indicators into `IndicatorDefinition` nodes
- Converts triggers into `Rule` nodes with condition trees
- Builds logical expression trees (AND/OR operations)
- Handles comparisons and crossing events
- Maps actions to order executions

**AST Node Types:**
- `TradingStrategy`: Root node
- `IndicatorDefinition`: Indicator configurations
- `Rule`: Conditional rules with actions
- `LogicalExpression`: AND/OR logic
- `Comparison`: Value comparisons
- `CrossingEvent`: Threshold crossing detection
- `PriceReference`: Price data references
- `IndicatorReference`: Indicator output references
- `Literal`: Constant values
- `OrderAction`: Order placement actions

**Example Transformation:**

Input (QSDL JSON):
```json
{
  "symbols": ["TSLA"],
  "indicators": [
    {
      "id": "ema_50",
      "type": "ema",
      "params": {"period": 50}
    }
  ],
  "triggers": [...]
}
```

Output (AST):
```json
{
  "type": "TradingStrategy",
  "symbol": "TSLA",
  "indicators": [
    {
      "type": "IndicatorDefinition",
      "name": "ema_50",
      "indicator_type": "EMA",
      "params": {"period": 50}
    }
  ],
  "rules": [...]
}
```

### 2. AST to Code Generator (`ast_to_code.py`)

Generates executable code from the AST representation.

**Currently Supported:**
- JavaScript class-based strategy code
- Entry condition methods
- Exit condition methods
- Logical expression compilation
- Comparison operations

**Generated Code Example:**

```javascript
// Generated JavaScript Trading Strategy
class TSLAStrategy {
  checkEntry(price, rsi14, ema50, ema200) {
    return (price < 430) && (ema50 > ema200) && (rsi14 > 60);
  }

  checkExit(ema50, ema200) {
    return ema50 < ema200;
  }
}
```

### 3. Main Orchestrator (`main.py`)

Coordinates the transformation pipeline.

**Current Workflow:**
1. Load example QSDL JSON strategy
2. Transform to AST using `transform_strategy()`
3. Save AST to `transformed_ast.json`
4. Generate JavaScript code using `JavaScriptGenerator`
5. Output code to console

## Example Strategy

The current implementation includes a sample TSLA strategy with:

- **Indicators:**
  - 50-period EMA
  - 200-period EMA
  - 14-period RSI

- **Entry Rule:** Enter long when:
  - Price crosses below $430
  - 50 EMA > 200 EMA (uptrend)
  - RSI crosses above 60

- **Exit Rule:** Exit long when:
  - 50 EMA crosses below 200 EMA

## Development Status

### ✅ Implemented

- JSON to AST transformation
- Basic AST structure and node types
- JavaScript code generation for simple strategies
- Logical expression handling (AND/OR)
- Comparison operators
- Indicator and price references

### 🚧 In Progress

- Complete QSDL schema support
- Extended node type coverage
- More sophisticated code generation

### 📋 Planned

- Support for additional target languages (Python, Go, Rust)
- Advanced order types (stop-loss, take-profit, trailing stops)
- Position management code generation
- Code optimization passes
- Integration with latest QSDL schema versions
- Unit tests and validation
- CLI interface with options
- Code templates and customization

## Limitations (Current)

This is an **early-stage experimental project**:

- ⚠️ Only supports a subset of QSDL features
- ⚠️ JavaScript is the only target language
- ⚠️ Limited error handling
- ⚠️ Hardcoded strategy examples
- ⚠️ No validation of generated code
- ⚠️ Does not yet support latest QSDL schema versions
- ⚠️ No order execution or position management code

## Extending the Code Generator

### Adding a New Target Language

1. Create a new generator class extending `ABC`:

```python
class PythonGenerator(ABC):
    def __init__(self, ast: Dict[str, Any]):
        self.ast = ast

    def generate(self) -> str:
        # Implement Python code generation
        pass
```

2. Implement language-specific code generation methods

3. Update `main.py` to use your generator

### Adding New AST Node Types

1. Add to `NodeType` enum in `json_to_ast.py`:

```python
class NodeType(Enum):
    YOUR_NEW_NODE = "YourNewNode"
```

2. Implement transformation logic in `StrategyTransformer`

3. Handle the new node type in code generators

## Troubleshooting

### Import Errors

Ensure you're running from the project root and the virtual environment is activated:

```bash
source bin/activate
python src/main.py
```

### Missing AST File

If `transformed_ast.json` is missing, run `json_to_ast()` first in `main.py`.

### Code Generation Issues

Check that your AST structure matches expected format. Validate AST against node type definitions.

## Future Integration

This tool is designed to eventually integrate with:

- **QSDL Schema**: Support all QSDL v0.1.2+ features
- **Trading Platforms**: Generate platform-specific code (TradingView, MetaTrader, etc.)
- **Backtesting Engines**: Output code compatible with backtesting frameworks
- **Live Trading Systems**: Production-ready code with proper error handling

## Related Projects

- **qsdl/**: Latest QSDL schema and TypeScript interfaces
- **websocket-typescript/**: Interactive LLM-powered strategy creation demo

## Contributing

This is an experimental project. Contributions are welcome but expect significant API changes.

## License

ISC
