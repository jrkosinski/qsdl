# QSDL WebSocket TypeScript Demo

Interactive demo application for converting natural language trading strategy descriptions into structured QSDL JSON format using LLM APIs (OpenAI and Anthropic) wrapped in a WebSocket communication layer.

## Overview

This application provides a conversational interface for defining trading strategies. Users describe their strategies in natural language, and the LLM converts them into validated QSDL JSON that can be executed by trading systems.

## Features

- **Multi-turn Conversations**: Interactive dialogue with the LLM to refine strategy definitions
- **Dual LLM Support**: Integration with both OpenAI and Anthropic APIs
- **WebSocket Server/Client**: Real-time bidirectional communication layer
- **Schema Validation**: Automatic validation using AJV (JSON Schema validator)
- **Multiple Schema Versions**: Support for schema versions v0.0.1 through v0.1.2
- **Colored CLI Output**: Enhanced user experience with chalk-colored console messages
- **JSON Export**: Save generated strategies to files

## Project Structure

```
src/
├── index.ts              # Main entry point, application initialization
├── llms/
│   ├── index.ts          # LLM API wrappers (OpenAI, Anthropic)
│   └── conversation.ts   # Multi-turn conversation management
├── server/
│   └── websocket-server.ts   # WebSocket server for LLM communication
├── client/
│   └── websocket-client.ts   # WebSocket client implementation
├── schema/
│   ├── schema_v0.0.1.ts      # Initial schema version
│   ├── schema_v0.0.2.ts
│   ├── schema_v0.0.3.ts
│   ├── schema_v0.1.0.ts      # Major schema update
│   ├── schema_v0.1.1.ts
│   ├── schema_v0.1.2.ts      # Latest stable schema
│   ├── schemaCode_v0.1.1.ts  # TypeScript interfaces
│   └── schemaCode_v0.1.2.ts  # Latest TypeScript interfaces
├── examples/             # Example QSDL strategies
└── util/                # Utility functions
```

## Prerequisites

- Node.js v16 or higher
- Yarn or npm package manager
- OpenAI API key (optional)
- Anthropic API key (optional)

At least one API key is required to use the LLM features.

## Installation

```bash
# Install dependencies
yarn install
# or
npm install
```

## Configuration

Create a `.env` file in the root directory:

```env
# LLM API Keys (at least one required)
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...

# WebSocket Server Configuration (optional)
JWT_SECRET=your-secret-key-here
```

## Usage

### Running the Application

Start the development server:

```bash
yarn dev
# or
npm run dev
```

This will:
1. Start the WebSocket server on port 1077
2. Initialize the WebSocket client
3. Begin the interactive CLI conversation

### Building for Production

```bash
yarn build
# or
npm run build
```

Run the compiled application:

```bash
yarn serve
# or
npm run serve
```

## How It Works

### Conversation Flow

1. **User Input**: User describes their trading strategy in natural language
2. **LLM Processing**: The LLM asks clarifying questions and refines understanding
3. **Strategy Generation**: LLM generates QSDL JSON that conforms to the schema
4. **Validation**: The JSON is automatically validated against the schema
5. **Output**: Valid QSDL is saved to `output.json`

### Example Conversation

```
Question: What trading strategy would you like to create?

Answer: I want to buy when the 50-day SMA crosses above the 200-day SMA

💬 Message: I understand. A classic golden cross strategy. Let me ask a few
clarifying questions...

Question: Which symbol do you want to trade?

Answer: SPY

💬 Message: Got it. Generating your QSDL strategy...

[Generated QSDL JSON appears here]
```

## API Components

### LLM APIs

```typescript
// OpenAI integration
const openai = new OpenAILLMApi(apiKey);
const response = await openai.query(prompt);

// Anthropic integration
const anthropic = new AnthropicLLMApi(apiKey);
const response = await anthropic.query(prompt);
```

### Conversation Manager

```typescript
const conversation = new AnthropicConversation(inputModule);
const qsdlJson = await conversation.startConversation();
```

### WebSocket Server

```typescript
new WebsocketConversationServer({
    port: 1077,
    jwtSecret: process.env.JWT_SECRET || 'secret',
}).start();
```

### WebSocket Client

```typescript
const client = new WebsocketClient({
    url: 'http://localhost:1077',
});

client.onMessage(async (data) => {
    // Handle incoming messages
});

await client.connect();
```

## Schema Versions

The project maintains multiple schema versions for backward compatibility:

- **v0.0.x**: Initial schema iterations with basic structure
- **v0.1.0**: Major update with indicator registry system
- **v0.1.1**: Enhanced type definitions and validation rules
- **v0.1.2**: Current stable version with comprehensive indicator support

See the `src/schema/` directory for version-specific schemas. The latest schema is actively used by default.

## Testing

The application includes several test functions:

```bash
# Test schema validation
testSchemaValidation()

# Test OpenAI API
testOpenAI()

# Test Anthropic API
testAnthropic()

# Test multi-turn conversation
multiTurnConversationTestTest()
```

Uncomment the desired test in `index.ts` main function.

## Message Types

The WebSocket protocol supports the following message types:

- **`message`**: General informational messages
- **`prompt`**: User input requests
- **`question`**: LLM questions to the user
- **`stats`**: Usage statistics (tokens, cost, etc.)
- **`error`**: Error messages

## Output Format

Generated strategies are saved as JSON files conforming to the QSDL schema:

```json
{
  "name": "Strategy Name",
  "description": "Strategy description",
  "data": [...],
  "actions": [...],
  "position_limits": [...],
  "rules": [...]
}
```

## Dependencies

### Core Dependencies
- `ws` - WebSocket implementation
- `@anthropic-ai/sdk` - Anthropic API client
- `openai` - OpenAI API client
- `ajv` - JSON schema validator
- `ajv-formats` - Additional format validation

### CLI & UX
- `chalk` - Colored console output
- `prompts` - Interactive CLI prompts
- `dotenv` - Environment variable management

### Development
- `typescript` - TypeScript compiler
- `ts-node` - TypeScript execution
- `ts-node-dev` - Development server with hot reload

## Troubleshooting

### Connection Issues

If the WebSocket connection fails:
- Ensure port 1077 is available
- Check firewall settings
- Verify the server is running

### API Errors

If you encounter LLM API errors:
- Verify your API keys are valid
- Check your API rate limits
- Ensure you have sufficient credits

### Validation Errors

If schema validation fails:
- Check the generated JSON structure
- Verify all required fields are present
- Ensure data types match the schema

## Future Enhancements

- [ ] WebSocket authentication improvements
- [ ] Enhanced logging system
- [ ] Additional schema improvements
- [ ] Support for more LLM providers
- [ ] Strategy testing/backtesting integration
- [ ] Web UI for strategy creation

## Related Projects

- **qsdl/**: Latest QSDL schema and TypeScript interfaces
- **codegen-python/**: Experimental code generation from QSDL

## License

ISC
